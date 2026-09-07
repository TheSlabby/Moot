import { conn } from "./Connection";
import { ServerOp } from "../protocol/ops";
import { useSession } from "../store/session";
import { useChat } from "../store/chat";
import { useDebug } from "../store/debug";
import type { Hello, Ready, MessageEvent, HistoryResp } from "../protocol/frames";

/**
 * Register inbound-frame handlers once, mapping ops -> store actions.
 * Client-side mirror of the C++ dispatch map. Connection.ts never imports the
 * stores, so there's no cycle — wiring lives here.
 */
export function initWs(): void {
  conn.onStatus((s) => useSession.getState().setStatus(s));
  conn.onLog((e) => useDebug.getState().push(e));

  // HELLO -> start heartbeat keepalive (also fires again after a reconnect)
  conn.on(ServerOp.Hello, (f) => {
    conn.startHeartbeat((f as unknown as Hello).d.heartbeat_interval);
  });

  // READY -> load the user's real guilds/channels (initial login AND reconnect)
  conn.on(ServerOp.Ready, (f) => {
    const d = (f as unknown as Ready).d;
    useChat.getState().setInitialGuilds(d.guilds ?? []);
  });

  // live message event
  conn.on(ServerOp.Message, (f) => {
    useChat.getState().onMessageEvent((f as unknown as MessageEvent).d);
  });

  // channel history
  conn.on(ServerOp.History, (f) => {
    useChat.getState().onHistory((f as unknown as HistoryResp).d);
  });
}
