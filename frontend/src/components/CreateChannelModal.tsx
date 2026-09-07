import { useState } from "react";
import { useChat } from "../store/chat";
import Modal from "./Modal";

export default function CreateChannelModal({ guildId, onClose }: { guildId: string; onClose: () => void }) {
  const createChannel = useChat((s) => s.createChannel);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!n || busy) return;
    setBusy(true);
    try {
      await createChannel(guildId, n);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Create Channel" subtitle="Channels are where your conversations happen." onClose={onClose}>
      <div className="px-6 pt-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-textFaint">Channel name</label>
        <div className="flex items-center rounded-md bg-rail px-3 focus-within:ring-2 focus-within:ring-blurple">
          <span className="text-xl text-textFaint">#</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="new-channel"
            className="w-full bg-transparent px-2 py-2.5 text-sm text-textNormal outline-none"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 bg-rail/40 px-6 py-4">
        <button onClick={onClose} className="text-sm text-textMuted hover:underline">Cancel</button>
        <button
          onClick={submit}
          disabled={busy || !name.trim()}
          className="rounded-md bg-blurple px-6 py-2 text-sm font-medium text-white transition hover:bg-blurpleHover disabled:opacity-50"
        >
          {busy ? "…" : "Create Channel"}
        </button>
      </div>
    </Modal>
  );
}
