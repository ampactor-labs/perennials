// The read API the app fetches. Serves the same three payloads the static site
// shipped — /data/plants.json, /data/facets.json, /data/meta.json — from Postgres,
// cached in memory with an ETag, CORS-open (read-only public CC BY-SA data).
// Seeds itself on an empty boot and refreshes weekly in-process when source
// credentials are present.
import http from "node:http";
import crypto from "node:crypto";
import zlib from "node:zlib";
import {
  ensureSchema, countPlants, allPlants, maxUpdatedAt,
  attractsProgress, bloomProgress, companionsProgress, recheckProgress, photoProgress,
} from "./db.mjs";
import { deriveFacets, deriveMeta } from "./facets.mjs";
import { ingest, refreshFromSource, enrichAll, recheckStalest } from "./ingest.mjs";
import { hasCredentials } from "./permapeople.mjs";
import { imageFor, imageStats, WIDTHS } from "./images.mjs";

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

let cache = null; // { "plants.json": { raw, gzip, br, etag }, ... }

/**
 * Build each payload once, with its compressed forms and a content-addressed ETag.
 *
 * The ETag hashes the bytes we are about to serve. Keying it on max(updated_at)
 * instead — as this did — is silently wrong in both directions: the hourly recheck
 * rewrites attracts/bloom/companions without touching updated_at, so a phone holding
 * the old ETag got a 304 forever and never saw ten weeks of re-verification; while a
 * weekly source pull TRUNCATEs and re-INSERTs every row, so updated_at moves for all
 * 8,800 plants even when not a single field changed, forcing a full re-download of a
 * byte-identical payload. Hash the content and both problems are the same problem.
 *
 * Compressing here rather than per-request costs one pass per rebuild (hourly at
 * worst) and takes plants.json from 8.9 MB to ~1.2 MB gzip / ~800 KB brotli. She is
 * on a phone in a garden; that is the difference between an 18-second first load and
 * a two-second one.
 */
function encode(text) {
  const raw = Buffer.from(text);
  return {
    raw,
    gzip: zlib.gzipSync(raw, { level: 6 }),
    br: zlib.brotliCompressSync(raw, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
    }),
    etag: '"' + crypto.createHash("sha1").update(raw).digest("hex") + '"',
  };
}

async function rebuildCache() {
  const plants = await allPlants();
  const facets = deriveFacets(plants);
  const meta = deriveMeta(plants, await maxUpdatedAt());
  cache = {
    "plants.json": encode(JSON.stringify(plants)),
    "facets.json": encode(JSON.stringify(facets)),
    "meta.json": encode(JSON.stringify(meta)),
  };
  return cache;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "If-None-Match, Authorization, Content-Type");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const { pathname } = new URL(req.url, "http://localhost");

  try {
    if (pathname === "/" || pathname === "/health") {
      const n = await countPlants().catch(() => -1);
      const updatedAt = await maxUpdatedAt().catch(() => null);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        ok: n >= 0,
        plants: n,
        source: hasCredentials() ? "permapeople" : "seed",
        dataAgeDays: updatedAt
          ? +((Date.now() - new Date(updatedAt).getTime()) / DAY_MS).toFixed(2)
          : null,
        attracts: await attractsProgress().catch(() => null),   // GloBI
        bloom: await bloomProgress().catch(() => null),         // USDA
        companions: await companionsProgress().catch(() => null), // Permapeople
        recheck: await recheckProgress().catch(() => null),     // rolling re-verify
        photos: await photoProgress().catch(() => null),        // Permapeople images
        images: imageStats(),                                   // resizer cache
      }));
    }

    // Kick off the GloBI visitor sweep. Takes many minutes, so start it and
    // answer immediately; progress shows up on /health and in the logs.
    if (pathname === "/admin/enrich" && req.method === "POST") {
      if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "forbidden" }));
      }
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ started: true }));
      // Every sweep is resumable, so a restart mid-run costs nothing but time.
      enrichAll({ onProgress: (p) => console.log("enrich:", JSON.stringify(p)) })
        .then(async (r) => {
          console.log("enrich complete:", JSON.stringify(r));
          await rebuildCache();
        })
        .catch((e) => console.error("enrich failed:", e.message));
      return;
    }

    // Resized plant photo: /img/<plant id>/<width>.webp
    //
    // Keyed on the plant, not on a URL — an `?u=` proxy would be an open one, and
    // this way the only images we will ever fetch are the ones already in our own
    // database. The width must be one of the handful the layout actually asks for.
    const img = pathname.match(/^\/img\/(\d+)\/(\d+)\.webp$/);
    if (img && (req.method === "GET" || req.method === "HEAD")) {
      const id = Number(img[1]);
      const w = Number(img[2]);
      if (!WIDTHS.includes(w)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "unsupported width", widths: WIDTHS }));
      }

      let entry;
      try {
        entry = await imageFor(id, w);
      } catch (e) {
        // The origin blinked. Say so honestly rather than caching a broken image:
        // the client falls back to its "no photo" glyph and retries next time.
        console.error(`image ${id}/${w}:`, e.message);
        res.writeHead(502, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "origin unavailable" }));
      }
      if (!entry) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "no photo for that plant" }));
      }

      if (req.headers["if-none-match"] === entry.etag) {
        res.writeHead(304, { ETag: entry.etag });
        return res.end();
      }
      res.writeHead(200, {
        "Content-Type": "image/webp",
        // The bytes for a given plant and width never change, so let the phone
        // keep them for good.
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": entry.body.length,
        ETag: entry.etag,
      });
      return res.end(req.method === "HEAD" ? undefined : entry.body);
    }

    const m = pathname.match(/^\/data\/(plants|facets|meta)\.json$/);
    if (m && (req.method === "GET" || req.method === "HEAD")) {
      if (!cache) await rebuildCache();
      const file = cache[`${m[1]}.json`];

      if (req.headers["if-none-match"] === file.etag) {
        res.writeHead(304, { ETag: file.etag, Vary: "Accept-Encoding" });
        return res.end();
      }

      const accept = req.headers["accept-encoding"] ?? "";
      const [encoding, body] = /\bbr\b/.test(accept)
        ? ["br", file.br]
        : /\bgzip\b/.test(accept)
          ? ["gzip", file.gzip]
          : [null, file.raw];

      const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "Content-Length": body.length,
        Vary: "Accept-Encoding",
        ETag: file.etag,
      };
      if (encoding) headers["Content-Encoding"] = encoding;
      res.writeHead(200, headers);
      return res.end(req.method === "HEAD" ? undefined : body);
    }

    if (pathname === "/admin/refresh" && req.method === "POST") {
      if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "forbidden" }));
      }
      // A source pull can take minutes — start it and respond immediately rather
      // than holding the connection open. Result lands in the logs.
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ started: true }));
      ingest({ force: true })
        .then((result) => rebuildCache().then(() => console.log("manual refresh:", result)))
        .catch((e) => console.error("manual refresh failed:", e.message));
      return;
    }

    // Nudge the rolling re-check by hand. It runs hourly on its own; this exists
    // so the rotation can be proven to work without waiting an hour for it.
    if (pathname === "/admin/recheck" && req.method === "POST") {
      if (!ADMIN_TOKEN || req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "forbidden" }));
      }
      const n = Number(new URL(req.url, "http://localhost").searchParams.get("n")) || 5;
      const result = await recheckStalest(n);
      await rebuildCache();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(result));
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (e) {
    console.error("request error:", e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
});

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const STALE_AFTER_DAYS = 7;
// A trickle, not a flood. 5 plants an hour cycles all 8,800 in about ten weeks,
// which keeps every enrichment layer current without ever hitting a small
// academic service with tens of thousands of calls in one afternoon.
const RECHECK_PER_HOUR = 5;

