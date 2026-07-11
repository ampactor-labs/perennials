import { useSearch } from "@/state/search";
import { IconSearch, IconX } from "./icons";

/** The command surface: free-text plus the active constraints as removable chips. */
export function ConstraintBar() {
  const s = useSearch();
  const hasChips = s.chips.length > 0 || s.constraints.zone !== null || s.constraints.edibleOnly;

  return (
    <div className="cbar">
      <div className="searchbar">
        <IconSearch className="search-icon" />
        <input
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search plants by name or Latin name…"
          value={s.constraints.text}
          onChange={(e) => s.setText(e.target.value)}
          aria-label="Search plants"
        />
        {s.constraints.text && (
          <button className="search-clear" onClick={() => s.setText("")} aria-label="Clear search">
            <IconX width={18} height={18} />
          </button>
        )}
      </div>

      {hasChips && (
        <div className="chips">
          {s.constraints.edibleOnly && (
            <button className="chip" onClick={s.toggleEdible}>
              Edible <IconX width={13} height={13} />
            </button>
          )}
          {s.constraints.zone !== null && (
            <button className="chip" onClick={() => s.setZone(null)}>
              Zone {s.constraints.zone} <IconX width={13} height={13} />
            </button>
          )}
          {s.chips.map((c) => (
            <button key={`${c.key}:${c.value}`} className="chip" onClick={() => s.toggle(c.key, c.value)}>
              <span className="chip-key">{c.label}</span>
              {c.value} <IconX width={13} height={13} />
            </button>
          ))}
          <button className="chip chip--clear" onClick={s.clearAll}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
