// "Seen": the days she saw a plant in flower.
//
// USDA's bloom period is a continent average; a tap on "Mark blooming today" is her
// yard on a real date. The two records never mix: taps live here, in their own
// store, and the calendar draws them as her own mark above the printed band.
// The dates themselves are the record. Nothing ever discards them; only the
// calendar coarsens them onto its nine-word axis.
import { useCallback, useSyncExternalStore } from "react";
import { BLOOM_SLOTS, slotForDate, type BloomSlot } from "./bloom";
import { createLocalStore } from "./localStore";

/** One observation: she saw this plant in bloom on this day. */
export type Seen = { id: number; at: number };

/** Her marks for one plant, coarsened onto the calendar's nine-word axis and
 *  ordered the way a year runs. The dates themselves stay in the store; this is
 *  only the reading the axis can show. */
export function seenSlots(seen: Seen[], id: number): readonly BloomSlot[] {
  const hit = new Set(seen.filter((s) => s.id === id).map((s) => slotForDate(s.at)));
  return BLOOM_SLOTS.filter((slot) => hit.has(slot));
}

/** Same local day: the granularity of a tap. */
export const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const store = createLocalStore<Seen[]>("perennials.seen.v1", [], (raw) =>
  Array.isArray(raw)
    ? (raw.filter(
        (s) => typeof (s as Seen)?.id === "number" && typeof (s as Seen)?.at === "number",
      ) as Seen[])
    : null,
);

/** Read and replace the whole store, for lib/backup.ts. It goes through the
 *  store rather than localStorage so a restore lands in the cache and pokes
 *  every subscriber; writing the key raw is what used to need a reload. */
export const readSeen = store.read;
export const writeSeen = store.write;

export function useSeen() {
  const seen = useSyncExternalStore(store.subscribe, store.read, () => store.empty);

  /** Stamp today. A second tap the same day un-stamps it: the undo for a
   *  pocket tap, and the only way "today" can ever hold two entries is never. */
  const markToday = useCallback((id: number) => {
    const now = Date.now();
    const all = store.read();
    const rest = all.filter((s) => !(s.id === id && sameDay(s.at, now)));
    store.write(rest.length === all.length ? [...rest, { id, at: now }] : rest);
  }, []);

  /** Her record, so she can strike a day from it. */
  const remove = useCallback((id: number, at: number) => {
    store.write(store.read().filter((s) => !(s.id === id && s.at === at)));
  }, []);

  return { seen, markToday, remove };
}
