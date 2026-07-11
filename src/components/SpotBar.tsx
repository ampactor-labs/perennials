import { useState } from "react";
import { useSearch } from "@/state/search";
import { hasSiteConditions, spotActive, useSpots } from "@/lib/spots";
import { IconX } from "./icons";

// Her places. A spot pill applies that place's site conditions in one tap;
// the set she's building for the north bed shouldn't be re-typed every visit.
export function SpotBar() {
  const s = useSearch();
  const { spots, save, remove } = useSpots();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);

  const canSave = hasSiteConditions(s.constraints);
  if (spots.length === 0 && !canSave) return null;

  function commit() {
    if (name.trim()) {
      save(name, s.constraints);
      setName("");
      setNaming(false);
    }
  }

  return (
    <div className="spotbar" aria-label="Saved spots">
      <span className="spotbar-label">Spots</span>
      {spots.map((spot) => {
        const active = spotActive(s.constraints, spot);
        return (
          <span key={spot.id} className="spot-wrap">
            <button
              className={`spot${active ? " on" : ""}`}
              onClick={() => s.applySpot(spot)}
              title={`Apply ${spot.name}`}
            >
              ⌂ {spot.name}
            </button>
            {editing && (
              <button className="spot-del" onClick={() => remove(spot.id)} aria-label={`Delete ${spot.name}`}>
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
            + Save these conditions
          </button>
        ))}
      {spots.length > 0 && (
        <button className="spot-edit" onClick={() => setEditing((e) => !e)}>
          {editing ? "done" : "edit"}
        </button>
      )}
    </div>
  );
}
