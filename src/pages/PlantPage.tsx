import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import { BLOOM_HEX, bloomPeriodLabel } from "@/lib/bloom";
import { useKept } from "@/lib/kept";
import { IconAlert, IconChevronLeft, IconKeep } from "@/components/icons";
import { NotePanel } from "@/components/NotePanel";
import { SeenMark } from "@/components/SeenMark";
import { Thumb } from "@/components/Thumb";

/** Close the source's clause so ours doesn't run into it. Never rewords it. */
const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

function BackLink() {
  const navigate = useNavigate();
  const canPop = window.history.state?.idx > 0;
  if (!canPop) {
    return (
      <Link to="/" className="back-link">
        <IconChevronLeft width={18} height={18} />
        All plants
      </Link>
    );
  }
  return (
    <button className="back-link" onClick={() => navigate(-1)}>
      <IconChevronLeft width={18} height={18} />
      All plants
    </button>
  );
}

function KeepButton({ plant }: { plant: Plant }) {
  const { kept, toggle } = useKept();
  const on = kept.some((k) => k.id === plant.id);
  return (
    <button
      className={on ? "btn btn--primary keep-btn" : "btn keep-btn"}
      onClick={() => toggle(plant.id)}
      aria-pressed={on}
    >
      <IconKeep width={17} height={17} filled={on} />
      {on ? "Kept" : "Keep"}
    </button>
  );
}

/** Six names read as "it goes by a few things". Three hundred read as a data dump. */
const SHOWN_NAMES = 6;

