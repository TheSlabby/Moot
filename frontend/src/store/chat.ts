import { create } from "zustand";
import { conn } from "../ws/Connection";
import { ClientOp } from "../protocol/ops";
import type { Ready, WireMessage } from "../protocol/frames";
import { useSession } from "./session";
import type { Channel, Guild } from "./mock";

export interface Reaction { emoji: string; count: number; me: boolean }
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  content: string;
  ts: number;
  editedAt?: number;
  nonce?: string;
  pending?: boolean;
  reactions: Reaction[];
}
export interface MemberInfo { id: string; username: string }

const PALETTE = ["#5865f2", "#23a55a", "#eb459e", "#f0b232", "#e91e63", "#3498db", "#e67e22"];
function guildVisual(name: string, idx: number): { icon: string; color: string } {
  return { icon: name.slice(0, 2).toUpperCase(), color: PALETTE[idx % PALETTE.length] };
}

interface TypingEntry { name: string; expiresAt: number }

interface ChatState {
  guilds: Guild[];
  channels: Channel[];
  guildMembers: Record<string, MemberInfo[]>; // by guildId
  onlineIds: Set<string>;
  messages: Message[];
  typing: Record<string, Record<string, TypingEntry>>; // channelId -> userId -> entry
  loadedChannels: Set<string>;
  selectedGuildId: string;
  selectedChannelId: string;

  setReady: (d: Ready["d"]) => void;
  selectGuild: (guildId: string) => void;
  selectChannel: (channelId: string) => void;

  loadHistory: (channelId: string) => void;
  loadMoreHistory: (channelId: string) => void;
  onHistory: (d: { channel_id: string; messages: WireMessage[] }) => void;

  sendMessage: (channelId: string, content: string) => void;
  editMessage: (id: string, channelId: string, content: string) => void;
  deleteMessage: (id: string, channelId: string) => void;
  toggleReaction: (messageId: string, channelId: string, emoji: string, mine: boolean) => void;
  sendTyping: (channelId: string) => void;

  onMessage: (d: WireMessage) => void;
  onMessageUpdate: (d: { id: string; channel_id: string; content: string; edited_at: number }) => void;
  onMessageDelete: (d: { id: string; channel_id: string }) => void;
  onReactionUpdate: (d: { message_id: string; channel_id: string; emoji: string; user_id: string; added: boolean }) => void;
  onTyping: (d: { channel_id: string; user_id: string; username: string }) => void;
  onPresence: (d: { user_id: string; online: boolean }) => void;
  onUserUpdate: (d: { user_id: string; username: string }) => void;
  renameUser: (username: string) => void;
  pruneTyping: () => void;

  createGuild: (name: string) => Promise<void>;
  createChannel: (guildId: string, name: string) => Promise<void>;
  joinGuild: (guildId: string) => Promise<void>;
}

function uuid(): string {
  return "n-" + Math.random().toString(36).slice(2, 10);
}
function toMessage(w: WireMessage): Message {
  return {
    id: w.id,
    channelId: w.channel_id,
    authorId: w.author_id,
    authorName: w.author_name,
    content: w.content,
    ts: w.created_at || Date.now(),
    editedAt: w.edited_at && w.edited_at > 0 ? w.edited_at : undefined,
    reactions: w.reactions ?? [],
  };
}

const TYPING_TTL = 5000;
let lastTypingSent = 0;

