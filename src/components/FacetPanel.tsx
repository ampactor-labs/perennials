import { useCatalog } from "@/state/catalog";
import { FACETS } from "@/lib/filters";
import { ZONES } from "@/data/vocab";

function ZoneControl() {
  const { filters, setZone } = useCatalog();
  return (
    <div className="facet">
      <div className="facet-head">
        <span className="facet-title">Hardiness</span>
      </div>
      <div className="zone-control">
        <label className="spec-label" htmlFor="zone-select">
          Survives in zone
        </label>
        <select
          id="zone-select"
          className="zone-select"
          value={filters.zone ?? "any"}
          onChange={(e) => setZone(e.target.value === "any" ? null : Number(e.target.value))}
        >
          <option value="any">any</option>
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function SelfSeedsControl() {
  const { filters, setSelfSeeds } = useCatalog();
  const opts: [string, boolean | null][] = [
    ["Any", null],
    ["Yes", true],
    ["No", false],
  ];
  return (
    <div className="facet">
      <div className="facet-head">
        <span className="facet-title">Self-seeds</span>
      </div>
      <div className="tri" role="group" aria-label="Self-seeds">
        {opts.map(([label, val]) => (
          <button
            key={label}
            className={filters.selfSeeds === val ? "on" : ""}
            aria-pressed={filters.selfSeeds === val}
            onClick={() => setSelfSeeds(val)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FacetPanel() {
  const { isChecked, toggle, clearFacet, countsFor, filters } = useCatalog();
  return (
    <div className="facets">
      <ZoneControl />
      {FACETS.map((facet) => {
        const counts = countsFor(facet.id);
        const anySelected = filters[facet.id].length > 0;
        return (
          <div className="facet" key={facet.id}>
            <div className="facet-head">
              <span className="facet-title">{facet.label}</span>
              {anySelected && (
                <button className="facet-clear" onClick={() => clearFacet(facet.id)}>
                  clear
                </button>
              )}
            </div>
            {facet.note && <div className="facet-note">{facet.note}</div>}
            <div className="facet-options">
              {facet.options.map((opt) => {
                const checked = isChecked(facet.id, opt.value);
                const count = counts.get(opt.value) ?? 0;
                const cls = `facet-opt${checked ? " checked" : ""}${!checked && count === 0 ? " is-empty" : ""}`;
                return (
                  <button
                    key={opt.value}
                    className={cls}
                    aria-pressed={checked}
                    title={opt.hint}
                    onClick={() => toggle(facet.id, opt.value)}
                  >
                    {opt.color && <span className="fo-dot" style={{ background: opt.color }} />}
                    {opt.label}
                    <span className="fo-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <SelfSeedsControl />
    </div>
  );
}
