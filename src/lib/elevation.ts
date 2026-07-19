// The yard from the side: recorded heights standing on a ground line.
//
// The plan sheet is her hand with the record performing on top; elevation is
// the record performing alone, in the one dimension the sheet cannot show.
// The honesty rule holds harder here than anywhere, because in this view size
// IS the claim: a plant with no height in our data draws no silhouette. It
// stands on the line as the same mark it is on the sheet, present and
// unmeasured, and the coverage line says how many stand that way.
//
// Shapes are the layer's, never the plant's. There is no open dataset of
// species silhouettes for 8,800 plants and inventing one per plant would be
// the false-confidence trap in a new dimension; the guild layer is a recorded
// fact, so each layer gets one archetype figure and a plant with no recorded
// layer gets the plain column. Height is the measured axis; the figure only
// carries it.

export const ELEV_W = 1000;
export const ELEV_H = 600;
export const GROUND_Y = 520;
export const TOP_Y = 36;

/**
 * Her height or width, in metres, or null. The same bargain parseHardiness
 * makes: only what parses as a measurement is allowed to move the drawing,
 * and a sentence stays on the page and off the scale.
 */
const RX = /^\s*(\d+(?:\.\d+)?)\s*(m|cm|ft|')?\s*$/i;

export function parseMetres(text: string | undefined): number | null {
  if (!text) return null;
  const m = RX.exec(text.replace(",", "."));
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "m").toLowerCase();
  const metres = unit === "cm" ? n / 100 : unit === "ft" || unit === "'" ? n * 0.3048 : n;
  // The ceiling is the tallest tree on earth with headroom: past it the number
  // is a typo, and a typo must not flatten every real plant on the scale.
  if (!(metres > 0) || metres > 130) return null;
  return Math.round(metres * 100) / 100;
}

/**
 * Whose measurement stands. The record's is never overwritten; hers counts
 * exactly where the record is silent, which is the lane rule from mine.ts
 * read in metres. A recorded zero is a gap, not a measurement.
 */
export function standing(
  recorded: number | null,
  hers: string | undefined,
): { m: number; hers: boolean } | null {
  if (recorded !== null && recorded > 0) return { m: recorded, hers: false };
  const m = parseMetres(hers);
  return m === null ? null : { m, hers: true };
}

/** The height rule's step, chosen so no yard prints a wall of ticks. */
export function tickStep(maxM: number): number {
  if (maxM <= 1.5) return 0.25;
  if (maxM <= 3) return 0.5;
  if (maxM <= 6) return 1;
  if (maxM <= 12) return 2;
  if (maxM <= 30) return 5;
  return 10;
}

export type Archetype =
  | "tall-tree"
  | "tree"
  | "shrub"
  | "vine"
  | "herb"
  | "ground"
  | "root"
  | "plain";

// The seven layers GuildView stacks, each with a figure; the vocabulary is
// the spine glyph's (vines dashed, roots reaching below the line).
const BY_LAYER: Record<string, Archetype> = {
  "Tall trees": "tall-tree",
  Trees: "tree",
  Shrubs: "shrub",
  Vines: "vine",
  Herbs: "herb",
  "Ground cover": "ground",
  Roots: "root",
};

/** An unrecorded layer wears the plain column, never a tree's crown. */
export function archetypeOf(layer: string | null | undefined): Archetype {
  return (layer && BY_LAYER[layer]) || "plain";
}

/** Crown width as a fraction of height, where no width is recorded. Ratio of
 *  an archetype, not a fact about the plant; a recorded width replaces it. */
export const CROWN_RATIO: Record<Archetype, number> = {
  "tall-tree": 0.55,
  tree: 0.7,
  shrub: 0.9,
  vine: 0.28,
  herb: 0.55,
  ground: 4,
  root: 0.55,
  plain: 0.4,
};