export const useChat = create<ChatState>((set, get) => ({
  guilds: [],
  channels: [],
  guildMembers: {},
  onlineIds: new Set<string>(),
  messages: [],
  typing: {},
  loadedChannels: new Set<string>(),
  selectedGuildId: "",
  selectedChannelId: "",

  setReady: (d) => {
    const guilds: Guild[] = d.guilds.map((g, i) => ({ id: g.id, name: g.name, ...guildVisual(g.name, i) }));
    const channels: Channel[] = d.guilds.flatMap((g) =>
      g.channels.map((c) => ({ id: c.id, guildId: g.id, name: c.name }))
    );
    const guildMembers: Record<string, MemberInfo[]> = {};
    d.guilds.forEach((g) => { guildMembers[g.id] = g.members; });

    set((s) => {
      const firstGuild = guilds[0]?.id ?? "";
      const selGuild = guilds.some((g) => g.id === s.selectedGuildId) ? s.selectedGuildId : firstGuild;
      const chanOk = channels.some((c) => c.id === s.selectedChannelId && c.guildId === selGuild);
      const selChannel = chanOk ? s.selectedChannelId : channels.find((c) => c.guildId === selGuild)?.id ?? "";
      return {
        guilds, channels, guildMembers,
        onlineIds: new Set(d.online),
        messages: [], loadedChannels: new Set<string>(),
        selectedGuildId: selGuild, selectedChannelId: selChannel,
      };
    });
    const cid = get().selectedChannelId;
    if (cid) get().loadHistory(cid);
  },

  selectGuild: (guildId) => {
    const first = get().channels.find((c) => c.guildId === guildId)?.id ?? "";
    set({ selectedGuildId: guildId, selectedChannelId: first });
    if (first) get().loadHistory(first);
  },
  selectChannel: (channelId) => {
    set({ selectedChannelId: channelId });
    get().loadHistory(channelId);
  },

  loadHistory: (channelId) => {
    if (!channelId || get().loadedChannels.has(channelId)) return;
    set((s) => ({ loadedChannels: new Set(s.loadedChannels).add(channelId) }));
    conn.send(ClientOp.History, { channel_id: channelId, limit: 50 });
  },
  loadMoreHistory: (channelId) => {
    const mine = get().messages.filter((m) => m.channelId === channelId && !m.pending);
    if (!mine.length) return;
    const oldest = mine.reduce((a, b) => (Number(a.id) < Number(b.id) ? a : b));
    conn.send(ClientOp.History, { channel_id: channelId, before: oldest.id, limit: 50 });
  },
  onHistory: (d) => {
    const incoming = d.messages.map(toMessage);
    set((s) => {
      const byId = new Map(s.messages.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return { messages: Array.from(byId.values()) };
    });
  },

  sendMessage: (channelId, content) => {
    const me = useSession.getState().user;
    const nonce = uuid();
    const optimistic: Message = {
      id: nonce, channelId, authorId: me?.id ?? "0", authorName: me?.username ?? "you",
      content, ts: Date.now(), nonce, pending: true, reactions: [],
    };
    set((s) => ({ messages: [...s.messages, optimistic] }));
    conn.send(ClientOp.MessageCreate, { channel_id: channelId, content, nonce });
  },
  editMessage: (id, channelId, content) => {
    conn.send(ClientOp.MessageEdit, { message_id: id, channel_id: channelId, content });
  },
  deleteMessage: (id, channelId) => {
    conn.send(ClientOp.MessageDelete, { message_id: id, channel_id: channelId });
  },
  toggleReaction: (messageId, channelId, emoji, mine) => {
    conn.send(mine ? ClientOp.ReactionRemove : ClientOp.ReactionAdd, {
      message_id: messageId, channel_id: channelId, emoji,
    });
  },
  sendTyping: (channelId) => {
    const now = Date.now();
    if (now - lastTypingSent < 2500) return;
    lastTypingSent = now;
    conn.send(ClientOp.Typing, { channel_id: channelId });
  },

  onMessage: (d) => {
    set((s) => {
      const idx = d.nonce ? s.messages.findIndex((m) => m.nonce === d.nonce && m.pending) : -1;
      const confirmed = toMessage(d);
      if (idx >= 0) {
        const next = s.messages.slice();
        next[idx] = confirmed;
        return { messages: next };
      }
      if (s.messages.some((m) => m.id === d.id)) return {};
      return { messages: [...s.messages, confirmed] };
    });
    // sender stops "typing" once their message lands
  },
  onMessageUpdate: (d) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === d.id ? { ...m, content: d.content, editedAt: d.edited_at } : m
      ),
    }));
  },
  onMessageDelete: (d) => {
    set((s) => ({ messages: s.messages.filter((m) => m.id !== d.id) }));
  },
  onReactionUpdate: (d) => {
    const myId = useSession.getState().user?.id;
    set((s) => ({
      messages: s.messages.map((m) => {
        if (m.id !== d.message_id) return m;
        const reactions = m.reactions.slice();
        const i = reactions.findIndex((r) => r.emoji === d.emoji);
        const isMe = d.user_id === myId;
        if (d.added) {
          if (i >= 0) reactions[i] = { ...reactions[i], count: reactions[i].count + 1, me: reactions[i].me || isMe };
          else reactions.push({ emoji: d.emoji, count: 1, me: isMe });
        } else if (i >= 0) {
          const count = reactions[i].count - 1;
          if (count <= 0) reactions.splice(i, 1);
          else reactions[i] = { ...reactions[i], count, me: isMe ? false : reactions[i].me };
        }
        return { ...m, reactions };
      }),
    }));
  },
  onTyping: (d) => {
    const myId = useSession.getState().user?.id;
    if (d.user_id === myId) return;
    set((s) => {
      const chan = { ...(s.typing[d.channel_id] ?? {}) };
      chan[d.user_id] = { name: d.username, expiresAt: Date.now() + TYPING_TTL };
      return { typing: { ...s.typing, [d.channel_id]: chan } };
    });
  },
  onPresence: (d) => {
    set((s) => {
      const next = new Set(s.onlineIds);
      if (d.online) next.add(d.user_id);
      else next.delete(d.user_id);
      return { onlineIds: next };
    });
  },
  onUserUpdate: (d) => {
    set((s) => {
      const guildMembers: Record<string, MemberInfo[]> = {};
      for (const [gid, ms] of Object.entries(s.guildMembers))
        guildMembers[gid] = ms.map((m) => (m.id === d.user_id ? { ...m, username: d.username } : m));
      return {
        guildMembers,
        messages: s.messages.map((m) =>
          m.authorId === d.user_id ? { ...m, authorName: d.username } : m
        ),
      };
    });
    if (useSession.getState().user?.id === d.user_id)
      useSession.getState().setUsername(d.username);
  },
  renameUser: (username) => {
    conn.send(ClientOp.UserUpdate, { username });
  },
  pruneTyping: () => {
    const now = Date.now();
    set((s) => {
      let changed = false;
      const typing: ChatState["typing"] = {};
      for (const [cid, users] of Object.entries(s.typing)) {
        const kept: Record<string, TypingEntry> = {};
        for (const [uid, e] of Object.entries(users)) {
          if (e.expiresAt > now) kept[uid] = e;
          else changed = true;
        }
        if (Object.keys(kept).length) typing[cid] = kept;
      }
      return changed ? { typing } : {};
    });
  },

  createGuild: async (name) => {
    const resp = await conn.sendAndWait(ClientOp.GuildCreate, { name }, ["GUILD_CREATE", "ERROR"]);
    if (resp.op !== "GUILD_CREATE") return;
    const d = resp.d as {
      id: string; name: string; owner_id: string;
      channels: { id: string; name: string }[]; members: MemberInfo[];
    };
    set((s) => ({
      guilds: [...s.guilds, { id: d.id, name: d.name, ...guildVisual(d.name, s.guilds.length) }],
      channels: [...s.channels, ...d.channels.map((c) => ({ id: c.id, guildId: d.id, name: c.name }))],
      guildMembers: { ...s.guildMembers, [d.id]: d.members },
    }));
    // jump into the new guild's first channel
    const first = d.channels[0]?.id ?? "";
    set({ selectedGuildId: d.id, selectedChannelId: first });
    if (first) get().loadHistory(first);
  },
  createChannel: async (guildId, name) => {
    const resp = await conn.sendAndWait(ClientOp.ChannelCreate, { guild_id: guildId, name }, ["CHANNEL_CREATE", "ERROR"]);
    if (resp.op !== "CHANNEL_CREATE") return;
    const d = resp.d as { id: string; guild_id: string; name: string };
    set((s) => ({ channels: [...s.channels, { id: d.id, guildId: d.guild_id, name: d.name }] }));
    get().selectChannel(d.id);
  },
  joinGuild: async (guildId) => {
    const resp = await conn.sendAndWait(ClientOp.GuildJoin, { guild_id: guildId }, ["GUILD_JOIN", "ERROR"]);
    if (resp.op !== "GUILD_JOIN") return;
    set((s) =>
      s.guilds.some((g) => g.id === guildId) ? {}
        : { guilds: [...s.guilds, { id: guildId, name: "Guild " + guildId, ...guildVisual("G" + guildId, s.guilds.length) }] }
    );
    get().selectGuild(guildId);
  },
}));

// prune expired typing indicators
setInterval(() => useChat.getState().pruneTyping(), 1500);
