import { useMemo } from "react";
import { useChat, type MemberInfo } from "../store/chat";
import { colorFor, initials } from "./ui";

export default function MemberList() {
  const guildId = useChat((s) => s.selectedGuildId);
  const membersMap = useChat((s) => s.guildMembers);
  const onlineIds = useChat((s) => s.onlineIds);

  const members = useMemo(() => membersMap[guildId] ?? [], [membersMap, guildId]);
  const online = members.filter((m) => onlineIds.has(m.id));
  const offline = members.filter((m) => !onlineIds.has(m.id));

  return (
    <div className="hidden w-60 flex-col bg-sidebar px-3 py-4 lg:flex">
      <Section title={`Online — ${online.length}`} members={online} online />
      {offline.length > 0 && <Section title={`Offline — ${offline.length}`} members={offline} />}
    </div>
  );
}

function Section({ title, members, online }: { title: string; members: MemberInfo[]; online?: boolean }) {
  return (
    <div className="mb-4">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-textFaint">{title}</div>
      {members.map((m) => (
        <div
          key={m.id}
          className={"flex items-center gap-2 rounded px-2 py-1 transition hover:bg-hover " + (online ? "" : "opacity-40")}
        >
          <div className="relative">
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: colorFor(m.id) }}
            >
              {initials(m.username)}
            </span>
            <span
              className={
                "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar " +
                (online ? "bg-online" : "bg-textFaint")
              }
            />
          </div>
          <span className="text-[15px] text-textNormal">{m.username}</span>
        </div>
      ))}
    </div>
  );
}
