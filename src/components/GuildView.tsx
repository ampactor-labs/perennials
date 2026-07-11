import { useState } from "react";
import type { Plant } from "@/data/model";
import { PlantCard } from "./PlantCard";

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

function Section({ layer, plants }: { layer: string; plants: Plant[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? plants : plants.slice(0, 6);
  return (
    <section className="guild-sec">
      <header className="guild-head">
        <Spine layer={layer} />
        <h2>{layer}</h2>
        <span className="guild-n mono">{plants.length.toLocaleString()}</span>
      </header>
      {plants.length === 0 ? (
        <p className="guild-empty">Nothing in this layer fits — loosen a constraint to fill it.</p>
      ) : (
        <>
          <div className="pgrid">
            {shown.map((p) => (
              <PlantCard key={p.slug} plant={p} />
            ))}
          </div>
          {plants.length > 6 && (
            <button className="guild-more" onClick={() => setAll((a) => !a)}>
              {all ? "Show fewer" : `Show all ${plants.length.toLocaleString()}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

export function GuildView({ results }: { results: Plant[] }) {
  const byLayer = new Map<string, Plant[]>(LAYER_ORDER.map((l) => [l, []]));
  const unplaced: Plant[] = [];
  for (const p of results) {
    if (p.layer && byLayer.has(p.layer)) byLayer.get(p.layer)!.push(p);
    else unplaced.push(p);
  }
  return (
    <div className="guild">
      {LAYER_ORDER.map((layer) => (
        <Section key={layer} layer={layer} plants={byLayer.get(layer)!} />
      ))}
      {unplaced.length > 0 && (
        <details className="guild-unplaced">
          <summary>
            No layer recorded <span className="mono">{unplaced.length.toLocaleString()}</span>
          </summary>
          <div className="pgrid" style={{ marginTop: "var(--sp-3)" }}>
            {unplaced.slice(0, 24).map((p) => (
              <PlantCard key={p.slug} plant={p} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