let refreshing = false;

/**
 * Re-pull the source if the data has aged out, then fill in any enrichment the
 * new plants are missing.
 *
 * The check runs on boot and hourly, NOT on a 24-hour timer. A daily interval
 * only fires after 24 hours of unbroken uptime, and every deploy or container
 * recycle resets it to zero, so in practice it would never fire at all.
 */
async function refreshIfStale(reason) {
  if (refreshing || !hasCredentials()) return;
  const updatedAt = await maxUpdatedAt();
  const ageDays = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) / DAY_MS : Infinity;
  if (ageDays < STALE_AFTER_DAYS) return;

  refreshing = true;
  try {
    console.log(`data ${ageDays.toFixed(1)}d old (${reason}) — refreshing from source`);
    const count = await refreshFromSource();
    await rebuildCache();
    console.log(`refresh complete: ${count} plants`);

    // Plants Permapeople added since last week arrive with no visitors, no bloom
    // and no companions. Without this they would stay that way forever.
    const enriched = await enrichAll({ onProgress: (p) => console.log("enrich:", JSON.stringify(p)) });
    console.log("newcomer enrichment:", JSON.stringify(enriched));
    await rebuildCache();
  } finally {
    refreshing = false;
  }
}

async function boot() {
  await ensureSchema();
  if ((await countPlants()) === 0) {
    console.log("empty DB — running initial ingest");
    console.log("ingest:", await ingest());
  }
  await rebuildCache().catch((e) => console.error("initial cache build failed:", e.message));
  server.listen(PORT, () => {
    const meta = cache ? JSON.parse(cache["meta.json"].raw.toString()) : null;
    const size = cache ? (cache["plants.json"].br.length / 1e6).toFixed(2) : "?";
    console.log(`perennials api listening on :${PORT} (${meta?.count ?? "?"} plants, ${size} MB br)`);
  });

  refreshIfStale("boot").catch((e) => console.error("boot refresh failed:", e.message));

  setInterval(async () => {
    try {
      await refreshIfStale("hourly check");
      if (refreshing) return; // a full refresh is already doing the work
      const { rechecked } = await recheckStalest(RECHECK_PER_HOUR);
      if (rechecked) await rebuildCache();
    } catch (e) {
      console.error("hourly tick failed:", e.message);
    }
  }, HOUR_MS);
}

boot().catch((e) => {
  console.error("boot failed:", e);
  process.exit(1);
});
