import { useState } from "react";
import type { Plant } from "@/data/model";
import { PAGE, useSearch } from "@/state/search";
import { PlantCard } from "./PlantCard";
import { ResultGrid } from "./ResultGrid";

// Results grouped as the forest garden stacks them, canopy down to root — so
// "fill my guild" reads as: pick your site, then shop each layer.
const LAYER_ORDER = [
  "Tall trees",
  "Trees",
  "Shrubs",
  "Vines",
  "Herbs",
  "Ground cover",
  "Roots",
] as const;

// Vertical position of each stratum on the spine glyph (0 = sky, ground at 0.72).
const SPINE_Y: Record<string, number> = {
  "Tall trees": 0.1,
  Trees: 0.24,
  Shrubs: 0.42,
  Vines: 0.32,
  Herbs: 0.56,
  "Ground cover": 0.68,
  Roots: 0.88,
};

function Spine({ layer }: { layer: string }) {
  const H = 40;
  const W = 20;
  const ground = H * 0.72;
  const y = H * (SPINE_Y[layer] ?? 0.5);
  const vine = layer === "Vines";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="guild-spine">
      <rect x={0} y={ground} width={W} height={H - ground} fill="var(--sepia)" opacity={0.12} />
      <line x1={2} y1={ground} x2={W - 2} y2={ground} stroke="var(--line-strong)" strokeWidth={1} />
      <line
        x1={W / 2}
        y1={H * 0.06}
        x2={W / 2}
        y2={ground}
        stroke="var(--line-strong)"
        strokeWidth={vine ? 1.6 : 1}
        strokeDasharray={vine ? "2.5 2.5" : undefined}
      />
      <circle cx={W / 2} cy={y} r={3.4} fill={y > ground ? "var(--sepia)" : "var(--green)"} />
    </svg>
  );
}

const SEED = 6;

/** Reveals SEED, then a page at a time. "Show all" used to mean exactly that —
 *  one tap mounted 1,986 cards in a single commit and froze the tab. */
function Deck({ plants }: { plants: Plant[] }) {
  const [shown, setShown] = useState(SEED);
  const visible = plants.slice(0, shown);
  const left = plants.length - visible.length;
  return (
    <>
      <div className="pgrid">
        {visible.map((p) => (
          <PlantCard key={p.slug} plant={p} />
        ))}
      </div>
      {left > 0 && (
        <button className="guild-more" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(left, PAGE).toLocaleString()} more of {left.toLocaleString()}
        </button>
      )}
      {shown > SEED && left === 0 && (
        <button className="guild-more" onClick={() => setShown(SEED)}>
          Show fewer
        </button>
      )}
    </>
  );
}

function Section({ layer, plants, inCatalog }: { layer: string; plants: Plant[]; inCatalog: number }) {
  return (
    <section className="guild-sec">
      <header className="guild-head">
        <Spine layer={layer} />
        <h2>{layer}</h2>
        <span className="guild-n mono">{plants.length.toLocaleString()}</span>
      </header>
      {layer === "Ground cover" && plants.length > 0 && (
        <p className="guild-empty" style={{ marginBottom: "var(--sp-3)" }}>
          Includes plants recorded as <em>functioning</em> as ground cover, where nobody recorded a
          layer for them.
        </p>
      )}
      {plants.length === 0 ? (
        // Two very different silences, and they used to sound the same. Ground
        // cover is recorded for 8 plants in the whole catalogue and Roots for 28,
        // so telling her to loosen a constraint sent her hunting for something no
        // constraint was hiding.
        inCatalog <= SEED_FLOOR ? (
          <p className="guild-empty">
            Only {inCatalog.toLocaleString()} plant{inCatalog === 1 ? "" : "s"} in the whole guide
            have a recorded {layer.toLowerCase()} layer. That gap is in the data, not in your search.
          </p>
        ) : (
          <p className="guild-empty">
            Nothing in this layer fits. Take a step off the trail to fill it.
          </p>
        )
      ) : (
        <Deck plants={plants} />
      )}
    </section>
  );
}

/** Below this, an empty layer is the catalogue's silence rather than her filters'. */
const SEED_FLOOR = 50;

export function GuildView({ results }: { results: Plant[] }) {
  const s = useSearch();
  const byLayer = new Map<string, Plant[]>(LAYER_ORDER.map((l) => [l, []]));
  const unplaced: Plant[] = [];
  for (const p of results) {
    if (p.layer && byLayer.has(p.layer)) {
      byLayer.get(p.layer)!.push(p);
    } else if (!p.layer && p.functions.includes("Ground cover")) {
      // The guide records a "Ground cover" LAYER for 8 plants and a "Ground cover"
      // FUNCTION for 496. Keying the stratum off the layer alone meant the section
      // she most wants to fill was reading the emptier of the two columns, while
      // the plants she was after sat one facet over.
      byLayer.get("Ground cover")!.push(p);
    } else {
      unplaced.push(p);
    }
  }

  // How many plants carry each layer in the entire catalogue, regardless of what
  // she has asked for — the number that tells an empty section which kind it is.
  const inCatalog = new Map<string, number>(
    (s.data?.facets.layer ?? []).map((v) => [v.value, v.count]),
  );

  if (results.length === 0) return <ResultGrid results={results} />;

  return (
    <div className="guild">
      {LAYER_ORDER.map((layer) => (
        <Section
          key={layer}
          layer={layer}
          plants={byLayer.get(layer)!}
          inCatalog={inCatalog.get(layer) ?? 0}
        />
      ))}
      {unplaced.length > 0 && (
        <details className="guild-unplaced">
          <summary>
            No layer recorded <span className="mono">{unplaced.length.toLocaleString()}</span>
          </summary>
          <div style={{ marginTop: "var(--sp-3)" }}>
            <p className="guild-empty" style={{ marginBottom: "var(--sp-3)" }}>
              Nobody has recorded which layer these grow in. They are still in your results; the
              List view shows every one of them.
            </p>
            <Deck plants={unplaced} />
          </div>
        </details>
      )}
    </div>
  );
}
