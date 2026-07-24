// The shape of her land, read one way by every projection.
//
// A yard's ground is the set of heights she set (lib/yards.ts, GroundMark):
// spot measurements in metres, relative to the level she calls zero. This file
// is the only place those marks become a surface, so the sheet, the elevation
// and the model cannot disagree about where the ground stands — the same
// bargain figurePaths makes for the figures.
//
// The surface is the honest napkin read of spot heights: it passes exactly
// through every mark, bends smoothly between neighbours, and where she marked
// nothing it settles back to level, because absence claims nothing — not a
// slope, not a plateau, just the sheet's own zero. (Plain inverse-distance
// weighting would float a whole yard to the height of its one mark; the level
// prior is what keeps an unmarked corner an unmarked corner.) With no marks at
// all every function here reads as the flat sheet the yard always was.
import {
  ELEV_H,
  GROUND_Y,
  TOP_Y,
} from "./elevation";
import { LEVEL_LIMIT, SHEET_H, SHEET_W, type GroundMark } from "./yards";

/** How far a mark's influence reaches before the ground settles back to
 *  level, sheet units. About a third of the sheet: near a mark her number
 *  rules; a sheet-length away it has faded to the datum. */
const SETTLE = 350;

/**
 * Her height or depth, in metres, or null. The same bargain parseMetres
 * makes, plus the sign the ground needs: a dip is a real measurement.
 * A sentence stays on the page and off the scale.
 */
const RX = /^\s*([+-]?\d+(?:\.\d+)?)\s*(m|cm|ft|')?\s*$/i;

export function parseLevel(text: string): number | null {
  const m = RX.exec(text.replace(",", "."));
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = (m[2] ?? "m").toLowerCase();
  const metres = unit === "cm" ? n / 100 : unit === "ft" || unit === "'" ? n * 0.3048 : n;
  if (!Number.isFinite(metres) || Math.abs(metres) > LEVEL_LIMIT) return null;
  return Math.round(metres * 100) / 100;
}

/** A height as she'd say it: signed, so a rise reads "+1.5 m" and a dip
 *  "-0.5 m". The zero level is plain "0 m". */
export const levelLabel = (m: number): string =>
  `${m > 0 ? "+" : ""}${Math.round(m * 100) / 100} m`;

/**
 * The ground's height at a sheet point, metres. Exact at every mark;
 * inverse-distance weighted between them, with the level datum holding a
 * weak claim everywhere so unmarked ground settles to zero rather than
 * floating to the mean of wherever she happened to measure.
 */
export function groundAt(
  marks: readonly GroundMark[] | undefined,
  x: number,
  y: number,
): number {
  if (!marks || marks.length === 0) return 0;
  let sw = 1 / (SETTLE * SETTLE); // the datum's own weight, claiming level
  let sv = 0;
  for (const g of marks) {
    const d2 = (x - g.at[0]) ** 2 + (y - g.at[1]) ** 2;
    if (d2 < 1) return g.m; // standing on the mark: her number, exactly
    const w = 1 / d2;
    sw += w;
    sv += w * g.m;
  }
  return sv / sw;
}

/** The field's reach above and below the datum. Because the surface is a
 *  weighted blend of the marks and the zero level, no point ever leaves
 *  [min(0, marks), max(0, marks)]; the range is exact without sampling. */
export function groundRange(marks: readonly GroundMark[] | undefined): {
  min: number;
  max: number;
} {
  let min = 0;
  let max = 0;
  for (const g of marks ?? []) {
    if (g.m < min) min = g.m;
    if (g.m > max) max = g.m;
  }
  return { min, max };
}

/**
 * The ground seen side-on: for each sampled x, the highest the surface gets
 * at any depth — the skyline an elevation drawing shows. Sampled densely
 * across x, and at every mark's own depth so no mark's crest slips between
 * depth samples. Metres, n+1 values across the sheet's width.
 */
export function groundSkyline(marks: readonly GroundMark[], n = 100): number[] {
  const depths: number[] = [];
  for (let i = 0; i <= 16; i++) depths.push((SHEET_H * i) / 16);
  for (const g of marks) depths.push(g.at[1]);
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const x = (SHEET_W * i) / n;
    let best = -Infinity;
    for (const y of depths) {
      const v = groundAt(marks, x, y);
      if (v > best) best = v;
    }
    out.push(best);
  }
  return out;
}

/** What a section (ElevationView, the exported band) needs to draw: the
 *  vertical scale that fits both the tallest reach and the deepest dip
 *  against the fixed datum line, and the skyline when there is one. */
export type Section = {
  /** Sheet units per metre; 0 when nothing stands and nothing dips. */
  scale: number;
  /** Metres above the datum the drawing must hold (tallest crown top or
   *  ground crest). */
  top: number;
  /** Metres below the datum (≤ 0). */
  bottom: number;
  /** The side-on ground profile, metres — or null with no marks, where the
   *  flat band draws as it always has. */
  skyline: number[] | null;
};

/** `reaches` are the standing tops in metres — each measured figure's footing
 *  plus its mature height — so the scale is pinned and never rescales
 *  mid-scrub, exactly as before the ground learned to bend. */
export function sectionOf(
  marks: readonly GroundMark[],
  reaches: readonly number[],
): Section {
  const r = groundRange(marks);
  let top = Math.max(0, r.max);
  for (const m of reaches) if (m > top) top = m;
  const bottom = Math.min(0, r.min);
  const sUp = top > 0 ? (GROUND_Y - TOP_Y) / top : Infinity;
  const sDown = bottom < 0 ? (ELEV_H - GROUND_Y - 24) / -bottom : Infinity;
  const scale = sUp === Infinity && sDown === Infinity ? 0 : Math.min(sUp, sDown);
  return { scale, top, bottom, skyline: marks.length ? groundSkyline(marks) : null };
}

/** The earth's shape as one SVG path: the skyline on top, the band's base
 *  below, closed. ElevationView and the exported sheet both draw from this,
 *  so the ground a client is handed is the ground she saw. */
export function earthPathD(
  skyline: readonly number[],
  scale: number,
  datumY: number,
  baseY: number,
): string {
  const n = skyline.length - 1;
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M0 ${r(baseY)}`;
  skyline.forEach((m, i) => {
    d += ` L${r((SHEET_W * i) / n)} ${r(datumY - m * scale)}`;
  });
  return d + ` L${SHEET_W} ${r(baseY)} Z`;
}
