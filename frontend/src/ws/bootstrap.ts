import { conn } from "./Connection";
import { ServerOp } from "../protocol/ops";
import { useSession } from "../store/session";
import { useChat } from "../store/chat";
import { useDebug } from "../store/debug";
import type { MessageEvent as MessageEventFrame } from "../protocol/frames";

/**
 * Register inbound-frame handlers once, mapping ops -> store actions.
 * This is the client-side mirror of the C++ dispatch map. Connection.ts never
 * imports the stores, so there's no cycle — wiring lives here.
 */
export function initWs(): void {
  // connection status -> session store
  conn.onStatus((s) => useSession.getState().setStatus(s));

  // every frame -> debug inspector log
  conn.onLog((e) => useDebug.getState().push(e));

  // live event stream (works today for anything the server sends)
  conn.on(ServerOp.Message, (f) => {
    const d = (f as MessageEventFrame).d;
    useChat.getState().onMessageEvent(d);
  });

  // TODO: HELLO -> start heartbeat once the server sends it.
  // TODO: HISTORY, GUILD_CREATE, CHANNEL_CREATE, GUILD_JOIN handlers as ops land.
}
