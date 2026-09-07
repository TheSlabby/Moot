import { create } from "zustand";
import { conn, type Status } from "../ws/Connection";

export interface CurrentUser {
  id: string;
  username: string;
  avatar?: string;
}

interface SessionState {
  status: Status;
  user: CurrentUser | null;
  sessionId: string | null;
  token: string | null;
  setStatus: (s: Status) => void;
  login: (user: CurrentUser, sessionId: string, token: string) => void;
  setUsername: (username: string) => void;
  setAvatar: (avatar: string) => void;
  logout: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: "idle",
  user: null,
  sessionId: null,
  token: null,
  setStatus: (status) => set({ status }),
  login: (user, sessionId, token) => set({ user, sessionId, token }),
  setUsername: (username) => set((s) => (s.user ? { user: { ...s.user, username } } : {})),
  setAvatar: (avatar) => set((s) => (s.user ? { user: { ...s.user, avatar } } : {})),
  logout: () => {
    conn.disconnect(); // stop reconnect + close the socket
    try { localStorage.removeItem("moot.token"); } catch { /* ignore */ }
    set({ user: null, sessionId: null, token: null });
  },
}));
