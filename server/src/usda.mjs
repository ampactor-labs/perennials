// Flower colour and bloom period from USDA PLANTS (public domain, US Government
// work). Deliberately US-centric: it covers the North-American species she'd
// actually plant and returns nothing for most Old-World taxa, so expect roughly
// a quarter of the dataset to come back with a colour.
//
// Two calls per plant: resolve the name to a USDA id, then read that plant's
// characteristics. Only an exact binomial match is accepted; taking the
// top-ranked search hit instead would happily paint the wrong plant.
const UA = "perennials-enrichment/1.0 (+https://ampactor.dev/perennials)";
const API = "https://plantsservices.sc.egov.usda.gov/api";

// USDA names carry markup and author strings: "<i>Achillea millefolium</i> L."
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

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`USDA HTTP ${res.status}`);
  return res.json();
}

function rowsOf(search) {
  if (Array.isArray(search)) {
    return search[0] && typeof search[0] === "object" && "Plant" in search[0]
      ? search.map((x) => x.Plant).filter(Boolean)
      : search;
  }
  for (const k of ["PlantResults", "data", "results", "Results"]) {
    if (Array.isArray(search?.[k])) return search[k];
  }
  return [];
}

/** { color, period } for one plant. Both null when USDA doesn't cover it. */
export async function bloomFor(scientificName) {
  const target = binomial(scientificName);
  if (!target) return { color: null, period: null };

  const search = await getJson(`${API}/PlantSearch?searchText=${encodeURIComponent(target)}`);
  const hit = rowsOf(search).find((r) => binomial(r.ScientificName) === target);
  if (!hit?.Id) return { color: null, period: null };

  const chars = await getJson(`${API}/PlantCharacteristics/${hit.Id}`);
  const pick = (name) => {
    const c = (chars ?? []).find((x) => String(x.PlantCharacteristicName) === name);
    const v = c?.PlantCharacteristicValue;
    return v && String(v).trim() ? String(v).trim() : null;
  };
  return { color: pick("Flower Color"), period: pick("Bloom Period") };
}
