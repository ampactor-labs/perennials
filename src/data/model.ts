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
  /** Where it has naturalised. The honest companion to nativeTo: this is the
   *  invasiveness question, in the source's own words. */
  introducedTo: string[];
  /** The names she'd actually say. "Mouse melon" for Melothria scabra. */
  altNames: string[];
  /** How it is eaten (Oil, Coffee, Gum), as distinct from which part. */
  edibleUses: string[];
  /** Coarse labels, for filtering only. Never show these alone: "Toxic fruits" and
   *  "Toxic for cats" both land on "Toxic". Show `cautions` to a human. */
  warnings: string[];
  /** The source's verbatim warning sentence, e.g. "Toxic fruits". */
  cautions?: string;
  height: number | null;
  /** Metres. Spacing, for someone laying out a bed. */
  width: number | null;
  links: {
    wikipedia: string | null;
    pfaf: string | null;
    powo?: string | null;
    permapeople: string;
  };
  /** Documentation richness 0–100, computed at transform time; drives default rank. */
  score: number;
  /** Permapeople companion-planting links (plant ids), when known. */
  companions?: number[];
  /**
   * Flower-visitor groups (Bees, Butterflies, Hoverflies…) from GloBI's published
   * interaction records.
   *
   * Absent means nobody has recorded a visitor — for about 4,900 of the 8,800
   * plants. It does not mean nothing visits them. (An earlier note here promised
   * that a present-but-empty array would distinguish "looked, found nothing" from
   * "never looked", but no plant in the shipped data has one, so anything relying
   * on that distinction was reading "unrecorded" as "no visitors".)
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
