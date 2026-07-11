import { allPlants } from "@/data";
import type { HeightBand, LoadedPlant, Plant } from "@/data/types";
import {
  COLOR,
  EASE,
  EDIBLE_PART,
  GROWTH_RATE,
  LAYER,
  LIFE_CYCLE,
  MINERAL,
  MOISTURE,
  SEASON,
  SUN,
  WATER,
  WILDLIFE,
  type Meta,
} from "@/data/vocab";

export type FunctionKey = "nitrogenFixer" | "accumulator" | "groundcover" | "nectary";
export type UseKey = "edible" | "medicinal" | "superfood";

/**
 * Facet ids whose selections live as string arrays on Filters. Keeping the
 * registry keyed by these means the UI, the predicate and the counts all read
 * from one source of truth.
 */
export type FacetId =
  | "lifeCycle"
  | "layer"
  | "heightBand"
  | "sun"
  | "moisture"
  | "water"
  | "bloomColors"
  | "bloomSeason"
  | "wildlife"
  | "functions"
  | "minerals"
  | "edibleParts"
  | "uses"
  | "growthRate"
  | "ease";

export type Filters = Record<FacetId, string[]> & {
  text: string;
  zone: number | null;
  selfSeeds: boolean | null;
};

export function emptyFilters(): Filters {
  return {
    text: "",
    zone: null,
    selfSeeds: null,
    lifeCycle: [],
    layer: [],
    heightBand: [],
    sun: [],
    moisture: [],
    water: [],
    bloomColors: [],
    bloomSeason: [],
    wildlife: [],
    functions: [],
    minerals: [],
    edibleParts: [],
    uses: [],
    growthRate: [],
    ease: [],
  };
}

export function activeFilterCount(f: Filters): number {
  let n = 0;
  for (const id of FACET_IDS) n += f[id].length;
  if (f.zone !== null) n += 1;
  if (f.selfSeeds !== null) n += 1;
  return n;
}

/** A plant's height range overlaps a band, so multi-band plants show in each. */
function bandOverlaps(height: Plant["height"], band: HeightBand): boolean {
  switch (band) {
    case "under-2ft":
      return height.min < 2;
    case "2-4ft":
      return height.max >= 2 && height.min <= 4;
    case "over-4ft":
      return height.max > 4;
  }
}

function matchesFunction(p: Plant, key: string): boolean {
  switch (key as FunctionKey) {
    case "nitrogenFixer":
      return p.functions.nitrogenFixer === true;
    case "accumulator":
      return !!p.functions.accumulator;
    case "groundcover":
      return p.functions.groundcover === true;
    case "nectary":
      return p.functions.nectary === true;
    default:
      return false;
  }
}

function matchesUse(p: Plant, key: string): boolean {
  switch (key as UseKey) {
    case "edible":
      return p.edibleParts.length > 0;
    case "medicinal":
      return !!p.medicinal;
    case "superfood":
      return p.superfood === true;
    default:
      return false;
  }
}

export type FacetOption = { value: string; label: string; hint?: string; color?: string };

export type Facet = {
  id: FacetId;
  label: string;
  /** Optional one-line gloss under the facet heading. */
  note?: string;
  options: FacetOption[];
  match: (plant: LoadedPlant, value: string) => boolean;
};

function optionsFrom(v: { keys: readonly string[]; meta: Record<string, Meta> }): FacetOption[] {
  return v.keys.map((k) => ({
    value: k,
    label: v.meta[k].label,
    hint: v.meta[k].hint,
    color: v.meta[k].color,
  }));
}

