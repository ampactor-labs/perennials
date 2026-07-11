import type { Plant } from "@/data/model";
import type { Dataset } from "@/data/store";

// How each facet maps onto a plant's fields (all multi-valued for a uniform
// intersection test). `edible` is a synthetic boolean facet.
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

export type FacetMeta = { key: string; label: string; searchable: boolean; note?: string };

// Order and labels are presentation; the values inside are all data-derived.
export const FACETS: FacetMeta[] = [
  { key: "layer", label: "Layer", searchable: false },
  { key: "light", label: "Light", searchable: false },
  { key: "water", label: "Water", searchable: false },
  { key: "soil", label: "Soil", searchable: false },
  { key: "lifeCycle", label: "Life cycle", searchable: false },
  { key: "growth", label: "Growth rate", searchable: false },
  { key: "edibleParts", label: "Edible parts", searchable: false },
  { key: "functions", label: "Function & use", searchable: true, note: "What it does — food, fiber, nitrogen, dye…" },
  { key: "warnings", label: "Cautions", searchable: false },
  { key: "family", label: "Family", searchable: true },
  { key: "nativeTo", label: "Native to", searchable: true, note: "Where it grows wild" },
];

export type Constraints = {
  text: string;
  zone: number | null;
  edibleOnly: boolean;
  facets: Record<string, string[]>;
};

export const emptyConstraints = (): Constraints => ({
  text: "",
  zone: null,
  edibleOnly: false,
  facets: {},
});

export function activeCount(c: Constraints): number {
  let n = Object.values(c.facets).reduce((a, v) => a + v.length, 0);
  if (c.zone !== null) n += 1;
  if (c.edibleOnly) n += 1;
  return n;
}

/** Flat list of active facet selections, for rendering removable chips. */
export function activeChips(c: Constraints): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = [];
  for (const f of FACETS) {
    for (const v of c.facets[f.key] ?? []) out.push({ key: f.key, label: f.label, value: v });
  }
  return out;
}

const facetOk = (p: Plant, c: Constraints, key: string) => {
  const sel = c.facets[key];
  if (!sel || sel.length === 0) return true;
  const have = ACCESS[key](p);
  return sel.some((v) => have.includes(v));
};

const zoneOk = (p: Plant, c: Constraints) =>
  c.zone === null || (!!p.hardiness && p.hardiness.min <= c.zone && c.zone <= p.hardiness.max);

const edibleOk = (p: Plant, c: Constraints) => !c.edibleOnly || p.edible;

export type Evaluation = {
  results: Plant[];
  counts: Record<string, Map<string, number>>;
};

/**
 * One pass produces the filtered results and, for every facet, the option
 * counts holding all *other* constraints fixed — the standard faceted-search
 * affordance, computed in-memory over the full dataset.
 */
export function evaluate(data: Dataset, c: Constraints): Evaluation {
  const textAllowed =
    c.text.trim().length > 0
      ? new Set(data.index.search(c.text).map((r) => r.slug as string))
      : null;

  const globalOk = (p: Plant) =>
    (textAllowed ? textAllowed.has(p.slug) : true) && zoneOk(p, c) && edibleOk(p, c);

  const results = data.plants.filter(
    (p) => globalOk(p) && FACETS.every((f) => facetOk(p, c, f.key)),
  );

  const counts: Record<string, Map<string, number>> = {};
  for (const f of FACETS) {
    const base = data.plants.filter(
      (p) => globalOk(p) && FACETS.every((g) => g.key === f.key || facetOk(p, c, g.key)),
    );
    const m = new Map<string, number>();
    for (const p of base) for (const v of ACCESS[f.key](p)) m.set(v, (m.get(v) ?? 0) + 1);
    counts[f.key] = m;
  }
  return { results, counts };
}
