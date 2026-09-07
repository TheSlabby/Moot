// Op names — the string discriminators of the wire protocol.
// Mirror of PROTOCOL.md. Kept as consts so typos are compile errors.

export const ClientOp = {
  Identify: "IDENTIFY",
  Heartbeat: "HEARTBEAT",
  GuildCreate: "GUILD_CREATE",
  ChannelCreate: "CHANNEL_CREATE",
  GuildJoin: "GUILD_JOIN",
  MessageCreate: "MESSAGE_CREATE",
  MessageEdit: "MESSAGE_EDIT",
  MessageDelete: "MESSAGE_DELETE",
  ReactionAdd: "REACTION_ADD",
  ReactionRemove: "REACTION_REMOVE",
  Typing: "TYPING",
  UserUpdate: "USER_UPDATE",
  History: "HISTORY",
} as const;

export const ServerOp = {
  Hello: "HELLO",
  Ready: "READY",
  HeartbeatAck: "HEARTBEAT_ACK",
  Message: "MESSAGE",
  MessageUpdate: "MESSAGE_UPDATE",
  MessageDelete: "MESSAGE_DELETE",
  ReactionUpdate: "REACTION_UPDATE",
  Typing: "TYPING",
  Presence: "PRESENCE",
  UserUpdate: "USER_UPDATE",
  GuildCreate: "GUILD_CREATE",
  ChannelCreate: "CHANNEL_CREATE",
  GuildJoin: "GUILD_JOIN",
  History: "HISTORY",
  Error: "ERROR",
} as const;
