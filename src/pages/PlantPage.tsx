import { Link, useParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import { IconAlert, IconChevronLeft } from "@/components/icons";

function Companions({ plant, data }: { plant: Plant; data: Dataset }) {
  const friends = (plant.companions ?? [])
    .map((id) => data.byId.get(id))
    .filter((p): p is Plant => !!p);
  if (friends.length === 0) return null;
  return (
    <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
      <div className="panel-title">Grows well with</div>
      <div className="companion-row">
        {friends.map((f) => (
          <Link key={f.slug} to={`/plant/${f.slug}`} className="companion">
            <span className="companion-thumb">
              {f.thumb ? <img src={f.thumb} alt="" loading="lazy" /> : <span>✿</span>}
            </span>
            <span className="companion-name">{f.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ChipRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="attr-row">
      <span className="attr-label">{label}</span>
      <span className="chip-row">
        {values.map((v) => (
          <span key={v} className="ptag">
            {v}
          </span>
        ))}
      </span>
    </div>
  );
}

function Detail({ plant, data }: { plant: Plant; data: Dataset }) {
  const paras = (plant.description ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const zone = plant.hardiness ? `${plant.hardiness.min}–${plant.hardiness.max}` : null;
  return (
    <div className="page wrap detail">
      <div className="detail-top">
        <Link to="/" className="back-link">
          <IconChevronLeft width={18} height={18} />
          All plants
        </Link>
      </div>

      <header className="detail-head">
        <div>
          <h1 className="detail-title">{plant.name}</h1>
          <div className="detail-binomial binomial">{plant.scientificName}</div>
          {plant.family && <div className="detail-family eyebrow">{plant.family}</div>}
        </div>
      </header>

      {plant.thumb && (
        <figure className="specimen-photo">
          <img src={plant.thumb} alt={plant.name} loading="lazy" />
          <figcaption>
            <a href={plant.links.permapeople} target="_blank" rel="noreferrer noopener">
              Permapeople
            </a>{" "}
            · CC BY-SA
          </figcaption>
        </figure>
      )}

      {(plant.cautions || plant.warnings.length > 0) && (
        <div className="callout callout--warn" style={{ marginTop: "var(--sp-4)" }}>
          <IconAlert />
          <span>
            <b>Caution:</b> {plant.cautions ?? plant.warnings.join(", ")}
            {plant.edible && plant.edibleParts.length > 0 && (
              <>
                {" "}
                Parts of this plant are eaten ({plant.edibleParts.join(", ")}), so read which
                parts the warning names.
              </>
            )}{" "}
            Wording is Permapeople's; verify before eating or planting.
          </span>
        </div>
      )}

      <section className="panel" style={{ marginTop: "var(--sp-5)" }}>
        <div className="panel-title">At a glance</div>
        <ChipRow label="Layer" values={plant.layer ? [plant.layer] : []} />
        <ChipRow label="Light" values={plant.light} />
        <ChipRow label="Water" values={plant.water} />
        <ChipRow label="Soil" values={plant.soil} />
        <ChipRow label="Life cycle" values={plant.lifeCycle ? [plant.lifeCycle] : []} />
        <ChipRow label="Growth" values={plant.growth ? [plant.growth] : []} />
        {zone && <ChipRow label="Hardiness" values={[`USDA ${zone}`]} />}
        {plant.height != null && <ChipRow label="Height" values={[`${plant.height} m`]} />}
        <ChipRow label="Edible parts" values={plant.edibleParts} />
        <ChipRow label="Native to" values={plant.nativeTo.slice(0, 12)} />
      </section>

      {plant.functions.length > 0 && (
        <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
          <div className="panel-title">Functions &amp; uses</div>
          <div className="chip-row">
            {plant.functions.map((f) => (
              <span key={f} className="ptag ptag--fn">
                {f}
              </span>
            ))}
          </div>
        </section>
      )}

      {plant.medicinal && (
        <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
          <div className="panel-title">Medicinal</div>
          <p style={{ fontSize: "var(--text-sm)" }}>{plant.medicinal}</p>
        </section>
      )}

      <Companions plant={plant} data={data} />

      {paras.length > 0 && (
        <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
          <div className="panel-title">Description</div>
          {paras.map((p, i) => (
            <p key={i} style={{ fontSize: "var(--text-sm)", lineHeight: 1.6, marginBottom: "var(--sp-2)" }}>
              {p}
            </p>
          ))}
        </section>
      )}

      <div className="detail-links">
        {plant.links.wikipedia && (
          <a href={plant.links.wikipedia} target="_blank" rel="noreferrer noopener">
            Wikipedia
          </a>
        )}
        {plant.links.pfaf && (
          <a href={plant.links.pfaf} target="_blank" rel="noreferrer noopener">
            Plants For A Future
          </a>
        )}
        <a href={plant.links.permapeople} target="_blank" rel="noreferrer noopener">
          Permapeople
        </a>
      </div>

      <p className="provenance">
        Data from{" "}
        <a href="https://permapeople.org" target="_blank" rel="noreferrer noopener">
          Permapeople
        </a>{" "}
        contributors, licensed CC BY-SA 4.0.
      </p>
    </div>
  );
}

export function PlantPage() {
  const { slug } = useParams();
  const state = useDataState();
  if (state.status !== "ready") return null;
  const plant = slug ? state.data.bySlug.get(slug) : undefined;
  if (!plant) {
    return (
      <div className="page wrap">
        <div className="empty">
          <h3>Not found</h3>
          <p>That plant isn't in the dataset.</p>
          <Link className="btn btn--ghost" to="/" style={{ marginTop: "var(--sp-3)" }}>
            Back to all plants
          </Link>
        </div>
      </div>
    );
  }
  return <Detail plant={plant} data={state.data} />;
}
