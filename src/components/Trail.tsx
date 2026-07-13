import { useSearch } from "@/state/search";
import { IconX } from "./icons";

// The collapse trail: the story of the narrowing, in the order she asked it.
// 8,799 → “wet” 790 → Full shade 61 → Edible 23. Each step is removable.
//
// One step per facet, not per atom. Two values in the same facet are OR'd, so a
// per-atom trail could report a "collapse" that went up.
export function Trail() {
  const s = useSearch();
  if (s.trail.length === 0) return null;

  return (
    <div className="trail" role="list" aria-label="Active constraints">
      <span className="trail-start mono">{s.total.toLocaleString()}</span>
      {s.trail.map((step, i) => {
        const text = step.atoms.length === 0;
        return (
          <span className="trail-step" role="listitem" key={i}>
            <span className="trail-arrow" aria-hidden="true">→</span>
            <button
              className={`trail-chip${text ? " trail-chip--text" : ""}`}
              onClick={() => (text ? s.setText("") : s.removeAll(step.atoms))}
              aria-label={`Remove ${step.key ? `${step.key} ` : ""}${step.label}`}
            >
              {step.key && <span className="chip-key">{step.key}</span>}
              {step.label}
              <span className="trail-n mono">{step.count.toLocaleString()}</span>
              <IconX width={15} height={15} />
            </button>
          </span>
        );
      })}
      {s.trail.length > 1 && (
        <button className="trail-clear" onClick={s.clearAll}>
          clear
        </button>
      )}
    </div>
  );
}
