import { useEffect, useState } from "react";
import { useSearch } from "@/state/search";
import { Omnibox } from "@/components/Omnibox";
import { Trail } from "@/components/Trail";
import { SpotBar } from "@/components/SpotBar";
import { FacetRail } from "@/components/FacetRail";
import { ResultGrid } from "@/components/ResultGrid";
import { GuildView } from "@/components/GuildView";
import { IconFilter } from "@/components/icons";

// First-visit seeds: the grammar taught by tapping, not reading.
const STARTERS: { label: string; key: string; value: string }[] = [
  { label: "Full sun", key: "light", value: "Full sun" },
  { label: "Part shade", key: "light", value: "Partial sun/shade" },
  { label: "Full shade", key: "light", value: "Full shade" },
  { label: "Dry", key: "water", value: "Dry" },
  { label: "Moist", key: "water", value: "Moist" },
  { label: "Wet", key: "water", value: "Wet" },
];

function Starters() {
  const s = useSearch();
  if (s.constraints.atoms.length > 0 || s.constraints.text) return null;
  return (
    <div className="starters">
      <span className="starters-label">Start with your ground</span>
      <div className="starters-row">
        {STARTERS.map((st) => (
          <button
            key={st.label}
            className="quick-ask"
            onClick={() => s.add({ kind: "facet", key: st.key, value: st.value })}
          >
            {st.label}
          </button>
        ))}
        <button className="quick-ask" onClick={() => s.add({ kind: "edible" })}>
          Edible
        </button>
      </div>
      <p className="starters-hint">
        …or type anything above — “wet shade”, “nitrogen”, “zone 6”, “mulberry”.
      </p>
    </div>
  );
}

export function BrowsePage() {
  const s = useSearch();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawer]);

  const guild = s.constraints.view === "guild";

  return (
    <div className="page wrap">
      <div className="browse-top">
        <Omnibox />
        <SpotBar />
        <Trail />
        <Starters />
      </div>

      <div className="filter-bar">
        <span className="result-count">
          <b>{s.results.length.toLocaleString()}</b> of {s.total.toLocaleString()} plants
        </span>
        <span className="spacer" style={{ marginLeft: "auto" }} />
        <div className="seg" role="tablist" aria-label="View">
          <button role="tab" aria-selected={!guild} className={guild ? "" : "on"} onClick={() => s.setView("list")}>
            List
          </button>
          <button role="tab" aria-selected={guild} className={guild ? "on" : ""} onClick={() => s.setView("guild")}>
            Guild
          </button>
        </div>
        <button className="btn btn--sm filter-toggle" onClick={() => setDrawer(true)}>
          <IconFilter width={17} height={17} />
          Filters
          {s.constraints.atoms.length > 0 && (
            <span className="count-badge">{s.constraints.atoms.length}</span>
          )}
        </button>
      </div>

      <div className="catalog-body">
        <aside className="facets-inline">
          <FacetRail />
        </aside>
        <div>{guild ? <GuildView results={s.results} /> : <ResultGrid results={s.results} />}</div>
      </div>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="drawer-grip" />
            <div className="drawer-head">
              <h2>Filters</h2>
              {s.constraints.atoms.length > 0 && (
                <button className="btn btn--ghost btn--sm" onClick={s.clearAll}>
                  Clear all
                </button>
              )}
            </div>
            <div className="drawer-body">
              <FacetRail />
            </div>
            <div className="drawer-foot">
              <button className="btn btn--primary" onClick={() => setDrawer(false)}>
                Show {s.results.length.toLocaleString()} plants
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
