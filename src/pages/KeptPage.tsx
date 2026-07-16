import { Link, useNavigate } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import { useKept } from "@/lib/kept";
import { useYards } from "@/lib/yards";
import { noteDate, useNotes, type Note } from "@/lib/notes";
import { useSeen, type Seen } from "@/lib/seen";
import { shareFiles } from "@/lib/share";
import { BloomCalendar } from "@/components/BloomCalendar";
import { PlantCard } from "@/components/PlantCard";
import { IconKeep, IconX } from "@/components/icons";

/** Every plant her hand has touched, by a note or a bloom mark, resolved against
 *  the dataset she is holding. Order follows her writing, notes first. */
function writtenPlants(data: Dataset, notes: Note[], seen: Seen[]): Plant[] {
  const out: Plant[] = [];
  const taken = new Set<number>();
  for (const id of [...notes.map((n) => n.id), ...seen.map((s) => s.id)]) {
    if (taken.has(id)) continue;
    taken.add(id);
    const p = data.byId.get(id);
    if (p) out.push(p);
  }
  return out;
}

/**
 * The notebook's paper backup. localStorage is one factory reset from gone,
 * and plain text is the only format guaranteed to outlive the app. On phones
 * the share sheet is the native way out (Files, mail, a message to herself);
 * anywhere else it downloads.
 */
