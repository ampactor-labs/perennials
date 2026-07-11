import type { LoadedPlant } from "@/data/types";
import { USDA_REGIONS } from "@/data/enrichment";
import { IconAlert, IconInfo } from "./icons";

export function SpecimenPhoto({ plant }: { plant: LoadedPlant }) {
  const img = plant.enrichment?.image;
  if (!img) return null;
  // Use the API-provided thumbnail as-is: Wikimedia 400s on any width larger
  // than the source file, so upscaling is unreliable.
  return (
    <figure className="specimen-photo">
      <img src={img.thumb} alt={plant.commonName} loading="lazy" />
      <figcaption>
        {img.page ? (
          <a href={img.page} target="_blank" rel="noreferrer noopener">
            {img.credit}
          </a>
        ) : (
          img.credit
        )}
      </figcaption>
    </figure>
  );
}

type Origin = { label: "Native" | "Introduced"; region: string };

function origins(plant: LoadedPlant): Origin[] {
  const ns = plant.enrichment?.nativeStatus;
  if (!ns) return [];
  // L48 first (the app's reference frame), then the rest.
  const order = Object.keys(ns).sort((a, b) => (a === "L48" ? -1 : b === "L48" ? 1 : 0));
  return order.map((code) => ({
    label: ns[code] === "Native" ? "Native" : "Introduced",
    region: USDA_REGIONS[code] ?? code,
  }));
}

export function OriginPanel({ plant }: { plant: LoadedPlant }) {
  const e = plant.enrichment;
  if (!e) return null;
  const list = origins(plant);
  const flagged = e.invasive || e.noxious;
  const usda = e.provenance?.invasive?.note ?? e.provenance?.noxious?.note;
  if (list.length === 0 && !flagged) return null;

  return (
    <section className="panel span-2">
      <div className="panel-title">Origin &amp; spread</div>
      {list.length > 0 && (
        <div className="origin-chips">
          {list.map((o) => (
            <span key={o.region} className={`origin-chip ${o.label.toLowerCase()}`}>
              <span className="origin-dot" />
              {o.label} · {o.region}
            </span>
          ))}
        </div>
      )}
      {flagged && (
        <div className="callout callout--warn" style={{ marginTop: list.length ? "var(--sp-3)" : 0 }}>
          <IconAlert />
          <span>
            USDA lists this plant as {e.invasive ? "invasive" : ""}
            {e.invasive && e.noxious ? " and " : ""}
            {e.noxious ? "a noxious weed" : ""} somewhere in the US. Check your own state before
            planting.{" "}
            {usda && (
              <a href={usda} target="_blank" rel="noreferrer noopener">
                See the USDA listing.
              </a>
            )}
          </span>
        </div>
      )}
    </section>
  );
}

export function WildDescription({ plant }: { plant: LoadedPlant }) {
  const e = plant.enrichment;
  if (!e?.description) return null;
  const page = e.provenance?.description?.note;
  return (
    <section className="panel span-2">
      <div className="panel-title">In the wild</div>
      <p style={{ fontSize: "var(--text-sm)", lineHeight: 1.6 }}>{e.description}</p>
      <p className="wiki-credit">
        {page ? (
          <a href={page} target="_blank" rel="noreferrer noopener">
            Wikipedia
          </a>
        ) : (
          "Wikipedia"
        )}{" "}
        · CC BY-SA
      </p>
    </section>
  );
}

const FIELD_LABEL: Record<string, string> = {
  family: "Family",
  canonicalName: "Accepted name",
  vernaculars: "Common names",
  nativeStatus: "Native status",
  invasive: "Invasive listing",
  noxious: "Noxious listing",
  duration: "Life cycle",
  usdaGrowthHabit: "Growth habit",
  image: "Photograph",
  description: "Description",
  gbifKey: "Taxonomy",
  wikidata: "Wikidata",
  usdaSymbol: "USDA symbol",
};

/** Per-field receipts: which open source supplied each enriched value. */
export function Receipts({ plant }: { plant: LoadedPlant }) {
  const prov = plant.enrichment?.provenance;
  if (!prov) return null;
  const rows = Object.entries(prov)
    .filter(([f]) => FIELD_LABEL[f])
    .map(([f, p]) => ({ label: FIELD_LABEL[f], source: p.source }));
  if (rows.length === 0) return null;
  return (
    <div className="receipts">
      <div className="receipts-head">
        <IconInfo width={14} height={14} />
        Where each fetched value came from
      </div>
      {rows.map((r) => (
        <div className="receipt-row" key={r.label}>
          <span>{r.label}</span>
          <span className="receipt-src">{r.source}</span>
        </div>
      ))}
    </div>
  );
}