export const FACETS: Facet[] = [
  {
    id: "lifeCycle",
    label: "Life cycle",
    options: optionsFrom(LIFE_CYCLE),
    match: (p, v) => p.lifeCycle === v,
  },
  {
    id: "bloomColors",
    label: "Bloom color",
    options: optionsFrom(COLOR),
    match: (p, v) => p.bloomColors.includes(v as never),
  },
  {
    id: "bloomSeason",
    label: "Bloom season",
    options: optionsFrom(SEASON),
    match: (p, v) => p.bloomSeason.includes(v as never),
  },
  {
    id: "sun",
    label: "Sun",
    options: optionsFrom(SUN),
    match: (p, v) => p.sun.includes(v as never),
  },
  {
    id: "moisture",
    label: "Soil moisture",
    options: optionsFrom(MOISTURE),
    match: (p, v) => p.moisture.includes(v as never),
  },
  {
    id: "water",
    label: "Water need",
    options: optionsFrom(WATER),
    match: (p, v) => p.water === v,
  },
  {
    id: "heightBand",
    label: "Height",
    options: [
      { value: "under-2ft", label: "Under 2 ft" },
      { value: "2-4ft", label: "2–4 ft" },
      { value: "over-4ft", label: "Over 4 ft" },
    ],
    match: (p, v) => bandOverlaps(p.height, v as HeightBand),
  },
  {
    id: "layer",
    label: "Forest-garden layer",
    options: optionsFrom(LAYER),
    match: (p, v) => p.layer === v,
  },
  {
    id: "wildlife",
    label: "Wildlife",
    note: "Who it feeds and shelters",
    options: optionsFrom(WILDLIFE),
    match: (p, v) => p.wildlife.includes(v as never),
  },
  {
    id: "functions",
    label: "Function",
    note: "The work it does in the system",
    options: [
      { value: "nitrogenFixer", label: "Nitrogen fixer", color: "#8bbf6a" },
      { value: "accumulator", label: "Dynamic accumulator", color: "#c8863c" },
      { value: "groundcover", label: "Groundcover", color: "#5f9e6a" },
      { value: "nectary", label: "Insectary / nectary", color: "#f2c14e" },
    ],
    match: (p, v) => matchesFunction(p, v),
  },
  {
    id: "minerals",
    label: "Accumulates minerals",
    options: optionsFrom(MINERAL),
    match: (p, v) => p.functions.accumulator?.minerals.includes(v as never) ?? false,
  },
  {
    id: "uses",
    label: "Use",
    options: [
      { value: "edible", label: "Edible" },
      { value: "medicinal", label: "Medicinal" },
      { value: "superfood", label: "Superfood" },
    ],
    match: (p, v) => matchesUse(p, v),
  },
  {
    id: "edibleParts",
    label: "Edible part",
    options: optionsFrom(EDIBLE_PART),
    match: (p, v) => p.edibleParts.includes(v as never),
  },
  {
    id: "growthRate",
    label: "Growth rate",
    options: optionsFrom(GROWTH_RATE),
    match: (p, v) => p.growthRate === v,
  },
  {
    id: "ease",
    label: "Ease",
    options: optionsFrom(EASE),
    match: (p, v) => p.ease === v,
  },
];

export const FACET_IDS = FACETS.map((f) => f.id);
const FACET_BY_ID = new Map(FACETS.map((f) => [f.id, f]));

/** Conditions that always apply, regardless of which facet's counts we compute. */
function passesGlobal(p: LoadedPlant, f: Filters): boolean {
  if (f.zone !== null && !(p.hardiness.min <= f.zone && f.zone <= p.hardiness.max)) return false;
  if (f.selfSeeds !== null && p.selfSeeds !== f.selfSeeds) return false;
  return true;
}

function passesFacet(p: LoadedPlant, facet: Facet, selected: string[]): boolean {
  return selected.length === 0 || selected.some((v) => facet.match(p, v));
}

/** All structured facets pass (text is handled separately by the search index). */
export function matchesStructured(p: LoadedPlant, f: Filters): boolean {
  if (!passesGlobal(p, f)) return false;
  for (const facet of FACETS) {
    if (!passesFacet(p, facet, f[facet.id])) return false;
  }
  return true;
}

/**
 * Count how many plants each option of one facet would yield, holding every
 * other active facet fixed — the standard "this choice returns N" affordance.
 */
export function facetCounts(f: Filters, facetId: FacetId, pool: LoadedPlant[] = allPlants()): Map<string, number> {
  const target = FACET_BY_ID.get(facetId)!;
  const base = pool.filter((p) => {
    if (!passesGlobal(p, f)) return false;
    for (const facet of FACETS) {
      if (facet.id === facetId) continue;
      if (!passesFacet(p, facet, f[facet.id])) return false;
    }
    return true;
  });
  const counts = new Map<string, number>();
  for (const opt of target.options) {
    counts.set(opt.value, base.reduce((n, p) => n + (target.match(p, opt.value) ? 1 : 0), 0));
  }
  return counts;
}
