import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useChat, type Message } from "../store/chat";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import Markdown from "./Markdown";
import { colorFor, formatDayTime, formatDivider, formatTime, initials, QUICK_EMOJIS } from "./ui";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export default function MessageList() {
  const channelId = useChat((s) => s.selectedChannelId);
  const allMessages = useChat((s) => s.messages);
  const channel = useChat((s) => s.channels.find((c) => c.id === channelId));
  const toggleReaction = useChat((s) => s.toggleReaction);
  const editMessage = useChat((s) => s.editMessage);
  const deleteMessage = useChat((s) => s.deleteMessage);
  const loadMore = useChat((s) => s.loadMoreHistory);
  const myId = useSession((s) => s.user?.id);
  const avatarColor = useSettings((s) => s.avatarColor);
  const density = useSettings((s) => s.density);
  const colorOf = (id: string) => (id === myId && avatarColor ? avatarColor : colorFor(id));

  const messages = useMemo(
    () => allMessages.filter((m) => m.channelId === channelId).sort((a, b) => a.ts - b.ts),
    [allMessages, channelId]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const lastLoadMore = useRef(0);

  // keep pinned to bottom when already near bottom
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    nearBottom.current = true;
    setPickerFor(null);
    setEditing(null);
  }, [channelId]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottom.current = dist < 80;
    setShowJump(dist > 200);
    if (el.scrollTop < 60 && Date.now() - lastLoadMore.current > 800) {
      lastLoadMore.current = Date.now();
      loadMore(channelId);
    }
  }
  function jumpToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  function startEdit(m: Message) {
    setEditing(m.id);
    setEditText(m.content);
  }
  function saveEdit(m: Message) {
    const t = editText.trim();
    if (t && t !== m.content) editMessage(m.id, m.channelId, t);
    setEditing(null);
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto px-4 pb-4">
        {/* channel intro */}
        <div className="pb-4 pt-6">
          <div className="mb-2 grid h-16 w-16 place-items-center rounded-full bg-active text-3xl text-textNormal">#</div>
          <h1 className="text-2xl font-bold text-textNormal">Welcome to #{channel?.name}</h1>
          <p className="text-sm text-textMuted">This is the start of the #{channel?.name} channel.</p>
        </div>

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const sameDay = prev && new Date(prev.ts).toDateString() === new Date(m.ts).toDateString();
          const grouped = prev && sameDay && prev.authorId === m.authorId && m.ts - prev.ts < GROUP_WINDOW_MS && !editing;
          const mine = m.authorId === myId;

          return (
            <div key={m.id}>
              {!sameDay && (
                <div className="my-4 flex items-center gap-2 px-2 text-xs font-semibold text-textFaint">
                  <div className="h-px flex-1 bg-divider" />
                  <span>{formatDivider(m.ts)}</span>
                  <div className="h-px flex-1 bg-divider" />
                </div>
              )}

              <div
                className={
                  "group relative flex gap-3 rounded px-2 hover:bg-black/10 " +
                  (grouped
                    ? (density === "compact" ? "py-0" : "py-0.5")
                    : (density === "compact" ? "mt-1.5 py-0" : "mt-3 py-0.5")) +
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
                    style={{ backgroundColor: colorOf(m.authorId) }}
                  >
                    {initials(m.authorName)}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="font-medium text-textNormal">{m.authorName}</span>
                      <span className="text-xs text-textFaint">{formatDayTime(m.ts)}</span>
                    </div>
                  )}

                  {editing === m.id ? (
                    <div className="mt-1">
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(m); }
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-full resize-none rounded-md bg-chatInput px-3 py-2 text-[15px] text-textNormal outline-none"
                        rows={2}
                      />
                      <div className="mt-1 text-xs text-textFaint">
                        escape to <button className="text-[#00a8fc]" onClick={() => setEditing(null)}>cancel</button>
                        {" · "}enter to <button className="text-[#00a8fc]" onClick={() => saveEdit(m)}>save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="break-words text-[15px] leading-relaxed text-textNormal">
                      <Markdown text={m.content} />
                      {m.editedAt && <span className="ml-1 text-[10px] text-textFaint">(edited)</span>}
                    </div>
                  )}

                  {/* reactions */}
                  {m.reactions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.reactions.map((r) => (
                        <button
                          key={r.emoji}
                          onClick={() => toggleReaction(m.id, m.channelId, r.emoji, r.me)}
                          className={
                            "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition " +
                            (r.me
                              ? "border-blurple bg-blurple/20 text-textNormal"
                              : "border-transparent bg-black/20 text-textMuted hover:border-divider")
                          }
                        >
                          <span>{r.emoji}</span>
                          <span className="tabular-nums">{r.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* hover action bar — only for confirmed messages (pending ones
                    still have a temporary nonce id the server can't act on) */}
                {!m.pending && (
                  <div className="absolute -top-3 right-2 hidden items-center gap-0.5 rounded-md border border-divider bg-sidebar px-1 py-0.5 shadow-md group-hover:flex">
                    <button
                      title="Add reaction"
                      onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}
                      className="rounded px-1.5 py-0.5 text-textMuted hover:bg-hover hover:text-textNormal"
                    >
                      😊
                    </button>
                    {mine && (
                      <>
                        <button
                          title="Edit"
                          onClick={() => startEdit(m)}
                          className="rounded px-1.5 py-0.5 text-textMuted hover:bg-hover hover:text-textNormal"
                        >
                          ✎
                        </button>
                        <button
                          title="Delete"
                          onClick={() => deleteMessage(m.id, m.channelId)}
                          className="rounded px-1.5 py-0.5 text-textMuted hover:bg-hover hover:text-danger"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* emoji picker popover */}
                {pickerFor === m.id && !m.pending && (
                  <div className="absolute right-2 top-4 z-10 flex gap-1 rounded-md border border-divider bg-sidebar p-1.5 shadow-lg">
                    {QUICK_EMOJIS.map((e) => {
                      const mineEmoji = m.reactions.find((r) => r.emoji === e)?.me ?? false;
                      return (
                        <button
                          key={e}
                          onClick={() => { toggleReaction(m.id, m.channelId, e, mineEmoji); setPickerFor(null); }}
                          className="rounded p-1 text-lg hover:bg-hover"
                        >
                          {e}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showJump && (
        <button
          onClick={jumpToBottom}
          className="absolute bottom-3 right-4 rounded-full bg-blurple px-3 py-1.5 text-xs font-medium text-white shadow-lg transition hover:bg-blurpleHover"
        >
          ↓ Jump to present
        </button>
      )}
    </div>
  );
}
