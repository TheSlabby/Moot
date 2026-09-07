import { useState } from "react";
import { conn, WS_URL } from "../ws/Connection";
import { ServerOp } from "../protocol/ops";
import { useSession } from "../store/session";
import type { Ready, ErrorFrame } from "../protocol/frames";

const DEV_USERS = [
  { name: "walker", token: "dev-token-walker", color: "#5865f2" },
  { name: "alice", token: "dev-token-alice", color: "#23a55a" },
];

// local token -> display name (READY doesn't include username yet)
const NAME_BY_TOKEN: Record<string, string> = {
  "dev-token-walker": "walker",
  "dev-token-alice": "alice",
};

export default function Login() {
  const login = useSession((s) => s.login);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function identify(tok: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!conn.isOpen()) await conn.connect(WS_URL);
      const resp = await conn.sendAndWait(
        "IDENTIFY",
        { token: tok },
        [ServerOp.Ready, ServerOp.Error]
      );
      if (resp.op === ServerOp.Ready) {
        const d = (resp as Ready).d;
        login(
          {
            id: d.user.id,
            username: d.user.username ?? NAME_BY_TOKEN[tok] ?? "user" + d.user.id,
          },
          d.session_id
        );
      } else {
        const d = (resp as ErrorFrame).d;
        setError(d?.message ?? "Login failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#5865f2] to-[#404eed] p-4">
      <div className="w-full max-w-md rounded-lg bg-chat p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl font-bold text-white">Moot</div>
          <div className="text-sm text-textMuted">
            self-hosted, C++ backed. Log in to a seeded dev user.
          </div>
        </div>

        <div className="mb-4 space-y-2">
          {DEV_USERS.map((u) => (
            <button
              key={u.token}
              disabled={busy}
              onClick={() => identify(u.token)}
              className="flex w-full items-center gap-3 rounded-md bg-chatInput px-4 py-3 text-left transition hover:bg-active disabled:opacity-50"
            >
              <span
                className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: u.color }}
              >
                {u.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1">
                <span className="block font-medium text-textNormal">
                  Login as {u.name}
                </span>
                <span className="block text-xs text-textFaint">{u.token}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="my-4 flex items-center gap-3 text-xs uppercase text-textFaint">
          <div className="h-px flex-1 bg-divider" />
          or
          <div className="h-px flex-1 bg-divider" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (token.trim()) identify(token.trim());
          }}
          className="space-y-2"
        >
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="paste a token…"
            className="w-full rounded-md bg-rail px-3 py-2 text-sm text-textNormal outline-none ring-blurple/0 transition focus:ring-2 focus:ring-blurple"
          />
          <button
            type="submit"
            disabled={busy || !token.trim()}
            className="w-full rounded-md bg-blurple px-4 py-2 font-medium text-white transition hover:bg-blurpleHover disabled:opacity-50"
          >
            {busy ? "Connecting…" : "Connect"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-textFaint">
          gateway: <code className="text-textMuted">{WS_URL}</code>
        </div>
      </div>
    </div>
  );
}
