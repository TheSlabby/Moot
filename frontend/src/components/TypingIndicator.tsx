import { useChat } from "../store/chat";

export default function TypingIndicator() {
  const channelId = useChat((s) => s.selectedChannelId);
  const typing = useChat((s) => s.typing[channelId]);

  const names = typing ? Object.values(typing).map((t) => t.name) : [];
  if (names.length === 0) return <div className="h-4" />; // reserve space

  let text: string;
  if (names.length === 1) text = `${names[0]} is typing…`;
  else if (names.length === 2) text = `${names[0]} and ${names[1]} are typing…`;
  else text = "Several people are typing…";

  return (
    <div className="flex h-4 items-center gap-1 px-1 pt-1 text-xs text-textMuted">
      <span className="flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-textMuted [animation-delay:-0.3s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-textMuted [animation-delay:-0.15s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-textMuted" />
      </span>
      <span className="font-medium">{text}</span>
    </div>
  );
}
