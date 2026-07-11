import { useState } from "react";
import { useSearch } from "@/state/search";
import { FACETS, type FacetMeta } from "@/lib/query";
import { facetsOf } from "@/lib/constraints";

const ZONES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function FacetSection({ facet }: { facet: FacetMeta }) {
  const s = useSearch();
  const [q, setQ] = useState("");
  const counts = s.counts[facet.key] ?? new Map<string, number>();
  const selected = facetsOf(s.constraints)[facet.key] ?? [];

  let options = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (facet.searchable && q.trim()) {
    const needle = q.toLowerCase();
    options = options.filter(([v]) => v.toLowerCase().includes(needle));
  }
  // Selected values always render (even at 0) so they can be unpicked.
  const shown = new Set(selected);
  const cap = facet.searchable ? 12 : 60;
  const visible: [string, number][] = selected.map((v) => [v, counts.get(v) ?? 0]);
  for (const [v, n] of options) {
    if (shown.has(v) || n === 0) continue;
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
              onClick={() => s.toggle({ kind: "facet", key: facet.key, value })}
            >
              <span className="fopt-val">{value}</span>
              <span className="fopt-n">{n.toLocaleString()}</span>
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
  const site = FACETS.filter((f) => f.group === "site");
  const intent = FACETS.filter((f) => f.group === "intent");
  return (
    <div className="facets">
      <div className="facet-quick">
        <label className="fq-row">
          <input
            type="checkbox"
            checked={s.has({ kind: "edible" })}
            onChange={() => s.toggle({ kind: "edible" })}
          />
          Edible only
        </label>
        <label className="fq-row">
          Hardy in zone
          <select
            value={s.zone ?? "any"}
            onChange={(e) => {
              if (e.target.value === "any") {
                if (s.zone !== null) s.remove({ kind: "zone", zone: s.zone });
              } else s.add({ kind: "zone", zone: Number(e.target.value) });
            }}
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
      <div className="facet-group-label">The site — what you have</div>
      {site.map((f) => (
        <FacetSection key={f.key} facet={f} />
      ))}
      <div className="facet-group-label">The ask — what you want</div>
      {intent.map((f) => (
        <FacetSection key={f.key} facet={f} />
      ))}
    </div>
  );
}
