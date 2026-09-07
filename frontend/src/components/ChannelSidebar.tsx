import { useMemo, useRef, useState } from "react";
import { useChat } from "../store/chat";
import { useSession } from "../store/session";
import { useSettings } from "../store/settings";
import { uploadFile } from "../ws/api";
import ConnectionBadge from "./ConnectionBadge";
import SettingsModal from "./SettingsModal";
import CreateChannelModal from "./CreateChannelModal";
import Avatar from "./Avatar";
import { colorFor } from "./ui";

export default function ChannelSidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const iconInput = useRef<HTMLInputElement>(null);
  const selectedGuildId = useChat((s) => s.selectedGuildId);
  const selectedChannelId = useChat((s) => s.selectedChannelId);
  const selectChannel = useChat((s) => s.selectChannel);
  const allChannels = useChat((s) => s.channels);
  const guild = useChat((s) => s.guilds.find((g) => g.id === selectedGuildId));
  const setGuildIcon = useChat((s) => s.setGuildIcon);

  const unread = useChat((s) => s.unread);
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
  async function onIconChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedGuildId) return;
    const url = await uploadFile(file);
    if (url) setGuildIcon(selectedGuildId, url);
  }

  return (
    <div className="flex w-60 flex-col bg-sidebar">
      {/* guild header */}
      <div className="group flex h-12 items-center gap-2 border-b border-black/20 px-3 font-semibold text-textNormal shadow-sm">
        {guild?.iconUrl ? (
          <img src={guild.iconUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          guild && <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] text-white" style={{ backgroundColor: guild.color }}>{guild.icon}</span>
        )}
        <span className="flex-1 truncate">{guild?.name ?? "—"}</span>
        <button
          onClick={() => iconInput.current?.click()}
          title="Change guild icon"
          className="rounded px-1.5 py-1 text-xs text-textMuted opacity-0 transition hover:bg-hover hover:text-textNormal group-hover:opacity-100"
        >
          📷
        </button>
        <input ref={iconInput} type="file" accept="image/*" hidden onChange={onIconChosen} />
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
          const u = unread[c.id] ?? 0;
          const unreadNotActive = u > 0 && !active;
          return (
            <button
              key={c.id}
              onClick={() => selectChannel(c.id)}
              className={
                "group mb-0.5 flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[15px] transition " +
                (active
                  ? "bg-active text-white"
                  : unreadNotActive
                    ? "font-medium text-textNormal hover:bg-hover"
                    : "text-textMuted hover:bg-hover hover:text-textNormal")
              }
            >
              <span className="text-xl leading-none text-textFaint">#</span>
              <span className="flex-1 truncate text-left">{c.name}</span>
              {unreadNotActive && (
                <span className="rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">{u}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* user panel */}
      {user && (
        <div className="flex items-center gap-2 bg-rail px-2 py-2">
          <Avatar url={user.avatar} name={user.username} id={user.id} size={32} color={myColor} />
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
