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

// Coarse labels, good enough to FILTER by and nothing more. They deliberately
// throw away the detail that matters most: "Toxic fruits", "Poisonous seeds"
// and "Toxic for cats" all land on the same word. The plant page must show the
// source's own sentence (see `cautions` below), never just these labels.
function warnings(raw) {
  const out = new Set();
  for (const a of atoms(raw)) {
    const s = lc(a);
    // A look-alike warning is about identification, not toxicity. Wild garlic is
    // edible; it simply resembles plants that would kill you. Calling it "Toxic"
    // is both wrong and drowns out the warning that actually matters.
    if (s.includes("mistaken") || s.includes("confused with")) {
      out.add("Lookalike risk");
      continue;
    }
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

  // Permapeople serves one shared placeholder image (blank.jpg) for photo-less
  // plants; any URL used by many species is that placeholder — null it so we stay
  // honest about which plants actually have photographs. It travels in both image
  // fields at once, so the same rule covers them both.
  const uses = new Map();
  for (const p of species) {
    for (const u of [p.images?.thumb, p.images?.title]) {
      if (u) uses.set(u, (uses.get(u) ?? 0) + 1);
    }
  }
  const placeholders = new Set([...uses].filter(([, n]) => n > 3).map(([u]) => u));
  const real = (u) => (u && !placeholders.has(u) ? u : null);

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
      thumb: real(p.images?.thumb),
      // The big one. Permapeople serves `title` at 800px on the long edge — 2.7x
      // the 300px `thumb` — and the pipeline was throwing it away, which is why
      // the plant page's photo was soft. It is the better resize source at every
      // size, so the image service prefers it.
      photo: real(p.images?.title),
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
      // The source's own words, verbatim and unsplit. This is the difference
      // between "Toxic" and "Toxic fruits" on a plant whose shoots are dinner.
      cautions: d.Warning ? String(d.Warning).trim() : null,
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
