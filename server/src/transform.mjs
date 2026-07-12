// Normalize a raw Permapeople dump into app-ready Plant records.
// Ported verbatim from the retired build-time pipeline (scripts/data/transform.mjs,
// in git history) and kept behavior-identical, so the service serves the same
// records the static pipeline produced. Two known
// upstream quirks are preserved on purpose for migration fidelity (medicinal
// arrives as the string "True"; the Utility field is not casing-canonicalized).
// Fixing those is a deliberate follow-up, not part of the lift-and-shift.

const atoms = (v) => String(v).split(",").map((s) => s.trim()).filter(Boolean);
const lc = (s) => s.toLowerCase();

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

// rawPlants: the Permapeople dump. companions: optional { [id]: number[] }.
export function rawToPlants(rawPlants, companions = {}) {
  const species = rawPlants.filter((p) => p.type === "Plant");

  // Permapeople serves one shared placeholder image for photo-less plants; any
  // thumb used by many species is that placeholder — null it so we stay honest
  // about which plants actually have photographs.
  const thumbUses = new Map();
  for (const p of species) {
    const t = p.images?.thumb;
    if (t) thumbUses.set(t, (thumbUses.get(t) ?? 0) + 1);
  }
  const placeholders = new Set([...thumbUses].filter(([, n]) => n > 3).map(([t]) => t));

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
      description: (p.description || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() || null,
      thumb: p.images?.thumb && !placeholders.has(p.images.thumb) ? p.images.thumb : null,
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
    if (companions[p.id]?.length) rec.companions = companions[p.id];

    const attrs = [
      rec.layer, rec.lifeCycle, rec.growth, rec.hardiness, rec.height != null,
      rec.light.length > 0, rec.water.length > 0, rec.soil.length > 0,
      rec.edibleParts.length > 0, rec.functions.length > 0, rec.nativeTo.length > 0,
    ];
    const attrScore = attrs.filter(Boolean).length / attrs.length;
    const descScore = Math.min((rec.description ?? "").length, 1200) / 1200;
    rec.score = Math.round(100 * (0.45 * attrScore + 0.35 * descScore + 0.2 * (rec.thumb ? 1 : 0)));
    plants.push(rec);
  }

  plants.sort((a, b) => b.score - a.score || (a.name || "").localeCompare(b.name || ""));
  return plants;
}
