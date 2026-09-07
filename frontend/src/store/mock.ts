// Seed data so the UI looks and feels like Discord before the backend can
// serve channels/messages. Everything here is replaced by real frames as the
// corresponding server ops land — see store/chat.ts for the seam.

export interface Guild {
  id: string;
  name: string;
  icon: string; // short label shown in the guild rail
  color: string;
  iconUrl?: string; // uploaded guild icon image
}

export interface Channel {
  id: string;
  guildId: string;
  name: string;
}

export interface Member {
  id: string;
  username: string;
  color: string;
  online: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  ts: number;
  nonce?: string;
  pending?: boolean;
}

// Seeded dev users (match the SQLite seed: id 1 walker, id 2 alice).
export const KNOWN_USERS: Record<string, Member> = {
  "1": { id: "1", username: "walker", color: "#5865f2", online: true },
  "2": { id: "2", username: "alice", color: "#23a55a", online: true },
  "3": { id: "3", username: "moot-bot", color: "#f0b232", online: true },
  "4": { id: "4", username: "guest42", color: "#eb459e", online: false },
};

export const mockGuilds: Guild[] = [
  { id: "10", name: "Moot HQ", icon: "MH", color: "#5865f2" },
  { id: "11", name: "C++ Wizards", icon: "C+", color: "#23a55a" },
  { id: "12", name: "Gamers", icon: "GG", color: "#eb459e" },
];

export const mockChannels: Channel[] = [
  { id: "20", guildId: "10", name: "general" },
  { id: "21", guildId: "10", name: "announcements" },
  { id: "22", guildId: "10", name: "random" },
  { id: "23", guildId: "11", name: "coroutines" },
  { id: "24", guildId: "11", name: "beast-asio" },
  { id: "25", guildId: "12", name: "lobby" },
];

export const mockMembers: Member[] = Object.values(KNOWN_USERS);

const now = Date.now();
export const mockMessages: Message[] = [
  { id: "1001", channelId: "20", authorId: "2", content: "yo, welcome to Moot 👋", ts: now - 1000 * 60 * 30 },
  { id: "1002", channelId: "20", authorId: "2", content: "it's a self-hosted Discord clone, C++ backend", ts: now - 1000 * 60 * 29 },
  { id: "1003", channelId: "20", authorId: "1", content: "the gateway is hand-written on Boost.Beast", ts: now - 1000 * 60 * 25 },
  { id: "1004", channelId: "20", authorId: "1", content: "single WebSocket, opcode-tagged JSON frames", ts: now - 1000 * 60 * 24, },
  { id: "1005", channelId: "20", authorId: "3", content: "beep boop. fanout via a pub/sub Bus.", ts: now - 1000 * 60 * 10 },
  { id: "1006", channelId: "23", authorId: "1", content: "co_await all the things", ts: now - 1000 * 60 * 5 },
];
