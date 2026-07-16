// "Kept" — the plants she has decided on.
//
// spots.ts already saved the conditions of a *place* ("north bed", "wet corner").
// It never saved the plants, so the answer to a search only ever existed in the
// address bar: fine for sending someone a link, useless for standing in the yard
// in April wondering what you picked in January. This is the dog-ear.
import { useCallback, useSyncExternalStore } from "react";

/** `at` is insertion order, so the list reads back in the order she found them. */
export type Kept = { id: number; at: number };

const LS_KEY = "perennials.kept.v1";

let cache: Kept[] | null = null;
const listeners = new Set<() => void>();

function read(): Kept[] {
  if (cache) return cache;
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    // A hand-edited or half-written value must not take the page down with it.
    cache = Array.isArray(raw)
      ? (raw.filter((k) => typeof (k as Kept)?.id === "number") as Kept[])
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(kept: Kept[]) {
  cache = kept;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(kept));
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/* A new [] every call would re-render forever; useSyncExternalStore compares by
   identity. read() returns the cache, so it is stable by construction. */
const EMPTY: Kept[] = [];

export function useKept() {
  const kept = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((id: number) => {
    const now = read();
    write(
      now.some((k) => k.id === id)
        ? now.filter((k) => k.id !== id)
        : [...now, { id, at: Date.now() }],
    );
  }, []);

  const remove = useCallback((id: number) => {
    write(read().filter((k) => k.id !== id));
  }, []);

  return { kept, toggle, remove };
}

export function useIsKept(id: number): boolean {
  const { kept } = useKept();
  return kept.some((k) => k.id === id);
}
