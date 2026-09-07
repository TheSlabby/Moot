import { useMemo } from "react";
import { useChat } from "../store/chat";
import { useSession } from "../store/session";
import ConnectionBadge from "./ConnectionBadge";
import { initials } from "./ui";

export default function ChannelSidebar() {
  const selectedGuildId = useChat((s) => s.selectedGuildId);
  const selectedChannelId = useChat((s) => s.selectedChannelId);
  const selectChannel = useChat((s) => s.selectChannel);
  const allChannels = useChat((s) => s.channels);
  const guild = useChat((s) => s.guilds.find((g) => g.id === selectedGuildId));

  const channels = useMemo(
    () => allChannels.filter((c) => c.guildId === selectedGuildId),
    [allChannels, selectedGuildId]
  );

  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);

  return (
    <div className="flex w-60 flex-col bg-sidebar">
      {/* guild header */}
      <div className="flex h-12 items-center border-b border-black/20 px-4 font-semibold text-textNormal shadow-sm">
        {guild?.name ?? "—"}
      </div>

      {/* channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-textFaint">
          Text Channels
        </div>
        {channels.map((c) => {
          const active = c.id === selectedChannelId;
          return (
            <button
              key={c.id}
              onClick={() => selectChannel(c.id)}
              className={
                "group mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[15px] transition " +
                (active
                  ? "bg-active text-white"
                  : "text-textMuted hover:bg-hover hover:text-textNormal")
              }
            >
              <span className="text-xl leading-none text-textFaint">#</span>
              <span className="truncate">{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* user panel */}
      {user && (
        <div className="flex items-center gap-2 bg-rail px-2 py-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blurple text-xs font-semibold text-white">
            {initials(user.username)}
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium text-textNormal">{user.username}</div>
            <ConnectionBadge />
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="rounded px-2 py-1 text-textMuted transition hover:bg-hover hover:text-danger"
          >
            ⏻
          </button>
        </div>
      )}
    </div>
  );
}
