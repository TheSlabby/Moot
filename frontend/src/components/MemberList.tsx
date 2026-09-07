import { useChat } from "../store/chat";
import { initials } from "./ui";

export default function MemberList() {
  const members = useChat((s) => s.members);
  const online = members.filter((m) => m.online);
  const offline = members.filter((m) => !m.online);

  return (
    <div className="hidden w-60 flex-col bg-sidebar px-3 py-4 lg:flex">
      <Section title={`Online — ${online.length}`} members={online} />
      {offline.length > 0 && (
        <Section title={`Offline — ${offline.length}`} members={offline} faded />
      )}
    </div>
  );
}

function Section({
  title,
  members,
  faded,
}: {
  title: string;
  members: { id: string; username: string; color: string }[];
  faded?: boolean;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-textFaint">
        {title}
      </div>
      {members.map((m) => (
        <div
          key={m.id}
          className={
            "flex items-center gap-2 rounded px-2 py-1 transition hover:bg-hover " +
            (faded ? "opacity-40" : "")
          }
        >
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: m.color }}
          >
            {initials(m.username)}
          </span>
          <span className="text-[15px] text-textNormal">{m.username}</span>
        </div>
      ))}
    </div>
  );
}
