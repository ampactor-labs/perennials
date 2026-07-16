// Her notes: the fourth source, and the only one that records a yard.
//
// USDA's "Late Spring" is a continent-wide average; "third week of May, by the
// fence" is true. The sources' lane and hers never mix: source values are never
// edited, her words are never attributed to a source, and a note is not a keep.
// "Avoid, spreads like hell" is a note about a plant she has decided against,
// and it must not put that plant in the bloom year.
import { useCallback, useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";

/** `at` is when she last touched it; a gardener dates her entries. */
export type Note = { id: number; text: string; at: number };

const store = createLocalStore<Note[]>("perennials.notes.v1", [], (raw) =>
  Array.isArray(raw)
    ? (raw.filter(
        (n) => typeof (n as Note)?.id === "number" && typeof (n as Note)?.text === "string",
      ) as Note[])
    : null,
);

export function useNotes() {
  const notes = useSyncExternalStore(store.subscribe, store.read, () => store.empty);

  /** Saving an emptied note deletes it; a blank page is not an entry. */
  const set = useCallback((id: number, text: string) => {
    const trimmed = text.trim();
    const rest = store.read().filter((n) => n.id !== id);
    store.write(trimmed ? [...rest, { id, text: trimmed, at: Date.now() }] : rest);
  }, []);

  const remove = useCallback((id: number) => {
    store.write(store.read().filter((n) => n.id !== id));
  }, []);

  return { notes, set, remove };
}

export const noteDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
