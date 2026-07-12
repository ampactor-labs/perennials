// Pull the entire Permapeople plant database (~8,400 plants) via keyset
// pagination, and cache the raw dump. Permapeople is CC BY-SA 4.0 — attribution
// to permapeople.org is required, and it becomes the app's primary dataset.
//
// Credentials come from the environment (never a committed file):
//   PERMAPEOPLE_KEY_ID=... PERMAPEOPLE_KEY_SECRET=... node scripts/data/pull-permapeople.mjs
// or:  node --env-file=.env scripts/data/pull-permapeople.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY_ID = process.env.PERMAPEOPLE_KEY_ID;
const KEY_SECRET = process.env.PERMAPEOPLE_KEY_SECRET;
if (!KEY_ID || !KEY_SECRET) {
  console.error(
    "Missing credentials. Set PERMAPEOPLE_KEY_ID and PERMAPEOPLE_KEY_SECRET\n" +
      "(both are shown together on permapeople.org -> Settings -> API keys).",
  );
  process.exit(1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, ".cache", "permapeople");
const headers = {
  "x-permapeople-key-id": KEY_ID,
  "x-permapeople-key-secret": KEY_SECRET,
  Accept: "application/json",
  "User-Agent": "perennials-data-build/0.1 (+https://ampactor.dev/perennials)",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pullAll() {
  const all = [];
  let lastId = 0;
  let total = null;
  for (let guard = 0; guard < 500; guard++) {
    const res = await fetch(
      `https://permapeople.org/api/plants?last_id=${lastId}&per_page=100`,
      { headers },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} at last_id=${lastId}`);
    const body = await res.json();
    const plants = body.plants ?? body.data ?? [];
    if (plants.length === 0) break;
    all.push(...plants);
    total = body.total ?? body.pagination?.total ?? total;
    lastId = body.last_id ?? body.pagination?.last_id ?? plants[plants.length - 1].id;
    process.stdout.write(`\r  pulled ${all.length}${total ? `/${total}` : ""}  (last_id=${lastId})`);
    const more = body.has_more ?? body.pagination?.has_more ?? plants.length === 100;
    if (!more) break;
    await sleep(300);
  }
  return { plants: all, total };
}

const { plants, total } = await pullAll();
await mkdir(OUT, { recursive: true });
await writeFile(resolve(OUT, "plants-raw.json"), JSON.stringify(plants));
console.log(`\nSaved ${plants.length}${total ? ` of ${total}` : ""} plants to scripts/data/.cache/permapeople/plants-raw.json`);

// Show the shape of the constraint space: which data[] keys exist and how
// common they are — this drives the facet design.
const keyCounts = new Map();
for (const p of plants) {
  for (const kv of p.data ?? []) {
    const k = kv.key ?? kv.name ?? Object.keys(kv)[0];
    if (k) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
  }
}
const ranked = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`\nConstraint keys across the dataset (${ranked.length} distinct):`);
for (const [k, n] of ranked.slice(0, 40)) {
  console.log(`  ${String(n).padStart(5)}  ${k}`);
}
