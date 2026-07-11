import MiniSearch from "minisearch";
import { allPlants } from "@/data";
import type { LoadedPlant } from "@/data/types";
import { matchesStructured, type Filters } from "./filters";

type Doc = {
  id: string;
  commonName: string;
  scientificName: string;
  otherNames: string;
  family: string;
  summary: string;
  medicinal: string;
  uses: string;
};

function toDoc(p: LoadedPlant): Doc {
  return {
    id: p.id,
    commonName: p.commonName,
    scientificName: p.scientificName,
    otherNames: (p.otherNames ?? []).join(" "),
    family: p.family ?? "",
    summary: p.summary,
    medicinal: p.medicinal?.uses.join(" ") ?? "",
    uses: p.edibleParts.join(" "),
  };
}

const index = new MiniSearch<Doc>({
  fields: ["commonName", "scientificName", "otherNames", "family", "summary", "medicinal", "uses"],
  storeFields: ["id"],
  searchOptions: {
    boost: { commonName: 4, scientificName: 3, otherNames: 3 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: "AND",
  },
});
index.addAll(allPlants().map(toDoc));

/** Ids in relevance order for a free-text query. */
function textRank(text: string): string[] {
  return index.search(text).map((r) => r.id as string);
}

/**
 * The one query the catalog runs: structured facets always apply; a non-empty
 * text box additionally narrows to fuzzy matches, ordered by relevance.
 */
export function queryPlants(filters: Filters): LoadedPlant[] {
  const structured = allPlants().filter((p) => matchesStructured(p, filters));
  const text = filters.text.trim();
  if (!text) return structured;

  const allow = new Set(structured.map((p) => p.id));
  const out: LoadedPlant[] = [];
  const seen = new Set<string>();
  for (const id of textRank(text)) {
    if (!allow.has(id) || seen.has(id)) continue;
    const p = structured.find((s) => s.id === id);
    if (p) {
      out.push(p);
      seen.add(id);
    }
  }
  return out;
}
