/**
 * Bloom colour as pigment.
 *
 * tokens.css states the rule of the house: "saturated color only ever encodes
 * plant data (bloom swatches, function tags)." Bloom is the one facet whose
 * values *are* colours, and it shipped as the words "Yellow" and "Purple" set
 * in ink, asking a gardener to read a colour and re-imagine it.
 *
 * USDA records exactly these eight, so this is a closed list, not an open
 * colour-mapping problem. The swatch always sits *beside* the word and never
 * replaces it: in direct sun the word is the more legible of the two, and a
 * screen reader gets nothing from a dot.
 *
 * A value that is not in this map renders with no swatch at all. Inventing a
 * colour for it would be a claim the data does not make.
 */
export const BLOOM_HEX: Record<string, string> = {
  Yellow: "#e0a92e",
  White: "#f4f1e2",
  Purple: "#7a5497",
  Green: "#5c8a45",
  Red: "#a63028",
  Blue: "#41689e",
  Brown: "#7c5a3a",
  Orange: "#d4762a",
};

/** USDA's word for "no defined bloom window", which, to a gardener planning a
 *  pollinator sequence, is the most useful thing a plant can do. Say it plainly. */
export const BLOOM_PERIOD_LABEL: Record<string, string> = {
  Indeterminate: "Blooms continuously",
};

export const bloomPeriodLabel = (v: string) => BLOOM_PERIOD_LABEL[v] ?? v;

/**
 * The succession axis.
 *
 * USDA records twelve bloom periods and they are not months; they are its own
 * season words. Laying them on a Jan–Dec calendar would invent precision the
 * source does not have: "Late Spring" is not May, it is late spring, and in her
 * zone that is a different fortnight than in Georgia. So the axis *is* the
 * source's vocabulary, ordered the way a year runs.
 *
 * The unqualified values are the subtle ones. "Spring" does not mean mid-spring;
 * it means the record only ever said spring. It therefore covers the whole
 * spring band rather than having a slot picked on its behalf.
 */
export const BLOOM_SLOTS = [
  "Winter",
  "Late Winter",
  "Early Spring",
  "Mid Spring",
  "Late Spring",
  "Early Summer",
  "Mid Summer",
  "Late Summer",
  "Fall",
] as const;

export type BloomSlot = (typeof BLOOM_SLOTS)[number];

const PERIOD_SLOTS: Record<string, readonly BloomSlot[]> = {
  Winter: ["Winter"],
  "Late Winter": ["Late Winter"],
  "Early Spring": ["Early Spring"],
  "Mid Spring": ["Mid Spring"],
  "Late Spring": ["Late Spring"],
  Spring: ["Early Spring", "Mid Spring", "Late Spring"],
  "Early Summer": ["Early Summer"],
  "Mid Summer": ["Mid Summer"],
  "Late Summer": ["Late Summer"],
  Summer: ["Early Summer", "Mid Summer", "Late Summer"],
  Fall: ["Fall"],
  // Blooms continuously, so it is in flower in every slot. That is the datum,
  // not a guess: these are the plants that carry a sequence through its gaps.
  Indeterminate: BLOOM_SLOTS,
};

/** The slots a recorded period covers. An unrecorded or unknown value covers
 *  none, and a caller must not read that as "does not flower". */
export const bloomSlots = (period: string | null | undefined): readonly BloomSlot[] =>
  period ? PERIOD_SLOTS[period] ?? [] : [];

/**
 * Her date onto the nine-word axis.
 *
 * This looks like the sin described above (pinning the season words to a
 * calendar), but it runs in the honest direction. USDA's "Late Spring" is a
 * continent average we refuse to place on months; a tap on "Blooming today" is
 * one real date in one yard, and coarsening it onto this axis loses precision
 * instead of inventing it. The reading is zone 6, northern hemisphere: hers.
 * The dates themselves are never discarded; only the calendar coarsens.
 */
const MONTH_SLOT: readonly BloomSlot[] = [
  "Winter", // Jan
  "Late Winter", // Feb
  "Early Spring", // Mar
  "Mid Spring", // Apr
  "Late Spring", // May
  "Early Summer", // Jun
  "Mid Summer", // Jul
  "Late Summer", // Aug
  "Fall", // Sep
  "Fall", // Oct
  "Fall", // Nov
  "Winter", // Dec
];

export const slotForDate = (at: number): BloomSlot => MONTH_SLOT[new Date(at).getMonth()];

/** The calendar's header: seasons over the slots they span. */
export const BLOOM_SEASONS: { name: string; span: number }[] = [
  { name: "Winter", span: 2 },
  { name: "Spring", span: 3 },
  { name: "Summer", span: 3 },
  { name: "Fall", span: 1 },
];

/** The qualifier alone, for the tick row: "Winter · Late", "Early · Mid · Late".
 *  The season above it already carries the noun. */
export const SLOT_TICK: Record<BloomSlot, string> = {
  Winter: "Winter",
  "Late Winter": "Late",
  "Early Spring": "Early",
  "Mid Spring": "Mid",
  "Late Spring": "Late",
  "Early Summer": "Early",
  "Mid Summer": "Mid",
  "Late Summer": "Late",
  Fall: "Fall",
};
