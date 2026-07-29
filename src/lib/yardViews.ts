// How the yard's plants draw, computed once and shared.
//
// The page used to rebuild these arrays inline on every render, and the model
// view paid for it: YardModel's scene effect keys on `figs`, so a 4-second
// toast handed it a fresh reference and tore down every mesh twice. These are
// the same derivations as pure functions, so the page can memoize them on
// their real inputs — and so the annual can re-render a yard's sheet from the
// exact geometry she saw, without standing the page up.
//
// The lane rules ride along unchanged: every plant read goes through ACCESS,
// heights resolve record-first (standing), and nothing here computes a sun
// without her latitude and her span — sceneOf returns null instead of a guess.
import type { Plant } from "@/data/model";
import type { TokenView } from "@/components/YardCanvas";
import { BLOOM_HEX, bloomSlots, type BloomSlot } from "./bloom";
import { archetypeOf, standing } from "./elevation";
import { groundAt, groundRange } from "./ground";
import { growthBand } from "./growth";
import { mineFor, type Mine, type MineIndex } from "./mine";
import { ACCESS } from "./query";
import { seenSlots, type Seen } from "./seen";
import {
  blockerOf,
  dayForSlot,
  directHours,
  lightTier,
  sunAt,
  sunlit,
  tierWord,
  type Blocker,
  type Terrain,
} from "./sun";
import { SHEET_H, SHEET_W, type Yard } from "./yards";

/** A placed plant, standing: what elevation and the model draw. */
export type Fig = TokenView & {
  /** Sheet y, for painter's order: low on the sheet is near the viewer. */
  depth: number;
  layer: string | null;
  /** Metres, or null: not in our data, and the plant stays a mark on the line. */
  height: number | null;
  /** The height is her measurement, so the figure wears her ink. */
  hers: boolean;
  width: number | null;
  /** The record's pace word (or hers), for the years axis; null bands nothing. */
  growth: string | null;
  /** The ground under the plant, metres from the level she calls zero: her
   *  shaped land read at this spot, 0 on a sheet she never shaped. Computed
   *  once (lib/ground.ts) so every projection stands the plant on the same
   *  footing. */
  footing: number;
  /** Her photo of this plant, by key, for the model to stand up. */
  photo?: string;
};

/** Height standing at year N: the band's middle when a pace is recorded,
 *  mature when none is (the coverage line owns that gap), mature when the
 *  years axis is off. */
export function grownM(f: Fig, years: number | null): number {
  if (f.height === null || years === null) return f.height ?? 0;
  const band = growthBand(f.growth, years);
  return band ? f.height * ((band.lo + band.hi) / 2) : f.height;
}

/** ACCESS values come back bare, one-valued or absent; a view wants lists.
 *  Exported because every room that reads through ACCESS needs the same
 *  unwrapping, and three copies of it had already grown. */
export const asList = (v: readonly string[] | string | null): readonly string[] =>
  v === null ? [] : typeof v === "string" ? [v] : v;

const short = (n: string) => (n.length > 16 ? n.slice(0, 15) + "…" : n);

type ById = ReadonlyMap<number, Plant>;

/** How each placed plant draws on the sheet: bloom state for the slot, her
 *  witness ring, the Show control's verdict. Pure; the page memoizes it. */
export function tokensOf(
  yard: Yard,
  byId: ById,
  herIndex: MineIndex,
  seen: Seen[],
  slot: BloomSlot | null,
  show: string,
): TokenView[] {
  const showKind = show ? show.slice(0, show.indexOf(":")) : null;
  const showValue = show ? show.slice(show.indexOf(":") + 1) : null;

  return yard.plants.map((pl) => {
    const p = byId.get(pl.id);
    const her = herIndex.get(pl.id);
    const slots = p ? bloomSlots(p.bloomPeriod) : [];
    // The first colour with a swatch paints the mark. Hers arrives through
    // ACCESS in the catalogue's spelling, so her "purple" finds its hex; a
    // colour of her own coinage ("cream") is true and unpaintable, and the
    // mark stays with the states that claim nothing they can't show.
    const colours = p ? asList(ACCESS.bloomColor(p, her)) : [];
    const hex = colours.map((c) => BLOOM_HEX[c]).find((c): c is string => !!c);

    let tokenState: TokenView["state"];
    if (slot === null) {
      tokenState = hex ? "fill" : "hollow";
    } else if (slots.includes(slot)) {
      tokenState = hex ? "fill" : "ink";
    } else if (p?.bloomPeriod) {
      tokenState = "hollow";
    } else {
      tokenState = "hatch";
    }

    const hand = seenSlots(seen, pl.id);
    const witness = slot === null ? hand.length > 0 : hand.includes(slot);

    let showState: TokenView["show"] = null;
    if (p && showKind && showValue) {
      const have = asList(ACCESS[showKind](p, her));
      showState = have.length === 0 ? "unrecorded" : have.includes(showValue) ? "match" : "other";
    }

    return {
      uid: pl.uid,
      x: pl.x,
      y: pl.y,
      label: short(p?.name ?? pl.name),
      state: tokenState,
      fill: hex,
      witness,
      ring: pl.r,
      show: showState,
      gone: !p,
    };
  });
}

