// Typed wire protocol — mirrors PROTOCOL.md.
// IMPORTANT: ids are always strings on the wire (JS numbers lose precision >2^53).

export interface Envelope<Op extends string, D> {
  op: Op;
  d: D;
  ref?: string;
  seq?: number;
}

export interface WireReaction { emoji: string; count: number; me: boolean }
export interface WireMessage {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: number;
  edited_at?: number; // 0 or missing = not edited
  reactions?: WireReaction[];
  nonce?: string;
}
export interface WireMember { id: string; username: string }

// ---- server -> client ----
export type Hello = Envelope<"HELLO", { heartbeat_interval: number }>;
export interface ReadyGuild {
  id: string;
  name: string;
  owner_id: string;
  channels: { id: string; name: string }[];
  members: WireMember[];
}
export type Ready = Envelope<"READY", {
  session_id: string;
  user: { id: string; username?: string };
  guilds: ReadyGuild[];
  online: string[];
}>;
export type HeartbeatAck = Envelope<"HEARTBEAT_ACK", Record<string, never>>;
export type MessageEvent = Envelope<"MESSAGE", WireMessage>;
export type MessageUpdate = Envelope<"MESSAGE_UPDATE", {
  id: string; channel_id: string; content: string; edited_at: number;
}>;
export type MessageDeleteEvent = Envelope<"MESSAGE_DELETE", { id: string; channel_id: string }>;
export type ReactionUpdate = Envelope<"REACTION_UPDATE", {
  message_id: string; channel_id: string; emoji: string; user_id: string; added: boolean;
}>;
export type TypingEvent = Envelope<"TYPING", { channel_id: string; user_id: string; username: string }>;
export type PresenceEvent = Envelope<"PRESENCE", { user_id: string; username: string; online: boolean }>;
export type UserUpdateEvent = Envelope<"USER_UPDATE", { user_id: string; username: string }>;
export type GuildCreated = Envelope<"GUILD_CREATE", {
  id: string; name: string; owner_id: string;
  channels: { id: string; name: string }[];
  members: WireMember[];
}>;
export type ChannelCreated = Envelope<"CHANNEL_CREATE", { id: string; guild_id: string; name: string }>;
export type GuildJoined = Envelope<"GUILD_JOIN", { guild_id: string; status?: string }>;
export type HistoryResp = Envelope<"HISTORY", { channel_id: string; messages: WireMessage[] }>;
export type ErrorFrame = Envelope<"ERROR", { code: string; message: string }>;

export type ServerFrame =
  | Hello | Ready | HeartbeatAck | MessageEvent | MessageUpdate | MessageDeleteEvent
  | ReactionUpdate | TypingEvent | PresenceEvent | UserUpdateEvent
  | GuildCreated | ChannelCreated | GuildJoined | HistoryResp | ErrorFrame;

// ---- client -> server ----
export type Identify = Envelope<"IDENTIFY", { token: string }>;
export type Heartbeat = Envelope<"HEARTBEAT", Record<string, never>>;
export type MessageCreate = Envelope<"MESSAGE_CREATE", { channel_id: string; content: string; nonce: string }>;
export type MessageEdit = Envelope<"MESSAGE_EDIT", { message_id: string; channel_id: string; content: string }>;
export type MessageDelete = Envelope<"MESSAGE_DELETE", { message_id: string; channel_id: string }>;
export type ReactionAdd = Envelope<"REACTION_ADD", { message_id: string; channel_id: string; emoji: string }>;
export type ReactionRemove = Envelope<"REACTION_REMOVE", { message_id: string; channel_id: string; emoji: string }>;
export type TypingReq = Envelope<"TYPING", { channel_id: string }>;
export type UserUpdateReq = Envelope<"USER_UPDATE", { username: string }>;
export type GuildCreate = Envelope<"GUILD_CREATE", { name: string }>;
export type ChannelCreate = Envelope<"CHANNEL_CREATE", { guild_id: string; name: string }>;
export type GuildJoin = Envelope<"GUILD_JOIN", { guild_id: string }>;
export type History = Envelope<"HISTORY", { channel_id: string; before?: string; limit: number }>;

export type ClientFrame =
  | Identify | Heartbeat | MessageCreate | MessageEdit | MessageDelete
  | ReactionAdd | ReactionRemove | TypingReq | UserUpdateReq
  | GuildCreate | ChannelCreate | GuildJoin | History;

// Generic shape for anything off the wire (before narrowing on `op`).
export interface RawFrame {
  op: string;
  d?: unknown;
  ref?: string;
  seq?: number;
}
