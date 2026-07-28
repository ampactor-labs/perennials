// The guide, opened onto the garden as it stands today.
//
// The browse page's strip reads the season straight off the device's date and
// asks one question of her own plants: who is recorded in bloom right now?
// "Recorded" is the load-bearing word. The printed band answers for USDA, her
// marks answer for her, and a plant with neither is not "quiet" — it is a gap
// in our data, and the strip says which.
import type { Plant } from "@/data/model";
import { bloomSlots, slotForDate, type BloomSlot } from "./bloom";
import { seenSlots, type Seen } from "./seen";

/** Today's place on the nine-word axis: the device's date, coarsened in the
 *  same honest direction her marks are (bloom.ts, slotForDate). */
export const todaySlot = (): BloomSlot => slotForDate(Date.now());

/**
 * Who is recorded in bloom in this slot. `recorded`: the printed band covers
 * it. `byHer`: only her own mark puts it in bloom here — drawn in her ink.
 * A plant with neither band nor mark is in neither list, and the caller must
 * never present that silence as "not blooming".
 */
export function inBloomNow(
  plants: readonly Plant[],
  seen: Seen[],
  slot: BloomSlot,
): { recorded: Plant[]; byHer: Plant[] } {
  const recorded: Plant[] = [];
  const byHer: Plant[] = [];
  for (const p of plants) {
    if (bloomSlots(p.bloomPeriod).includes(slot)) recorded.push(p);
    else if (seenSlots(seen, p.id).includes(slot)) byHer.push(p);
  }
  return { recorded, byHer };
}
