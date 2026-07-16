// One localStorage store instead of three copies.
//
// spots, kept and notes each need the same thing: a JSON value in localStorage,
// a stable snapshot for useSyncExternalStore, and listeners poked on write.
// Three hand-rolled copies of that plumbing is three places for the same
// staleness bug. The value semantics stay with the callers; this owns only the
// storage.
type Store<T> = {
  read: () => T;
  /** Returns false when localStorage refused the write (quota, private mode).
   *  The session keeps working from cache either way — but a caller holding
   *  something she cannot afford to lose, like a client's yard plan, should
   *  say so instead of letting the failure stay silent. */
  write: (next: T) => boolean;
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
  opts?: {
    /** Live cross-tab sync (the default). A store that feeds derived structure
     *  must pass false: the home zone re-sorts the whole dataset, and a zone
     *  named in one tab would reorder and truncate a list another tab is
     *  scrolled deep into. Opted out, the other tab reads the new value on its
     *  next load instead of mid-scroll. */
    crossTab?: boolean;
  },
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

  const write = (next: T): boolean => {
    cache = next;
    let persisted = true;
    try {
      localStorage.setItem(key, JSON.stringify(next));
      askPersist();
    } catch {
      /* private mode or quota: the session keeps working from cache */
      persisted = false;
    }
    notify();
    return persisted;
  };

  // Another tab wrote: drop the cache so the next snapshot re-reads, and let
  // subscribers re-render. The event only ever fires in the tabs that didn't.
  if (typeof window !== "undefined" && (opts?.crossTab ?? true)) {
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
