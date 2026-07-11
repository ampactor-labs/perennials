// Transform the raw Permapeople dump into app-ready artifacts:
//   public/data/plants.json  — the full dataset the app fetches once and caches
//   public/data/facets.json  — the constraint vocabulary, counts derived from data
//   public/data/meta.json    — counts, attribution, generatedAt
//
// Everything here is Permapeople's real data (CC BY-SA 4.0); nothing is authored.
// We only normalize casing noise and parse ranges so the facets are clean.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = resolve(HERE, ".cache", "permapeople", "plants-raw.json");
const OUT = resolve(HERE, "..", "..", "public", "data");

const atoms = (v) => String(v).split(",").map((s) => s.trim()).filter(Boolean);
const lc = (s) => s.toLowerCase();

// Canonicalize the small, noisy facets to a clean value set.
function canon(map, fallbackKeep = false) {
  return (raw) => {
    const out = [];
    for (const a of atoms(raw)) {
      const hit = map[lc(a)];
      if (hit) out.push(hit);
      else if (fallbackKeep) out.push(a);
    }
    return [...new Set(out)];
  };
}

const light = canon({
  "full sun": "Full sun",
  "partial sun/shade": "Partial sun/shade",
  "partial shade": "Partial sun/shade",
  "full sun/partial shade": "Partial sun/shade",
  "full shade": "Full shade",
});
const water = canon({
  moist: "Moist",
  dry: "Dry",
  wet: "Wet",
  water: "Wet",
  low: "Dry",
  moderate: "Moist",
  "wet to moist": "Moist",
  "well-drained": "Dry",
});
const soil = canon({
  "light (sandy)": "Light (sandy)",
  sand: "Light (sandy)",
  sandy: "Light (sandy)",
  medium: "Medium",
  loam: "Medium",
  loamy: "Medium",
  "loam (silt)": "Medium",
  "heavy (clay)": "Heavy (clay)",
  clay: "Heavy (clay)",
});
const layer = canon({
  "tall trees": "Tall trees",
  trees: "Trees",
  shrubs: "Shrubs",
  vines: "Vines",
  herbs: "Herbs",
  roots: "Roots",
  "ground cover": "Ground cover",
});
const lifeCycle = canon({ perennial: "Perennial", annual: "Annual", biennial: "Biennial" });
const growth = canon({ fast: "Fast", medium: "Medium", slow: "Slow" });

function warnings(raw) {
  const out = new Set();
  for (const a of atoms(raw)) {
    const s = lc(a);
    if (s.includes("invasive")) out.add("Invasive");
    else if (s.includes("weed")) out.add("Weed potential");
    else if (s.includes("toxic") || s.includes("poison")) out.add("Toxic");
  }
  return [...out];
}

function hardiness(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (m) return { min: +m[1], max: +m[2] };
  const one = String(raw).match(/\d+/);
  return one ? { min: +one[0], max: +one[0] } : null;
}

function heightM(raw) {
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const rawPlants = JSON.parse(await readFile(RAW, "utf8"));
  const species = rawPlants.filter((p) => p.type === "Plant");

  const plants = [];
  for (const p of species) {
    const d = {};
    for (const kv of p.data ?? []) if (kv.key) d[kv.key] = kv.value;

    const rec = {
      id: p.id,
      slug: p.slug,
      name: p.name,
      scientificName: p.scientific_name,
      family: d.Family || null,
      description: (p.description || "").trim() || null,
      thumb: p.images?.thumb || null,
      light: light(d["Light requirement"]),
      water: water(d["Water requirement"]),
      soil: soil(d["Soil type"]),
      layer: layer(d.Layer)[0] || null,
      lifeCycle: lifeCycle(d["Life cycle"])[0] || null,
      growth: growth(d.Growth)[0] || null,
      edible: lc(d.Edible || "") === "true" || (d["Edible parts"] ? true : false),
      edibleParts: d["Edible parts"] ? atoms(d["Edible parts"]) : [],
      functions: d.Utility ? atoms(d.Utility) : [],
      medicinal: d.Medicinal || null,
      hardiness: hardiness(d["USDA Hardiness zone"]),
      nativeTo: d["Native to"] ? atoms(d["Native to"]) : [],
      warnings: warnings(d.Warning),
      height: heightM(d.Height),
      links: {
        wikipedia: d.Wikipedia || null,
        pfaf: d["Plants For A Future"] || null,
        permapeople: `https://permapeople.org${p.link || `/plants/${p.slug}`}`,
      },
    };
    plants.push(rec);
  }

  plants.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  // Derive facet vocabularies with real counts.
  const facetKeys = {
    light: (r) => r.light,
    water: (r) => r.water,
    soil: (r) => r.soil,
    layer: (r) => (r.layer ? [r.layer] : []),
    lifeCycle: (r) => (r.lifeCycle ? [r.lifeCycle] : []),
    growth: (r) => (r.growth ? [r.growth] : []),
    edibleParts: (r) => r.edibleParts,
    functions: (r) => r.functions,
    warnings: (r) => r.warnings,
    family: (r) => (r.family ? [r.family] : []),
    nativeTo: (r) => r.nativeTo,
  };
  const facets = {};
  for (const [key, get] of Object.entries(facetKeys)) {
    const c = new Map();
    for (const r of plants) for (const v of get(r)) c.set(v, (c.get(v) ?? 0) + 1);
    facets[key] = [...c.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }
  const edibleCount = plants.filter((r) => r.edible).length;

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await writeFile(resolve(OUT, "plants.json"), JSON.stringify(plants));
  await writeFile(resolve(OUT, "facets.json"), JSON.stringify(facets));
  await writeFile(
    resolve(OUT, "meta.json"),
    JSON.stringify({
      count: plants.length,
      edibleCount,
      source: "Permapeople (permapeople.org)",
      license: "CC BY-SA 4.0",
      note: "Plant data from Permapeople contributors, CC BY-SA 4.0.",
    }),
  );

  const bytes = JSON.stringify(plants).length;
  console.log(`Wrote ${plants.length} plants -> public/data/plants.json (${(bytes / 1e6).toFixed(1)} MB)`);
  console.log(`Facets: ${Object.entries(facets).map(([k, v]) => `${k}:${v.length}`).join(", ")}`);
  console.log(`Edible: ${edibleCount}  ·  with hardiness: ${plants.filter((r) => r.hardiness).length}  ·  with photo: ${plants.filter((r) => r.thumb).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
