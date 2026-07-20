// The sun, computed rather than claimed.
//
// Shade is the one site condition the yard can derive instead of asking her to
// declare, but only from numbers that are real: her latitude (one tap, kept to
// a whole degree, which is plenty for the sun and too coarse to place her
// house), and her own estimate of how many metres the sheet spans. Without
// both, nothing here runs and nothing is guessed; the sheet stays the napkin
// it was born as. With both, a placed canopy starts costing the beds beneath
// it, in the guide's own light vocabulary, with the basis printed beside it.
//
// The geometry is deliberately coarse: crowns are ellipsoids, the day is
// sampled on the half hour, and every printed number says "about". This is a
// napkin computing its own weather, not a survey.
import type { BloomSlot } from "./bloom";
import { type Archetype, CROWN_RATIO } from "./elevation";

const RAD = Math.PI / 180;

/** Solar position: altitude above the horizon and compass azimuth (0 = north,
 *  clockwise), both degrees. Standard declination + hour-angle geometry. */
export function sunAt(
  latDeg: number,
  dayOfYear: number,
  solarHour: number,
): { altitude: number; azimuth: number } {
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear));
  const lat = latDeg * RAD;
  const d = decl * RAD;
  const h = (solarHour - 12) * 15 * RAD;
  const sinAlt = Math.sin(lat) * Math.sin(d) + Math.cos(lat) * Math.cos(d) * Math.cos(h);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / RAD;
  const az =
    Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(lat) - Math.tan(d) * Math.cos(lat)) / RAD + 180;
  return { altitude, azimuth: ((az % 360) + 360) % 360 };
}

/** A representative day for each of USDA's season words: the season, not a
 *  month, so mid-month of the season's middle. South of the equator the same
 *  words fall half a year later, and the flip keeps them seasons. */
const SLOT_DAY: Record<BloomSlot, number> = {
  Winter: 15,
  "Late Winter": 46,
  "Early Spring": 74,
  "Mid Spring": 105,
  "Late Spring": 135,
  "Early Summer": 166,
  "Mid Summer": 196,
  "Late Summer": 227,
  Fall: 288,
};

export function dayForSlot(slot: BloomSlot | null, latDeg: number): number {
  // No slot picked reads as the leafed-out year: early summer.
  const day = SLOT_DAY[slot ?? "Early Summer"];
  return latDeg < 0 ? ((day + 182) % 365) + 1 : day;
}

/** A crown as an occluder, in sheet units: an ellipsoid centred at height cy,
 *  rx across, ry tall. Coarse on purpose. */
export type Blocker = { x: number; z: number; cy: number; rx: number; ry: number };

/** The crown a figure raises, in sheet units, given her span (units per
 *  metre). Trunks don't shade beds; crowns do, so the tree layers lift the
 *  ellipsoid and everything else fills from the ground up. */
export function blockerOf(
  kind: Archetype,
  x: number,
  z: number,
  heightM: number,
  widthM: number | null,
  upm: number,
): Blocker {
  const h = heightM * upm;
  const w = (widthM ?? heightM * CROWN_RATIO[kind]) * upm;
  if (kind === "tall-tree" || kind === "tree") {
    const trunkFrac = kind === "tree" ? 0.42 : 0.5;
    const ry = (h * (1 - trunkFrac)) / 2;
    return { x, z, cy: h - ry, rx: w / 2, ry };
  }
  return { x, z, cy: h / 2, rx: w / 2, ry: h / 2 };
}

/** Sheet direction of a compass bearing, given her rose: `north` is degrees
 *  clockwise from sheet-up, so bearing B renders at north + B. */
const sheetDir = (bearing: number, north: number): [number, number] => {
  const a = (north + bearing) * RAD;
  return [Math.sin(a), -Math.cos(a)];
};

/** Is this ground point in direct sun, or under some crown's ellipsoid? A ray
 *  is cast toward the sun and tested against each crown in scaled space. */
export function sunlit(
  px: number,
  pz: number,
  sun: { altitude: number; azimuth: number },
  north: number,
  blockers: Blocker[],
): boolean {
  if (sun.altitude <= 0) return false;
  const [dx, dz] = sheetDir(sun.azimuth, north);
  const dy = Math.tan(sun.altitude * RAD);
  for (const b of blockers) {
    // Scale to the unit sphere: (x/rx, (y-cy)/ry, z/rx) relative to the crown.
    const ox = (px - b.x) / b.rx;
    const oy = (0 - b.cy) / b.ry;
    const oz = (pz - b.z) / b.rx;
    const vx = dx / b.rx;
    const vy = dy / b.ry;
    const vz = dz / b.rx;
    const A = vx * vx + vy * vy + vz * vz;
    const B = 2 * (ox * vx + oy * vy + oz * vz);
    const C = ox * ox + oy * oy + oz * oz - 1;
    // Standing inside the crown is shade, and the quadratic's positive-root
    // test would miss it: both roots straddle the origin.
    if (C < 0) return false;
    const disc = B * B - 4 * A * C;
    if (disc <= 0) continue;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    if (t > 0.001) return false;
  }
  return true;
}

/** Hours of direct sun at a ground point across one day, sampled on the half
 *  hour. "About": the answer is for planning a bed, not for a permit. */
export function directHours(
  px: number,
  pz: number,
  latDeg: number,
  dayOfYear: number,
  north: number,
  blockers: Blocker[],
): number {
  let halves = 0;
  for (let hour = 5; hour <= 21; hour += 0.5) {
    const sun = sunAt(latDeg, dayOfYear, hour);
    if (sun.altitude > 0 && sunlit(px, pz, sun, north, blockers)) halves += 1;
  }
  return halves / 2;
}

/** The horticultural bands: six direct hours is the usual full-sun line,
 *  three the part line. The caller maps tiers onto the catalogue's own
 *  spellings so a derived value lands in the same bucket the sources use. */
export function lightTier(hours: number): "full" | "part" | "shade" {
  return hours >= 6 ? "full" : hours >= 3 ? "part" : "shade";
}
