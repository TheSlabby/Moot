import { create } from "zustand";
import { conn } from "../ws/Connection";
import { ClientOp } from "../protocol/ops";
import {
  mockChannels,
  mockGuilds,
  mockMembers,
  mockMessages,
  type Channel,
  type Guild,
  type Member,
  type Message,
} from "./mock";

interface ChatState {
  guilds: Guild[];
  channels: Channel[];
  members: Member[];
  messages: Message[]; // flat; filtered per channel in selectors
  selectedGuildId: string;
  selectedChannelId: string;

  selectGuild: (guildId: string) => void;
  selectChannel: (channelId: string) => void;

  // Sends a real MESSAGE_CREATE frame AND adds an optimistic message.
  sendMessage: (channelId: string, authorId: string, content: string) => void;

  // Inbound MESSAGE event from the server (reconciles by nonce). Live path.
  onMessageEvent: (d: {
    id: string;
    channel_id: string;
    author_id: string;
    content: string;
    nonce?: string;
  }) => void;
}

function firstChannelOf(guildId: string): string {
  return mockChannels.find((c) => c.guildId === guildId)?.id ?? "";
}

function uuid(): string {
  return "n-" + Math.random().toString(36).slice(2, 10);
}

export const useChat = create<ChatState>((set) => ({
  guilds: mockGuilds,
  channels: mockChannels,
  members: mockMembers,
  messages: mockMessages,
  selectedGuildId: mockGuilds[0].id,
  selectedChannelId: firstChannelOf(mockGuilds[0].id),

  selectGuild: (guildId) =>
    set({ selectedGuildId: guildId, selectedChannelId: firstChannelOf(guildId) }),

  selectChannel: (channelId) => set({ selectedChannelId: channelId }),

  sendMessage: (channelId, authorId, content) => {
    const nonce = uuid();
    // optimistic add (shows immediately, greyed until confirmed)
    const optimistic: Message = {
      id: nonce,
      channelId,
      authorId,
      content,
      ts: Date.now(),
      nonce,
      pending: true,
    };
    set((s) => ({ messages: [...s.messages, optimistic] }));

    // real frame — the server ignores MESSAGE_CREATE for now (unknown op),
    // so nothing comes back yet. Once handle_message_create + bus.publish land,
    // a MESSAGE event arrives and onMessageEvent() reconciles by nonce.
    conn.send(ClientOp.MessageCreate, { channel_id: channelId, content, nonce });
  },

  onMessageEvent: (d) => {
    set((s) => {
      // reconcile our own optimistic message by nonce
      const idx = d.nonce
        ? s.messages.findIndex((m) => m.nonce === d.nonce && m.pending)
        : -1;
      const confirmed: Message = {
        id: d.id,
        channelId: d.channel_id,
        authorId: d.author_id,
        content: d.content,
        ts: Date.now(),
        nonce: d.nonce,
        pending: false,
      };
      if (idx >= 0) {
        const next = s.messages.slice();
        next[idx] = confirmed;
        return { messages: next };
      }
      // someone else's message (or no matching optimistic) — append
      if (s.messages.some((m) => m.id === d.id)) return {};
      return { messages: [...s.messages, confirmed] };
    });
  },
}));

// selectors
export const channelsForGuild = (s: ChatState, guildId: string) =>
  s.channels.filter((c) => c.guildId === guildId);

export const messagesForChannel = (s: ChatState, channelId: string) =>
  s.messages.filter((m) => m.channelId === channelId).sort((a, b) => a.ts - b.ts);
