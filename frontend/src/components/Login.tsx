import { useEffect, useRef, useState } from "react";
import { conn, WS_URL } from "../ws/Connection";
import { ServerOp } from "../protocol/ops";
import { useSession } from "../store/session";
import type { Ready, ErrorFrame, Registered } from "../protocol/frames";

const DEV_USERS = [
  { name: "walker", token: "dev-token-walker", color: "#5865f2" },
  { name: "alice", token: "dev-token-alice", color: "#23a55a" },
];
const NAME_BY_TOKEN: Record<string, string> = {
  "dev-token-walker": "walker",
  "dev-token-alice": "alice",
};

const SAVED_TOKEN = "moot.token";

export default function Login() {
  const login = useSession((s) => s.login);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  async function identify(tok: string, fallbackName?: string) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      if (!conn.isOpen()) await conn.connect(WS_URL);
      const resp = await conn.sendAndWait("IDENTIFY", { token: tok }, [ServerOp.Ready, ServerOp.Error]);
      if (resp.op === ServerOp.Ready) {
        const d = (resp as Ready).d;
        login(
          { id: d.user.id, username: d.user.username ?? NAME_BY_TOKEN[tok] ?? fallbackName ?? "user" + d.user.id, avatar: d.user.avatar || undefined },
          d.session_id,
          tok
        );
        conn.enableReconnect(tok);
        try { localStorage.setItem(SAVED_TOKEN, tok); } catch { /* ignore */ }
        return true;
      }
      setError((resp as ErrorFrame).d?.message ?? "Login failed");
      try { localStorage.removeItem(SAVED_TOKEN); } catch { /* ignore */ }
      return false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    const name = username.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (!conn.isOpen()) await conn.connect(WS_URL);
      const resp = await conn.sendAndWait("REGISTER", { username: name }, [ServerOp.Registered, ServerOp.Error]);
      if (resp.op === ServerOp.Registered) {
        const d = (resp as Registered).d;
        setBusy(false);
        await identify(d.token, d.username);
      } else {
        setError((resp as ErrorFrame).d?.message ?? "Could not create account");
        setBusy(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setBusy(false);
    }
  }

  // auto-login with a saved token (created accounts survive refresh)
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    let saved: string | null = null;
    try { saved = localStorage.getItem(SAVED_TOKEN); } catch { /* ignore */ }
    if (saved) identify(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#5865f2] to-[#404eed] p-4">
      <div className="w-full max-w-md rounded-lg bg-chat p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl font-bold text-white">Moot</div>
          <div className="text-sm text-textMuted">self-hosted, C++ backed.</div>
        </div>

        {/* tabs */}
        <div className="mb-5 flex gap-1 rounded-lg bg-rail p-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={"flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition " + (mode === m ? "bg-blurple text-white" : "text-textMuted hover:text-textNormal")}
            >
              {m === "login" ? "Log in" : "Create account"}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <>
            <div className="mb-4 space-y-2">
              {DEV_USERS.map((u) => (
                <button
                  key={u.token}
                  disabled={busy}
                  onClick={() => identify(u.token)}
                  className="flex w-full items-center gap-3 rounded-md bg-chatInput px-4 py-3 text-left transition hover:bg-active disabled:opacity-50"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: u.color }}>
                    {u.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="flex-1">
                    <span className="block font-medium text-textNormal">Login as {u.name}</span>
                    <span className="block text-xs text-textFaint">{u.token}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="my-4 flex items-center gap-3 text-xs uppercase text-textFaint">
              <div className="h-px flex-1 bg-divider" />or<div className="h-px flex-1 bg-divider" />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (token.trim()) identify(token.trim()); }} className="space-y-2">
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="paste a token…"
                className="w-full rounded-md bg-rail px-3 py-2 text-sm text-textNormal outline-none transition focus:ring-2 focus:ring-blurple"
              />
              <button type="submit" disabled={busy || !token.trim()} className="w-full rounded-md bg-blurple px-4 py-2 font-medium text-white transition hover:bg-blurpleHover disabled:opacity-50">
                {busy ? "Connecting…" : "Connect"}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); register(); }} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-textFaint">Username</label>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="pick a username"
                className="w-full rounded-md bg-rail px-3 py-2.5 text-sm text-textNormal outline-none transition focus:ring-2 focus:ring-blurple"
              />
            </div>
            <button type="submit" disabled={busy || !username.trim()} className="w-full rounded-md bg-blurple px-4 py-2.5 font-medium text-white transition hover:bg-blurpleHover disabled:opacity-50">
              {busy ? "Creating…" : "Create account"}
            </button>
            <p className="text-center text-xs text-textFaint">No password needed (yet) — you'll land in Moot HQ.</p>
          </form>
        )}

        {error && <div className="mt-4 rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">{error}</div>}
        <div className="mt-6 text-center text-xs text-textFaint">gateway: <code className="text-textMuted">{WS_URL}</code></div>
      </div>
    </div>
  );
}
