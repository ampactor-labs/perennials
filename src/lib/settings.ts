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

export type ThemePref = "light" | "dark" | "system";

/** Her home zone drives the default hardiness filter. Book case study = zone 6. */
export function useZone() {
  return usePersistent<number>("perrenials.zone", 6);
}

export function useTheme() {
  const [pref, setPref] = usePersistent<ThemePref>("perrenials.theme", "system");
  useEffect(() => {
    const root = document.documentElement;
    if (pref === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", pref);
  }, [pref]);
  return [pref, setPref] as const;
}
