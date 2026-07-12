// Pull the whole Permapeople plant database via keyset pagination.
// Ported from scripts/data/pull-permapeople.mjs; credentials from the environment.
// Permapeople is CC BY-SA 4.0 — attribution to permapeople.org is required.
const KEY_ID = process.env.PERMAPEOPLE_KEY_ID;
const KEY_SECRET = process.env.PERMAPEOPLE_KEY_SECRET;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function hasCredentials() {
  return Boolean(KEY_ID && KEY_SECRET);
}

export async function pullAll() {
  if (!hasCredentials()) {
    throw new Error("PERMAPEOPLE_KEY_ID / PERMAPEOPLE_KEY_SECRET not set");
  }
  const headers = {
    "x-permapeople-key-id": KEY_ID,
    "x-permapeople-key-secret": KEY_SECRET,
    Accept: "application/json",
    "User-Agent": "perennials-data-service/1.0 (+https://ampactor.dev/perennials)",
  };
  const all = [];
  let lastId = 0;
  for (let guard = 0; guard < 500; guard++) {
    const res = await fetch(
      `https://permapeople.org/api/plants?last_id=${lastId}&per_page=100`,
      { headers },
    );
    if (!res.ok) throw new Error(`Permapeople HTTP ${res.status} at last_id=${lastId}`);
    const body = await res.json();
    const plants = body.plants ?? body.data ?? [];
    if (plants.length === 0) break;
    all.push(...plants);
    lastId = body.last_id ?? body.pagination?.last_id ?? plants[plants.length - 1].id;
    const more = body.has_more ?? body.pagination?.has_more ?? plants.length === 100;
    if (!more) break;
    await sleep(300);
  }
  return all;
}
