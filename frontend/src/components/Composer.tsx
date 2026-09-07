import { useState } from "react";
import { useChat } from "../store/chat";
import { useSession } from "../store/session";

export default function Composer() {
  const channelId = useChat((s) => s.selectedChannelId);
  const channel = useChat((s) => s.channels.find((c) => c.id === channelId));
  const sendMessage = useChat((s) => s.sendMessage);
  const user = useSession((s) => s.user);
  const [text, setText] = useState("");

  function submit() {
    const content = text.trim();
    if (!content || !user) return;
    sendMessage(channelId, user.id, content);
    setText("");
  }

  return (
    <div className="px-4 pb-6">
      <div className="flex items-center gap-3 rounded-lg bg-chatInput px-4">
        <button className="text-2xl text-textMuted transition hover:text-textNormal">
          +
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Message #${channel?.name ?? ""}`}
          className="flex-1 bg-transparent py-3 text-[15px] text-textNormal outline-none placeholder:text-textFaint"
        />
      </div>
      <div className="mt-1 px-1 text-[11px] text-textFaint">
        sends a real <code>MESSAGE_CREATE</code> frame · optimistic until the
        server broadcasts it back
      </div>
    </div>
  );
}
