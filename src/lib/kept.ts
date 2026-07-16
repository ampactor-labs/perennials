// "Kept" — the plants she has decided on.
//
// spots.ts already saved the conditions of a *place* ("north bed", "wet corner").
// It never saved the plants, so the answer to a search only ever existed in the
// address bar: fine for sending someone a link, useless for standing in the yard
// in April wondering what you picked in January. This is the dog-ear.
import { useCallback, useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";

/** `at` is insertion order, so the list reads back in the order she found them. */
export type Kept = { id: number; at: number };

const store = createLocalStore<Kept[]>("perennials.kept.v1", [], (raw) =>
  Array.isArray(raw) ? (raw.filter((k) => typeof (k as Kept)?.id === "number") as Kept[]) : null,
);

export function useKept() {
  const kept = useSyncExternalStore(store.subscribe, store.read, () => store.empty);

  const toggle = useCallback((id: number) => {
    const now = store.read();
    store.write(
      now.some((k) => k.id === id)
        ? now.filter((k) => k.id !== id)
        : [...now, { id, at: Date.now() }],
    );
  }, []);

  const remove = useCallback((id: number) => {
    store.write(store.read().filter((k) => k.id !== id));
  }, []);

  return { kept, toggle, remove };
}

export function useIsKept(id: number): boolean {
  const { kept } = useKept();
  return kept.some((k) => k.id === id);
}
