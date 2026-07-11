import { useEffect, useState } from "react";
import { useSearch } from "@/state/search";
import { ConstraintBar } from "@/components/ConstraintBar";
import { FacetRail } from "@/components/FacetRail";
import { ResultGrid } from "@/components/ResultGrid";
import { IconFilter } from "@/components/icons";

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

  return (
    <div className="page wrap">
      <ConstraintBar />

      <div className="filter-bar">
        <span className="result-count">
          <b>{s.results.length.toLocaleString()}</b> of {s.total.toLocaleString()} plants
        </span>
        <span className="spacer" style={{ marginLeft: "auto" }} />
        <button className="btn btn--sm filter-toggle" onClick={() => setDrawer(true)}>
          <IconFilter width={17} height={17} />
          Filters
          {s.active > 0 && <span className="count-badge">{s.active}</span>}
        </button>
      </div>

      <div className="catalog-body">
        <aside className="facets-inline">
          <FacetRail />
        </aside>
        <div>
          <ResultGrid results={s.results} />
        </div>
      </div>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="drawer-grip" />
            <div className="drawer-head">
              <h2>Filters</h2>
              {s.active > 0 && (
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
