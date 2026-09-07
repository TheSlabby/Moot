import { KNOWN_USERS, type Member } from "../store/mock";

export function userFor(id: string): Member {
  return (
    KNOWN_USERS[id] ?? {
      id,
      username: "user" + id,
      color: "#949ba4",
      online: false,
    }
  );
}

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDayTime(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const day = sameDay ? "Today" : d.toLocaleDateString();
  return `${day} at ${formatTime(ts)}`;
}
