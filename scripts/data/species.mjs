// The species to enrich, read straight from the curated dataset so the two
// never drift: every plant in plants.ts gets enriched by its id + binomial.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANTS_TS = resolve(HERE, "..", "..", "src", "data", "plants.ts");

export async function loadSpecies() {
  const src = await readFile(PLANTS_TS, "utf8");
  const re = /id:\s*"([^"]+)"[\s\S]*?scientificName:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    // Keep hybrids and infraspecifics intact (GBIF matches them); only a
    // trailing "spp." is noise for the lookup.
    out.push({ id: m[1], scientificName: m[2].replace(/\s+spp?\.$/i, "").trim() });
  }
  return out;
}
