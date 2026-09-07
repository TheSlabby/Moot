import { useChat } from "../store/chat";
import { useDebug } from "../store/debug";
import MessageList from "./MessageList";
import Composer from "./Composer";

export default function ChatArea() {
  const channelId = useChat((s) => s.selectedChannelId);
  const channel = useChat((s) => s.channels.find((c) => c.id === channelId));
  const toggleDebug = useDebug((s) => s.toggle);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-chat">
      {/* channel header */}
      <div className="flex h-12 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <span className="text-2xl leading-none text-textFaint">#</span>
        <span className="font-semibold text-textNormal">{channel?.name}</span>
        <div className="ml-auto">
          <button
            onClick={toggleDebug}
            title="Toggle raw frame inspector"
            className="rounded px-2 py-1 text-xs text-textMuted transition hover:bg-hover hover:text-textNormal"
          >
            ⚡ frames
          </button>
        </div>
      </div>

      <MessageList />
      <Composer />
    </div>
  );
}
