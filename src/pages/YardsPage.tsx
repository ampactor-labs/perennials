import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useYards } from "@/lib/yards";
import { importYardFile } from "@/lib/yardFile";
import { IconGarden } from "@/components/icons";

/** The first free "Yard N". Counting the list instead handed a second yard the
 *  name of one still on the shelf: delete Yard 1 of two, and the next New yard
 *  was a second Yard 2. */
function untitled(names: string[]): string {
  const taken = new Set(names);
  let n = 1;
  while (taken.has(`Yard ${n}`)) n += 1;
  return `Yard ${n}`;
}

const when = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/**
 * Her yards, one per client and one for home.
 *
 * This lived at the bottom of the Kept page for a day, under the calendar and
 * every card, behind an early return that hid it entirely on a phone with
 * nothing kept. A sketch is not a footnote to a plant list; it is the thing the
 * plant list is for, so it gets a tab.
 *
 * A yard can also arrive as a file someone shared: "Open a yard file" imports
 * one without touching the yards already here, because a client opening a plan
 * on the phone that holds their own gardens must never overwrite them.
 */
export function YardsPage() {
  const { yards, create } = useYards();
  const navigate = useNavigate();
  const pick = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const sorted = [...yards].sort((a, b) => b.at - a.at);
  const start = () => navigate(`/yard/${create(untitled(yards.map((y) => y.name))).id}`);

  const open = async (file: File | undefined) => {
    if (!file) return;
    const got = await importYardFile(await file.text(), Date.now());
    setNote(
      got
        ? `Opened “${got.name}” · ${got.plants} ${got.plants === 1 ? "plant" : "plants"}.`
        : "That file isn't a yard.",
    );
  };

  const openButton = (
    <>
      <input
        ref={pick}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          void open(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button className="btn btn--ghost btn--sm" onClick={() => pick.current?.click()}>
        Open a yard file
      </button>
    </>
  );

  if (sorted.length === 0) {
    return (
      <div className="page wrap">
        <div className="empty">
          <IconGarden />
          <h2>No yards yet</h2>
          <p>
            Draw a bed, a fence, the house. Your kept plants place onto it, and the year
            scrubber shows what is in flower when.
          </p>
          <div className="yard-sun-row" style={{ justifyContent: "center", marginTop: "var(--sp-3)" }}>
            <button className="btn btn--primary" onClick={start}>
              New yard
            </button>
            {openButton}
          </div>
          {note && <p className="yard-coverage">{note}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="page wrap detail">
      <header className="detail-head">
        <div>
          <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)" }}>
            Yards
          </h1>
          <div className="detail-family eyebrow">
            {sorted.length} {sorted.length === 1 ? "sketch" : "sketches"}
          </div>
        </div>
        <div className="yard-sun-row" style={{ marginTop: 0 }}>
          {openButton}
          <button className="btn btn--sm" onClick={start}>
            New yard
          </button>
        </div>
      </header>

      {note && <p className="yard-coverage">{note}</p>}

      <section className="panel" style={{ marginTop: "var(--sp-5)" }}>
        <div className="yard-list">
          {sorted.map((y) => (
            <div key={y.id} className="yard-row">
              <Link to={`/yard/${y.id}`} className="yard-row-name">
                {y.name}
              </Link>
              <span className="yard-row-meta">
                {y.plants.length} {y.plants.length === 1 ? "plant" : "plants"} · {when(y.at)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
