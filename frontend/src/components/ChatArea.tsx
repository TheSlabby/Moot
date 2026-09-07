import { useState } from "react";
import { useChat, type Message } from "../store/chat";
import { useDebug } from "../store/debug";
import MessageList from "./MessageList";
import Composer from "./Composer";
import Markdown from "./Markdown";

const NO_PINS: Message[] = []; // stable ref so the selector doesn't loop

export default function ChatArea() {
  const channelId = useChat((s) => s.selectedChannelId);
  const channel = useChat((s) => s.channels.find((c) => c.id === channelId));
  const pins = useChat((s) => s.pins[channelId] ?? NO_PINS);
  const toggleDebug = useDebug((s) => s.toggle);
  const [showPins, setShowPins] = useState(false);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-chat">
      {/* channel header */}
      <div className="relative flex h-12 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <span className="text-2xl leading-none text-textFaint">#</span>
        <span className="font-semibold text-textNormal">{channel?.name}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowPins((v) => !v)}
            title="Pinned messages"
            className="rounded px-2 py-1 text-xs text-textMuted transition hover:bg-hover hover:text-textNormal"
          >
            📌 {pins.length > 0 && <span className="font-semibold">{pins.length}</span>}
          </button>
          <button
            onClick={toggleDebug}
            title="Toggle raw frame inspector"
            className="rounded px-2 py-1 text-xs text-textMuted transition hover:bg-hover hover:text-textNormal"
          >
            ⚡ frames
          </button>
        </div>

        {/* pins popover */}
        {showPins && (
          <div className="animate-dropIn absolute right-3 top-12 z-20 w-80 overflow-hidden rounded-lg border border-divider bg-sidebar shadow-2xl">
            <div className="border-b border-black/20 px-3 py-2 text-sm font-semibold text-textNormal">Pinned Messages</div>
            <div className="max-h-96 overflow-y-auto p-2">
              {pins.length === 0 ? (
                <div className="p-4 text-center text-sm text-textFaint">No pinned messages yet.</div>
              ) : (
                pins.map((m) => (
                  <div key={m.id} className="mb-1 rounded-md bg-chat p-2">
                    <div className="text-xs font-medium text-textNormal">{m.authorName}</div>
                    <div className="text-sm text-textMuted"><Markdown text={m.content} /></div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <MessageList />
      <Composer />
    </div>
  );
}
