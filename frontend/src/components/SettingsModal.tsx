import { useState } from "react";
import { useChat } from "../store/chat";
import { useSession } from "../store/session";
import { useSettings, type Density } from "../store/settings";
import { colorFor, initials } from "./ui";

const COLOR_CHOICES = [
  "#5865f2", "#23a55a", "#eb459e", "#f0b232", "#e91e63",
  "#3498db", "#e67e22", "#9b59b6", "#1abc9c", "#e74c3c",
];

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const user = useSession((s) => s.user);
  const sessionId = useSession((s) => s.sessionId);
  const logout = useSession((s) => s.logout);
  const renameUser = useChat((s) => s.renameUser);

  const avatarColor = useSettings((s) => s.avatarColor);
  const density = useSettings((s) => s.density);
  const setAvatarColor = useSettings((s) => s.setAvatarColor);
  const setDensity = useSettings((s) => s.setDensity);

  const [name, setName] = useState(user?.username ?? "");
  const [saved, setSaved] = useState(false);

  const myColor = avatarColor ?? colorFor(user?.id ?? "0");

  function saveName() {
    const n = name.trim();
    if (n && n !== user?.username) {
      renameUser(n);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="animate-modalIn w-full max-w-lg overflow-hidden rounded-xl bg-chat shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/20 px-6 py-4">
          <h2 className="text-lg font-bold text-textNormal">User Settings</h2>
          <button onClick={onClose} className="rounded px-2 py-1 text-textMuted hover:bg-hover hover:text-textNormal">✕</button>
        </div>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-5">
          {/* profile preview */}
          <div className="flex items-center gap-3">
            <span
              className="grid h-14 w-14 place-items-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: myColor }}
            >
              {initials(name || user?.username || "?")}
            </span>
            <div>
              <div className="text-base font-semibold text-textNormal">{user?.username}</div>
              <div className="text-xs text-textFaint">id {user?.id}</div>
            </div>
          </div>

          {/* username */}
          <section>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-textFaint">Username</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="flex-1 rounded-md bg-rail px-3 py-2 text-sm text-textNormal outline-none focus:ring-2 focus:ring-blurple"
              />
              <button
                onClick={saveName}
                className="rounded-md bg-blurple px-4 py-2 text-sm font-medium text-white transition hover:bg-blurpleHover"
              >
                {saved ? "Saved ✓" : "Save"}
              </button>
            </div>
            <p className="mt-1 text-xs text-textFaint">Changes broadcast live to everyone.</p>
          </section>

          {/* avatar color (client-side) */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textFaint">Avatar color</label>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_CHOICES.map((c) => (
                <button
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  className={"h-8 w-8 rounded-full transition " + (myColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-chat" : "")}
                  style={{ backgroundColor: c }}
                />
              ))}
              <button
                onClick={() => setAvatarColor(null)}
                className="rounded-md border border-divider px-2 py-1 text-xs text-textMuted hover:bg-hover"
              >
                Reset
              </button>
            </div>
            <p className="mt-1 text-xs text-textFaint">Only affects how you see your own avatar (saved locally).</p>
          </section>

          {/* message density (client-side) */}
          <section>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-textFaint">Message display</label>
            <div className="flex gap-2">
              {(["cozy", "compact"] as Density[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDensity(d)}
                  className={
                    "flex-1 rounded-md border px-3 py-2 text-sm capitalize transition " +
                    (density === d ? "border-blurple bg-blurple/15 text-textNormal" : "border-divider text-textMuted hover:bg-hover")
                  }
                >
                  {d}
                </button>
              ))}
            </div>
          </section>

          {/* account */}
          <section className="border-t border-black/20 pt-4">
            <div className="mb-2 text-xs text-textFaint">session: {sessionId}</div>
            <button
              onClick={() => { logout(); onClose(); }}
              className="rounded-md bg-danger/90 px-4 py-2 text-sm font-medium text-white transition hover:bg-danger"
            >
              Log out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
