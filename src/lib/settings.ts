import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";

export type ThemePref = "light" | "dark" | "system";

/** The localStorage key. index.html's pre-paint script reads this string
 *  literally, before any module loads, to stamp the theme ahead of the first
 *  frame; it cannot import this, so the two have to agree by hand. */
export const THEME_KEY = "perennials.theme";

// The theme was the app's one hand-rolled store: a useState plus a setItem,
// which meant it held its value in a component rather than anywhere the rest of
// the app could reach. That was fine while she was the only writer. A restore is
// a second writer, and it could not tell the toggle its own answer had changed,
// so the page needed reloading to agree with its own storage. It is a store now,
// like the other seven, and there is nothing left to reload.
const store = createLocalStore<ThemePref>(THEME_KEY, "system", (raw) =>
  raw === "light" || raw === "dark" || raw === "system" ? raw : null,
);

export const readTheme = store.read;
export const writeTheme = store.write;

export function useTheme() {
  const pref = useSyncExternalStore(store.subscribe, store.read, () => store.empty);
  const setPref = useCallback((next: ThemePref) => store.write(next), []);
  useEffect(() => {
    const root = document.documentElement;
    if (pref === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", pref);
  }, [pref]);
  return [pref, setPref] as const;
}
