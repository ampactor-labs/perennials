// Companion-planting links from Permapeople's per-plant endpoint. The bulk pull
// doesn't carry them, so they need their own sweep, one call per plant.
//
// This used to live in the retired build-time pipeline, which meant the server
// could preserve companions but never discover new ones. Newly added plants got
// none, permanently.
const KEY_ID = process.env.PERMAPEOPLE_KEY_ID;
const KEY_SECRET = process.env.PERMAPEOPLE_KEY_SECRET;

export function hasCredentials() {
  return Boolean(KEY_ID && KEY_SECRET);
}

/** Companion plant ids for one plant. An empty array is a real answer. */
export async function companionsFor(plantId) {
  if (!hasCredentials()) throw new Error("PERMAPEOPLE credentials not set");
  const res = await fetch(`https://permapeople.org/api/plants/${plantId}/companions`, {
    headers: {
      "x-permapeople-key-id": KEY_ID,
      "x-permapeople-key-secret": KEY_SECRET,
      Accept: "application/json",
      "User-Agent": "perennials-data-service/1.0 (+https://ampactor.dev/perennials)",
    },
  });
  // A plant with no companion page is a legitimate empty, not a failure.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Permapeople companions HTTP ${res.status} (plant ${plantId})`);
  const body = await res.json();
  const list = body.plants ?? body.companions ?? (Array.isArray(body) ? body : []);
  return list.map((p) => p?.id).filter((x) => Number.isInteger(x));
}
