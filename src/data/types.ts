import type {
  Color,
  EdiblePart,
  Ease,
  GrowthRate,
  Habit,
  Layer,
  LifeCycle,
  Mineral,
  Moisture,
  Season,
  SiteCondition,
  Sun,
  Water,
  Wildlife,
} from "./vocab";

/** A measured range in feet (mature size). */
export type FtRange = { min: number; max: number };

/** Inclusive USDA hardiness range, e.g. zones 4–8. */
export type ZoneRange = { min: number; max: number };

export type DynamicAccumulator = {
  minerals: Mineral[];
  /** Jacke's confidence rating: 3 = excellent, 2 = good, 1 = fair. */
  rating?: 1 | 2 | 3;
};

export type Medicinal = {
  /** Plain-language indications, e.g. "cardiovascular tonic". */
  uses: string[];
  /** Which parts are used, if noted. */
  parts?: EdiblePart[];
  note?: string;
};

export type Functions = {
  nitrogenFixer?: boolean;
  accumulator?: DynamicAccumulator;
  /** Effective living mulch / soil cover. */
  groundcover?: boolean;
  /** Nectary supporting bees and/or predatory & parasitic insects. */
  nectary?: boolean;
};

/** Where a field's value came from, so nothing is silently invented. */
export type Source =
  | "Edible Forest Gardens v2 (Jacke & Toensmeier)"
  | "Plants For A Future"
  | "USDA PLANTS"
  | "Permapeople"
  | "Wikimedia / Wikidata"
  | "editor";

export type Plant = {
  /** URL-safe stable id. */
  id: string;
  scientificName: string;
  commonName: string;
  otherNames?: string[];
  family?: string;

  lifeCycle: LifeCycle;
  layer: Layer;
  habit: Habit;

  /** Mature height in feet. `heightBand` is derived at load time. */
  height: FtRange;
  /** Mature crown spread in feet — drives spacing in the visualizer. */
  spread: FtRange;
  hardiness: ZoneRange;

  sun: Sun[];
  moisture: Moisture[];
  water: Water;

  bloomColors: Color[];
  bloomSeason: Season[];

  functions: Functions;
  wildlife: Wildlife[];

  edibleParts: EdiblePart[];
  medicinal?: Medicinal;
  superfood?: boolean;

  growthRate: GrowthRate;
  ease: Ease;
  selfSeeds: boolean;

  nativeRange?: string;
  /** Site conditions this plant indicates when found growing wild. */
  indicatorOf?: SiteCondition[];
  /** Common guild / companion associates (free text or ids). */
  companions?: string[];

  summary: string;
  notes?: string;
  sources: Source[];
  /** Fields we know are missing or uncertain, surfaced honestly in the UI. */
  unknown?: string[];
};

/** Height buckets from her wishlist: under 2 ft, 2–4 ft, over 4 ft. */
export type HeightBand = "under-2ft" | "2-4ft" | "over-4ft";

export type LoadedPlant = Plant & {
  heightBand: HeightBand;
  enrichment?: import("./enrichment").Enrichment;
};
