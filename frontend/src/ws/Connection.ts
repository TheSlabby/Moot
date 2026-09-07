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

/**
 * Single WebSocket connection to the Moot gateway.
 * Mirrors the server side: send opcode-tagged JSON frames, dispatch inbound
 * frames by `op`. No socket.io — the raw WebSocket IS the protocol.
 */
class Connection {
  private ws?: WebSocket;
  private refCounter = 0;
  private handlers = new Map<string, Set<FrameHandler>>();
  private statusListeners = new Set<StatusListener>();
  private logListeners = new Set<LogListener>();
  private waiters: Waiter[] = [];

  status: Status = "idle";

  /** Connect and resolve once the socket is open (rejects if it fails first). */
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus("connecting");
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
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
        // fail any in-flight waiters
        for (const w of this.waiters) {
          clearTimeout(w.timer);
          w.reject(new Error("connection closed"));
        }
        this.waiters = [];
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
   * Works even when the server doesn't echo `ref` yet (e.g. current READY).
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

    // resolve any waiters matching this op
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

    // dispatch to op handlers
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
