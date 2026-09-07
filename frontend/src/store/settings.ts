import { create } from "zustand";

export type Density = "cozy" | "compact";

interface SettingsState {
  avatarColor: string | null; // overrides your own hashed avatar color
  density: Density;
  setAvatarColor: (c: string | null) => void;
  setDensity: (d: Density) => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ }
}

export const useSettings = create<SettingsState>((set) => ({
  avatarColor: load<string | null>("moot.avatarColor", null),
  density: load<Density>("moot.density", "cozy"),
  setAvatarColor: (c) => { save("moot.avatarColor", c); set({ avatarColor: c }); },
  setDensity: (d) => { save("moot.density", d); set({ density: d }); },
}));
