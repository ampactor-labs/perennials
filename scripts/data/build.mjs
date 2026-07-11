// Data-build pipeline. Reads the curated species list, enriches each plant from
// several open sources, and writes a committed, source-cited dataset the app
// loads at runtime. Run: npm run data:build  (needs network; safe to re-run —
// responses are cached under scripts/data/.cache).
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSpecies } from "./species.mjs";
import { gbif } from "./sources/gbif.mjs";
import { usda } from "./sources/usda.mjs";
import { wikipedia } from "./sources/wikipedia.mjs";
import { reconcile } from "./reconcile.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "..", "..", "src", "data", "generated");

// Priority order: GBIF (taxonomy), USDA (honesty layer), Wikipedia (prose+image).
const ADAPTERS = [
  { name: "GBIF", fn: gbif },
  { name: "USDA PLANTS", fn: usda },
  { name: "Wikipedia", fn: wikipedia },
];

const SOURCES = [
  { name: "GBIF", url: "https://www.gbif.org", license: "CC BY 4.0", use: "Accepted names, family, common names" },
  { name: "USDA PLANTS", url: "https://plants.usda.gov", license: "Public domain (US Government)", use: "Native status, invasive/noxious listings, duration, growth habit" },
  { name: "Wikipedia", url: "https://en.wikipedia.org", license: "CC BY-SA 4.0", use: "Descriptions" },
  { name: "Wikimedia Commons", url: "https://commons.wikimedia.org", license: "Per-file (see file page)", use: "Plant photographs" },
  { name: "Edible Forest Gardens v2 (Jacke & Toensmeier)", url: "https://www.chelseagreen.com", license: "Referenced, not redistributed", use: "Permaculture function, use and layer data (curated)" },
  { name: "Plants For A Future", url: "https://pfaf.org", license: "Referenced, not redistributed", use: "Edibility/medicinal cross-reference (curated)" },
];

async function main() {
  const species = await loadSpecies();
  console.log(`Enriching ${species.length} species from ${ADAPTERS.length} open sources...\n`);

  const plants = {};
  const hits = Object.fromEntries(ADAPTERS.map((a) => [a.name, 0]));
  const errors = [];
  let done = 0;

  for (const sp of species) {
    const results = [];
    for (const a of ADAPTERS) {
      try {
        const r = await a.fn(sp);
        results.push(r);
        if (r?.ok) hits[a.name] += 1;
      } catch (err) {
        errors.push(`${sp.id} / ${a.name}: ${err.message}`);
      }
    }
    const { fields, provenance } = reconcile(results);
    plants[sp.id] = { scientificName: sp.scientificName, ...fields, provenance };
    done += 1;
    process.stdout.write(`\r  ${done}/${species.length}  ${sp.id.padEnd(24)}`);
  }

  await mkdir(OUT, { recursive: true });
  const payload = { generatedAt: new Date().toISOString(), sources: SOURCES, plants };
  await writeFile(resolve(OUT, "enrichment.json"), JSON.stringify(payload));
  await writeFile(resolve(OUT, "attribution.json"), JSON.stringify(SOURCES, null, 2));

  console.log("\n\nSource coverage:");
  for (const [name, n] of Object.entries(hits)) {
    console.log(`  ${name.padEnd(14)} ${n}/${species.length}`);
  }
  console.log(`\nWrote src/data/generated/enrichment.json (${species.length} plants).`);
  if (errors.length) {
    console.log(`\n${errors.length} soft errors:`);
    console.log(errors.slice(0, 12).map((e) => "  " + e).join("\n"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
