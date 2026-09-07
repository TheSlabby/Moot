import { Fragment, useState, type ReactNode } from "react";
import { useSession } from "../store/session";

const EMOJI: Record<string, string> = {
  fire: "🔥", tada: "🎉", heart: "❤️", joy: "😂", "+1": "👍", "-1": "👎",
  eyes: "👀", rocket: "🚀", 100: "💯", thinking: "🤔", sob: "😭", smile: "😄",
  wave: "👋", pray: "🙏", clap: "👏", star: "⭐", check: "✅", x: "❌",
  sparkles: "✨", bug: "🐛", coffee: "☕", moon: "🌙", zap: "⚡", skull: "💀",
  cool: "😎", wink: "😉", cry: "😢", angry: "😠", ok: "🆗", warning: "⚠️",
};

function shortcodes(text: string): string {
  return text.replace(/:([a-z0-9_+-]+):/gi, (m, name) => EMOJI[name.toLowerCase()] ?? m);
}

const INLINE =
  /(\|\|[^|]+\|\|)|(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(@[A-Za-z0-9_]+)|(https?:\/\/[^\s]+)/g;

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <span
      onClick={() => setShown(true)}
      className={
        "cursor-pointer rounded px-1 transition " +
        (shown ? "bg-black/30 text-textNormal" : "select-none bg-[#1e1f22] text-transparent")
      }
      title={shown ? undefined : "Spoiler — click to reveal"}
    >
      {children}
    </span>
  );
}

function renderInline(text: string, myName?: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let key = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("||")) {
      out.push(<Spoiler key={key++}>{tok.slice(2, -2)}</Spoiler>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key++} className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[13px] text-[#e6e6e6]">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      out.push(<strong key={key++} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("__")) {
      out.push(<u key={key++}>{tok.slice(2, -2)}</u>);
    } else if (tok.startsWith("~~")) {
      out.push(<s key={key++} className="opacity-80">{tok.slice(2, -2)}</s>);
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("@")) {
      const name = tok.slice(1);
      const isMe = myName && name.toLowerCase() === myName.toLowerCase();
      out.push(
        <span key={key++} className={"rounded px-1 font-medium " + (isMe ? "bg-blurple/40 text-white" : "bg-blurple/20 text-[#c9cdfb]")}>
          @{name}
        </span>
      );
    } else {
      out.push(<a key={key++} href={tok} target="_blank" rel="noopener noreferrer" className="text-[#00a8fc] hover:underline">{tok}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  const myName = useSession((s) => s.user?.username);
  const parts = shortcodes(text).split(/```([\s\S]*?)```/);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <pre key={i} className="my-1 overflow-x-auto rounded-md border border-black/30 bg-[#2b2d31] p-3 font-mono text-[13px] text-[#e6e6e6]">
              <code>{part.replace(/^\n/, "")}</code>
            </pre>
          );
        }
        const lines = part.split("\n");
        return (
          <Fragment key={i}>
            {lines.map((line, li) => {
              const h = /^(#{1,3})\s+(.*)$/.exec(line);
              if (h) {
                const size = h[1].length === 1 ? "text-xl" : h[1].length === 2 ? "text-lg" : "text-base";
                return <div key={li} className={`mt-1 font-bold text-textNormal ${size}`}>{renderInline(h[2], myName)}</div>;
              }
              if (/^[-*]\s+/.test(line)) {
                return (
                  <div key={li} className="flex gap-2 pl-1">
                    <span className="text-textFaint">•</span>
                    <span>{renderInline(line.replace(/^[-*]\s+/, ""), myName)}</span>
                  </div>
                );
              }
              if (line.startsWith("> ")) {
                return <div key={li} className="my-0.5 border-l-4 border-[#4f545c] pl-3 text-textNormal">{renderInline(line.slice(2), myName)}</div>;
              }
              return <div key={li} className="min-h-[1px]">{renderInline(line, myName)}</div>;
            })}
          </Fragment>
        );
      })}
    </>
  );
}
