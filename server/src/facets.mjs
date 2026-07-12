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
  const generatedAt = (updatedAt ? new Date(updatedAt) : new Date()).toISOString().slice(0, 10);
  return {
    count: plants.length,
    edibleCount: plants.filter((p) => p.edible).length,
    photoCount: plants.filter((p) => p.thumb).length,
    companionCount: plants.filter((p) => p.companions && p.companions.length).length,
    generatedAt,
    source: "Permapeople (permapeople.org)",
    license: "CC BY-SA 4.0",
    note: "Plant data from Permapeople contributors, CC BY-SA 4.0.",
  };
}
