import { conn } from "./Connection";
import { ServerOp } from "../protocol/ops";
import { useSession } from "../store/session";
import { useChat } from "../store/chat";
import { useDebug } from "../store/debug";
import type {
  Hello, Ready, MessageEvent, MessageUpdate, MessageDeleteEvent,
  ReactionUpdate, TypingEvent, PresenceEvent, UserUpdateEvent, GuildUpdateEvent, HistoryResp,
  PinUpdate, Pins,
} from "../protocol/frames";

/** Register inbound-frame handlers once — the client mirror of the C++ dispatch map. */
export function initWs(): void {
  conn.onStatus((s) => useSession.getState().setStatus(s));
  conn.onLog((e) => useDebug.getState().push(e));

  conn.on(ServerOp.Hello, (f) => conn.startHeartbeat((f as unknown as Hello).d.heartbeat_interval));

  conn.on(ServerOp.Ready, (f) => useChat.getState().setReady((f as unknown as Ready).d));

  conn.on(ServerOp.Message, (f) => useChat.getState().onMessage((f as unknown as MessageEvent).d));
  conn.on(ServerOp.MessageUpdate, (f) => useChat.getState().onMessageUpdate((f as unknown as MessageUpdate).d));
  conn.on(ServerOp.MessageDelete, (f) => useChat.getState().onMessageDelete((f as unknown as MessageDeleteEvent).d));
  conn.on(ServerOp.ReactionUpdate, (f) => useChat.getState().onReactionUpdate((f as unknown as ReactionUpdate).d));
  conn.on(ServerOp.Typing, (f) => useChat.getState().onTyping((f as unknown as TypingEvent).d));
  conn.on(ServerOp.Presence, (f) => useChat.getState().onPresence((f as unknown as PresenceEvent).d));
  conn.on(ServerOp.UserUpdate, (f) => useChat.getState().onUserUpdate((f as unknown as UserUpdateEvent).d));
  conn.on(ServerOp.GuildUpdate, (f) => useChat.getState().onGuildUpdate((f as unknown as GuildUpdateEvent).d));
  conn.on(ServerOp.PinUpdate, (f) => useChat.getState().onPinUpdate((f as unknown as PinUpdate).d));
  conn.on(ServerOp.Pins, (f) => useChat.getState().onPins((f as unknown as Pins).d));
  conn.on(ServerOp.History, (f) => useChat.getState().onHistory((f as unknown as HistoryResp).d));
}
