// Real, source-cited data merged in from the build-time pipeline
// (`npm run data:build`). Every field here carries provenance — see the
// `provenance` map for which open source supplied it.
import raw from "./generated/enrichment.json";

export type ProvenanceEntry = { source: string; confidence: number; note?: string };

export type PlantImage = {
  thumb: string;
  full: string;
  credit: string;
  license: string;
  page?: string;
};

export type Enrichment = {
  scientificName: string;
  canonicalName?: string;
  family?: string;
  vernaculars?: string[];
  gbifKey?: number;
  wikidata?: string;
  usdaSymbol?: string;
  duration?: string[];
  usdaGrowthHabit?: string[];
  /** Region code → "Native" | "Introduced", e.g. { L48: "Native", CAN: "Introduced" }. */
  nativeStatus?: Record<string, string>;
  invasive?: boolean;
  noxious?: boolean;
  image?: PlantImage;
  description?: string;
  provenance: Record<string, ProvenanceEntry>;
};

export type SourceCredit = { name: string; url: string; license: string; use: string };

type EnrichmentFile = {
  generatedAt: string;
  sources: SourceCredit[];
  plants: Record<string, Enrichment>;
};

const file = raw as unknown as EnrichmentFile;

export const enrichmentSources = file.sources;
export const enrichmentGeneratedAt = file.generatedAt;
export const enrichmentFor = (id: string): Enrichment | undefined => file.plants[id];

/** Human-readable regions for the native-status panel. */
export const USDA_REGIONS: Record<string, string> = {
  L48: "Lower 48 US",
  AK: "Alaska",
  HI: "Hawaii",
  PR: "Puerto Rico",
  VI: "Virgin Islands",
  CAN: "Canada",
  GL: "Greenland",
  SPM: "St. Pierre & Miquelon",
  NAV: "Navassa Island",
};
