# Moot

A self-hosted Discord alternative. Hand-written C++20 gateway (Boost.Beast/Asio)
+ a React/TypeScript/Vite frontend. Single WebSocket, opcode-tagged JSON protocol;
HTTP only for file bytes (avatars, guild icons, image messages).

## Build & run

**Backend** (C++20, needs Boost 1.81+ with the `json` component, CMake 3.16+):
```bash
cmake -B build            # first time / after CMakeLists changes (fetches SQLiteCpp)
cmake --build build       # compile
./build/moot              # listens on :8080 (WS + HTTP)
```

**Frontend** (Node 18+):
```bash
cd frontend
npm install
npm run dev               # Vite on :5173, proxies /upload + /files to :8080
npm run build             # tsc -b && vite build (typecheck + bundle)
```

Run both, open http://localhost:5173. Dev logins: **walker** (`dev-token-walker`)
and **alice** (`dev-token-alice`), or create an account (no password yet).

## Architecture (backend)

Single binary, single port, single acceptor. Every connection is an HTTP request;
`websocket::is_upgrade(req)` branches WS-gateway vs plain HTTP.

- **`Gateway`** (`Gateway.{hpp,cpp}`) — owns the acceptor + connection lifecycle.
  One strand per connection (`make_strand` at accept). Reads frames, dispatches by
  `op`. Also serves the **HTTP surface**: `POST /upload?token=…` (raw image body →
  `uploads/<rand>.<ext>`, returns `/files/<name>`) and `GET /files/<name>`.
- **`Handlers`** (`Handlers.{hpp,cpp}`) — one function per op, registered in
  `dispatchMap`. Each: parse `frame.at("d")`, hop to the DB pool, DB call,
  `reply()` (echoes `ref`) or `ctx.bus.publish()` a broadcast event. `reply()` +
  `msgJson()` are shared helpers.
- **`Bus`** (`Bus.{hpp,cpp}`) — holds `weak_ptr<Session>` subscribers; `publish()`
  fans a serialized frame out to all (broadcast-to-all for now; per-channel topics
  later). `onlineUsers()` powers presence. Resilient to a dead socket.
- **`Database`** (`Database.{hpp,cpp}`, schema in `Schema.hpp`) — SQLiteCpp over
  SQLite (WAL). Schema created on startup; column additions done via `ALTER TABLE`
  migrations in the constructor (data-preserving).
- **`AppContext`** — `{ Database&, thread_pool& dbPool, Bus& }`, created in `main`,
  injected everywhere (no globals).
- **`Session`** — per-connection state: `ws`, `userID`, `username`, `avatar`,
  `status`. Owned by the connection coroutine, observed via `weak_ptr` in the Bus.

### Critical backend rules
- **Never call SQLite on the io_context thread.** DB work goes through
  `co_await asio::co_spawn(ctx.dbPool, [...]{ ... }, use_awaitable)` — the lambda
  runs on the pool, then you resume back on the session strand automatically.
  Capture inputs **by value**; never touch `session`/`ws` from inside the lambda.
- **One write at a time per socket** — all writes to a session go through the read
  loop / Bus on its strand. Two concurrent `async_write`s is UB.
- **ids are strings on the wire** (`std::to_string` out, `std::stoll` in). JS loses
  precision on 64-bit numbers.
- `auto_fragment(false)` on the ws so JSON goes as single frames.

## Architecture (frontend, `frontend/src/`)

- **`ws/Connection.ts`** — the raw WebSocket client (the API *is* the protocol; no
  socket.io). `send(op,d)`, `sendAndWait(op,d,[ops])` (matches reply by op),
  `on(op, fn)` dispatch, status/log listeners, heartbeat, auto-reconnect (+re-IDENTIFY).
- **`ws/bootstrap.ts`** — `initWs()` maps inbound ops → store actions (mirror of the
  C++ dispatch map). `ws/api.ts` — `uploadFile()` (POST to `/upload`).
- **`protocol/`** — `ops.ts` (op-name consts), `frames.ts` (typed frames; ids as strings).
- **`store/`** (Zustand) — `chat.ts` (guilds/channels/messages/members/presence/
  pins/typing/unread + all actions & event handlers), `session.ts` (user + token,
  token persisted to localStorage for auto-login), `settings.ts` (theme/avatar
  color/density, localStorage), `debug.ts` (frame log), `mock.ts` (types + a little
  seed used pre-READY).
- **`components/`** — Discord-style UI: `GuildRail`, `ChannelSidebar`, `ChatArea`,
  `MessageList`, `Composer`, `MemberList`, `HomeView`, `Login`, plus `Modal`,
  `Markdown` (safe subset renderer), `Avatar`, `SettingsModal`, `CreateGuildModal`,
  `CreateChannelModal`, `ProfilePopout`, `TypingIndicator`. `debug/FrameInspector`.

### Critical frontend rules
- **Zustand selectors must not return a fresh object/array each call** (e.g.
  `s.pins[id] ?? []`) — it trips `useSyncExternalStore` into an infinite loop
  (blank screen). Use a stable module-level empty constant, or select raw + `useMemo`.
- **Theming is CSS variables**: palette tokens in `index.css` (`:root` = default,
  `[data-theme="fantasy"]` = fantasy), Tailwind colors map to `var(--…)`. Add a
  theme = one `THEMES` entry (`store/settings.ts`) + one `[data-theme]` block.
- Message/avatar images use relative `/files/…` URLs (same-origin via the Vite proxy).

## Wire protocol

Full spec in **`PROTOCOL.md`**. Envelope: `{ op, d, ref?, seq? }`. Flow:
connect → `HELLO` → `IDENTIFY`/`REGISTER` → `READY` (guilds+channels+members+online) →
event stream. Ops include MESSAGE_CREATE/EDIT/DELETE, REACTION_ADD/REMOVE, TYPING,
PRESENCE, PIN/UNPIN/GET_PINS, SET_STATUS/SET_AVATAR/SET_GUILD_ICON, USER_UPDATE,
GUILD/CHANNEL_CREATE, GUILD_JOIN, HISTORY. Fanout is broadcast-to-all; the client
filters by `channel_id`.

## Testing

No formal test suite. Headless checks are done with small stdlib-only Python WS
clients (see git history / scratchpad). **Gotchas when writing one:** mask
client→server frames, and use extended length encoding for payloads ≥126 bytes.
The DB (`moot.sqlite`) and `uploads/` are gitignored; the DB is seeded with guilds
Moot HQ / C++ Wizards / Gamers (ids 10–12), channels 20–25, walker+alice as members.

## Conventions
- Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Keep `PROTOCOL.md`, `SCHEMA.md`, and this file in sync when ops/schema change.
- Deferred: real auth, per-channel fanout topics, the outbox/backpressure write-loop,
  RESUME replay, roles/permissions, DMs, voice.
