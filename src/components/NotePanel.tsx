import { useState } from "react";
import type { Plant } from "@/data/model";
import { noteDate, useNotes } from "@/lib/notes";
import { IconPlus } from "./icons";

/**
 * Her marginalia on the specimen sheet.
 *
 * The panel renders in one slot whether the note exists or not, so the page
 * never reflows around her decision to write. Reading is the common case and
 * it looks like an annotation — a sepia rule, her words in the display face,
 * dated — not like a form that happens to be filled in.
 */
export function NotePanel({ plant }: { plant: Plant }) {
  const { notes, set, remove } = useNotes();
  const note = notes.find((n) => n.id === plant.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const open = () => {
    setDraft(note?.text ?? "");
    setEditing(true);
  };

  if (!editing && !note) {
    return (
      <div style={{ marginTop: "var(--sp-4)" }}>
        <button className="btn btn--ghost btn--sm" onClick={open}>
          <IconPlus width={15} height={15} />
          Add a note
        </button>
      </div>
    );
  }

  if (!editing && note) {
    return (
      <section className="panel note-panel" style={{ marginTop: "var(--sp-4)" }}>
        <div className="panel-title">Your note</div>
        {note.text.split(/\n+/).map((p, i) => (
          <p key={i} className="note-text">
            {p}
          </p>
        ))}
        <div className="note-meta">
          {noteDate(note.at)} ·{" "}
          <button className="linkish" onClick={open}>
            Edit
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel note-panel" style={{ marginTop: "var(--sp-4)" }}>
      <div className="panel-title">Your note</div>
      <textarea
        className="note-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        autoFocus
        aria-label={`Your note on ${plant.name}`}
        placeholder="Third week of May, by the fence…"
      />
      <p className="note-helper">Stays on this phone. It goes to no server.</p>
      <div className="note-actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => {
            set(plant.id, draft);
            setEditing(false);
          }}
        >
          Save
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
        {note && (
          <button
            className="linkish note-delete"
            onClick={() => {
              remove(plant.id);
              setEditing(false);
            }}
          >
            Delete
          </button>
        )}
      </div>
    </section>
  );
}
