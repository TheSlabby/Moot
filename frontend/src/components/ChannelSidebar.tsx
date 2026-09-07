import { useMemo, useState } from "react";
import { useChat } from "../store/chat";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import ConnectionBadge from "./ConnectionBadge";
import SettingsModal from "./SettingsModal";
import CreateChannelModal from "./CreateChannelModal";
import { colorFor, initials } from "./ui";

export default function ChannelSidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
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
  const avatarColor = useSettings((s) => s.avatarColor);
  const myColor = avatarColor ?? colorFor(user?.id ?? "0");

  function onCreateChannel() {
    if (selectedGuildId) setChannelModalOpen(true);
  }

  return (
    <div className="flex w-60 flex-col bg-sidebar">
      {/* guild header */}
      <div className="flex h-12 items-center border-b border-black/20 px-4 font-semibold text-textNormal shadow-sm">
        {guild?.name ?? "—"}
      </div>

      {/* channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-1 flex items-center px-2 text-xs font-semibold uppercase tracking-wide text-textFaint">
          <span>Text Channels</span>
          <button
            onClick={onCreateChannel}
            title="Create a channel (CHANNEL_CREATE)"
            className="ml-auto text-base leading-none text-textFaint transition hover:text-textNormal"
          >
            +
          </button>
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
          <span
            className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: myColor }}
          >
            {initials(user.username)}
          </span>
          <div className="flex-1 leading-tight">
            <div className="text-sm font-medium text-textNormal">{user.username}</div>
            <ConnectionBadge />
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            title="User settings"
            className="rounded px-2 py-1 text-textMuted transition hover:bg-hover hover:text-textNormal"
          >
            ⚙
          </button>
        </div>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {channelModalOpen && (
        <CreateChannelModal guildId={selectedGuildId} onClose={() => setChannelModalOpen(false)} />
      )}
    </div>
  );
}
