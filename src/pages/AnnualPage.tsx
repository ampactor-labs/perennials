import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import { bloomSlots } from "@/lib/bloom";
import { useKept } from "@/lib/kept";
import { useMine } from "@/lib/mine";
import { noteDate, useNotes } from "@/lib/notes";
import { visitorGaps } from "@/lib/phenology";
import { blobToDataUrl, getPhoto, useMinePhoto } from "@/lib/photos";
import { useSeen } from "@/lib/seen";
import { sheetSvg } from "@/lib/yardExport";
import { figsOf, tokensOf } from "@/lib/yardViews";
import { useYards, type Yard } from "@/lib/yards";
import { BloomCalendar } from "@/components/BloomCalendar";
import { SlotLinks } from "@/components/SlotLinks";
import { IconChevronLeft } from "@/components/icons";

/**
 * The annual: one year of her record, typeset to be printed.
 *
 * Everything on this page is read from the stores she already owns — marks,
 * notes, photos, yards — assembled at render time and never written back. The
 * browser's own print-to-PDF is the whole export path: no new format, no new
 * dependency, and the page doubles as the year in review on screen. The
 * licence line rides at the foot exactly as it does on a shared sheet,
 * because a printed page travels further than a screen does.
 *
 * Dated sections (marks, notes) belong to the year in the URL. The yards and
 * photographs are the garden as it stands on the day of printing — yards
 * keep no history, and the page says so rather than implying an archive.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const LICENCE =
  "Data: Permapeople (CC BY-SA 4.0) · GloBI (CC BY 4.0) · USDA PLANTS (public domain)";

/** A yard's plan and elevation, from the exact geometry the yard page draws.
 *  The slot is null on purpose: the annual shows the timeless sheet, each
 *  mark in its recorded colour. */
function YardSheet({
  yard,
  data,
  seen,
  mine,
  ground,
}: {
  yard: Yard;
  data: Dataset;
  seen: ReturnType<typeof useSeen>["seen"];
  mine: ReturnType<typeof useMine>["mine"];
  ground: string | null;
}) {
  const tokens = tokensOf(yard, data.byId, data.mine, seen, null, "");
  const figs = figsOf(yard, data.byId, data.mine, mine, tokens);
  const placed = yard.plants.length;
  const withPeriod = yard.plants.filter(
    (pl) => bloomSlots(data.byId.get(pl.id)?.bloomPeriod).length > 0,
  ).length;
  const bloomLine =
    placed === 0
      ? null
      : `${withPeriod} of ${placed} placed ${placed === 1 ? "plant has" : "plants have"} a bloom period recorded.`;
  const { svg } = sheetSvg(yard, tokens, figs, null, bloomLine, ground);
  return (
    <figure className="annual-sheet">
      {/* Our own generated markup; every hand-written string in it passes
          through the exporter's escaping. */}
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="annual-caption">
        {yard.name}, as it stands today; a yard keeps no history.
      </figcaption>
    </figure>
  );
}

function PhotoFig({ pkey, plant }: { pkey: string; plant: Plant | undefined }) {
  const url = useMinePhoto(pkey);
  if (!url) return null;
  return (
    <figure className="annual-photo">
      <img src={url} alt={plant?.name ?? "Her photograph"} loading="lazy" />
      <figcaption className="annual-caption">{plant?.name ?? "No longer in this copy of the guide"}</figcaption>
    </figure>
  );
}

