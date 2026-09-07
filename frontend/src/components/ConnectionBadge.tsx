import { useSession } from "../store/session";
import type { Status } from "../ws/Connection";

const META: Record<Status, { label: string; color: string }> = {
  idle: { label: "Idle", color: "#80848e" },
  connecting: { label: "Connecting…", color: "#f0b232" },
  open: { label: "Connected", color: "#23a55a" },
  closed: { label: "Disconnected", color: "#da373c" },
  error: { label: "Error", color: "#da373c" },
};

export default function ConnectionBadge() {
  const status = useSession((s) => s.status);
  const m = META[status];
  return (
    <div className="flex items-center gap-1.5 text-xs text-textMuted">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: m.color }}
      />
      {m.label}
    </div>
  );
}
