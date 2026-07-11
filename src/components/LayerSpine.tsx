import type { Layer } from "@/data/vocab";
import { LAYER } from "@/data/vocab";

// Vertical position (fraction of height, 0 = top) of each above/below-ground
// stratum. Vine is the vertical layer — it climbs, so it highlights the stem.
const FRAC: Record<Layer, number> = {
  canopy: 0.12,
  understory: 0.27,
  shrub: 0.41,
  herb: 0.53,
  groundcover: 0.64,
  vine: 0.4,
  root: 0.86,
};

const ORDER: Layer[] = ["canopy", "understory", "shrub", "herb", "groundcover", "root"];

export function LayerSpine({ layer, size = "sm" }: { layer: Layer; size?: "sm" | "lg" }) {
  const W = size === "lg" ? 90 : 24;
  const H = size === "lg" ? 180 : 44;
  const cx = W / 2;
  const groundY = H * 0.72;
  const topY = H * 0.08;
  const tick = size === "lg" ? 20 : 5;
  const activeTick = tick + (size === "lg" ? 8 : 3);
  const dot = size === "lg" ? 6 : 3.4;
  const isVine = layer === "vine";

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Forest-garden layer: ${LAYER.meta[layer].label}`}
      style={{ overflow: "visible" }}
    >
      {/* soil below ground line */}
      <rect
        x={0}
        y={groundY}
        width={W}
        height={H - groundY}
        fill="var(--sepia)"
        opacity={0.1}
      />
      <line x1={2} y1={groundY} x2={W - 2} y2={groundY} stroke="var(--line-strong)" strokeWidth={1} />
      {/* stem */}
      <line
        x1={cx}
        y1={topY}
        x2={cx}
        y2={groundY}
        stroke={isVine ? "var(--green)" : "var(--line-strong)"}
        strokeWidth={isVine ? 2 : 1.3}
        strokeDasharray={isVine ? "3 3" : undefined}
      />
      {/* strata ticks */}
      {ORDER.map((l) => {
        const y = H * FRAC[l];
        const active = l === layer;
        const half = active ? activeTick : tick;
        return (
          <line
            key={l}
            x1={cx - half}
            y1={y}
            x2={cx + half}
            y2={y}
            stroke={active ? "var(--green)" : "var(--line-strong)"}
            strokeWidth={active ? 2 : 1}
            opacity={active ? 1 : 0.5}
          />
        );
      })}
      {/* active marker */}
      <circle
        cx={cx}
        cy={H * FRAC[layer]}
        r={dot}
        fill={layer === "root" || layer === "groundcover" ? "var(--sepia)" : "var(--green)"}
      />
      {isVine && (
        <circle cx={cx} cy={H * FRAC.vine} r={dot} fill="var(--green)" />
      )}
    </svg>
  );
}
