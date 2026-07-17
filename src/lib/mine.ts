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
import type { Facets, Hardiness } from "@/data/model";
import { parseHardiness } from "./hardiness";
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

/* ---- what she wrote, in the shape the guide reads ------------------- */

/** The facet keys her values can speak to. lib/query.ts's ACCESS reads exactly
 *  these off a plant, so a value here filters, counts and covers like any other.
 *  height and width have no facet; hardiness has its own control, below. */
const FACET_FIELDS = [
  "bloomColor",
  "light",
  "water",
  "soil",
  "layer",
  "lifeCycle",
  "growth",
  "attracts",
  "edibleParts",
  "nativeTo",
  "functions",
] as const;

/** Her side of one plant, resolved once when the dataset is assembled. */
export type Hers = {
  /** facet key -> her values, spelled the way the sources spell them. */
  facets: Record<string, string[]>;
  /** Her zone, when what she typed was a zone. Null keeps her out of the sort. */
  hardiness: Hardiness | null;
  /** Her photo's key in IndexedDB. */
  photo?: string;
  /** Everything she wrote here, lowercased, for the text search to scan. */
  text: string;
};

export type MineIndex = ReadonlyMap<number, Hers>;

export const NO_MINE: MineIndex = new Map();

/** Has she filled this field in on this plant? */
export function herValue(mine: MineIndex, id: number, field: string): boolean {
  const h = mine.get(id);
  if (!h) return false;
  if (field === "photo") return !!h.photo;
  if (field === "hardiness") return !!h.hardiness;
  return !!h.facets[field]?.length;
}

/**
 * Fold her records into one lookup, keyed by plant.
 *
 * Two things happen here and both matter.
 *
 * Her text is split on commas, because "Bees, hoverflies" is two answers and she
 * should not have to know that. And each piece is matched, case-insensitively,
 * against the values the sources already use for that facet, so her "purple"
 * becomes the catalogue's "Purple" and lands in the same bucket rather than
 * forking the rail into two options that mean one thing. What does not match
 * survives exactly as she typed it: "cream" is not a USDA colour and it is still
 * true, so it becomes a value of her own that only her plants have.
 *
 * The canonical spelling is the sources'; the value is hers. That is the whole
 * bargain: it lets her answers join the guide's vocabulary without ever being
 * attributed to a source, because they are never written into Plant.
 */
export function indexMine(mine: Mine[], facets: Facets): MineIndex {
  if (mine.length === 0) return NO_MINE;

  // value.toLowerCase() -> the spelling the catalogue uses, per facet.
  const canon = new Map<string, Map<string, string>>();
  for (const key of FACET_FIELDS) {
    const m = new Map<string, string>();
    for (const v of facets[key] ?? []) m.set(v.value.toLowerCase(), v.value);
    canon.set(key, m);
  }

  const out = new Map<number, Hers>();
  const facetField = new Set<string>(FACET_FIELDS);

  for (const rec of mine) {
    let hers = out.get(rec.id);
    if (!hers) {
      hers = { facets: {}, hardiness: null, text: "" };
      out.set(rec.id, hers);
    }
    if (rec.field !== "photo") hers.text += " " + rec.text.toLowerCase();

    if (rec.field === "photo") {
      hers.photo = rec.text;
    } else if (rec.field === "hardiness") {
      hers.hardiness = parseHardiness(rec.text);
    } else if (facetField.has(rec.field)) {
      const table = canon.get(rec.field)!;
      const values: string[] = [];
      for (const piece of rec.text.split(",")) {
        const t = piece.trim();
        if (!t) continue;
        const v = table.get(t.toLowerCase()) ?? t;
        if (!values.includes(v)) values.push(v);
      }
      if (values.length) hers.facets[rec.field] = values;
    }
  }
  return out;
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
