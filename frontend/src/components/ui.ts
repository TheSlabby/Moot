const AVATAR_COLORS = [
  "#5865f2", "#23a55a", "#eb459e", "#f0b232", "#e91e63",
  "#3498db", "#e67e22", "#9b59b6", "#1abc9c", "#e74c3c",
];

// stable color from a user id
export function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return (name || "?").slice(0, 2).toUpperCase();
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDayTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay ? "Today" : d.toLocaleDateString();
  return `${day} at ${formatTime(ts)}`;
}

export function formatDivider(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

export const QUICK_EMOJIS = ["👍", "😂", "❤️", "🎉", "🔥", "👀", "😮", "😢"];

export function statusColor(status: string | undefined, online: boolean): string {
  if (!online) return "#80848e";
  if (status === "idle") return "#f0b232";
  if (status === "dnd") return "#f23f43";
  return "#23a55a"; // online
}
export function statusLabel(status: string | undefined, online: boolean): string {
  if (!online) return "Offline";
  if (status === "idle") return "Idle";
  if (status === "dnd") return "Do Not Disturb";
  return "Online";
}
