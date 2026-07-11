import { useSearch } from "@/state/search";
import { atomLabel } from "@/lib/constraints";
import { IconX } from "./icons";

// The collapse trail: the story of the narrowing, in the order she asked it.
// 8,799 → “wet” 790 → Full shade 61 → Edible 23. Each step is removable.
export function Trail() {
  const s = useSearch();
  if (s.trail.length === 0) return null;

  return (
    <div className="trail" role="list" aria-label="Active constraints">
      <span className="trail-start mono">{s.total.toLocaleString()}</span>
      {s.trail.map((step, i) => {
        const a = step.atom;
        const lbl = a ? atomLabel(a) : null;
        return (
          <span className="trail-step" role="listitem" key={i}>
            <span className="trail-arrow" aria-hidden="true">→</span>
            {a ? (
              <button className="trail-chip" onClick={() => s.remove(a)} title="Remove">
                {lbl!.key && <span className="chip-key">{lbl!.key}</span>}
                {lbl!.value}
                <span className="trail-n mono">{step.count.toLocaleString()}</span>
                <IconX width={12} height={12} />
              </button>
            ) : (
              <button className="trail-chip trail-chip--text" onClick={() => s.setText("")} title="Clear text">
                {step.label}
                <span className="trail-n mono">{step.count.toLocaleString()}</span>
                <IconX width={12} height={12} />
              </button>
            )}
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
