// Typed wire protocol — mirrors PROTOCOL.md.
// IMPORTANT: ids are always strings on the wire (JS numbers lose precision >2^53).

export interface Envelope<Op extends string, D> {
  op: Op;
  d: D;
  ref?: string;
  seq?: number;
}

// ---- server -> client ----
export type Hello = Envelope<"HELLO", { heartbeat_interval: number }>;
export interface ReadyGuild {
  id: string;
  name: string;
  owner_id: string;
  channels: { id: string; name: string }[];
}
export type Ready = Envelope<"READY", {
  session_id: string;
  user: { id: string; username?: string };
  guilds: ReadyGuild[];
}>;
export type HeartbeatAck = Envelope<"HEARTBEAT_ACK", Record<string, never>>;
export type MessageAck = Envelope<"MESSAGE_ACK", { id: string; nonce?: string }>;
export type MessageEvent = Envelope<"MESSAGE", {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  nonce?: string;
}>;
export type GuildCreated = Envelope<"GUILD_CREATE", { id: string; name: string; owner_id: string }>;
export type ChannelCreated = Envelope<"CHANNEL_CREATE", { id: string; guild_id: string; name: string }>;
export type GuildJoined = Envelope<"GUILD_JOIN", { guild_id: string; status?: string }>;
export type HistoryResp = Envelope<"HISTORY", {
  channel_id: string;
  messages: Array<{ id: string; channel_id: string; author_id: string; content: string }>;
}>;
export type ErrorFrame = Envelope<"ERROR", { code: string; message: string }>;

export type ServerFrame =
  | Hello | Ready | HeartbeatAck | MessageAck | MessageEvent
  | GuildCreated | ChannelCreated | GuildJoined | HistoryResp | ErrorFrame;

// ---- client -> server ----
export type Identify = Envelope<"IDENTIFY", { token: string }>;
export type Heartbeat = Envelope<"HEARTBEAT", Record<string, never>>;
export type MessageCreate = Envelope<"MESSAGE_CREATE", { channel_id: string; content: string; nonce: string }>;
export type GuildCreate = Envelope<"GUILD_CREATE", { name: string }>;
export type ChannelCreate = Envelope<"CHANNEL_CREATE", { guild_id: string; name: string }>;
export type GuildJoin = Envelope<"GUILD_JOIN", { guild_id: string }>;
export type History = Envelope<"HISTORY", { channel_id: string; before?: string; limit: number }>;

export type ClientFrame =
  | Identify | Heartbeat | MessageCreate | GuildCreate | ChannelCreate | GuildJoin | History;

// Generic shape for anything off the wire (before narrowing on `op`).
export interface RawFrame {
  op: string;
  d?: unknown;
  ref?: string;
  seq?: number;
}
