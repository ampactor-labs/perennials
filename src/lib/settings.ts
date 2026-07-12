import { useCallback, useEffect, useState } from "react";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => read(key, fallback));
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* private mode / quota — hold in memory only */
      }
    },
    [key],
  );
  return [value, set] as const;
}

// One-time rename of legacy localStorage keys (the project was once "perrenials").
// Runs before the app reads, so saved zone, theme, and spots survive the rename.
export function migrateLegacyKeys() {
  const renames: [string, string][] = [
    ["perrenials.zone", "perennials.zone"],
    ["perrenials.theme", "perennials.theme"],
    ["perrenials.spots.v1", "perennials.spots.v1"],
  ];
  try {
    for (const [oldKey, newKey] of renames) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch {
    /* no storage available (private mode) */
  }
}

export type ThemePref = "light" | "dark" | "system";

/** Her home zone drives the default hardiness filter. Book case study = zone 6. */
export function useZone() {
  return usePersistent<number>("perennials.zone", 6);
}

export function useTheme() {
  const [pref, setPref] = usePersistent<ThemePref>("perennials.theme", "system");
  useEffect(() => {
    const root = document.documentElement;
    if (pref === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", pref);
  }, [pref]);
  return [pref, setPref] as const;
}
