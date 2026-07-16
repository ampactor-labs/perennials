import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigationType } from "react-router-dom";
import { useHomeZone } from "@/lib/homeZone";
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
  const zone = useHomeZone();
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
        Or type it: “wet shade”, “nitrogen”, “zone 6”, “mulberry”.
      </p>
      {/* The order is not mysterious: name it. It reads the same store the
          dataset sorts by, so the two can never disagree. */}
      <p className="starters-hint">
        Plants recorded hardy in zone {zone} come first. Name another zone and the
        order follows.
      </p>
    </div>
  );
}

// Where she was in the list when she tapped a plant. The browse page is a
// singleton, so a module-level number is the whole mechanism.
let savedScroll = 0;

export function BrowsePage() {
  const s = useSearch();
  const [drawer, setDrawer] = useState(false);
  const navigation = useNavigationType();
  const drawerRef = useRef<HTMLDivElement>(null);
  const openedFrom = useRef<HTMLElement | null>(null);

  // Put her back where she was when she came back. `limit` already survives in
  // SearchProvider, so by the time this runs the list is as long as she left it.
  useLayoutEffect(() => {
    if (navigation === "POP" && savedScroll > 0) window.scrollTo(0, savedScroll);
    return () => {
      savedScroll = window.scrollY;
    };
  }, [navigation]);

  useEffect(() => {
    if (!drawer) return;

    // aria-modal only tells assistive tech to ignore the background. It does not
    // stop Tab, so without this the sheet says it is modal and then walks you out
    // the back of it into the cards behind the backdrop.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return setDrawer(false);
      if (e.key !== "Tab") return;
      const sheet = drawerRef.current;
      if (!sheet) return;
      const stops = [
        ...sheet.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => el.offsetParent !== null);
      if (stops.length === 0) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const on = document.activeElement;
      if (e.shiftKey && (on === first || on === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && on === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    // Move focus into the sheet, and hand it back to the button she opened it with.
    openedFrom.current = document.activeElement as HTMLElement | null;
    drawerRef.current?.focus();
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      openedFrom.current?.focus();
    };
  }, [drawer]);

  const guild = s.constraints.view === "guild";

  return (
    <div className="page wrap">
      <div className="browse-top">
        <h1 className="sr-only">Find a plant by its conditions</h1>
        <Omnibox />
        <SpotBar />
        <Trail />
        <Starters />
      </div>

      <div className="filter-bar">
        {/* "8,800 of 8,800 plants" said the same number twice and wrapped to two
            lines on a 360px phone (three at 320px), in the one row that has no
            slack left. Unfiltered, say the total; narrowed, tell the collapse. */}
        <span className="result-count" aria-live="polite" aria-atomic="true">
          {s.results.length === s.total ? (
            <>
              <b>{s.total.toLocaleString()}</b> plants
            </>
          ) : (
            <>
              <b>{s.results.length.toLocaleString()}</b> of {s.total.toLocaleString()}
            </>
          )}
        </span>
        <span className="spacer" style={{ marginLeft: "auto" }} />
        {/* Not a tablist. role="tab" promises arrow-key navigation and a tabpanel,
            neither of which exists here. These are two buttons, one of them on. */}
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={!guild} className={guild ? "" : "on"} onClick={() => s.setView("list")}>
            List
          </button>
          <button aria-pressed={guild} className={guild ? "on" : ""} onClick={() => s.setView("guild")}>
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
          <div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            ref={drawerRef}
            tabIndex={-1}
          >
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
