// Her dates against the record.
//
// USDA's bloom period is a continent average; a mark of hers is a real day in
// one yard. When her marks land in slots the printed band does not cover, that
// is her yard teaching the record, and the guide says so plainly. Neither side
// is called wrong, because neither is: a plant can bloom in April in her zone
// and in May on the continent's average. Divergence needs both sides. A missing
// period is a gap in our data, not a band she can fall outside of, and with no
// marks nothing was witnessed; either way there is nothing to say.
import type { Plant } from "@/data/model";
import { BLOOM_SLOTS, bloomPeriodLabel, bloomSlots, type BloomSlot } from "./bloom";
import type { MineIndex } from "./mine";
import { ACCESS } from "./query";
import { seenSlots, type Seen } from "./seen";

/** Her slots the record does not cover, in the year's order. Empty when either
 *  side is empty: no record means no band to fall outside of, and no marks
 *  means nothing witnessed. */
export function outsideRecord(
  hers: readonly BloomSlot[],
  recorded: readonly BloomSlot[],
): BloomSlot[] {
  if (hers.length === 0 || recorded.length === 0) return [];
  return BLOOM_SLOTS.filter((s) => hers.includes(s) && !recorded.includes(s));
}

/** "Mid Spring", "Mid Spring and Fall", "Winter, Mid Spring, and Fall". */
const join = (slots: readonly BloomSlot[]): string =>
  slots.length === 1
    ? slots[0]
    : slots.length === 2
      ? `${slots[0]} and ${slots[1]}`
      : `${slots.slice(0, -1).join(", ")}, and ${slots[slots.length - 1]}`;

/** The divergence in one sentence, or null when there is none. Her sighting is
 *  stated as fact, because she stood there; the period is attributed to USDA
 *  by name, because it is theirs; neither is called wrong. */
export function phenologyLine(
  hers: readonly BloomSlot[],
  recordedPeriod: string | null | undefined,
): string | null {
  if (!recordedPeriod) return null;
  const outside = outsideRecord(hers, bloomSlots(recordedPeriod));
  if (outside.length === 0) return null;
  return `You saw it bloom in ${join(outside)}; USDA's record says ${bloomPeriodLabel(recordedPeriod)}.`;
}

/**
 * The pollinator famine, read honestly.
 *
 * A gap is a slot where something is recorded in bloom (the printed band, or
 * her mark) and none of those blooming plants has a recorded flower visitor.
 * A slot where nothing blooms at all is NOT a gap here — the calendar's own
 * verdict speaks there, and stacking a second claim on the same silence would
 * say it twice. `covered`/`of` is the visitor coverage over these plants, and
 * the caller must print it: with visitors recorded for nobody, the gaps list
 * is every blooming slot and means only "we have no visitor data", so the
 * caller shows the coverage sentence alone.
 */
export function visitorGaps(
  plants: readonly Plant[],
  herIndex: MineIndex,
  seen: Seen[],
): { gaps: BloomSlot[]; covered: number; of: number } {
  let covered = 0;
  const blooming = new Set<BloomSlot>();
  const fed = new Set<BloomSlot>();
  for (const p of plants) {
    const hers = herIndex.get(p.id);
    const v = ACCESS.attracts(p, hers);
    const hasVisitors = v !== null && (typeof v === "string" || v.length > 0);
    if (hasVisitors) covered += 1;
    const slots = new Set<BloomSlot>([...bloomSlots(p.bloomPeriod), ...seenSlots(seen, p.id)]);
    for (const s of slots) {
      blooming.add(s);
      if (hasVisitors) fed.add(s);
    }
  }
  return {
    gaps: BLOOM_SLOTS.filter((s) => blooming.has(s) && !fed.has(s)),
    covered,
    of: plants.length,
  };
}
