import type { RawFrame } from "../protocol/frames";

export type Status = "idle" | "connecting" | "open" | "closed" | "error";

export interface LogEntry {
  dir: "in" | "out";
  frame: RawFrame;
  at: number;
}

type FrameHandler = (frame: RawFrame) => void;
type StatusListener = (s: Status) => void;
type LogListener = (e: LogEntry) => void;

interface Waiter {
  ops: Set<string>;
  resolve: (f: RawFrame) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const BACKOFF_MS = [1000, 2000, 5000]; // reconnect delays, capped at the last

/**
 * Single WebSocket connection to the Moot gateway.
 * Mirrors the server side: send opcode-tagged JSON frames, dispatch inbound
 * frames by `op`. No socket.io — the raw WebSocket IS the protocol.
 */
class Connection {
  private ws?: WebSocket;
  private url = "";
  private refCounter = 0;
  private handlers = new Map<string, Set<FrameHandler>>();
  private statusListeners = new Set<StatusListener>();
  private logListeners = new Set<LogListener>();
  private waiters: Waiter[] = [];

  // heartbeat + reconnect state
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private token?: string;
  private wantReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  status: Status = "idle";

  /** Connect and resolve once the socket is open (rejects if it fails first). */
  connect(url: string): Promise<void> {
    this.url = url;
    return new Promise((resolve, reject) => {
      this.setStatus("connecting");
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("open");
        resolve();
      };
      ws.onmessage = (ev) => this.onRaw(ev.data);
      ws.onerror = () => {
        this.setStatus("error");
        reject(new Error("websocket error"));
      };
      ws.onclose = () => {
        this.setStatus("closed");
        this.stopHeartbeat();
        for (const w of this.waiters) {
          clearTimeout(w.timer);
          w.reject(new Error("connection closed"));
        }
        this.waiters = [];
        if (this.wantReconnect) this.scheduleReconnect();
      };
    });
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Fire-and-forget send. Returns the generated ref. */
  send(op: string, d: Record<string, unknown> = {}): string {
    const ref = "c" + ++this.refCounter;
    const frame: RawFrame = { op, d, ref };
    this.log({ dir: "out", frame, at: Date.now() });
    if (this.isOpen()) {
      this.ws!.send(JSON.stringify(frame));
    } else {
      console.warn("[ws] send while not open:", op);
    }
    return ref;
  }

  /**
   * Send, then resolve with the next inbound frame whose op is in `expect`.
   * Works even when the server doesn't echo `ref` yet.
   */
  sendAndWait(
    op: string,
    d: Record<string, unknown>,
    expect: string[],
    timeoutMs = 5000
  ): Promise<RawFrame> {
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        ops: new Set(expect),
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error("timed out waiting for " + expect.join("/")));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
      this.send(op, d);
    });
  }

  // ---- heartbeat ----
  startHeartbeat(intervalMs: number) {
    this.stopHeartbeat();
    if (!intervalMs || intervalMs < 1000) return;
    this.heartbeatTimer = setInterval(() => this.send("HEARTBEAT"), intervalMs);
  }
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // ---- reconnect ----
  /** After a successful login, keep the connection alive across drops. */
  enableReconnect(token: string) {
    this.token = token;
    this.wantReconnect = true;
  }
  /** Deliberate teardown (logout) — no reconnect. */
  disconnect() {
    this.wantReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return; // already scheduled
    const delay = BACKOFF_MS[Math.min(this.reconnectAttempts, BACKOFF_MS.length - 1)];
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect(this.url)
        .then(() => {
          if (this.token) this.send("IDENTIFY", { token: this.token });
        })
        .catch(() => {
          /* onclose will fire and schedule the next attempt */
        });
    }, delay);
  }

  /** Register a handler for a given op. Returns an unsubscribe fn. */
  on(op: string, handler: FrameHandler): () => void {
    let set = this.handlers.get(op);
    if (!set) {
      set = new Set();
      this.handlers.set(op, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  onStatus(cb: StatusListener): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  onLog(cb: LogListener): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  private onRaw(data: unknown) {
    if (typeof data !== "string") return;
    let frame: RawFrame;
    try {
      frame = JSON.parse(data);
    } catch {
      console.warn("[ws] non-JSON frame:", data);
      return;
    }
    this.log({ dir: "in", frame, at: Date.now() });

    if (this.waiters.length) {
      const remaining: Waiter[] = [];
      for (const w of this.waiters) {
        if (w.ops.has(frame.op)) {
          clearTimeout(w.timer);
          w.resolve(frame);
        } else {
          remaining.push(w);
        }
      }
      this.waiters = remaining;
    }

    this.handlers.get(frame.op)?.forEach((h) => h(frame));
  }

  private setStatus(s: Status) {
    this.status = s;
    this.statusListeners.forEach((cb) => cb(s));
  }

  private log(e: LogEntry) {
    this.logListeners.forEach((cb) => cb(e));
  }
}

export const conn = new Connection();

export const WS_URL: string =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://localhost:8080";