/** The same plants, standing. Height and width resolve by the lane rule in
 *  metres: the record's value is never overwritten, hers counts exactly where
 *  the record is silent, and a plant with neither stays a mark on the line
 *  rather than growing a shape. */
export function figsOf(
  yard: Yard,
  byId: ById,
  herIndex: MineIndex,
  mine: Mine[],
  tokens: TokenView[],
): Fig[] {
  const marks = yard.ground ?? [];
  return yard.plants.map((pl, i) => {
    const p = byId.get(pl.id);
    const her = herIndex.get(pl.id);
    const h = standing(p?.height ?? null, mineFor(mine, pl.id, "height")?.text);
    const w = standing(p?.width ?? null, mineFor(mine, pl.id, "width")?.text);
    return {
      ...tokens[i],
      depth: pl.y,
      footing: groundAt(marks, pl.x, pl.y),
      // Through ACCESS, so a layer or pace she filled shapes the figure where
      // the record is silent; the record's own value always speaks first.
      layer: p ? (asList(ACCESS.layer(p, her))[0] ?? null) : null,
      height: h?.m ?? null,
      hers: h?.hers ?? false,
      width: w?.m ?? null,
      growth: p ? (asList(ACCESS.growth(p, her))[0] ?? null) : null,
      ...(her?.photo ? { photo: her.photo } : {}),
    };
  });
}

/** Everything a sun question needs: what stands casts (the year-scrubbed
 *  crowns, each starting from the ground under its plant), the land itself
 *  when she has shaped it, and the day the slot names. Null without her
 *  latitude and her span — the sun is never guessed. */
export type Scene = {
  blockers: Blocker[];
  terrain?: Terrain;
  /** Sheet units per metre. */
  upm: number;
  day: number;
  lat: number;
};

export function sceneOf(
  yard: Yard,
  figs: Fig[],
  lat: number | null,
  slot: BloomSlot | null,
  years: number | null,
): Scene | null {
  if (lat === null || !yard.span) return null;
  const upm = 1000 / yard.span;
  const day = dayForSlot(slot, lat);
  const blockers = figs
    .filter((f) => f.height !== null)
    .map((f) =>
      blockerOf(archetypeOf(f.layer), f.x, f.depth, grownM(f, years), f.width, upm, f.footing),
    );
  const marks = yard.ground ?? [];
  const terrain: Terrain | undefined =
    marks.length > 0
      ? {
          at: (x: number, z: number) => groundAt(marks, x, z) * upm,
          maxY: groundRange(marks).max * upm,
          w: SHEET_W,
          h: SHEET_H,
        }
      : undefined;
  return { blockers, terrain, upm, day, lat };
}

/** Hours of direct sun at a sheet point, for the scene's day. The Ask tool
 *  and the bed lines both read the sky through this one call. */
export function hoursAt(x: number, z: number, scene: Scene, north: number): number {
  return directHours(x, z, scene.lat, scene.day, north, scene.blockers, scene.terrain);
}

/* ---- the plan's shade wash -------------------------------------------- */

// One ray per cell at one hour: coarse enough to recompute as she drags the
// hour, fine enough that a bank's shadow has a shape.
export const SHADE_COLS = 40;
export const SHADE_ROWS = 56;

/**
 * The cells of the sheet this hour's sun cannot reach, against the same
 * crowns and land the bed lines march. Null when the sun is below the
 * horizon: night is not shade, and the caller says which. `litFrac` rides
 * along so the caller can print what fraction of the sheet still gets sun.
 */
