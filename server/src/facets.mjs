// Derive the facet vocabulary and meta from the Plant set — same shape and
// counts the static transform produced, computed on read from the DB rows.

const FACET_KEYS = {
  light: (p) => p.light,
  water: (p) => p.water,
  soil: (p) => p.soil,
  layer: (p) => (p.layer ? [p.layer] : []),
  lifeCycle: (p) => (p.lifeCycle ? [p.lifeCycle] : []),
  growth: (p) => (p.growth ? [p.growth] : []),
  edibleParts: (p) => p.edibleParts,
  functions: (p) => p.functions,
  attracts: (p) => p.attracts ?? [],
  bloomColor: (p) => (p.bloomColor ? [p.bloomColor] : []),
  bloomPeriod: (p) => (p.bloomPeriod ? [p.bloomPeriod] : []),
  warnings: (p) => p.warnings,
  family: (p) => (p.family ? [p.family] : []),
  nativeTo: (p) => p.nativeTo,
};

export function deriveFacets(plants) {
  const facets = {};
  for (const [key, get] of Object.entries(FACET_KEYS)) {
    const counts = new Map();
    for (const p of plants) for (const v of get(p)) counts.set(v, (counts.get(v) ?? 0) + 1);
    facets[key] = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }
  return facets;
}

export function deriveMeta(plants, updatedAt) {
  // No surrender fallback here. Defaulting to today would report the data as
  // fresh forever, which is precisely the failure the app's stale notice exists
  // to catch — and it would silence it. If we do not know when this was built,
  // say we do not know.
  const generatedAt = updatedAt ? new Date(updatedAt).toISOString().slice(0, 10) : null;
  return {
    count: plants.length,
    edibleCount: plants.filter((p) => p.edible).length,
    photoCount: plants.filter((p) => p.thumb).length,
    companionCount: plants.filter((p) => p.companions && p.companions.length).length,
    generatedAt,
    // Three sources now, not one. GloBI is CC BY 4.0, which requires attribution,
    // so naming it here is an obligation and not a courtesy.
    source: "Permapeople (permapeople.org), GloBI (globalbioticinteractions.org), USDA PLANTS",
    license: "CC BY-SA 4.0 · CC BY 4.0 · public domain",
    note:
      "Plants and their attributes from Permapeople contributors (CC BY-SA 4.0). " +
      "Flower visitors from the Global Biotic Interactions database (CC BY 4.0). " +
      "Bloom colour and period from USDA PLANTS (public domain).",
  };
}
