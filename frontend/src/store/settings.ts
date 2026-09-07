import { create } from "zustand";

export type Density = "cozy" | "compact";
export type ThemeId = "default" | "fantasy";

// Registry of available themes — add a new one here + a [data-theme] block in index.css.
export const THEMES: { id: ThemeId; label: string; blurb: string }[] = [
  { id: "default", label: "Midnight", blurb: "The classic dark look." },
  { id: "fantasy", label: "Fantasy", blurb: "Parchment, gold & deep wood." },
];

interface SettingsState {
  avatarColor: string | null;
  density: Density;
  theme: ThemeId;
  setAvatarColor: (c: string | null) => void;
  setDensity: (d: Density) => void;
  setTheme: (t: ThemeId) => void;
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

// apply the theme to the document root (default = no attribute)
function applyTheme(t: ThemeId) {
  if (typeof document === "undefined") return;
  if (t === "default") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

const initialTheme = load<ThemeId>("moot.theme", "default");
applyTheme(initialTheme);

export const useSettings = create<SettingsState>((set) => ({
  avatarColor: load<string | null>("moot.avatarColor", null),
  density: load<Density>("moot.density", "cozy"),
  theme: initialTheme,
  setAvatarColor: (c) => { save("moot.avatarColor", c); set({ avatarColor: c }); },
  setDensity: (d) => { save("moot.density", d); set({ density: d }); },
  setTheme: (t) => { save("moot.theme", t); applyTheme(t); set({ theme: t }); },
}));
