import type { Plant } from "@/data/model";
import type { Dataset } from "@/data/store";
import { facetsOf, zoneOf, type Atom, type Constraints } from "./constraints";

// How each facet maps onto a plant's fields (all multi-valued for a uniform
// intersection test).
export const ACCESS: Record<string, (p: Plant) => string[]> = {
  layer: (p) => (p.layer ? [p.layer] : []),
  light: (p) => p.light,
  water: (p) => p.water,
  soil: (p) => p.soil,
  lifeCycle: (p) => (p.lifeCycle ? [p.lifeCycle] : []),
  growth: (p) => (p.growth ? [p.growth] : []),
  edibleParts: (p) => p.edibleParts,
  functions: (p) => p.functions,
  warnings: (p) => p.warnings,
  family: (p) => (p.family ? [p.family] : []),
  nativeTo: (p) => p.nativeTo,
};

export type FacetMeta = {
  key: string;
  label: string;
  searchable: boolean;
  /** Site facets describe a place; intent facets describe what you want. */
  group: "site" | "intent";
  note?: string;
};

// Site first — the conditions she has — then intent, the things she wants.
export const FACETS: FacetMeta[] = [
  { key: "light", label: "Light", searchable: false, group: "site" },
  { key: "water", label: "Water", searchable: false, group: "site" },
  { key: "soil", label: "Soil", searchable: false, group: "site" },
  { key: "layer", label: "Layer", searchable: false, group: "intent" },
  { key: "lifeCycle", label: "Life cycle", searchable: false, group: "intent" },
  { key: "growth", label: "Growth rate", searchable: false, group: "intent" },
  { key: "edibleParts", label: "Edible parts", searchable: false, group: "intent" },
  { key: "functions", label: "Function & use", searchable: true, group: "intent", note: "What it does — food, fiber, nitrogen, dye…" },
  { key: "warnings", label: "Cautions", searchable: false, group: "intent" },
  { key: "family", label: "Family", searchable: true, group: "intent" },
  { key: "nativeTo", label: "Native to", searchable: true, group: "intent", note: "Where it grows wild" },
];

const zoneOk = (p: Plant, zone: number | null) =>
  zone === null || (!!p.hardiness && p.hardiness.min <= zone && zone <= p.hardiness.max);

function facetOk(p: Plant, key: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const have = ACCESS[key](p);
  return selected.some((v) => have.includes(v));
}

/** Full structured test for one plant against a set of atoms. */
function passes(p: Plant, facets: Record<string, string[]>, zone: number | null, edible: boolean): boolean {
  if (!zoneOk(p, zone)) return false;
  if (edible && !p.edible) return false;
  for (const key in facets) if (!facetOk(p, key, facets[key])) return false;
  return true;
}

function atomsState(atoms: Atom[]) {
  const facets: Record<string, string[]> = {};
  let zone: number | null = null;
  let edible = false;
  for (const a of atoms) {
    if (a.kind === "facet") (facets[a.key] ??= []).push(a.value);
    else if (a.kind === "zone") zone = a.zone;
    else edible = true;
  }
  return { facets, zone, edible };
}

export type TrailStep = { atom: Atom | null; label: string; count: number };

export type Evaluation = {
  results: Plant[];
  counts: Record<string, Map<string, number>>;
  /** Cumulative counts as each constraint applies, for the collapse trail. */
  trail: TrailStep[];
};

/**
 * One evaluation produces: the ranked results, per-facet option counts holding
 * every other constraint fixed, and the cumulative collapse trail.
 * All in-memory over the full dataset — no index needed at this scale.
 */
export function evaluate(data: Dataset, c: Constraints): Evaluation {
  const text = c.text.trim();
  const ranked = text ? data.index.search(text).map((r) => r.slug as string) : null;
  const textAllowed = ranked ? new Set(ranked) : null;

  const { facets, zone, edible } = atomsState(c.atoms);

  const base = (p: Plant) => (textAllowed ? textAllowed.has(p.slug) : true);

  // Results, ranked: text relevance when searching, else richness (the
  // dataset ships pre-sorted by score).
  let results: Plant[];
  if (ranked) {
    results = [];
    for (const slug of ranked) {
      const p = data.bySlug.get(slug);
      if (p && passes(p, facets, zone, edible)) results.push(p);
    }
  } else {
    results = data.plants.filter((p) => passes(p, facets, zone, edible));
  }

  // Per-facet option counts (hold all other constraints fixed).
  const counts: Record<string, Map<string, number>> = {};
  for (const f of FACETS) {
    const others: Record<string, string[]> = {};
    for (const key in facets) if (key !== f.key) others[key] = facets[key];
    const m = new Map<string, number>();
    for (const p of data.plants) {
      if (!base(p) || !passes(p, others, zone, edible)) continue;
      for (const v of ACCESS[f.key](p)) m.set(v, (m.get(v) ?? 0) + 1);
    }
    counts[f.key] = m;
  }

  // The collapse trail: total → text → each atom in the order it was added.
  const trail: TrailStep[] = [];
  if (text) {
    let n = 0;
    for (const p of data.plants) if (base(p)) n += 1;
    trail.push({ atom: null, label: `“${text}”`, count: n });
  }
  const sofar: Atom[] = [];
  for (const a of c.atoms) {
    sofar.push(a);
    const st = atomsState(sofar);
    let n = 0;
    for (const p of data.plants) if (base(p) && passes(p, st.facets, st.zone, st.edible)) n += 1;
    trail.push({ atom: a, label: "", count: n });
  }

  return { results, counts, trail };
}

export { facetsOf, zoneOf };
