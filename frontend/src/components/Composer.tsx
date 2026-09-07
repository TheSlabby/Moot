import { useMemo, useRef, useState } from "react";
import { useChat, type MemberInfo } from "../store/chat";
import { useSession } from "../store/session";
import { uploadFile } from "../ws/api";
import TypingIndicator from "./TypingIndicator";

const EMOJIS = ["😀","😂","😍","😎","😭","😡","👍","👎","🙏","👏","🔥","🎉","❤️","💯","🚀","⚡","👀","🤔","💀","✨","☕","🌙","✅","❌"];
const NO_MEMBERS: MemberInfo[] = []; // stable ref so the selector doesn't loop

export default function Composer() {
  const channelId = useChat((s) => s.selectedChannelId);
  const channel = useChat((s) => s.channels.find((c) => c.id === channelId));
  const guildId = useChat((s) => s.selectedGuildId);
  const members = useChat((s) => s.guildMembers[guildId] ?? NO_MEMBERS);
  const sendMessage = useChat((s) => s.sendMessage);
  const sendTyping = useChat((s) => s.sendTyping);
  const replyingTo = useChat((s) => s.replyingTo);
  const setReplyingTo = useChat((s) => s.setReplyingTo);
  const user = useSession((s) => s.user);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const url = await uploadFile(file);
    setUploading(false);
    if (url) setAttachment(url);
  }

  // @mention autocomplete on the trailing @token
  const mentionQuery = useMemo(() => {
    const m = /@(\w*)$/.exec(text);
    return m ? m[1].toLowerCase() : null;
  }, [text]);
  const mentionMatches = useMemo(
    () => (mentionQuery === null ? [] : members.filter((mm) => mm.username.toLowerCase().startsWith(mentionQuery)).slice(0, 6)),
    [mentionQuery, members]
  );

  function submit() {
    const content = text.trim();
    if ((!content && !attachment) || !user) return;
    sendMessage(channelId, content, replyingTo?.id, attachment ?? undefined);
    setText("");
    setAttachment(null);
    setReplyingTo(null);
    setShowEmoji(false);
  }
  function pickMention(name: string) {
    setText((t) => t.replace(/@\w*$/, "@" + name + " "));
  }

  return (
    <div className="relative px-4 pb-6">
      {/* reply bar */}
      {replyingTo && (
        <div className="animate-slideUp flex items-center gap-2 rounded-t-lg bg-rail/70 px-4 py-1.5 text-xs text-textMuted">
          <span>Replying to <span className="font-medium text-textNormal">{replyingTo.authorName}</span></span>
          <span className="truncate opacity-70">{replyingTo.content}</span>
          <button onClick={() => setReplyingTo(null)} className="ml-auto rounded px-1 hover:text-textNormal">✕</button>
        </div>
      )}

      {/* mention autocomplete */}
      {mentionMatches.length > 0 && (
        <div className="animate-popIn absolute bottom-full left-4 mb-1 w-64 overflow-hidden rounded-md border border-divider bg-sidebar shadow-lg">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase text-textFaint">Members</div>
          {mentionMatches.map((mm) => (
            <button
              key={mm.id}
              onClick={() => pickMention(mm.username)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-textNormal hover:bg-hover"
            >
              @{mm.username}
            </button>
          ))}
        </div>
      )}

      {/* emoji picker */}
      {showEmoji && (
        <div className="animate-popIn absolute bottom-full right-4 mb-1 grid w-64 grid-cols-8 gap-1 rounded-md border border-divider bg-sidebar p-2 shadow-lg">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => { setText((t) => t + e); }}
              className="grid h-8 w-8 place-items-center rounded text-lg leading-none hover:bg-hover"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* pending image attachment */}
      {(attachment || uploading) && (
        <div className="animate-slideUp flex items-center gap-3 rounded-t-lg bg-rail/70 px-4 py-2">
          {uploading ? (
            <span className="text-xs text-textMuted">Uploading…</span>
          ) : (
            <>
              <img src={attachment!} alt="" className="h-14 w-14 rounded object-cover" />
              <span className="text-xs text-textMuted">Image attached</span>
              <button onClick={() => setAttachment(null)} className="ml-auto rounded px-2 py-1 text-textMuted hover:text-danger">✕</button>
            </>
          )}
        </div>
      )}

      <div className={"flex items-center gap-3 bg-chatInput px-4 " + (replyingTo || attachment || uploading ? "rounded-b-lg" : "rounded-lg")}>
        <button
          onClick={() => fileInput.current?.click()}
          title="Upload an image"
          className="text-2xl text-textMuted transition hover:text-textNormal"
        >
          +
        </button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFileChosen} />
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); if (e.target.value) sendTyping(channelId); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            if (e.key === "Escape" && replyingTo) setReplyingTo(null);
          }}
          placeholder={`Message #${channel?.name ?? ""}`}
          className="flex-1 bg-transparent py-3 text-[15px] text-textNormal outline-none placeholder:text-textFaint"
        />
        <button
          onClick={() => setShowEmoji((v) => !v)}
          className="text-xl text-textMuted transition hover:text-textNormal"
          title="Emoji"
        >
          😊
        </button>
      </div>
      <TypingIndicator />
    </div>
  );
}
