// Polite, cached JSON fetch for the data-build pipeline.
// Responses are cached to scripts/data/.cache so re-runs are fast and don't
// hammer public APIs. Delete .cache to force a refresh.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = resolve(HERE, "..", ".cache");

// Wikimedia and GBIF both ask for a descriptive User-Agent with contact info.
const UA =
  "perrenials-data-build/0.1 (+https://ampactor.dev/perrenials; ampactorlabs@gmail.com)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyFor = (url) => createHash("sha1").update(url).digest("hex").slice(0, 16);

async function writeCache(file, data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
}

/**
 * Fetch JSON with on-disk caching, retries and a courtesy delay.
 * A 404 is cached as null (a real "not found", not an error to retry).
 */
export async function cachedJson(url, { bucket = "misc", headers = {}, delayMs = 250, retries = 3 } = {}) {
  const file = resolve(CACHE, bucket, keyFor(url) + ".json");
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    /* cache miss */
  }
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json", ...headers },
      });
      if (res.status === 404) {
        await writeCache(file, null);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      await writeCache(file, data);
      await sleep(delayMs);
      return data;
    } catch (err) {
      lastErr = err;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`fetch failed after ${retries} tries: ${url} (${lastErr?.message})`);
}

/** A provenance-carrying field value. */
export const field = (value, source, confidence, note) => ({ value, source, confidence, note });

export const dedupe = (arr) => [...new Set(arr.map((s) => String(s).trim()))].filter(Boolean);
