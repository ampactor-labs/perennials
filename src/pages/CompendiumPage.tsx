import { useEffect, useState } from "react";
import { plantCount } from "@/data";
import { useCatalog } from "@/state/catalog";
import { SearchBar } from "@/components/SearchBar";
import { QuickAsks } from "@/components/QuickAsks";
import { FacetPanel } from "@/components/FacetPanel";
import { PlantCard } from "@/components/PlantCard";
import { IconFilter, IconLeaf } from "@/components/icons";

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="empty">
      <IconLeaf />
      <h3>Nothing matches — yet</h3>
      <p>No plant in the guide fits every filter at once. Try loosening one, or widen the zone.</p>
      <button className="btn btn--ghost" style={{ marginTop: "var(--sp-3)" }} onClick={onClear}>
        Clear filters
      </button>
    </div>
  );
}

export function CompendiumPage() {
  const { results, activeCount, clearAll } = useCatalog();
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
      <section className="hero">
        <div className="eyebrow hero-eyebrow">A permaculture field guide</div>
        <h1>
          Ask the garden <em>what grows here.</em>
        </h1>
        <p className="hero-sub">
          Search {plantCount} temperate perennials by bloom, light, moisture, and the work they do —
          then plant what fits.
        </p>
        <SearchBar />
        <QuickAsks />
      </section>

      <section className="catalog">
        <div className="filter-bar">
          <span className="result-count">
            <b>{results.length}</b> of {plantCount} plants
          </span>
          {activeCount > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={clearAll}>
              Clear all
            </button>
          )}
          <span className="spacer" />
          <button className="btn btn--sm filter-toggle" onClick={() => setDrawer(true)}>
            <IconFilter width={17} height={17} />
            Filters
            {activeCount > 0 && <span className="count-badge">{activeCount}</span>}
          </button>
        </div>

        <div className="catalog-body">
          <aside className="facets-inline">
            <FacetPanel />
          </aside>

          <div>
            {results.length === 0 ? (
              <EmptyState onClear={clearAll} />
            ) : (
              <div className="plant-grid">
                {results.map((p, i) => (
                  <PlantCard key={p.id} plant={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {drawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Filters">
            <div className="drawer-grip" />
            <div className="drawer-head">
              <h2>Filters</h2>
              {activeCount > 0 && (
                <button className="btn btn--ghost btn--sm" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
            <div className="drawer-body">
              <FacetPanel />
            </div>
            <div className="drawer-foot">
              <button className="btn btn--primary" onClick={() => setDrawer(false)}>
                Show {results.length} {results.length === 1 ? "plant" : "plants"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
