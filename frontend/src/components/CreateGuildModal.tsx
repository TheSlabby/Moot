import { useState } from "react";
import { useChat } from "../store/chat";
import Modal from "./Modal";

export default function CreateGuildModal({ onClose }: { onClose: () => void }) {
  const createGuild = useChat((s) => s.createGuild);
  const joinGuild = useChat((s) => s.joinGuild);
  const [tab, setTab] = useState<"create" | "join">("create");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      if (tab === "create") await createGuild(v);
      else await joinGuild(v);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const creating = tab === "create";

  return (
    <Modal
      title={creating ? "Create your guild" : "Join a guild"}
      subtitle={creating ? "Your guild is where you and your friends hang out." : "Enter a guild id to join an existing one."}
      onClose={onClose}
    >
      <div className="px-6 pt-4">
        {/* tabs */}
        <div className="mb-4 flex gap-1 rounded-lg bg-rail p-1">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setValue(""); }}
              className={
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition " +
                (tab === t ? "bg-blurple text-white" : "text-textMuted hover:text-textNormal")
              }
            >
              {t}
            </button>
          ))}
        </div>

        {/* big icon */}
        <div className="mb-4 flex justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blurple text-3xl">
            {creating ? "✨" : "🔗"}
          </div>
        </div>

        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-textFaint">
          {creating ? "Guild name" : "Guild id"}
        </label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={creating ? "My Awesome Guild" : "e.g. 11"}
          inputMode={creating ? "text" : "numeric"}
          className="w-full rounded-md bg-rail px-3 py-2.5 text-sm text-textNormal outline-none focus:ring-2 focus:ring-blurple"
        />
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 bg-rail/40 px-6 py-4">
        <button onClick={onClose} className="text-sm text-textMuted hover:underline">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="rounded-md bg-blurple px-6 py-2 text-sm font-medium text-white transition hover:bg-blurpleHover disabled:opacity-50"
        >
          {busy ? "…" : creating ? "Create Guild" : "Join Guild"}
        </button>
      </div>
    </Modal>
  );
}
