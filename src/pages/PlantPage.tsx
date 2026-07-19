import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import { BLOOM_HEX, bloomPeriodLabel } from "@/lib/bloom";
import { hardinessLabel } from "@/lib/hardiness";
import { useKept } from "@/lib/kept";
import { mineFor, useMine, type MineField } from "@/lib/mine";
import { phenologyLine } from "@/lib/phenology";
import { seenSlots, useSeen } from "@/lib/seen";
import { AddMine, AddMinePhoto } from "@/components/AddMine";
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
 * A row of values, or (when `absent` is given) a row that says our sources carry
 * none. The distinction is the whole point on the three fields below: she filtered
 * on "Attracts: Bees", and a page that simply omits the row leaves her unable to
 * tell "nothing visits it" from "our data doesn't have it".
 *
 * What the row may not do is claim the absence is the world's. Somebody has very
 * likely recorded this plant's bloom colour somewhere; we only know that the
 * three sources we pull didn't hand it to us, so that is the only thing the copy
 * is allowed to say.
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
  mine,
  plantId,
}: {
  label: string;
  values: string[];
  absent?: string;
  swatches?: boolean;
  /** Give a field key and the row lets her fill the blank herself. Only ever
   *  offered where our sources gave nothing: a value we do have is not hers to
   *  overwrite, and the "+" never appears next to one. */
  mine?: MineField;
  plantId?: number;
}) {
  const [all, setAll] = useState(false);
  const { mine: written } = useMine();
  const hers =
    mine && plantId !== undefined ? mineFor(written, plantId, mine)?.text : undefined;

  if (values.length === 0) {
    // A blank row with nowhere to put anything is worth printing only when it
    // has something to say about why it is blank.
    if (!absent && !mine) return null;
    return (
      <div className="attr-row">
        <span className="attr-label">{label}</span>
        <span className="chip-row">
          {absent && hers === undefined && <span className="attr-absent">{absent}</span>}
          {mine && plantId !== undefined && (
            <AddMine id={plantId} field={mine} label={label} value={hers} />
          )}
        </span>
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

/**
 * When it blooms: the printed record, and hers, side by side.
 *
 * USDA recorded a period for about one plant in eight, and this row used to
 * render nothing at all for the other seven: silence in the one place a reader
 * looks for bloom timing, while her own "Mark blooming today" marks sat further up
 * the page saying otherwise. Her record belongs here, in her own ink, whether or
 * not the printed one has anything to say. Same rule as the calendar: a mark of
 * hers earns its place even where USDA is blank.
 *
 * And when her marks land outside the printed band, the row says so in one
 * line: her yard teaching the record, with neither side called wrong. It only
 * ever speaks when both records exist; a blank period is a gap in our data,
 * not a band she can fall outside of.
 */
function BloomsRow({ plant }: { plant: Plant }) {
  const { seen } = useSeen();
  const mine = seenSlots(seen, plant.id);
  const printed = plant.bloomPeriod ? bloomPeriodLabel(plant.bloomPeriod) : null;
  if (!printed && mine.length === 0) return null;
  const outran = phenologyLine(mine, plant.bloomPeriod);
  return (
    <div className="attr-row">
      <span className="attr-label">Blooms</span>
      <span className="chip-row">
        {printed && <span className="ptag">{printed}</span>}
        {mine.length > 0 && (
          <span className="ptag ptag--mine">{mine.join(", ")} · seen by you</span>
        )}
        {outran && <span className="phenology">{outran}</span>}
      </span>
    </div>
  );
}

/** Her functions, beside the sourced ones. This is the one row where hers sits
 *  next to values we do have rather than only in place of them: a plant can do
 *  something in her yard that no contributor wrote down, and that is an addition,
 *  not a correction. It still renders in her ink. */
function MineFunctions({ plant }: { plant: Plant }) {
  const { mine } = useMine();
  return (
    <AddMine
      id={plant.id}
      field="functions"
      label="Functions"
      value={mineFor(mine, plant.id, "functions")?.text}
    />
  );
}

/** Her photo, on a plant the guide has no photo for. A plant Permapeople did
 *  photograph keeps its sourced figure and is not second-guessed here. */
function MinePhotoRow({ plant }: { plant: Plant }) {
  const { mine } = useMine();
  if (plant.thumb) return null;
  return <AddMinePhoto id={plant.id} value={mineFor(mine, plant.id, "photo")?.text} />;
}

function Detail({ plant, data }: { plant: Plant; data: Dataset }) {
  const paras = (plant.description ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const zone = plant.hardiness ? hardinessLabel(plant.hardiness) : null;
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

      {/* Permapeople has a photo for about half the catalogue. For the other half
          the page has always just had a hole where the plant should be, and she
          is the one standing in front of it with a camera. Only offered where the
          guide has none: her photo supplements the record, never replaces it. */}
      <MinePhotoRow plant={plant} />

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

      {/* Her hand, above the printed record, where an annotation sits on a
          herbarium sheet. The note is her prose; the bloom marks are her data. */}
      <NotePanel plant={plant} />
      <SeenMark plant={plant} />

      <section className="panel" style={{ marginTop: "var(--sp-5)" }}>
        <div className="panel-title">At a glance</div>
        {/* Every row below takes a `mine` key, so a blank is never a dead end:
            where our sources gave nothing she can put what she sees, in her own
            ink. Hardiness, height and width used to render nothing at all when
            null, which is the one shape that can't offer her anything. */}
        <ChipRow label="Layer" values={plant.layer ? [plant.layer] : []} mine="layer" plantId={plant.id} />
        <ChipRow label="Light" values={plant.light} mine="light" plantId={plant.id} />
        <ChipRow label="Water" values={plant.water} mine="water" plantId={plant.id} />
        <ChipRow label="Soil" values={plant.soil} mine="soil" plantId={plant.id} />
        <ChipRow label="Life cycle" values={plant.lifeCycle ? [plant.lifeCycle] : []} mine="lifeCycle" plantId={plant.id} />
        <ChipRow label="Growth" values={plant.growth ? [plant.growth] : []} mine="growth" plantId={plant.id} />
        <ChipRow label="Hardiness" values={zone ? [`USDA ${zone}`] : []} mine="hardiness" plantId={plant.id} />
        <ChipRow label="Height" values={plant.height != null ? [`${plant.height} m`] : []} mine="height" plantId={plant.id} />
        {/* Spacing, for someone actually laying out a bed. Recorded for 3% of the
            catalogue, so this row is her hand's more often than not. */}
        <ChipRow label="Width" values={plant.width != null ? [`${plant.width} m`] : []} mine="width" plantId={plant.id} />
        {/* The three she can now search by. They belong on the page she searched
            her way to. Otherwise she narrows to "Attracts: Bees", taps a result,
            and the page says nothing about bees. */}
        {/* "Bloom" was this row's label, and it renders the colour, so a plant
            USDA never described read "Bloom: not in our sources" directly under a
            button she had just pressed to say it was blooming. The row is about
            the colour; it has to say so. */}
        <ChipRow
          label="Bloom colour"
          values={plant.bloomColor ? [plant.bloomColor] : []}
          swatches
          absent="Not in our sources. USDA covers North-American species."
          mine="bloomColor"
          plantId={plant.id}
        />
        <BloomsRow plant={plant} />
        <ChipRow
          label="Flower visitors"
          values={plant.attracts ?? []}
          absent="No visitor in our sources."
          mine="attracts"
          plantId={plant.id}
        />
        <ChipRow label="Edible parts" values={plant.edibleParts} mine="edibleParts" plantId={plant.id} />
        {/* How it's eaten, which is a different question from which part. */}
        <ChipRow label="Eaten as" values={plant.edibleUses} />
        <ChipRow label="Native to" values={plant.nativeTo} mine="nativeTo" plantId={plant.id} />
        {/* The invasiveness question, asked in the source's own words. If it has
            naturalised across half the world, that is worth seeing next to where
            it is actually from. */}
        <ChipRow label="Naturalised in" values={plant.introducedTo} />
      </section>

      {/* The section used to vanish when the sources had no function for a plant,
          which is the one case where a permaculture gardener most obviously knows
          something we don't. It stays, and it asks. */}
      <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
        <div className="panel-title">Functions &amp; uses</div>
        <div className="chip-row">
          {plant.functions.map((f) => (
            <span key={f} className="ptag ptag--fn">
              {f}
            </span>
          ))}
          <MineFunctions plant={plant} />
        </div>
      </section>

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
