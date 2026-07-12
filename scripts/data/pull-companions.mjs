// Sweep Permapeople's per-plant companions endpoint for every species in the
// raw dump. Resumable: each response is cached as .cache/permapeople/companions/
// <id>.json and existing files are skipped, so re-runs only fetch what's missing.
// Output is merged into the app dataset by transform.mjs.
//
//   PERMAPEOPLE_KEY_ID=... PERMAPEOPLE_KEY_SECRET=... node scripts/data/pull-companions.mjs
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEY_ID = process.env.PERMAPEOPLE_KEY_ID;
const KEY_SECRET = process.env.PERMAPEOPLE_KEY_SECRET;
if (!KEY_ID || !KEY_SECRET) {
  console.error("Missing PERMAPEOPLE_KEY_ID / PERMAPEOPLE_KEY_SECRET");
  process.exit(1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(HERE, ".cache", "permapeople");
const OUT = resolve(CACHE, "companions");
const headers = {
  "x-permapeople-key-id": KEY_ID,
  "x-permapeople-key-secret": KEY_SECRET,
  Accept: "application/json",
  "User-Agent": "perennials-data-build/0.1 (+https://ampactor.dev/perennials)",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const raw = JSON.parse(await readFile(resolve(CACHE, "plants-raw.json"), "utf8"));
const ids = raw.filter((p) => p.type === "Plant").map((p) => p.id);
await mkdir(OUT, { recursive: true });
const done = new Set((await readdir(OUT)).map((f) => Number(f.replace(".json", ""))));
const todo = ids.filter((id) => !done.has(id));
console.log(`${ids.length} species; ${done.size} cached; ${todo.length} to fetch`);

let fetched = 0;
let withData = 0;
for (const id of todo) {
  let delay = 90;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`https://permapeople.org/api/plants/${id}/companions`, { headers });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) {
        await writeFile(resolve(OUT, `${id}.json`), "[]");
        break;
      }
      const body = await res.json();
      const list = (body.plants ?? body.companions ?? (Array.isArray(body) ? body : []))
        .map((p) => p.id)
        .filter((x) => Number.isInteger(x));
      await writeFile(resolve(OUT, `${id}.json`), JSON.stringify(list));
      if (list.length) withData += 1;
      break;
    } catch (err) {
      if (attempt >= 5) {
        console.error(`\ngiving up on ${id}: ${err.message}`);
        break;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
  fetched += 1;
  if (fetched % 50 === 0)
    process.stdout.write(`\r  ${fetched}/${todo.length} fetched (${withData} with companions)`);
  await sleep(delay);
}

// Merge everything cached into one map for the transform step.
const files = await readdir(OUT);
const map = {};
for (const f of files) {
  const list = JSON.parse(await readFile(resolve(OUT, f), "utf8"));
  if (Array.isArray(list) && list.length) map[Number(f.replace(".json", ""))] = list;
}
await writeFile(resolve(CACHE, "companions-map.json"), JSON.stringify(map));
console.log(`\nDone. ${Object.keys(map).length} plants have companions -> companions-map.json`);