function AltNames({ names }: { names: string[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? names : names.slice(0, SHOWN_NAMES);
  const rest = names.length - shown.length;
  return (
    <div className="detail-altnames">
      Also called {shown.join(", ")}
      {rest > 0 && (
        <>
          {". "}
          <button className="linkish" onClick={() => setAll(true)}>
            {rest.toLocaleString()} more
          </button>
        </>
      )}
    </div>
  );
}

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
              <Thumb id={f.id} has={!!f.thumb} sizes="28px" />
            </span>
            <span className="companion-name">{f.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * A row of values, or — when `absent` is given — a row that says nobody recorded
 * any. The distinction is the whole point on the three fields below: she filtered
 * on "Attracts: Bees", and a page that simply omits the row leaves her unable to
 * tell "nothing visits it" from "nobody has looked".
 */
/** Long lists get folded, never quietly cut. Yellow Sorrel has naturalised into 248
 *  regions; showing twelve of them and saying nothing is the same silent truncation
 *  the guild view used to do, and the rule here is that absence is always named. */
const SHOWN_CHIPS = 12;

function ChipRow({
  label,
  values,
  absent,
  swatches,
}: {
  label: string;
  values: string[];
  absent?: string;
  swatches?: boolean;
}) {
  const [all, setAll] = useState(false);

  if (values.length === 0) {
    if (!absent) return null;
    return (
      <div className="attr-row">
        <span className="attr-label">{label}</span>
        <span className="attr-absent">{absent}</span>
      </div>
    );
  }

  const shown = all ? values : values.slice(0, SHOWN_CHIPS);
  const rest = values.length - shown.length;
  return (
    <div className="attr-row">
      <span className="attr-label">{label}</span>
      <span className="chip-row">
        {shown.map((v) => {
          const hex = swatches ? BLOOM_HEX[v] : undefined;
          return (
            <span key={v} className="ptag">
              {hex && <span className="swatch" style={{ background: hex }} aria-hidden="true" />}
              {v}
            </span>
          );
        })}
        {rest > 0 && (
          <button className="linkish" onClick={() => setAll(true)}>
            {rest.toLocaleString()} more
          </button>
        )}
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
        {/* A pop, not a push. `<Link to="/">` was a fresh navigation, which scrolled
            her to the top of a list she had scrolled 200 cards into. */}
        <BackLink />
      </div>

      <header className="detail-head">
        <div>
          <h1 className="detail-title">{plant.name}</h1>
          <div className="detail-binomial binomial">{plant.scientificName}</div>
          {/* The names she'd actually say out loud. All of them go into the search
              index; only a few belong on the page. Tamarind carries 310, which are
              transliterations from every language it grows in, and 547 plants carry
              more than eight. */}
          {plant.altNames.length > 0 && <AltNames names={plant.altNames} />}
          {plant.family && <div className="detail-family eyebrow">{plant.family}</div>}
        </div>
        {/* .detail-head has been `1fr auto` all along with nothing in the auto
            column. This is what it was waiting for. */}
        <KeepButton plant={plant} />
      </header>

      {plant.thumb && (
        <figure className="specimen-photo">
          <Thumb id={plant.id} has={!!plant.thumb} alt={plant.name} photo />
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
            {/* The source's sentence rarely ends in punctuation ("Toxic fruits"),
                and what follows ran straight onto it. */}
            <b>Caution:</b> {sentence(plant.cautions ?? plant.warnings.join(", "))}
            {plant.edible && plant.edibleParts.length > 0 && (
              <>
                {" "}
                Parts of this plant are eaten ({plant.edibleParts.join(", ")}), so read which
                parts the warning names.
              </>
            )}
            {/* Castor bean is marked edible with no parts recorded at all, and it
                is one of about a hundred like that. Saying nothing here let the
                "Edible" chip stand unqualified next to a poison warning. */}
            {plant.edible && plant.edibleParts.length === 0 && (
              <>
                {" "}
                This plant is marked edible and <b>no edible parts are recorded</b>, so nothing
                here tells you which parts the warning is about.
              </>
            )}{" "}
            Wording is Permapeople's; verify before eating or planting.
          </span>
        </div>
      )}

      {/* Her hand, above the printed record — where an annotation sits on a
          herbarium sheet. The note is her prose; the bloom marks are her data. */}
      <NotePanel plant={plant} />
      <SeenMark plant={plant} />

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
        {/* Spacing, for someone actually laying out a bed. */}
        {plant.width != null && <ChipRow label="Width" values={[`${plant.width} m`]} />}
        {/* The three she can now search by. They belong on the page she searched
            her way to — otherwise she narrows to "Attracts: Bees", taps a result,
            and the page says nothing about bees. */}
        <ChipRow
          label="Bloom"
          values={plant.bloomColor ? [plant.bloomColor] : []}
          swatches
          absent="Not recorded. USDA covers North-American species."
        />
        <ChipRow
          label="Blooms"
          values={plant.bloomPeriod ? [bloomPeriodLabel(plant.bloomPeriod)] : []}
        />
        <ChipRow label="Flower visitors" values={plant.attracts ?? []} absent="No visitor recorded." />
        <ChipRow label="Edible parts" values={plant.edibleParts} />
        {/* How it's eaten, which is a different question from which part. */}
        <ChipRow label="Eaten as" values={plant.edibleUses} />
        <ChipRow label="Native to" values={plant.nativeTo} />
        {/* The invasiveness question, asked in the source's own words. If it has
            naturalised across half the world, that is worth seeing next to where
            it is actually from. */}
        <ChipRow label="Naturalised in" values={plant.introducedTo} />
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
        {plant.links.powo && (
          <a href={plant.links.powo} target="_blank" rel="noreferrer noopener">
            Kew
          </a>
        )}
        <a href={plant.links.permapeople} target="_blank" rel="noreferrer noopener">
          Permapeople
        </a>
      </div>

      {/* Credit only the sources that actually fed this plant. GloBI is CC BY 4.0;
          the attribution is a licence term, not a nicety. */}
      <p className="provenance">
        Data from{" "}
        <a href="https://permapeople.org" target="_blank" rel="noreferrer noopener">
          Permapeople
        </a>{" "}
        contributors, licensed CC BY-SA 4.0.
        {plant.attracts && plant.attracts.length > 0 && (
          <>
            {" "}
            Flower visitors from{" "}
            <a
              href="https://www.globalbioticinteractions.org"
              target="_blank"
              rel="noreferrer noopener"
            >
              GloBI
            </a>
            , CC BY 4.0.
          </>
        )}
        {(plant.bloomColor || plant.bloomPeriod) && (
          <>
            {" "}
            Bloom from{" "}
            <a href="https://plants.usda.gov" target="_blank" rel="noreferrer noopener">
              USDA PLANTS
            </a>
            , public domain.
          </>
        )}
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
