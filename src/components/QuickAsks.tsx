import { useCatalog } from "@/state/catalog";
import type { Filters } from "@/lib/filters";

type Preset = { label: string; patch: Partial<Filters>; dot?: string };

// Plain-language questions that set several facets at once — the way she'd ask.
const PRESETS: Preset[] = [
  { label: "Blooms yellow", patch: { bloomColors: ["yellow"] }, dot: "#f2c14e" },
  { label: "Blooms blue", patch: { bloomColors: ["blue"] }, dot: "#4a72b0" },
  { label: "Loves wet shade", patch: { moisture: ["wet"], sun: ["part-shade", "full-shade"] } },
  { label: "Dry & sunny", patch: { moisture: ["dry"], sun: ["full-sun"] } },
  { label: "Feeds bees", patch: { wildlife: ["bees"] }, dot: "#f2c14e" },
  { label: "For butterflies", patch: { wildlife: ["butterflies"] }, dot: "#e0863c" },
  { label: "Fixes nitrogen", patch: { functions: ["nitrogenFixer"] }, dot: "#8bbf6a" },
  { label: "Edible in shade", patch: { uses: ["edible"], sun: ["part-shade", "full-shade"] } },
];

function isActive(filters: Filters, patch: Partial<Filters>): boolean {
  return Object.entries(patch).every(([k, v]) => {
    if (Array.isArray(v)) {
      const cur = filters[k as keyof Filters] as string[];
      return v.every((x) => cur.includes(x));
    }
    return filters[k as keyof Filters] === v;
  });
}

export function QuickAsks() {
  const { filters, applyPreset } = useCatalog();
  return (
    <div className="quick-asks">
      {PRESETS.map((p) => {
        const active = isActive(filters, p.patch);
        return (
          <button
            key={p.label}
            className="quick-ask"
            aria-pressed={active}
            style={active ? { borderColor: "var(--green)", background: "color-mix(in srgb, var(--green) 14%, transparent)", color: "var(--ink)" } : undefined}
            onClick={() => applyPreset(p.patch)}
          >
            {p.dot && <span className="qa-dot" style={{ background: p.dot }} />}
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