function exportText(data: Dataset, kept: Plant[], notes: Note[], seen: Seen[]): string {
  const noteFor = (id: number) => notes.find((n) => n.id === id);
  const seenFor = (id: number) => seen.filter((s) => s.id === id).sort((a, b) => a.at - b.at);
  const entry = (p: Plant) => {
    const n = noteFor(p.id);
    const days = seenFor(p.id);
    return [
      `${p.name} — ${p.scientificName}`,
      n ? `  ${n.text.replace(/\n/g, "\n  ")}  (${noteDate(n.at)})` : null,
      days.length ? `  Seen in bloom: ${days.map((s) => noteDate(s.at)).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  };
  const keptIds = new Set(kept.map((p) => p.id));
  const notedOnly = writtenPlants(data, notes, seen).filter((p) => !keptIds.has(p.id));

  const parts = [
    `Perennials · kept plants & notes · ${new Date().toLocaleDateString()}`,
    "",
    `KEPT (${kept.length})`,
    ...kept.map(entry),
  ];
  if (notedOnly.length) parts.push("", `NOTED, NOT KEPT (${notedOnly.length})`, ...notedOnly.map(entry));
  return parts.join("\n") + "\n";
}

async function saveACopy(text: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  await shareFiles([
    new File([text], `perennials-notebook-${stamp}.txt`, { type: "text/plain" }),
  ]);
}

function KeptEntry({
  plant,
  note,
  onRemove,
}: {
  plant: Plant;
  note?: Note;
  onRemove?: () => void;
}) {
  return (
    <div className="kept-entry">
      <div className="kept-item">
        <PlantCard plant={plant} />
        {onRemove && (
          <button
            className="icon-btn kept-remove"
            onClick={onRemove}
            aria-label={`Remove ${plant.name} from kept`}
          >
            <IconX width={18} height={18} />
          </button>
        )}
      </div>
      {note && <p className="kept-note">{note.text}</p>}
    </div>
  );
}

/** The first free "Yard N". Counting the list instead handed a second yard the
 *  name of one still on the shelf: delete Yard 1 of two, and the next New yard
 *  was a second Yard 2. */
function untitled(names: string[]): string {
  const taken = new Set(names);
  let n = 1;
  while (taken.has(`Yard ${n}`)) n += 1;
  return `Yard ${n}`;
}

/**
 * The yards shelf: where a kept list turns into a plan for a place.
 *
 * It sits at the top of Kept, above the calendar, because a yard is the thing
 * the kept list is *for*. It spent its first day at the bottom of the page,
 * under the calendar and every card, where nobody found it.
 */
function YardShelf() {
  const { yards, create } = useYards();
  const navigate = useNavigate();
  const sorted = [...yards].sort((a, b) => b.at - a.at);
  return (
    <section className="panel yard-shelf">
      <div className="panel-title">Yard sketches</div>
      <div className="yard-list">
        {sorted.map((y) => (
          <div key={y.id} className="yard-row">
            <Link to={`/yard/${y.id}`} className="yard-row-name">
              {y.name}
            </Link>
            <span className="yard-row-meta">
              {y.plants.length} {y.plants.length === 1 ? "plant" : "plants"}
            </span>
          </div>
        ))}
      </div>
      {sorted.length === 0 && (
        <p className="yard-shelf-hint">
          Draw a bed, a fence, the house. Your kept plants place onto it, and the year
          scrubber shows what is in flower when.
        </p>
      )}
      <button
        className="btn btn--sm"
        style={{ marginTop: "var(--sp-3)" }}
        onClick={() => navigate(`/yard/${create(untitled(yards.map((y) => y.name))).id}`)}
      >
        New yard
      </button>
    </section>
  );
}

export function KeptPage() {
  const state = useDataState();
  const { kept, remove } = useKept();
  const { notes } = useNotes();
  const { seen } = useSeen();
  if (state.status !== "ready") return null;
  const data = state.data;

  // Kept ids outlive the dataset: a plant can be renamed or dropped upstream on
  // a refresh. Resolve against the data she is holding and skip what's gone
  // rather than rendering a hole.
  const plants = kept.map((k) => data.byId.get(k.id)).filter((p) => p !== undefined);
  const keptIds = new Set(plants.map((p) => p.id));
  const noteFor = (id: number) => notes.find((n) => n.id === id);
  // A note is not a keep, and neither is a bloom mark. "Avoid, spreads like
  // hell" is a decision *against* a plant, and a flower witnessed over a fence
  // is not a plant in her yard. Written-on-but-not-kept gets its own shelf,
  // out of the bloom year.
  const notedOnly = writtenPlants(data, notes, seen).filter((p) => !keptIds.has(p.id));

  // The empty state carries the shelf too. It used to return early, above the
  // only door to the yard editor, so a phone with nothing kept on it could not
  // reach the editor at all — and the editor needs no plants to be useful: the
  // beds, the fence, the house and the compass are all her own hand.
  if (plants.length === 0 && notedOnly.length === 0) {
    return (
      <div className="page wrap detail">
        <div className="empty" style={{ paddingBottom: "var(--sp-4)" }}>
          <IconKeep />
          <h2>Nothing kept yet</h2>
          <p>Open a plant and press Keep. They gather here, and so does their bloom calendar.</p>
          <Link className="btn btn--primary" to="/" style={{ marginTop: "var(--sp-3)" }}>
            Find some plants
          </Link>
        </div>
        <YardShelf />
      </div>
    );
  }

  return (
    <div className="page wrap detail">
      <header className="detail-head">
        <div>
          <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)" }}>
            Kept
          </h1>
          <div className="detail-family eyebrow">
            {plants.length} {plants.length === 1 ? "plant" : "plants"}
            {notes.length > 0 && ` · ${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
            {seen.length > 0 &&
              ` · ${seen.length} bloom ${seen.length === 1 ? "mark" : "marks"}`}
          </div>
        </div>
        <button
          className="btn btn--sm"
          onClick={() => saveACopy(exportText(data, plants, notes, seen))}
        >
          Save a copy
        </button>
      </header>

      <div style={{ marginTop: "var(--sp-5)" }}>
        <YardShelf />
      </div>

      {plants.length > 0 && (
        <div style={{ marginTop: "var(--sp-4)" }}>
          <BloomCalendar plants={plants} />
        </div>
      )}

      <div className="pgrid" style={{ marginTop: "var(--sp-5)" }}>
        {plants.map((p) => (
          <KeptEntry key={p.slug} plant={p} note={noteFor(p.id)} onRemove={() => remove(p.id)} />
        ))}
      </div>

      {notedOnly.length > 0 && (
        <>
          <div className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
            Noted, not kept
          </div>
          <div className="pgrid">
            {/* No one-tap remove here: the X above un-keeps, but removing one of
                these would delete her words. That takes the editor, on the page. */}
            {notedOnly.map((p) => (
              <KeptEntry key={p.slug} plant={p} note={noteFor(p.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
