// Her values, on the fields our sources left empty.
//
// notes.ts holds her prose and seen.ts holds her dates; this holds everything
// else she fills in herself. Together they are the fourth source, and the lane
// rule from notes.ts governs all three: source values are never edited, hers are
// never attributed to a source. She can fill a blank. She cannot overwrite
// Permapeople, and nothing here ever tries to.
//
// This is the honesty rule read the other way round. The rule says we don't
// invent a value to fill a gap. It never said *she* couldn't: she is standing in
// front of the plant with the flower in her hand, which is a better instrument
// than anything we scraped. The only thing that matters is that the page keeps
// saying which of the two is speaking, so every value here renders in her ink.
import { useCallback, useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";
import { deletePhoto } from "./photos";

/** The fields she can fill. Keyed to Plant, so a value here always has a blank
 *  on the page to sit in; a field the sources filled never offers the "+". */
// No `bloomPeriod` here on purpose. She already has a bloom record and it is a
// better one: seen.ts stamps real dates in her yard, where a typed "Late Spring"
// would only be her copying USDA's guess back at us. Two records of the same
// fact is the thing seen.ts exists to keep apart, so the calendar and the button
// stay the only way she says when a plant blooms.
export const MINE_FIELDS = [
  "bloomColor",
  "light",
  "water",
  "soil",
  "layer",
  "lifeCycle",
  "growth",
  "height",
  "width",
  "hardiness",
  "attracts",
  "edibleParts",
  "nativeTo",
  "functions",
  "photo",
] as const;

export type MineField = (typeof MINE_FIELDS)[number];

/** One value of hers. `text` is what she typed; for `photo` it is the IndexedDB
 *  key of the image, because a photo does not fit in localStorage. */
export type Mine = { id: number; field: MineField; text: string; at: number };

/** Her longest sensible answer is a short list ("Bees, hoverflies"), not an
 *  essay; the note is where an essay goes. The cap keeps a hand-edited entry
 *  from eating the origin's 5MB. */
export const MAX_MINE = 120;

const isField = (f: unknown): f is MineField =>
  typeof f === "string" && (MINE_FIELDS as readonly string[]).includes(f);

const store = createLocalStore<Mine[]>("perennials.mine.v1", [], (raw) =>
  Array.isArray(raw)
    ? (raw.filter(
        (m) =>
          typeof (m as Mine)?.id === "number" &&
          isField((m as Mine)?.field) &&
          typeof (m as Mine)?.text === "string" &&
          (m as Mine).text.trim().length > 0,
      ) as Mine[]).map((m) => ({ ...m, text: m.text.slice(0, MAX_MINE) }))
    : null,
);

/** Read and replace the whole store, for lib/backup.ts. It goes through the
 *  store rather than localStorage so a restore lands in the cache and pokes
 *  every subscriber; writing the key raw is what used to need a reload. */
export const readMine = store.read;
export const writeMine = store.write;

export function mineFor(mine: Mine[], id: number, field: MineField): Mine | undefined {
  return mine.find((m) => m.id === id && m.field === field);
}

export function useMine() {
  const mine = useSyncExternalStore(store.subscribe, store.read, () => store.empty);

  /** Saving an emptied value deletes it, the same bargain notes.ts makes. */
  const set = useCallback((id: number, field: MineField, text: string): boolean => {
    const trimmed = text.trim().slice(0, MAX_MINE);
    const rest = store.read().filter((m) => !(m.id === id && m.field === field));
    return store.write(trimmed ? [...rest, { id, field, text: trimmed, at: Date.now() }] : rest);
  }, []);

  /** Dropping a photo value has to drop the blob too, or IndexedDB keeps a
   *  megabyte she can no longer see or reach. */
  const remove = useCallback((id: number, field: MineField) => {
    const hit = mineFor(store.read(), id, field);
    if (field === "photo" && hit) void deletePhoto(hit.text);
    store.write(store.read().filter((m) => !(m.id === id && m.field === field)));
  }, []);

  return { mine, set, remove };
}
