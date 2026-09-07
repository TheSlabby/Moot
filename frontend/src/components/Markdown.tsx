import { Fragment, type ReactNode } from "react";

// Discord-subset markdown, rendered as React nodes (no dangerouslySetInnerHTML,
// so it's XSS-safe — all text goes through React's escaping).

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*)|(_[^_\s][^_]*_)|(https?:\/\/[^\s]+)/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  let key = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code key={key++} className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[13px] text-[#e6e6e6]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={key++} className="font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("__")) {
      out.push(<u key={key++}>{tok.slice(2, -2)}</u>);
    } else if (tok.startsWith("~~")) {
      out.push(<s key={key++} className="opacity-80">{tok.slice(2, -2)}</s>);
    } else if (tok.startsWith("*")) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith("_")) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    } else {
      out.push(
        <a key={key++} href={tok} target="_blank" rel="noopener noreferrer" className="text-[#00a8fc] hover:underline">
          {tok}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  // split out ```fenced code blocks```
  const parts = text.split(/```([\s\S]*?)```/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <pre
              key={i}
              className="my-1 overflow-x-auto rounded-md border border-black/30 bg-[#2b2d31] p-3 font-mono text-[13px] text-[#e6e6e6]"
            >
              <code>{part.replace(/^\n/, "")}</code>
            </pre>
          );
        }
        const lines = part.split("\n");
        return (
          <Fragment key={i}>
            {lines.map((line, li) => {
              if (line.startsWith("> ")) {
                return (
                  <div key={li} className="my-0.5 border-l-4 border-[#4f545c] pl-3 text-textNormal">
                    {renderInline(line.slice(2))}
                  </div>
                );
              }
              return (
                <div key={li} className="min-h-[1px]">
                  {renderInline(line)}
                </div>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}
