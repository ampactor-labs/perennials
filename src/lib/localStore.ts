// One localStorage store instead of three copies.
//
// spots, kept and notes each need the same thing: a JSON value in localStorage,
// a stable snapshot for useSyncExternalStore, and listeners poked on write.
// Three hand-rolled copies of that plumbing is three places for the same
// staleness bug. The value semantics stay with the callers; this owns only the
// storage.
type Store<T> = {
  read: () => T;
  write: (next: T) => void;
  subscribe: (cb: () => void) => () => void;
  /** Stable reference for useSyncExternalStore's server snapshot. */
  empty: T;
};

// Ask the browser, once, not to evict this origin's storage under pressure.
// The dataset can always be re-downloaded; what she keeps and writes cannot.
// Asked on first write — first *decision* — not on load: an empty guide has
// nothing worth protecting, and browsers weigh engagement when granting it.
let persistAsked = false;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

export function createLocalStore<T>(
  key: string,
  empty: T,
  /** Shape-check a parsed value; return null to fall back to empty. A
   *  hand-edited or half-written entry must not take the page down with it. */
  sanitize: (raw: unknown) => T | null,
): Store<T> {
  let cache: T | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  const read = (): T => {
    if (cache !== null) return cache;
    try {
      cache = sanitize(JSON.parse(localStorage.getItem(key) ?? "null")) ?? empty;
    } catch {
      cache = empty;
    }
    return cache;
  };

  const write = (next: T) => {
    cache = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      askPersist();
    } catch {
      /* private mode: the session keeps working from cache, nothing survives it */
    }
    notify();
  };

  // Another tab wrote: drop the cache so the next snapshot re-reads, and let
  // subscribers re-render. The event only ever fires in the tabs that didn't.
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      cache = null;
      notify();
    });
  }

  return {
    read,
    write,
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    empty,
  };
}
