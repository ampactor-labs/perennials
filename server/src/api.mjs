// The read API the app fetches. Serves the same three payloads the static site
// shipped — /data/plants.json, /data/facets.json, /data/meta.json — from Postgres,
// cached in memory with an ETag, CORS-open (read-only public CC BY-SA data).
// Seeds itself on an empty boot and refreshes weekly in-process when source
// credentials are present.
import http from "node:http";
import crypto from "node:crypto";
import { ensureSchema, countPlants, allPlants, maxUpdatedAt } from "./db.mjs";
import { deriveFacets, deriveMeta } from "./facets.mjs";
import { ingest, refreshFromSource } from "./ingest.mjs";
import { hasCredentials } from "./permapeople.mjs";

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

let cache = null; // { etag, body: { "plants.json": str, ... } }

async function rebuildCache() {
  const plants = await allPlants();
  const facets = deriveFacets(plants);
  const updatedAt = await maxUpdatedAt();
  const meta = deriveMeta(plants, updatedAt);
  const etag =
    '"' +
    crypto
      .createHash("sha1")
      .update(`${plants.length}|${updatedAt ? new Date(updatedAt).toISOString() : ""}`)
      .digest("hex") +
    '"';
  cache = {
    etag,
    body: {
      "plants.json": JSON.stringify(plants),
      "facets.json": JSON.stringify(facets),
      "meta.json": JSON.stringify(meta),
    },
  };
  return cache;
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: n >= 0, plants: n, source: hasCredentials() ? "permapeople" : "seed" }));
    }

    const m = pathname.match(/^\/data\/(plants|facets|meta)\.json$/);
    if (m && req.method === "GET") {
      if (!cache) await rebuildCache();
      if (req.headers["if-none-match"] === cache.etag) {
        res.writeHead(304, { ETag: cache.etag });
        return res.end();
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        ETag: cache.etag,
      });
      return res.end(cache.body[`${m[1]}.json`]);
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

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
  } catch (e) {
    console.error("request error:", e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: e.message }));
  }
});

const DAY_MS = 24 * 60 * 60 * 1000;

async function boot() {
  await ensureSchema();
  if ((await countPlants()) === 0) {
    console.log("empty DB — running initial ingest");
    console.log("ingest:", await ingest());
  }
  await rebuildCache().catch((e) => console.error("initial cache build failed:", e.message));
  server.listen(PORT, () => {
    const count = cache ? JSON.parse(cache.body["meta.json"]).count : "?";
    console.log(`perrenials api listening on :${PORT} (${count} plants)`);
  });

  // Refresh from source at most once a day if the data is >= 7 days old.
  setInterval(async () => {
    try {
      if (!hasCredentials()) return;
      const updatedAt = await maxUpdatedAt();
      const ageDays = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) / DAY_MS : Infinity;
      if (ageDays >= 7) {
        console.log(`data ${ageDays.toFixed(1)}d old — refreshing from source`);
        await refreshFromSource();
        await rebuildCache();
        console.log("refresh complete");
      }
    } catch (e) {
      console.error("scheduled refresh failed:", e.message);
    }
  }, DAY_MS);
}

boot().catch((e) => {
  console.error("boot failed:", e);
  process.exit(1);
});