export function shadeCells(
  scene: Scene,
  north: number,
  hour: number,
  cols = SHADE_COLS,
  rows = SHADE_ROWS,
): { shaded: Uint8Array; cols: number; rows: number; litFrac: number } | null {
  const sun = sunAt(scene.lat, scene.day, hour);
  if (sun.altitude <= 0) return null;
  const shaded = new Uint8Array(cols * rows);
  let lit = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) * SHEET_W) / cols;
      const z = ((r + 0.5) * SHEET_H) / rows;
      if (sunlit(x, z, sun, north, scene.blockers, scene.terrain)) lit += 1;
      else shaded[r * cols + c] = 1;
    }
  }
  return { shaded, cols, rows, litFrac: lit / (cols * rows) };
}

/**
 * The wash as an image the sheet can lay over itself: shaded cells painted
 * black into a cell-sized canvas, left to the browser's bilinear upscale and
 * the sheet's blur filter to soften. Black on purpose, not ink — ink flips
 * light in the dark theme, and shade darkens in either. Null when the sun
 * is down, and the caller says so instead of washing the night.
 */
export function shadeImage(
  scene: Scene,
  north: number,
  hour: number,
): { url: string; litFrac: number } | null {
  const cells = shadeCells(scene, north, hour);
  if (!cells) return null;
  const c = document.createElement("canvas");
  c.width = cells.cols;
  c.height = cells.rows;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#000";
  for (let r = 0; r < cells.rows; r++) {
    for (let col = 0; col < cells.cols; col++) {
      if (cells.shaded[r * cells.cols + col]) g.fillRect(col, r, 1, 1);
    }
  }
  return { url: c.toDataURL(), litFrac: cells.litFrac };
}

/**
 * Which of two text rows each elevation label takes: left to right, a label
 * crowding its neighbour steps to the other row, drafting-style, so two
 * names stop printing on top of each other. Pure, so the screen's elevation
 * and the exported band stagger identically.
 */
export function labelRowsFor(
  figs: readonly { uid: string; x: number }[],
  gap = 150,
): Map<string, number> {
  const rows = new Map<string, number>();
  const sorted = [...figs].sort((a, b) => a.x - b.x);
  let prevX = -Infinity;
  let prevRow = 1;
  for (const f of sorted) {
    const row = f.x - prevX < gap ? 1 - prevRow : 0;
    rows.set(f.uid, row);
    prevX = f.x;
    prevRow = row;
  }
  return rows;
}

/**
 * The scale bar her span earns: a round length (1·2·5 × 10ⁿ metres) near a
 * fifth of the sheet, and its width in sheet units. Nothing draws without a
 * span, because a bar on an unscaled napkin would be a claim.
 */
export function scaleBarFor(span: number): { m: number; units: number } {
  const target = span / 5;
  const pow = 10 ** Math.floor(Math.log10(target));
  let m = pow;
  for (const k of [2 * pow, 5 * pow, 10 * pow]) {
    if (Math.abs(k - target) < Math.abs(m - target)) m = k;
  }
  return { m, units: (m / span) * 1000 };
}

export type BedLine = {
  id: string;
  name: string;
  /** About: sampled on the half hour, for planning a bed, not a permit. */
  hours: number;
  /** The catalogue's own spelling for the tier, so it filters like a source's. */
  word: string;
  /** How many of her kept plants are recorded for that word. */
  fit: number;
};

/** Each drawn bed's day of sun, read at its centre, named by its nearest
 *  label. What stands casts; the land shades when she has shaped it. */
export function bedLinesOf(
  yard: Yard,
  scene: Scene,
  keptPlants: Plant[],
  herIndex: MineIndex,
  lightValues: readonly string[],
): BedLine[] {
  const labels = yard.strokes.filter((s) => s.k === "label");
  return yard.strokes
    .filter((s) => s.k === "area")
    .slice(0, 8)
    .map((bed, i) => {
      if (bed.k !== "area") throw new Error("unreachable");
      const cx = bed.pts.reduce((a, p) => a + p[0], 0) / bed.pts.length;
      const cz = bed.pts.reduce((a, p) => a + p[1], 0) / bed.pts.length;
      let name = `Bed ${i + 1}`;
      let best = 300;
      for (const l of labels) {
        if (l.k !== "label") continue;
        const d = Math.hypot(l.at[0] - cx, l.at[1] - cz);
        if (d < best) {
          best = d;
          name = l.text;
        }
      }
      const hours = hoursAt(cx, cz, scene, yard.north);
      const word = tierWord(lightValues, lightTier(hours));
      const fit = keptPlants.filter((p) =>
        asList(ACCESS.light(p, herIndex.get(p.id))).includes(word),
      ).length;
      return { id: bed.id, name, hours, word, fit };
    });
}
