// The zone the guide sorts for (home), as distinct from a zone atom in a
// search, which filters. The default view used to open in the server's
// documentation order, so a tropical nobody here could plant outranked a
// serviceberry whenever contributors wrote more about it. No source records
// "commonly grown near you"; what the record does hold is hardiness, and the
// one regional fact the guide owns is the zone she gardens in. It is never
// asked for: it starts at 6 and re-learns itself every time she names a zone.
import { useSyncExternalStore } from "react";
import type { Hardiness, Plant } from "@/data/model";
import { hardyIn } from "./hardiness";
import { createLocalStore } from "./localStore";

const store = createLocalStore<number>(
  "perennials.zone.v1",
  6,
  (raw) => (typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 13 ? raw : null),
  // No live cross-tab sync: this value decides the dataset's sort order, and a
  // zone named in one tab must not reorder (and re-truncate to the first page)
  // a list another tab is scrolled three hundred cards into. Review caught this;
  // other tabs pick the new zone up when they next assemble the dataset.
  { crossTab: false },
);

/** Read and replace the whole store, for lib/backup.ts. It goes through the
 *  store rather than localStorage so a restore lands in the cache and pokes
 *  every subscriber; writing the key raw is what used to need a reload. */
export const readZone = store.read;
export const writeZone = store.write;

/** She named a zone (a search, a spot), so that is where home is now. */
export const learnHomeZone = (zone: number) => {
  if (Number.isInteger(zone) && zone >= 1 && zone <= 13 && zone !== store.read()) {
    store.write(zone);
  }
};

export function useHomeZone(): number {
  return useSyncExternalStore(store.subscribe, store.read, () => store.empty);
}

/**
 * 0: recorded hardy there. 1: nothing to go on. 2: the record says it cannot
 * overwinter there.
 *
 * The middle band is the honesty rule expressed as a sort order: a plant we have
 * no measurement for must never rank below a plant the record says dies there,
 * because that would read a gap in our data as a fact about the plant. Band 2 is
 * a demotion the data actually states; band 1 is only paperwork.
 *
 * Her number counts, and only when it is a number: `hers.hardiness` is null
 * unless what she typed parsed as a zone (see parseHardiness), so a sentence
 * leaves the plant in band 1 where it belongs. She is asked second, not because
 * the record outranks her, but because the "+" only appears where the record is
 * blank, so the two can never both be here.
 */
export function hardyBand(p: Plant, zone: number, hers?: { hardiness: Hardiness | null }): 0 | 1 | 2 {
  const h = p.hardiness ?? hers?.hardiness;
  if (!h) return 1;
  return hardyIn(h, zone) ? 0 : 2;
}
