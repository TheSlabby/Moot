import { create } from "zustand";
import type { LogEntry } from "../ws/Connection";

interface DebugState {
  log: LogEntry[];
  open: boolean;
  push: (e: LogEntry) => void;
  clear: () => void;
  toggle: () => void;
}

const MAX = 200;

export const useDebug = create<DebugState>((set) => ({
  log: [],
  open: false,
  push: (e) => set((s) => ({ log: [...s.log.slice(-(MAX - 1)), e] })),
  clear: () => set({ log: [] }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
