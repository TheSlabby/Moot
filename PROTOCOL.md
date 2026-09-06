# Moot Wire Protocol (v1)

Custom, opcode-tagged JSON over a **single WebSocket**. HTTP is only for file
bytes (attachments, avatars) — everything interactive is a frame on this socket.

## Envelope

Every frame is a JSON object with the same top-level shape. Only `d` varies.

```jsonc
{
  "op":  "MESSAGE_CREATE",   // string discriminator — always present
  "d":   { ... },            // payload object — shape defined per op
  "ref": "c7",               // optional: correlate a request to its response
  "seq": 42                  // optional: sequence number on server->client events
}
```

Rules:
- `op` is **always present** and **always a string**. It is the dispatch key.
- `d` is **always an object** (never a bare value), even for single-field payloads.
- `ref` is set by the client on a request; the server **echoes it** on the response.
- `seq` appears on server→client **events** only; it increments per session and
  is what a future RESUME replays from.
- **Ids are sent as strings** (`"id": "1001"`), not numbers. JSON numbers are
  64-bit floats in JavaScript and lose precision above 2^53; strings are safe.
- Unknown fields are **ignored**, not errors — this lets the protocol add fields
  without breaking older clients.

## Connection lifecycle

```
connect
  -> server: HELLO
  <- client: IDENTIFY (with token)
  -> server: READY (session_id, user)
  ... event stream ...
```

Until IDENTIFY succeeds the connection is **anonymous**: the only op the server
accepts is IDENTIFY. Any other op before READY -> ERROR / close.

---

## Ops

### HELLO — server → client
Sent immediately on connect. Tells the client how often to heartbeat.
```jsonc
{"op": "HELLO", "d": {"heartbeat_interval": 30000}}
```

### IDENTIFY — client → server
Authenticate. `resolveToken(token)` maps the token to a user.
```jsonc
{"op": "IDENTIFY", "ref": "c1", "d": {"token": "dev-token-walker"}}
```

### READY — server → client
Response to a successful IDENTIFY. `session_id` is ours, used by RESUME later.
```jsonc
{"op": "READY", "ref": "c1", "d": {
    "session_id": "abc123",
    "user": {"id": "1", "username": "walker"}
}}
```

### HEARTBEAT — client → server / HEARTBEAT_ACK — server → client
Keepalive. Client sends HEARTBEAT every `heartbeat_interval` ms; server acks.
```jsonc
{"op": "HEARTBEAT"}
{"op": "HEARTBEAT_ACK"}
```

### GUILD_CREATE — client → server
Create a guild. Server calls `createGuild(user_id, name)` (which also adds the
owner as a member). Responds with the created guild.
```jsonc
// request
{"op": "GUILD_CREATE", "ref": "c2", "d": {"name": "My Server"}}
// response
{"op": "GUILD_CREATE", "ref": "c2", "d": {"id": "10", "name": "My Server", "owner_id": "1"}}
```

### CHANNEL_CREATE — client → server
Create a channel in a guild. `createChannel(guild_id, name)`.
```jsonc
{"op": "CHANNEL_CREATE", "ref": "c3", "d": {"guild_id": "10", "name": "general"}}
{"op": "CHANNEL_CREATE", "ref": "c3", "d": {"id": "20", "guild_id": "10", "name": "general"}}
```

### GUILD_JOIN — client → server
Join an existing guild. `joinGuild(user_id, guild_id)` (idempotent).
```jsonc
{"op": "GUILD_JOIN", "ref": "c4", "d": {"guild_id": "10"}}
{"op": "GUILD_JOIN", "ref": "c4", "d": {"guild_id": "10", "status": "ok"}}
```

### MESSAGE_CREATE — client → server
Send a message. `insertMessage(channel_id, user_id, content)`, then broadcast a
`MESSAGE` event to everyone subscribed to that channel.
- `nonce` is client-chosen, echoed back so the sender can match/dedupe on retry.
```jsonc
{"op": "MESSAGE_CREATE", "ref": "c5", "d": {
    "channel_id": "20", "content": "hi", "nonce": "n-88"
}}
```

### MESSAGE_ACK — server → client (sender only)
Confirms the create to the sender, carrying the new id and the echoed nonce.
```jsonc
{"op": "MESSAGE_ACK", "ref": "c5", "d": {"id": "1001", "nonce": "n-88"}}
```

### MESSAGE — server → client (event, broadcast)
The message, delivered to all channel subscribers (including the sender).
Carries `seq`; no `ref` (nobody asked for it individually).
```jsonc
{"op": "MESSAGE", "seq": 42, "d": {
    "id": "1001", "channel_id": "20", "author_id": "1", "content": "hi", "nonce": "n-88"
}}
```

### HISTORY — client → server / HISTORY response
Paginate a channel's messages. `messagesBefore(channel_id, before, limit)`.
- `before` is a message id cursor; omit (or use the max) for the latest page.
- Results are newest-first.
```jsonc
{"op": "HISTORY", "ref": "c6", "d": {"channel_id": "20", "before": "1001", "limit": 50}}
{"op": "HISTORY", "ref": "c6", "d": {"channel_id": "20", "messages": [
    {"id": "1000", "channel_id": "20", "author_id": "2", "content": "hey"},
    {"id": "999",  "channel_id": "20", "author_id": "1", "content": "yo"}
]}}
```

### ERROR — server → client
Any failed request. Echoes the offending request's `ref` when there was one.
```jsonc
{"op": "ERROR", "ref": "c5", "d": {"code": "not_a_member", "message": "You are not in that channel"}}
```

---

## Conventions

- **Request vs event are distinct.** A request (`MESSAGE_CREATE`) has `ref` and
  gets a response to that one client. An event (`MESSAGE`) has `seq` and is
  broadcast. Do not overload one op for both.
- **Every request can produce an ERROR** with the same `ref`.
- **Additive changes are safe** (new optional fields). Removing, renaming, or
  retyping a field is breaking and needs a protocol version bump.

## Not in v1

Presence, typing indicators, message edit/delete, reactions, RESUME replay
(the `seq`/`session_id` groundwork is here but replay isn't implemented yet),
permissions/roles, DMs, voice.
