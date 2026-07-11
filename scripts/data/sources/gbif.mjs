// GBIF — the taxonomy backbone: accepted name, family, and English common names.
// License: CC BY 4.0. https://www.gbif.org
import { cachedJson, field, dedupe } from "../lib/http.mjs";

export async function gbif(species) {
  const match = await cachedJson(
    `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(species.scientificName)}`,
    { bucket: "gbif" },
  );
  const fields = {};
  if (!match || !match.usageKey || match.matchType === "NONE") {
    return { source: "GBIF", fields, ok: false };
  }
  fields.gbifKey = field(match.usageKey, "GBIF", 1);
  if (match.canonicalName) fields.canonicalName = field(match.canonicalName, "GBIF", 0.95);
  if (match.family) fields.family = field(match.family, "GBIF", 0.92);
  if (match.rank) fields.rank = field(match.rank, "GBIF", 0.9);

  const vern = await cachedJson(
    `https://api.gbif.org/v1/species/${match.usageKey}/vernacularNames?limit=40`,
    { bucket: "gbif" },
  );
  const english = (vern?.results ?? [])
    .filter((r) => r.language === "eng" || !r.language)
    .map((r) => r.vernacularName);
  const names = dedupe(english).filter((n) => /^[a-z][a-z '.-]+$/i.test(n)).slice(0, 6);
  if (names.length) fields.vernaculars = field(names, "GBIF", 0.7);

  return { source: "GBIF", fields, ok: true };
}
