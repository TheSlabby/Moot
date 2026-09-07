import { create } from "zustand";
import { conn, type Status } from "../ws/Connection";

export interface CurrentUser {
  id: string;
  username: string;
}

interface SessionState {
  status: Status;
  user: CurrentUser | null;
  sessionId: string | null;
  setStatus: (s: Status) => void;
  login: (user: CurrentUser, sessionId: string) => void;
  setUsername: (username: string) => void;
  logout: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: "idle",
  user: null,
  sessionId: null,
  setStatus: (status) => set({ status }),
  login: (user, sessionId) => set({ user, sessionId }),
  setUsername: (username) => set((s) => (s.user ? { user: { ...s.user, username } } : {})),
  logout: () => {
    conn.disconnect(); // stop reconnect + close the socket
    set({ user: null, sessionId: null });
  },
}));
