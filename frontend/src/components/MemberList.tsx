import { useMemo, useState } from "react";
import { useChat, type MemberInfo } from "../store/chat";
import ProfilePopout from "./ProfilePopout";
import Avatar from "./Avatar";
import { statusColor } from "./ui";

export default function MemberList() {
  const guildId = useChat((s) => s.selectedGuildId);
  const membersMap = useChat((s) => s.guildMembers);
  const onlineIds = useChat((s) => s.onlineIds);
  const userStatus = useChat((s) => s.userStatus);
  const [profile, setProfile] = useState<MemberInfo | null>(null);

  const members = useMemo(() => membersMap[guildId] ?? [], [membersMap, guildId]);
  const online = members.filter((m) => onlineIds.has(m.id));
  const offline = members.filter((m) => !onlineIds.has(m.id));

  const row = (m: MemberInfo, isOnline: boolean) => {
    const st = userStatus[m.id];
    return (
      <button
        key={m.id}
        onClick={() => setProfile(m)}
        className={"flex w-full items-center gap-2 rounded px-2 py-1 text-left transition hover:bg-hover " + (isOnline ? "" : "opacity-40")}
      >
        <div className="relative">
          <Avatar url={m.avatar} name={m.username} id={m.id} size={32} />
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-sidebar"
            style={{ backgroundColor: statusColor(st?.status, isOnline) }}
          />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] text-textNormal">{m.username}</div>
          {isOnline && st?.statusText && <div className="truncate text-[11px] text-textMuted">{st.statusText}</div>}
        </div>
      </button>
    );
  };

  return (
    <div className="hidden w-60 flex-col bg-sidebar px-3 py-4 lg:flex">
      <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-textFaint">Online — {online.length}</div>
      {online.map((m) => row(m, true))}
      {offline.length > 0 && (
        <>
          <div className="mb-2 mt-4 px-1 text-xs font-semibold uppercase tracking-wide text-textFaint">Offline — {offline.length}</div>
          {offline.map((m) => row(m, false))}
        </>
      )}
      {profile && <ProfilePopout userId={profile.id} username={profile.username} onClose={() => setProfile(null)} />}
    </div>
  );
}
