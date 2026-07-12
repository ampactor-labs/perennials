// Fill Postgres with the dataset. Two paths:
//   - source: pull from Permapeople + transform (needs PERMAPEOPLE_KEY_*).
//   - seed:   fetch the already-built dataset from the live static file, so the
//             API serves identical data immediately, with no key and no empty window.
// A source refresh preserves companion links already stored (the source pull
// carries none), so we don't re-run the expensive per-plant companions sweep.
import { ensureSchema, countPlants, replaceAll, existingCompanions } from "./db.mjs";
import { hasCredentials, pullAll } from "./permapeople.mjs";
import { rawToPlants } from "./transform.mjs";

const SEED_URL = process.env.SEED_URL || "https://ampactor.dev/perrenials/data/plants.json";

export async function refreshFromSource() {
  const raw = await pullAll();
  const companions = await existingCompanions();
  const plants = rawToPlants(raw, companions);
  await replaceAll(plants);
  return plants.length;
}

export async function seedFromUrl(url = SEED_URL) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`seed fetch ${url}: HTTP ${res.status}`);
  const plants = await res.json(); // already transformed Plant[]
  if (!Array.isArray(plants) || plants.length === 0) throw new Error("seed payload empty");
  await replaceAll(plants);
  return plants.length;
}

export async function ingest({ force = false } = {}) {
  await ensureSchema();
  if (hasCredentials()) {
    return { mode: "source", count: await refreshFromSource() };
  }
  const n = await countPlants();
  if (n === 0 || force) {
    return { mode: "seed", count: await seedFromUrl() };
  }
  return { mode: "skip", count: n };
}

// Direct run: `node src/ingest.mjs [--force]` (for a manual or scheduled job).
if (import.meta.url === `file://${process.argv[1]}`) {
  ingest({ force: process.argv.includes("--force") })
    .then((r) => {
      console.log("ingest:", r);
      process.exit(0);
    })
    .catch((e) => {
      console.error("ingest failed:", e);
      process.exit(1);
    });
}
