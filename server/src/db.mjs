// Postgres access + schema for the perennials data service.
// One table, `plants`, mirroring src/data/model.ts (Plant). The API reconstructs
// the exact JSON shape the app already consumes; facets/meta are derived on read.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) console.warn("DATABASE_URL is not set — DB calls will fail until it is.");

// Railway's internal URL (postgres.railway.internal) and local dev use no TLS.
// For any other host, TLS is verified by default. Disabling verification is
// needed only for Railway's self-signed *public* proxy during local dev — make
// that an explicit, documented opt-in (DATABASE_SSL_NO_VERIFY=1), never silent.
function sslConfig(u) {
  if (!u || /\.railway\.internal|localhost|127\.0\.0\.1/.test(u)) return undefined;
  if (process.env.DATABASE_SSL_NO_VERIFY === "1") return { rejectUnauthorized: false };
  return { rejectUnauthorized: true };
}

export const pool = new pg.Pool({
  connectionString: url,
  ssl: sslConfig(url),
  max: 5,
});

export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS plants (
      id             integer PRIMARY KEY,
      slug           text UNIQUE NOT NULL,
      name           text NOT NULL,
      scientific_name text NOT NULL,
      family         text,
      description    text,
      thumb          text,
      light          text[] NOT NULL DEFAULT '{}',
      water          text[] NOT NULL DEFAULT '{}',
      soil           text[] NOT NULL DEFAULT '{}',
      layer          text,
      life_cycle     text,
      growth         text,
      edible         boolean NOT NULL DEFAULT false,
      edible_parts   text[] NOT NULL DEFAULT '{}',
      functions      text[] NOT NULL DEFAULT '{}',
      medicinal      text,
      hardiness_min  smallint,
      hardiness_max  smallint,
      native_to      text[] NOT NULL DEFAULT '{}',
      warnings       text[] NOT NULL DEFAULT '{}',
      height         real,
      links          jsonb NOT NULL DEFAULT '{}',
      companions     integer[],
      attracts       text[],
      score          integer NOT NULL DEFAULT 0,
      updated_at     timestamptz NOT NULL DEFAULT now()
    );
  `);
  // Added after the table shipped; NULL means "not enriched yet", while an empty
  // array means "enriched, genuinely no flower visitors" (grasses, conifers).
  await pool.query(`ALTER TABLE plants ADD COLUMN IF NOT EXISTS attracts text[];`);
  // Bloom needs its own "checked" flag: a null colour is a real answer (USDA
  // doesn't cover this plant), so it can't double as "not looked up yet".
  await pool.query(`ALTER TABLE plants ADD COLUMN IF NOT EXISTS bloom_color text;`);
  await pool.query(`ALTER TABLE plants ADD COLUMN IF NOT EXISTS bloom_period text;`);
  await pool.query(
    `ALTER TABLE plants ADD COLUMN IF NOT EXISTS bloom_checked boolean NOT NULL DEFAULT false;`,
  );
  // The source's verbatim warning sentence. The coarse `warnings` labels are for
  // filtering; this is what a person actually needs to read.
  await pool.query(`ALTER TABLE plants ADD COLUMN IF NOT EXISTS cautions text;`);
  // Companions need their own "checked" flag for the same reason bloom does: an
  // empty companion list is a real answer, so it can't stand in for "not swept".
  await pool.query(
    `ALTER TABLE plants ADD COLUMN IF NOT EXISTS companions_checked boolean NOT NULL DEFAULT false;`,
  );
  // One-time backfill. The retired pipeline already swept every plant that existed
  // at seed time (all 8,799; only 187 came back with links), so mark them checked
  // rather than fire 8,600 redundant calls at a small community server.
  //
  // The NOT EXISTS guard makes this fire exactly once: on later boots some row is
  // already checked, so it no-ops. Without it, this would keep marking genuinely
  // new plants as swept and they would never get companions at all.
  await pool.query(
    `UPDATE plants SET companions_checked = true
       WHERE NOT EXISTS (SELECT 1 FROM plants WHERE companions_checked);`,
  );
  // When each plant's enrichment was last re-verified. Drives the rolling
  // re-check: a few plants an hour, so the whole dataset cycles in ~10 weeks
  // without ever hammering a small upstream service in a burst.
  await pool.query(`ALTER TABLE plants ADD COLUMN IF NOT EXISTS rechecked_at timestamptz;`);
}

/** The plants whose enrichment is stalest. Never-rechecked ones come first. */
export async function stalestPlants(limit = 5) {
  const { rows } = await pool.query(
    "SELECT id, scientific_name FROM plants ORDER BY rechecked_at NULLS FIRST, score DESC LIMIT $1",
    [limit],
  );
  return rows.map((r) => ({ id: r.id, scientificName: r.scientific_name }));
}

/** The origin photo URL for one plant, or null. Used by the image resizer. */
export async function thumbFor(id) {
  const { rows } = await pool.query("SELECT thumb FROM plants WHERE id = $1", [id]);
  return rows[0]?.thumb ?? null;
}

export async function markRechecked(id) {
  await pool.query("UPDATE plants SET rechecked_at = now() WHERE id = $1", [id]);
}

export async function recheckProgress() {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS total, count(rechecked_at)::int AS done, min(rechecked_at) AS oldest FROM plants",
  );
  return rows[0];
}

export async function plantsNeedingCompanions(limit = 20000) {
  const { rows } = await pool.query(
    "SELECT id FROM plants WHERE companions_checked = false ORDER BY score DESC LIMIT $1",
    [limit],
  );
  return rows.map((r) => r.id);
}

export async function setCompanions(id, ids) {
  await pool.query(
    "UPDATE plants SET companions = $2, companions_checked = true WHERE id = $1",
    [id, ids && ids.length ? ids : null],
  );
}

export async function companionsProgress() {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE companions_checked)::int AS done, count(companions)::int AS with_links FROM plants",
  );
  return rows[0];
}

export async function plantsNeedingBloom(limit = 20000) {
  const { rows } = await pool.query(
    "SELECT id, scientific_name FROM plants WHERE bloom_checked = false ORDER BY score DESC LIMIT $1",
    [limit],
  );
  return rows.map((r) => ({ id: r.id, scientificName: r.scientific_name }));
}

export async function setBloom(id, color, period) {
  await pool.query(
    "UPDATE plants SET bloom_color = $2, bloom_period = $3, bloom_checked = true WHERE id = $1",
    [id, color, period],
  );
}

// Prior bloom data, so a source refresh (which carries none) keeps it.
export async function existingBloom() {
  const { rows } = await pool.query(
    "SELECT id, bloom_color, bloom_period FROM plants WHERE bloom_checked = true",
  );
  const map = {};
  for (const r of rows) map[r.id] = { color: r.bloom_color, period: r.bloom_period };
  return map;
}

// A source refresh truncates, so the re-check clock has to survive it too or the
// whole dataset would look never-rechecked and re-sweep itself every week.
export async function existingRecheckedAt() {
  const { rows } = await pool.query(
    "SELECT id, rechecked_at FROM plants WHERE rechecked_at IS NOT NULL",
  );
  const map = {};
  for (const r of rows) map[r.id] = r.rechecked_at;
  return map;
}

export async function bloomProgress() {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS total, count(*) FILTER (WHERE bloom_checked)::int AS done, count(bloom_color)::int AS with_color FROM plants",
  );
  return rows[0];
}

// Plants still awaiting a GloBI lookup (attracts IS NULL, not merely empty).
export async function plantsNeedingAttracts(limit = 20000) {
  const { rows } = await pool.query(
    "SELECT id, scientific_name FROM plants WHERE attracts IS NULL ORDER BY score DESC LIMIT $1",
    [limit],
  );
  return rows.map((r) => ({ id: r.id, scientificName: r.scientific_name }));
}

export async function setAttracts(id, groups) {
  await pool.query("UPDATE plants SET attracts = $2 WHERE id = $1", [id, groups]);
}

// Prior visitor groups, so a source refresh (which carries none) keeps them.
export async function existingAttracts() {
  const { rows } = await pool.query("SELECT id, attracts FROM plants WHERE attracts IS NOT NULL");
  const map = {};
  for (const r of rows) map[r.id] = r.attracts;
  return map;
}

export async function attractsProgress() {
  const { rows } = await pool.query(
    "SELECT count(*)::int AS total, count(attracts)::int AS done, count(NULLIF(attracts,'{}'))::int AS with_visitors FROM plants",
  );
  return rows[0];
}

export async function countPlants() {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM plants");
  return rows[0].n;
}

export async function maxUpdatedAt() {
  const { rows } = await pool.query("SELECT max(updated_at) AS m FROM plants");
  return rows[0].m;
}

// Prior companion links, so a source refresh (which has no companions) keeps them.
// Companion links plus their swept flag, so a source refresh (which carries
// neither) keeps both and doesn't re-sweep every plant each week.
export async function existingCompanions() {
  const { rows } = await pool.query(
    "SELECT id, companions FROM plants WHERE companions_checked = true",
  );
  const map = {};
  for (const r of rows) map[r.id] = r.companions ?? [];
  return map;
}

const COLS = [
  "id", "slug", "name", "scientific_name", "family", "description", "thumb",
  "light", "water", "soil", "layer", "life_cycle", "growth", "edible", "edible_parts",
  "functions", "medicinal", "hardiness_min", "hardiness_max", "native_to", "warnings",
  "height", "links", "companions", "companions_checked", "attracts",
  "bloom_color", "bloom_period", "bloom_checked", "cautions", "rechecked_at", "score",
];

function toRow(p) {
  return [
    p.id, p.slug, p.name, p.scientificName, p.family ?? null, p.description ?? null, p.thumb ?? null,
    p.light ?? [], p.water ?? [], p.soil ?? [], p.layer ?? null, p.lifeCycle ?? null, p.growth ?? null,
    Boolean(p.edible), p.edibleParts ?? [], p.functions ?? [], p.medicinal ?? null,
    p.hardiness?.min ?? null, p.hardiness?.max ?? null, p.nativeTo ?? [], p.warnings ?? [],
    p.height ?? null, JSON.stringify(p.links ?? {}), p.companions ?? null,
    Boolean(p.companionsChecked),
    p.attracts ?? null,
    p.bloomColor ?? null, p.bloomPeriod ?? null, Boolean(p.bloomChecked),
    p.cautions ?? null, p.recheckedAt ?? null, p.score ?? 0,
  ];
}

// Full replace in one transaction: readers see the old set until COMMIT (MVCC),
// so there is no empty window during ingest.
export async function replaceAll(plants) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE plants");
    const perRow = COLS.length;
    const chunkSize = 400; // 400 * 25 = 10000 params, well under Postgres' 65535
    for (let i = 0; i < plants.length; i += chunkSize) {
      const chunk = plants.slice(i, i + chunkSize);
      const params = [];
      const tuples = chunk.map((p, j) => {
        const row = toRow(p);
        const base = j * perRow;
        const ph = row.map((_, k) => {
          const n = base + k + 1;
          return COLS[k] === "links" ? `$${n}::jsonb` : `$${n}`;
        });
        params.push(...row);
        return `(${ph.join(",")})`;
      });
      await client.query(
        `INSERT INTO plants (${COLS.join(",")}) VALUES ${tuples.join(",")}`,
        params,
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function rowToPlant(r) {
  const p = {
    id: r.id,
    slug: r.slug,
    name: r.name,
    scientificName: r.scientific_name,
    family: r.family,
    description: r.description,
    thumb: r.thumb,
    light: r.light,
    water: r.water,
    soil: r.soil,
    layer: r.layer,
    lifeCycle: r.life_cycle,
    growth: r.growth,
    edible: r.edible,
    edibleParts: r.edible_parts,
    functions: r.functions,
    medicinal: r.medicinal,
    hardiness: r.hardiness_min != null ? { min: r.hardiness_min, max: r.hardiness_max } : null,
    nativeTo: r.native_to,
    warnings: r.warnings,
    height: r.height,
    links: r.links,
    score: r.score,
  };
  if (r.companions && r.companions.length) p.companions = r.companions;
  if (r.attracts && r.attracts.length) p.attracts = r.attracts;
  if (r.bloom_color) p.bloomColor = r.bloom_color;
  if (r.bloom_period) p.bloomPeriod = r.bloom_period;
  if (r.bloom_checked) p.bloomChecked = true;
  if (r.cautions) p.cautions = r.cautions;
  return p;
}

export async function allPlants() {
  const { rows } = await pool.query("SELECT * FROM plants ORDER BY score DESC, name ASC");
  return rows.map(rowToPlant);
}
