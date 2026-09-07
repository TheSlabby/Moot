import { create } from "zustand";
import { conn } from "../ws/Connection";
import { ClientOp, ServerOp } from "../protocol/ops";
import type { ReadyGuild } from "../protocol/frames";
import {
  mockMembers,
  type Channel,
  type Guild,
  type Member,
  type Message,
} from "./mock";

// derive a guild-rail icon + color from a real guild (READY has no visuals)
const PALETTE = ["#5865f2", "#23a55a", "#eb459e", "#f0b232", "#e91e63", "#3498db", "#e67e22"];
function guildVisual(name: string, idx: number): { icon: string; color: string } {
  return { icon: name.slice(0, 2).toUpperCase(), color: PALETTE[idx % PALETTE.length] };
}

interface HistoryData {
  channel_id: string;
  messages: Array<{ id: string; channel_id: string; author_id: string; content: string }>;
}

interface ChatState {
  guilds: Guild[];
  channels: Channel[];
  members: Member[];
  messages: Message[];
  loadedChannels: Set<string>;
  selectedGuildId: string;
  selectedChannelId: string;

  // populate real guilds/channels from the READY frame (replaces any mock)
  setInitialGuilds: (guilds: ReadyGuild[]) => void;

  selectGuild: (guildId: string) => void;
  selectChannel: (channelId: string) => void;

  loadHistory: (channelId: string) => void;
  onHistory: (d: HistoryData) => void;

  sendMessage: (channelId: string, authorId: string, content: string) => void;
  onMessageEvent: (d: {
    id: string; channel_id: string; author_id: string; content: string; nonce?: string;
  }) => void;

  createGuild: (name: string) => Promise<void>;
  createChannel: (guildId: string, name: string) => Promise<void>;
  joinGuild: (guildId: string) => Promise<void>;
}

function uuid(): string {
  return "n-" + Math.random().toString(36).slice(2, 10);
}

export const useChat = create<ChatState>((set, get) => ({
  // pre-login placeholders; replaced by setInitialGuilds on READY
  guilds: [],
  channels: [],
  members: mockMembers,
  messages: [],
  loadedChannels: new Set<string>(),
  selectedGuildId: "",
  selectedChannelId: "",

  setInitialGuilds: (rgs) => {
    const guilds: Guild[] = rgs.map((g, i) => ({ id: g.id, name: g.name, ...guildVisual(g.name, i) }));
    const channels: Channel[] = rgs.flatMap((g) =>
      g.channels.map((c) => ({ id: c.id, guildId: g.id, name: c.name }))
    );
    set((s) => {
      const firstGuild = guilds[0]?.id ?? "";
      const guildOk = guilds.some((g) => g.id === s.selectedGuildId);
      const selGuild = guildOk ? s.selectedGuildId : firstGuild;
      const chanOk = channels.some((c) => c.id === s.selectedChannelId && c.guildId === selGuild);
      const selChannel = chanOk
        ? s.selectedChannelId
        : channels.find((c) => c.guildId === selGuild)?.id ?? "";
      return {
        guilds,
        channels,
        messages: [],
        loadedChannels: new Set<string>(),
        selectedGuildId: selGuild,
        selectedChannelId: selChannel,
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

  onHistory: (d) => {
    // backend returns newest-first, no timestamps -> reverse + synthesize ordered ts
    const n = d.messages.length;
    const base = Date.now() - n * 1000;
    const mapped: Message[] = d.messages
      .slice()
      .reverse()
      .map((m, i) => ({
        id: m.id,
        channelId: m.channel_id,
        authorId: m.author_id,
        content: m.content,
        ts: base + i * 1000,
        pending: false,
      }));
    set((s) => ({
      // replace this channel's confirmed messages; keep still-pending optimistic ones
      messages: [
        ...s.messages.filter((x) => x.channelId !== d.channel_id || x.pending),
        ...mapped,
      ],
    }));
  },

  sendMessage: (channelId, authorId, content) => {
    const nonce = uuid();
    const optimistic: Message = {
      id: nonce, channelId, authorId, content, ts: Date.now(), nonce, pending: true,
    };
    set((s) => ({ messages: [...s.messages, optimistic] }));
    conn.send(ClientOp.MessageCreate, { channel_id: channelId, content, nonce });
  },

  onMessageEvent: (d) => {
    set((s) => {
      const idx = d.nonce
        ? s.messages.findIndex((m) => m.nonce === d.nonce && m.pending)
        : -1;
      const confirmed: Message = {
        id: d.id, channelId: d.channel_id, authorId: d.author_id,
        content: d.content, ts: Date.now(), nonce: d.nonce, pending: false,
      };
      if (idx >= 0) {
        const next = s.messages.slice();
        next[idx] = confirmed;
        return { messages: next };
      }
      if (s.messages.some((m) => m.id === d.id)) return {};
      return { messages: [...s.messages, confirmed] };
    });
  },

  createGuild: async (name) => {
    const resp = await conn.sendAndWait(ClientOp.GuildCreate, { name }, [ServerOp.GuildCreate, ServerOp.Error]);
    if (resp.op !== ServerOp.GuildCreate) return;
    const d = resp.d as { id: string; name: string; owner_id: string };
    set((s) => ({
      guilds: [...s.guilds, { id: d.id, name: d.name, ...guildVisual(d.name, s.guilds.length) }],
    }));
    get().selectGuild(d.id);
  },

  createChannel: async (guildId, name) => {
    const resp = await conn.sendAndWait(ClientOp.ChannelCreate, { guild_id: guildId, name }, [ServerOp.ChannelCreate, ServerOp.Error]);
    if (resp.op !== ServerOp.ChannelCreate) return;
    const d = resp.d as { id: string; guild_id: string; name: string };
    set((s) => ({ channels: [...s.channels, { id: d.id, guildId: d.guild_id, name: d.name }] }));
    get().selectChannel(d.id);
  },

  joinGuild: async (guildId) => {
    const resp = await conn.sendAndWait(ClientOp.GuildJoin, { guild_id: guildId }, [ServerOp.GuildJoin, ServerOp.Error]);
    if (resp.op !== ServerOp.GuildJoin) return;
    // placeholder — a joined guild has no name/channels until list ops exist
    set((s) =>
      s.guilds.some((g) => g.id === guildId)
        ? {}
        : { guilds: [...s.guilds, { id: guildId, name: "Guild " + guildId, ...guildVisual("G" + guildId, s.guilds.length) }] }
    );
    get().selectGuild(guildId);
  },
}));
