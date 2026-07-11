// Wikipedia REST — a one-paragraph description, the lead image, and the
// Wikidata id. Text: CC BY-SA 4.0. Images: per-file license on Commons.
import { cachedJson, field } from "../lib/http.mjs";

export async function wikipedia(species) {
  const title = encodeURIComponent(species.scientificName.replace(/ /g, "_"));
  const s = await cachedJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    { bucket: "wikipedia" },
  );
  const fields = {};
  if (!s || s.type === "https://mediawiki.org/wiki/HyperSwitch/errors/not_found") {
    return { source: "Wikipedia", fields, ok: false };
  }
  const page = s.content_urls?.desktop?.page;
  if (s.extract) fields.description = field(s.extract, "Wikipedia", 0.8, page);
  if (s.wikibase_item) fields.wikidata = field(s.wikibase_item, "Wikidata", 1);
  if (s.thumbnail?.source) {
    fields.image = field(
      {
        thumb: s.thumbnail.source,
        full: s.originalimage?.source ?? s.thumbnail.source,
        credit: "Wikimedia Commons",
        license: "see file page",
        page,
      },
      "Wikimedia Commons",
      0.65,
    );
  }
  return { source: "Wikipedia", fields, ok: true };
}