export function AnnualPage() {
  const { year: yearParam } = useParams();
  const state = useDataState();
  const { kept } = useKept();
  const { yards } = useYards();
  const { seen } = useSeen();
  const { notes } = useNotes();
  const { mine } = useMine();

  // The yards' ground photos, resolved to data URLs so the sheets carry them.
  // An unreadable photo costs a sheet its backdrop, never the page.
  const [grounds, setGrounds] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    void (async () => {
      const out: Record<string, string> = {};
      for (const y of yards) {
        if (!y.underlay) continue;
        try {
          const blob = await getPhoto(y.underlay);
          if (blob) out[y.id] = await blobToDataUrl(blob);
        } catch {
          /* the sheet draws on plain paper */
        }
      }
      if (live) setGrounds(out);
    })();
    return () => {
      live = false;
    };
  }, [yards]);

  if (state.status !== "ready") return null;
  const data = state.data;

  const now = new Date().getFullYear();
  const parsed = Number(yearParam);
  const year = Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : now;
  const inYear = (at: number) => new Date(at).getFullYear() === year;

  // Her garden: kept and placed, one set, resolved against the data she holds.
  const ids = new Set<number>(kept.map((k) => k.id));
  for (const y of yards) for (const pl of y.plants) ids.add(pl.id);
  const garden = [...ids].map((id) => data.byId.get(id)).filter((p): p is Plant => !!p);

  const marks = seen.filter((s) => inYear(s.at)).sort((a, b) => a.at - b.at);
  const marksByMonth = new Map<number, typeof marks>();
  for (const m of marks) {
    const mo = new Date(m.at).getMonth();
    (marksByMonth.get(mo) ?? marksByMonth.set(mo, []).get(mo)!).push(m);
  }

  const yearNotes = notes.filter((n) => inYear(n.at)).sort((a, b) => a.at - b.at);
  const photos = mine.filter((m) => m.field === "photo");

  const vg = garden.length > 0 ? visitorGaps(garden, data.mine, seen) : null;

  const empty =
    marks.length === 0 && yearNotes.length === 0 && yards.length === 0 && garden.length === 0;

  return (
    <div className="page wrap annual">
      <div className="detail-top annual-chrome">
        <Link to="/kept" className="back-link">
          <IconChevronLeft width={18} height={18} />
          Kept
        </Link>
      </div>

      <header className="annual-head">
        <div className="annual-chrome annual-yearnav">
          <Link to={`/annual/${year - 1}`} className="linkish">
            ← {year - 1}
          </Link>
          {year < now && (
            <Link to={`/annual/${year + 1}`} className="linkish">
              {year + 1} →
            </Link>
          )}
        </div>
        <h1 className="annual-title">Field notes · {year}</h1>
        <p className="annual-sub">
          Printed{" "}
          {new Date().toLocaleDateString(undefined, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          . Your record beside the sources', each in its own ink.
        </p>
        <button className="btn btn--sm annual-chrome" onClick={() => window.print()}>
          Print
        </button>
      </header>

      {empty && (
        <p className="annual-caption">
          Nothing recorded for {year} yet. Marks, notes, yards and photographs gather here
          through the year.
        </p>
      )}

      {marks.length > 0 && (
        <section className="annual-sec">
          <h2>Blooms witnessed</h2>
          {[...marksByMonth.entries()].map(([mo, ms]) => (
            <div key={mo} className="annual-month">
              <h3>{MONTHS[mo]}</h3>
              <ul>
                {ms.map((m) => {
                  const p = data.byId.get(m.id);
                  return (
                    <li key={`${m.id}-${m.at}`}>
                      {new Date(m.at).getDate()} {MONTHS[new Date(m.at).getMonth()]} —{" "}
                      {p ? (
                        <Link to={`/plant/${p.slug}`} className="annual-plant">
                          {p.name}
                        </Link>
                      ) : (
                        "a plant no longer in this copy of the guide"
                      )}
                      , in bloom.
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {yearNotes.length > 0 && (
        <section className="annual-sec">
          {/* `at` is last-touched, so an old note rewritten this year belongs
              to this year — say "touched", not "written". */}
          <h2>Notes touched in {year}</h2>
          {yearNotes.map((n) => {
            const p = data.byId.get(n.id);
            return (
              <div key={n.id} className="annual-note">
                <div className="annual-note-head">
                  {p ? (
                    <Link to={`/plant/${p.slug}`} className="annual-plant">
                      {p.name}
                    </Link>
                  ) : (
                    "No longer in this copy of the guide"
                  )}
                  <span className="annual-caption"> · {noteDate(n.at)}</span>
                </div>
                <p className="annual-note-text">{n.text}</p>
              </div>
            );
          })}
        </section>
      )}

      {garden.length > 0 && (
        <section className="annual-sec">
          <h2>The year, on the record's axis</h2>
          <BloomCalendar plants={garden} context="garden" />
          {vg && (
            <p className="annual-caption">
              {`Visitors are recorded for ${vg.covered} of ${vg.of} garden ${vg.of === 1 ? "plant" : "plants"}.`}
              {vg.covered > 0 && vg.gaps.length > 0 && (
                <>
                  {" "}
                  In <SlotLinks slots={vg.gaps} />, nothing recorded in bloom has a recorded
                  flower visitor.
                </>
              )}
            </p>
          )}
        </section>
      )}

      {yards.length > 0 && (
        <section className="annual-sec">
          <h2>The yards</h2>
          {yards.map((y) => (
            <YardSheet
              key={y.id}
              yard={y}
              data={data}
              seen={seen}
              mine={mine}
              ground={grounds[y.id] ?? null}
            />
          ))}
        </section>
      )}

      {photos.length > 0 && (
        <section className="annual-sec">
          <h2>Photographs</h2>
          <div className="annual-photos">
            {photos.map((m) => (
              <PhotoFig key={m.text} pkey={m.text} plant={data.byId.get(m.id)} />
            ))}
          </div>
        </section>
      )}

      <footer className="annual-foot">
        <p>{LICENCE}</p>
        <p>Diagrams not to scale. Your values appear in your own ink.</p>
      </footer>
    </div>
  );
}
