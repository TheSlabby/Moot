import { useEffect, useMemo, useRef } from "react";
import { useChat } from "../store/chat";
import { formatDayTime, formatTime, initials, userFor } from "./ui";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export default function MessageList() {
  const channelId = useChat((s) => s.selectedChannelId);
  const allMessages = useChat((s) => s.messages);
  const channel = useChat((s) => s.channels.find((c) => c.id === channelId));
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(
    () =>
      allMessages
        .filter((m) => m.channelId === channelId)
        .sort((a, b) => a.ts - b.ts),
    [allMessages, channelId]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, channelId]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      {/* channel intro */}
      <div className="pb-4 pt-6">
        <div className="mb-2 grid h-16 w-16 place-items-center rounded-full bg-active text-3xl text-textNormal">
          #
        </div>
        <h1 className="text-2xl font-bold text-textNormal">
          Welcome to #{channel?.name}
        </h1>
        <p className="text-sm text-textMuted">
          This is the start of the #{channel?.name} channel.
        </p>
      </div>

      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const author = userFor(m.authorId);
        const grouped =
          prev &&
          prev.authorId === m.authorId &&
          m.ts - prev.ts < GROUP_WINDOW_MS;

        return (
          <div
            key={m.id}
            className={
              "group flex gap-3 rounded px-2 hover:bg-black/10 " +
              (grouped ? "py-0.5" : "mt-4 py-0.5") +
              (m.pending ? " opacity-50" : "")
            }
          >
            {grouped ? (
              <div className="w-10 shrink-0 pt-0.5 text-right text-[10px] leading-5 text-textFaint opacity-0 group-hover:opacity-100">
                {formatTime(m.ts)}
              </div>
            ) : (
              <span
                className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: author.color }}
              >
                {initials(author.username)}
              </span>
            )}

            <div className="min-w-0 flex-1">
              {!grouped && (
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-textNormal">
                    {author.username}
                  </span>
                  <span className="text-xs text-textFaint">
                    {formatDayTime(m.ts)}
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap break-words text-[15px] text-textNormal">
                {m.content}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
