import { useChat } from "../store/chat";
import Avatar from "./Avatar";
import { colorFor, statusColor, statusLabel } from "./ui";

export default function ProfilePopout({ userId, username, onClose }: { userId: string; username: string; onClose: () => void }) {
  const online = useChat((s) => s.onlineIds.has(userId));
  const status = useChat((s) => s.userStatus[userId]);
  const avatar = useChat((s) => s.userAvatars[userId]);
  const guildCount = useChat((s) => Object.values(s.guildMembers).filter((ms) => ms.some((m) => m.id === userId)).length);
  const color = colorFor(userId);

  return (
    <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="animate-modalIn w-72 overflow-hidden rounded-xl bg-chat shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16" style={{ backgroundColor: color }} />
        <div className="px-4 pb-4">
          <div className="-mt-8 mb-2 flex items-end justify-between">
            <div className="relative rounded-full border-4 border-chat">
              <Avatar url={avatar} name={username} id={userId} size={64} color={color} />
              <span
                className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-4 border-chat"
                style={{ backgroundColor: statusColor(status?.status, online) }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-rail p-3">
            <div className="text-lg font-bold text-textNormal">{username}</div>
            <div className="text-xs text-textMuted">
              {statusLabel(status?.status, online)}
              {status?.statusText ? ` — ${status.statusText}` : ""}
            </div>
            <div className="mt-2 border-t border-black/20 pt-2 text-xs text-textFaint">
              id {userId} · member of {guildCount} guild{guildCount === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
