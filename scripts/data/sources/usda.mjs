// USDA PLANTS — the authoritative, public-domain honesty layer: native vs.
// introduced by region, invasive/noxious listings, duration and growth habit.
// This is US-centric: rich for North American species, thin for Old-World ones.
// Public domain (US Government work). https://plants.usda.gov
import { cachedJson, field } from "../lib/http.mjs";

const API = "https://plantsservices.sc.egov.usda.gov/api";

// Search results carry HTML tags and author strings, e.g.
// "<i>Echinacea purpurea</i> (L.) Moench" — reduce to "echinacea purpurea".
function binomial(name) {
  return String(name)
    .replace(/<[^>]+>/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toLowerCase();
}

// PlantSearch returns [{ Text, Plant: {...} }]; unwrap to the Plant objects.
function plantsFrom(search) {
  if (Array.isArray(search)) {
    if (search[0] && typeof search[0] === "object" && "Plant" in search[0]) {
      return search.map((x) => x.Plant).filter(Boolean);
    }
    return search;
  }
  for (const k of ["PlantResults", "data", "results", "Results"]) {
    if (Array.isArray(search?.[k])) return search[k];
  }
  return [];
}

export async function usda(species) {
  const fields = {};
  const target = binomial(species.scientificName);
  const search = await cachedJson(
    `${API}/PlantSearch?searchText=${encodeURIComponent(target)}`,
    { bucket: "usda" },
  );
  const rows = plantsFrom(search);
  // Prefer an exact species match; fall back to the top-ranked result.
  const hit = rows.find((r) => binomial(r.ScientificName) === target) ?? rows[0];
  const symbol = hit?.Symbol;
  if (!symbol) return { source: "USDA PLANTS", fields, ok: false };
  fields.usdaSymbol = field(symbol, "USDA PLANTS", 1);

  const p = await cachedJson(`${API}/PlantProfile?symbol=${encodeURIComponent(symbol)}`, {
    bucket: "usda",
  });
  const src = p ?? hit;

  if (Array.isArray(src.NativeStatuses) && src.NativeStatuses.length) {
    const status = {};
    for (const s of src.NativeStatuses) if (s.Region && s.Type) status[s.Region] = s.Type;
    if (Object.keys(status).length) fields.nativeStatus = field(status, "USDA PLANTS", 0.9);
  }
  if (Array.isArray(src.Durations) && src.Durations.length)
    fields.duration = field(src.Durations, "USDA PLANTS", 0.85);
  if (Array.isArray(src.GrowthHabits) && src.GrowthHabits.length)
    fields.usdaGrowthHabit = field(src.GrowthHabits, "USDA PLANTS", 0.85);
  // The detail arrays are served on another endpoint, but the boolean flags on
  // the profile are reliable (verified against kudzu and multiflora rose). Use
  // them as the honesty signal and link out to the full USDA listing.
  const profileUrl = `https://plants.usda.gov/plant-profile/${symbol}`;
  if (p?.HasInvasiveStatuses === true)
    fields.invasive = field(true, "USDA PLANTS", 0.9, profileUrl);
  if (p?.HasNoxiousStatuses === true)
    fields.noxious = field(true, "USDA PLANTS", 0.95, profileUrl);

  return { source: "USDA PLANTS", fields, ok: !!symbol };
}
