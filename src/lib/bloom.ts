/**
 * Bloom colour as pigment.
 *
 * tokens.css states the rule of the house: "saturated color only ever encodes
 * plant data (bloom swatches, function tags)." Bloom is the one facet whose
 * values *are* colours, and it shipped as the words "Yellow" and "Purple" set
 * in ink — asking a gardener to read a colour and re-imagine it.
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

/** USDA's word for "no defined bloom window" — which, to a gardener planning a
 *  pollinator sequence, is the most useful thing a plant can do. Say it plainly. */
export const BLOOM_PERIOD_LABEL: Record<string, string> = {
  Indeterminate: "Blooms continuously",
};

export const bloomPeriodLabel = (v: string) => BLOOM_PERIOD_LABEL[v] ?? v;
