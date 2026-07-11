import { useState } from "react";
import { useSearch } from "@/state/search";
import { FACETS, type FacetMeta } from "@/lib/query";

const ZONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function FacetSection({ facet }: { facet: FacetMeta }) {
  const s = useSearch();
  const [q, setQ] = useState("");
  const counts = s.counts[facet.key] ?? new Map<string, number>();
  const selected = s.constraints.facets[facet.key] ?? [];

  let options = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (facet.searchable && q.trim()) {
    const needle = q.toLowerCase();
    options = options.filter(([v]) => v.toLowerCase().includes(needle));
  }
  // Always surface selected values (even at count 0) so they can be removed.
  const shown = new Set(selected);
  const cap = facet.searchable ? 14 : 60;
  const visible: [string, number][] = [];
  for (const v of selected) visible.push([v, counts.get(v) ?? 0]);
  for (const [v, n] of options) {
    if (shown.has(v)) continue;
    if (n === 0) continue;
    visible.push([v, n]);
    shown.add(v);
    if (visible.length >= cap) break;
  }

  return (
    <details className="facet-sec" open={!facet.searchable}>
      <summary>
        <span className="facet-sec-label">{facet.label}</span>
        {selected.length > 0 && <span className="facet-sec-badge">{selected.length}</span>}
      </summary>
      {facet.note && <p className="facet-sec-note">{facet.note}</p>}
      {facet.searchable && (
        <input
          className="facet-search"
          placeholder={`Filter ${facet.label.toLowerCase()}…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <div className="facet-opts">
        {visible.map(([value, n]) => {
          const on = selected.includes(value);
          return (
            <button
              key={value}
              className={`fopt${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => s.toggle(facet.key, value)}
            >
              <span className="fopt-val">{value}</span>
              <span className="fopt-n">{n}</span>
            </button>
          );
        })}
        {facet.searchable && !q && counts.size > visible.length && (
          <p className="facet-more">{counts.size - visible.length} more — type to filter</p>
        )}
      </div>
    </details>
  );
}

export function FacetRail() {
  const s = useSearch();
  return (
    <div className="facets">
      <div className="facet-sec facet-quick">
        <label className="fq-row">
          <input type="checkbox" checked={s.constraints.edibleOnly} onChange={s.toggleEdible} />
          Edible only
        </label>
        <label className="fq-row">
          Hardy in zone
          <select
            value={s.constraints.zone ?? "any"}
            onChange={(e) => s.setZone(e.target.value === "any" ? null : Number(e.target.value))}
          >
            <option value="any">any</option>
            {ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </label>
      </div>
      {FACETS.map((f) => (
        <FacetSection key={f.key} facet={f} />
      ))}
    </div>
  );
}
