// Yard sketches: her hand on a fixed sheet, the record performing on top.
//
// A yard is a napkin drawing, and the sheet refuses everything a napkin
// refuses: no pan, no zoom, no scale. Width is recorded for 244 of 8,800
// plants (3%), so a placement is a point, never a sized circle, and every
// coordinate is an integer on a dimensionless 1000×1414 page. A crowded yard
// is the signal to start a second sketch, which is how she works anyway.
//
// Growth is bounded on purpose. A phone's localStorage is about 5MB and a lost
// client plan is the one failure this lane cannot afford, so freehand strokes
// decimate while drawing, simplify on commit, and sanitize enforces hard caps
// on read. A yard stays in the low kilobytes, and a hundred of them still
// clear the origin budget with room to spare.
import { useCallback, useSyncExternalStore } from "react";
import { createLocalStore } from "./localStore";
import { deletePhoto } from "./photos";

export const SHEET_W = 1000;
export const SHEET_H = 1414; // portrait, √2: the paper she holds

export type Pt = [number, number];

export type Stroke =
  | { k: "line"; id: string; pts: Pt[] }
  | { k: "area"; id: string; pts: Pt[] }
  | { k: "label"; id: string; at: Pt; text: string };

export type Placed = {
  uid: string;
  /** Plant.id; every decoration resolves live against the dataset. */
  id: number;
  /** Snapshot at placement. A dataset refresh must never erase a mark from a
   *  client's plan; a dropped plant keeps its name and says so in its sheet. */
  name: string;
  x: number;
  y: number;
  /** Her spacing estimate, sheet units. Her hand; the record has no say in it. */
  r?: number;
};

/** A height she set on the ground itself: this point stands `m` metres above
 *  (or below, negative) the level she calls zero. Hers entirely — no source
 *  records the shape of her land — and the one kind of mark all three
 *  projections read: the sheet shows it, the elevation sections through it,
 *  the model stands on it (lib/ground.ts is the one interpolator). */
export type GroundMark = {
  id: string;
  at: Pt;
  m: number;
};

export type Yard = {
  v: 1;
  id: string;
  name: string;
  at: number;
  /** Compass: degrees clockwise from up. Hers, not data. */
  north: number;
  /** Her photo of the ground, as its key in IndexedDB (lib/photos.ts). Only
   *  the key lives here: an image in this record would eat the localStorage
   *  budget that keeps a hundred yards safe. */
  underlay?: string;
  /** Roughly how many metres the sheet spans, her estimate. The one number
   *  that turns the napkin computable: with it (and her latitude) the sun
   *  casts and the model stands at true scale. Absent, nothing is guessed. */
  span?: number;
  /** The shape of her land, as the heights she set. Absent or empty, the
   *  ground is the flat sheet it always was, and no projection claims a
   *  slope nobody measured. */
  ground?: GroundMark[];
  strokes: Stroke[];
  plants: Placed[];
};

// The caps. sanitize enforces them on read and the editor respects them on
// write, so no gesture (and no hand-edited entry) can grow a yard past them.
export const MAX_STROKES = 200;
export const MAX_PTS = 240;
export const MAX_PLANTS = 150;
export const MAX_LABEL = 60;
export const MAX_GROUND = 40;
/** |metres| a ground height may claim. Past a cliff's worth it is a typo, and
 *  a typo must not fold every real rise and dip flat on the shared scale. */
export const LEVEL_LIMIT = 200;

/* ---- geometry: the pen budget --------------------------------------- */

const dist2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

function segDist2(p: Pt, a: Pt, b: Pt): number {
  const l2 = dist2(a, b);
  if (l2 === 0) return dist2(p, a);
  let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
}

