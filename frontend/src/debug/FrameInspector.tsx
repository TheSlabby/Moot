import { useDebug } from "../store/debug";
import { formatTime } from "../components/ui";

export default function FrameInspector() {
  const open = useDebug((s) => s.open);
  const log = useDebug((s) => s.log);
  const clear = useDebug((s) => s.clear);
  const toggle = useDebug((s) => s.toggle);

  if (!open) return null;

  return (
    <div className="flex w-96 flex-col border-l border-black/40 bg-rail">
      <div className="flex h-12 items-center gap-2 border-b border-black/20 px-3">
        <span className="font-semibold text-textNormal">Frame Inspector</span>
        <span className="text-xs text-textFaint">{log.length}</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={clear}
            className="rounded px-2 py-1 text-xs text-textMuted hover:bg-hover hover:text-textNormal"
          >
            clear
          </button>
          <button
            onClick={toggle}
            className="rounded px-2 py-1 text-xs text-textMuted hover:bg-hover hover:text-textNormal"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed">
        {log.length === 0 && (
          <div className="p-3 text-textFaint">
            no frames yet — log in or send a message
          </div>
        )}
        {log.map((e, i) => {
          const out = e.dir === "out";
          return (
            <div
              key={i}
              className={
                "mb-1 rounded px-2 py-1 " +
                (out ? "bg-blurple/10" : "bg-online/10")
              }
            >
              <div className="flex items-center gap-2">
                <span className={out ? "text-blurple" : "text-online"}>
                  {out ? "▲ out" : "▼ in"}
                </span>
                <span className="font-semibold text-textNormal">
                  {e.frame.op}
                </span>
                <span className="ml-auto text-textFaint">
                  {formatTime(e.at)}
                </span>
              </div>
              <pre className="mt-0.5 whitespace-pre-wrap break-all text-textMuted">
                {JSON.stringify(e.frame.d ?? {}, null, 0)}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}
