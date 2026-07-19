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

/* ---- the figures, as geometry ----------------------------------------- */

type P = [number, number];

/** One archetype's drawing: a fill path, and the strokes that aren't fills.
 *  ElevationView and the exported sheet both draw from this, so the figure a
 *  client is handed is the figure she saw. */
export type Figure = {
  body: string;
  /** The trunk, for the tree layers. */
  trunk?: [P, P];
  /** The below-ground reach, for the root layer. */
  taproot?: [P, P];
};

const column = (cx: number, g: number, h: number, w: number) => {
  const r = Math.min(w / 2, h);
  return `M${cx - w / 2} ${g} L${cx - w / 2} ${g - h + r} Q${cx - w / 2} ${g - h} ${cx} ${g - h} Q${cx + w / 2} ${g - h} ${cx + w / 2} ${g - h + r} L${cx + w / 2} ${g} Z`;
};

const dome = (cx: number, g: number, h: number, w: number) =>
  `M${cx - w / 2} ${g} Q${cx - w / 2} ${g - h} ${cx} ${g - h} Q${cx + w / 2} ${g - h} ${cx + w / 2} ${g} Z`;

const tuft = (cx: number, g: number, h: number, w: number) =>
  `M${cx - w / 2} ${g} Q${cx - w / 8} ${g - h * 0.85} ${cx} ${g - h} Q${cx + w / 8} ${g - h * 0.85} ${cx + w / 2} ${g} Z`;

const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;

export function figurePaths(
  kind: Archetype,
  cx: number,
  ground: number,
  h: number,
  w: number,
): Figure {
  if (kind === "tall-tree" || kind === "tree") {
    const trunkFrac = kind === "tree" ? 0.42 : 0.5;
    const ry = (h * (1 - trunkFrac)) / 2;
    return {
      body: ellipse(cx, ground - h + ry, w / 2, ry),
      trunk: [
        [cx, ground],
        [cx, ground - h + ry],
      ],
    };
  }
  if (kind === "root") {
    return {
      body: tuft(cx, ground, h, w),
      taproot: [
        [cx, ground],
        [cx, ground + 22],
      ],
    };
  }
  if (kind === "shrub") return { body: dome(cx, ground, h, w) };
  if (kind === "herb") return { body: tuft(cx, ground, h, w) };
  if (kind === "ground")
    return { body: `M${cx - w / 2} ${ground} Q${cx} ${ground - 2 * h} ${cx + w / 2} ${ground} Z` };
  return { body: column(cx, ground, h, w) }; // vine, and the plain column
}
