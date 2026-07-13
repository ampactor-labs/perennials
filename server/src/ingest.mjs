// Fill Postgres with the dataset. Two paths:
//   - source: pull from Permapeople + transform (needs PERMAPEOPLE_KEY_*).
//   - seed:   fetch the already-built dataset from the live static file, so the
//             API serves identical data immediately, with no key and no empty window.
// A source refresh preserves companion links already stored (the source pull
// carries none), so we don't re-run the expensive per-plant companions sweep.
import {
  ensureSchema, countPlants, replaceAll, existingCompanions,
  existingAttracts, plantsNeedingAttracts, setAttracts,
  existingBloom, plantsNeedingBloom, setBloom,
  plantsNeedingCompanions, setCompanions,
  existingRecheckedAt, stalestPlants, markRechecked,
} from "./db.mjs";
import { hasCredentials, pullAll } from "./permapeople.mjs";
import { rawToPlants } from "./transform.mjs";
import { attractsFor } from "./globi.mjs";
import { bloomFor } from "./usda.mjs";
import { companionsFor } from "./companions.mjs";

const SEED_URL = process.env.SEED_URL || "https://ampactor.dev/perennials/data/plants.json";

export async function refreshFromSource() {
  const raw = await pullAll();
  const companions = await existingCompanions();
  const attracts = await existingAttracts();
  const bloom = await existingBloom();
  const recheckedAt = await existingRecheckedAt();
  const plants = rawToPlants(raw, companions);

  // Trust gate. replaceAll TRUNCATEs before inserting, so a short pull (upstream
  // outage, truncated page, changed schema) would otherwise quietly destroy the
  // dataset and serve the wreckage. Refuse instead: the stored data stays put and
  // the failure is loud.
  const current = await countPlants();
  if (current > 0 && plants.length < current * 0.9) {
    throw new Error(
      `refusing refresh: source returned ${plants.length} plants, but ${current} are stored ` +
        `(under the 90% floor). Keeping the existing data.`,
    );
  }
  // The source pull carries neither visitor nor bloom data, so carry forward the
  // enrichment we already paid for.
  for (const p of plants) {
    // A plant already swept for companions stays swept, even if it has none.
    if (companions[p.id] !== undefined) p.companionsChecked = true;
    if (recheckedAt[p.id]) p.recheckedAt = recheckedAt[p.id];
    const groups = attracts[p.id];
    if (groups) p.attracts = groups;
    const b = bloom[p.id];
    if (b) {
      p.bloomColor = b.color;
      p.bloomPeriod = b.period;
      p.bloomChecked = true;
    }
  }
  await replaceAll(plants);
  return plants.length;
}

/** Companion links from Permapeople, for every plant not yet swept. */
export async function enrichCompanions({ concurrency = 4, onProgress } = {}) {
  if (!hasCredentials()) return { total: 0, done: 0, withLinks: 0, failed: 0 };
  const todo = await plantsNeedingCompanions();
  let next = 0, done = 0, withLinks = 0, failed = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= todo.length) return;
      try {
        const ids = await companionsFor(todo[i]);
        await setCompanions(todo[i], ids);
        if (ids.length) withLinks += 1;
      } catch {
        failed += 1; // stays unswept, retried next time
      }
      done += 1;
      if (onProgress && done % 250 === 0) {
        onProgress({ done, total: todo.length, withLinks, failed });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { total: todo.length, done, withLinks, failed };
}

/**
 * Fill in every enrichment layer that's missing anything. Each sweep only touches
 * rows it hasn't done, so after the first full run this is cheap: it's what picks
 * up plants that Permapeople added since last week, which would otherwise sit in
 * the dataset forever with no visitors, no bloom and no companions.
 */
export async function enrichAll({ onProgress } = {}) {
  const log = (sweep) => (p) => onProgress?.({ sweep, ...p });
  const attracts = await enrichAttracts({ onProgress: log("attracts") });
  const bloom = await enrichBloom({ onProgress: log("bloom") });
  const companions = await enrichCompanions({ onProgress: log("companions") });
  return { attracts, bloom, companions };
}

/**
 * Re-verify enrichment on the few stalest plants. Run hourly, this cycles the
 * whole dataset in roughly ten weeks: a trickle, not a quarterly flood at a small
 * academic service. It also quietly heals plants whose lookups once failed, and
 * picks up coverage that GloBI has ingested since we last asked.
 */
export async function recheckStalest(n = 5) {
  const todo = await stalestPlants(n);
  for (const p of todo) {
    try {
      await setAttracts(p.id, await attractsFor(p.scientificName));
    } catch { /* leave the previous answer standing */ }
    try {
      const b = await bloomFor(p.scientificName);
      await setBloom(p.id, b.color, b.period);
    } catch { /* ditto */ }
    if (hasCredentials()) {
      try {
        await setCompanions(p.id, await companionsFor(p.id));
      } catch { /* ditto */ }
    }
    // Stamp even when a lookup failed. Otherwise a permanently broken plant stays
    // "stalest" forever and wedges the rotation on itself.
    await markRechecked(p.id);
  }
  return { rechecked: todo.length };
}

/** Flower colour and bloom period from USDA, for every plant not yet checked. */
export async function enrichBloom({ concurrency = 5, onProgress } = {}) {
  const todo = await plantsNeedingBloom();
  let next = 0, done = 0, withColor = 0, failed = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= todo.length) return;
      const p = todo[i];
      try {
        const { color, period } = await bloomFor(p.scientificName);
        await setBloom(p.id, color, period);
        if (color) withColor += 1;
      } catch {
        failed += 1; // leave bloom_checked false so the next sweep retries it
      }
      done += 1;
      if (onProgress && done % 250 === 0) {
        onProgress({ done, total: todo.length, withColor, failed });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { total: todo.length, done, withColor, failed };
}

/**
 * Fill in flower-visitor groups from GloBI for every plant that has none yet.
 * Resumable: a plant whose lookup fails keeps attracts NULL and is retried on
 * the next run, while an enriched-but-empty plant (wind-pollinated) is left be.
 */
export async function enrichAttracts({ concurrency = 6, onProgress } = {}) {
  const todo = await plantsNeedingAttracts();
  let next = 0, done = 0, withVisitors = 0, failed = 0;

  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= todo.length) return;
      const p = todo[i];
      try {
        const groups = await attractsFor(p.scientificName);
        await setAttracts(p.id, groups);
        if (groups.length) withVisitors += 1;
      } catch {
        failed += 1; // leave NULL so the next sweep retries it
      }
      done += 1;
      if (onProgress && done % 250 === 0) {
        onProgress({ done, total: todo.length, withVisitors, failed });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return { total: todo.length, done, withVisitors, failed };
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
