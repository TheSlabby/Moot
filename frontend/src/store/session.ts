import { create } from "zustand";
import type { Status } from "../ws/Connection";

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
  logout: () => void;
}

export const useSession = create<SessionState>((set) => ({
  status: "idle",
  user: null,
  sessionId: null,
  setStatus: (status) => set({ status }),
  login: (user, sessionId) => set({ user, sessionId }),
  logout: () => set({ user: null, sessionId: null }),
}));
