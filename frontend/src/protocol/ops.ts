// Op names — the string discriminators of the wire protocol.
// Mirror of PROTOCOL.md. Kept as consts so typos are compile errors.

export const ClientOp = {
  Identify: "IDENTIFY",
  Heartbeat: "HEARTBEAT",
  GuildCreate: "GUILD_CREATE",
  ChannelCreate: "CHANNEL_CREATE",
  GuildJoin: "GUILD_JOIN",
  MessageCreate: "MESSAGE_CREATE",
  History: "HISTORY",
} as const;

export const ServerOp = {
  Hello: "HELLO",
  Ready: "READY",
  HeartbeatAck: "HEARTBEAT_ACK",
  MessageAck: "MESSAGE_ACK",
  Message: "MESSAGE",
  GuildCreate: "GUILD_CREATE",
  ChannelCreate: "CHANNEL_CREATE",
  GuildJoin: "GUILD_JOIN",
  History: "HISTORY",
  Error: "ERROR",
} as const;
