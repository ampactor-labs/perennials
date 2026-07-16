import { Link } from "react-router-dom";
import type { Plant } from "@/data/model";
import { useDataState, type Dataset } from "@/data/store";
import { useKept } from "@/lib/kept";
import { noteDate, useNotes, type Note } from "@/lib/notes";
import { BloomCalendar } from "@/components/BloomCalendar";
import { PlantCard } from "@/components/PlantCard";
import { IconKeep, IconX } from "@/components/icons";

/**
 * The notebook's paper backup. localStorage is one factory reset from gone,
 * and plain text is the only format guaranteed to outlive the app. On phones
 * the share sheet is the native way out (Files, mail, a message to herself);
 * anywhere else it downloads.
 */
function exportText(data: Dataset, kept: Plant[], notes: Note[]): string {
  const noteFor = (id: number) => notes.find((n) => n.id === id);
  const entry = (p: Plant) => {
    const n = noteFor(p.id);
    return [`${p.name} — ${p.scientificName}`, n ? `  ${n.text.replace(/\n/g, "\n  ")}  (${noteDate(n.at)})` : null]
      .filter(Boolean)
      .join("\n");
  };
  const keptIds = new Set(kept.map((p) => p.id));
  const notedOnly = notes
    .map((n) => data.byId.get(n.id))
    .filter((p): p is Plant => !!p && !keptIds.has(p.id));

  const parts = [
    `Perennials — kept plants & notes — ${new Date().toLocaleDateString()}`,
    "",
    `KEPT (${kept.length})`,
    ...kept.map(entry),
  ];
  if (notedOnly.length) parts.push("", `NOTED, NOT KEPT (${notedOnly.length})`, ...notedOnly.map(entry));
  return parts.join("\n") + "\n";
}

async function saveACopy(text: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File([text], `perennials-notebook-${stamp}.txt`, { type: "text/plain" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      /* she closed the sheet, or the share failed — fall through to download */
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
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

export function KeptPage() {
  const state = useDataState();
  const { kept, remove } = useKept();
  const { notes } = useNotes();
  if (state.status !== "ready") return null;
  const data = state.data;

  // Kept ids outlive the dataset: a plant can be renamed or dropped upstream on
  // a refresh. Resolve against the data she is holding and skip what's gone
  // rather than rendering a hole.
  const plants = kept.map((k) => data.byId.get(k.id)).filter((p) => p !== undefined);
  const keptIds = new Set(plants.map((p) => p.id));
  const noteFor = (id: number) => notes.find((n) => n.id === id);
  // A note is not a keep — "avoid, spreads like hell" is a decision *against* a
  // plant. Noted-but-not-kept gets its own shelf, out of the bloom year.
  const notedOnly = notes
    .map((n) => data.byId.get(n.id))
    .filter((p): p is Plant => !!p && !keptIds.has(p.id));

  if (plants.length === 0 && notedOnly.length === 0) {
    return (
      <div className="page wrap">
        <div className="empty">
          <IconKeep />
          <h2>Nothing kept yet</h2>
          <p>Open a plant and press Keep. They gather here, and so does their bloom calendar.</p>
          <Link className="btn btn--primary" to="/" style={{ marginTop: "var(--sp-3)" }}>
            Find some plants
          </Link>
        </div>
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
          </div>
        </div>
        <button className="btn btn--sm" onClick={() => saveACopy(exportText(data, plants, notes))}>
          Save a copy
        </button>
      </header>

      {plants.length > 0 && (
        <div style={{ marginTop: "var(--sp-5)" }}>
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