function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length <= 2) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  const eps2 = eps * eps;
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let worst = 0;
    let at = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = segDist2(pts[i], pts[lo], pts[hi]);
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    if (worst > eps2 && at > 0) {
      keep[at] = true;
      stack.push([lo, at], [at, hi]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** Midpoint-smoothed path: the same curve on screen and in the exported
 *  sheet, because both call this. */
export function pathD(pts: readonly Pt[], close: boolean): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L${last[0]} ${last[1]}`;
  return close ? d + " Z" : d;
}

/**
 * A committed stroke: rounded to integers, simplified to what a pen would
 * keep, and guaranteed under the point cap; the epsilon widens until it fits,
 * so the bound holds no matter how long the thumb wandered.
 */
export function commitStroke(pts: Pt[]): Pt[] {
  let out = rdp(
    pts.map(([x, y]) => [Math.round(x), Math.round(y)] as Pt),
    2.5,
  );
  for (let eps = 5; out.length > MAX_PTS; eps *= 2) out = rdp(out, eps);
  return out;
}

/* ---- the store ------------------------------------------------------- */

const int = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isPt = (p: unknown): p is Pt => Array.isArray(p) && int(p[0]) && int(p[1]);

function cleanStroke(raw: unknown): Stroke | null {
  const s = raw as Stroke;
  if (typeof s?.id !== "string") return null;
  if (s.k === "label") {
    return isPt(s.at) && typeof s.text === "string" && s.text.trim()
      ? { k: "label", id: s.id, at: s.at, text: s.text.slice(0, MAX_LABEL) }
      : null;
  }
  if ((s.k === "line" || s.k === "area") && Array.isArray(s.pts)) {
    const pts = s.pts.filter(isPt).slice(0, MAX_PTS);
    return pts.length >= 2 ? { k: s.k, id: s.id, pts } : null;
  }
  return null;
}

function cleanGround(raw: unknown): GroundMark | null {
  const g = raw as GroundMark;
  if (typeof g?.id !== "string" || !isPt(g.at) || !int(g.m)) return null;
  if (Math.abs(g.m) > LEVEL_LIMIT) return null;
  return { id: g.id, at: g.at, m: Math.round(g.m * 100) / 100 };
}

function cleanPlaced(raw: unknown): Placed | null {
  const p = raw as Placed;
  if (typeof p?.uid !== "string" || !int(p?.id) || !int(p?.x) || !int(p?.y)) return null;
  return {
    uid: p.uid,
    id: p.id,
    name: typeof p.name === "string" ? p.name.slice(0, 80) : "",
    x: p.x,
    y: p.y,
    ...(int(p.r) && p.r > 0 ? { r: p.r } : {}),
  };
}

/** Sanitize one yard on the way in, enforcing every cap. Exported for the
 *  yard-file importer, which admits a yard from outside this phone and must
 *  bounce a malformed one exactly as a restore does. */
export function sanitizeYard(raw: unknown): Yard | null {
  const y = raw as Yard;
  if (typeof y?.id !== "string" || typeof y?.name !== "string") return null;
  const ground = Array.isArray(y.ground)
    ? y.ground.map(cleanGround).filter((g): g is GroundMark => g !== null).slice(0, MAX_GROUND)
    : [];
  return {
    v: 1,
    id: y.id,
    name: y.name.slice(0, 80),
    at: int(y.at) ? y.at : 0,
    north: int(y.north) ? y.north : 0,
    ...(typeof y.underlay === "string" && y.underlay ? { underlay: y.underlay } : {}),
    ...(int(y.span) && y.span >= 2 && y.span <= 2000 ? { span: Math.round(y.span) } : {}),
    ...(ground.length ? { ground } : {}),
    strokes: Array.isArray(y.strokes)
      ? y.strokes.map(cleanStroke).filter((s): s is Stroke => s !== null).slice(0, MAX_STROKES)
      : [],
    plants: Array.isArray(y.plants)
      ? y.plants.map(cleanPlaced).filter((p): p is Placed => p !== null).slice(0, MAX_PLANTS)
      : [],
  };
}

const store = createLocalStore<Yard[]>("perennials.yards.v1", [], (raw) =>
  Array.isArray(raw) ? raw.map(sanitizeYard).filter((y): y is Yard => y !== null) : null,
);

/** Read and replace the whole store, for lib/backup.ts. It goes through the
 *  store rather than localStorage so a restore lands in the cache and pokes
 *  every subscriber; writing the key raw is what used to need a reload. */
export const readYards = store.read;
export const writeYards = store.write;

export function useYards() {
  const yards = useSyncExternalStore(store.subscribe, store.read, () => store.empty);

  const create = useCallback((name: string): Yard => {
    const yard: Yard = {
      v: 1,
      id: "y" + Date.now().toString(36),
      name,
      at: Date.now(),
      north: 0,
      strokes: [],
      plants: [],
    };
    store.write([...store.read(), yard]);
    return yard;
  }, []);

  /** Replace one yard wholesale; the editor commits whole values, so undo is
   *  snapshots. False means localStorage refused; the session still holds it,
   *  and the editor tells her rather than losing a plan silently. */
  const put = useCallback((yard: Yard): boolean => {
    const rest = store.read().filter((y) => y.id !== yard.id);
    return store.write([...rest, { ...yard, at: Date.now() }]);
  }, []);

  const remove = useCallback((id: string) => {
    // The ground goes with the sketch, or IndexedDB keeps a photo she can no
    // longer see or reach; the same bargain mine.ts makes for a plant photo.
    const gone = store.read().find((y) => y.id === id);
    if (gone?.underlay) void deletePhoto(gone.underlay);
    store.write(store.read().filter((y) => y.id !== id));
  }, []);

  return { yards, create, put, remove };
}
