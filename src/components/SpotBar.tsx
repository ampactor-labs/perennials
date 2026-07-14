import { useState } from "react";
import { useSearch } from "@/state/search";
import { hasSiteConditions, siteSummary, spotActive, useSpots } from "@/lib/spots";
import { IconX } from "./icons";

// Her places. A spot pill applies that place's site conditions in one tap;
// the set she's building for the north bed shouldn't be re-typed every visit.
export function SpotBar() {
  const s = useSearch();
  const { spots, save, remove } = useSpots();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState<string | null>(null);

  const canSave = hasSiteConditions(s.constraints);
  if (spots.length === 0 && !canSave) return null;

  function commit() {
    if (name.trim()) {
      save(name, s.constraints);
      setName("");
      setNaming(false);
    }
  }

  // A spot only stores the site — light, water, soil, zone — because that is what
  // makes it re-appliable next spring without dragging last spring's wishes along.
  // But the button used to say "these conditions", and a gardener reads that as
  // "this search". Name what it will actually keep.
  const siteWords = siteSummary(s.constraints);

  return (
    <div className="spotbar" role="group" aria-label="Saved spots">
      <span className="spotbar-label">Spots</span>
      {spots.map((spot) => {
        const active = spotActive(s.constraints, spot);
        return (
          <span key={spot.id} className="spot-wrap">
            <button
              className={`spot${active ? " on" : ""}`}
              onClick={() => s.applySpot(spot)}
            >
              ⌂ {spot.name}
            </button>
            {editing && (
              // Two taps. It writes straight to localStorage with no undo, and a
              // spot is the only thing in this app she made herself.
              <button
                className={`spot-del${armed === spot.id ? " armed" : ""}`}
                onClick={() => (armed === spot.id ? remove(spot.id) : setArmed(spot.id))}
                aria-label={
                  armed === spot.id ? `Delete ${spot.name}. Tap again to confirm.` : `Delete ${spot.name}`
                }
              >
                <IconX width={12} height={12} />
              </button>
            )}
          </span>
        );
      })}
      {canSave &&
        (naming ? (
          <span className="spot-namer">
            <input
              autoFocus
              value={name}
              aria-label="Name this spot"
              placeholder="Name this spot…"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setNaming(false);
              }}
            />
            <button className="spot" onClick={commit}>
              Save
            </button>
          </span>
        ) : (
          <button className="spot spot--new" onClick={() => setNaming(true)}>
            + Save this site{siteWords && ` (${siteWords})`}
          </button>
        ))}
      {spots.length > 0 && (
        <button
          className="spot-edit"
          onClick={() =>
            setEditing((e) => {
              setArmed(null);
              return !e;
            })
          }
        >
          {editing ? "done" : "edit"}
        </button>
      )}
    </div>
  );
}
