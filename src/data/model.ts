// The app's data model — a straight reflection of the Permapeople dataset as
// normalized by server/src/transform.mjs. Nothing here is authored; every
// value comes from Permapeople contributors (CC BY-SA 4.0).

export type Hardiness = { min: number; max: number };

export type Plant = {
  id: number;
  slug: string;
  name: string;
  scientificName: string;
  family: string | null;
  description: string | null;
  thumb: string | null;
  light: string[];
  water: string[];
  soil: string[];
  layer: string | null;
  lifeCycle: string | null;
  growth: string | null;
  edible: boolean;
  edibleParts: string[];
  functions: string[];
  medicinal: string | null;
  hardiness: Hardiness | null;
  nativeTo: string[];
  warnings: string[];
  height: number | null;
  links: { wikipedia: string | null; pfaf: string | null; permapeople: string };
  /** Documentation richness 0–100, computed at transform time; drives default rank. */
  score: number;
  /** Permapeople companion-planting links (plant ids), when known. */
  companions?: number[];
  /**
   * Flower-visitor groups (Bees, Butterflies, Hoverflies…) derived from GloBI
   * interaction records. Absent when nothing is known; genuinely empty for
   * wind-pollinated plants like grasses and conifers.
   */
  attracts?: string[];
  /**
   * Flower color from USDA PLANTS. North-American species only, so it's absent
   * for most Old-World plants rather than wrong.
   */
  bloomColor?: string;
  /** Bloom period from USDA PLANTS, e.g. "Early Summer". */
  bloomPeriod?: string;
};

export type FacetValue = { value: string; count: number };
export type Facets = Record<string, FacetValue[]>;

export type Meta = {
  count: number;
  edibleCount: number;
  photoCount?: number;
  companionCount?: number;
  source: string;
  license: string;
  note: string;
  generatedAt?: string;
};
