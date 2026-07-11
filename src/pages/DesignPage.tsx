import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "react-router-dom";
import { getPlant } from "@/data";
import { COLOR } from "@/data/vocab";
import { useCatalog } from "@/state/catalog";
import { IconPlus, IconX } from "@/components/icons";

// The plot is measured in feet; the SVG viewBox is feet, so every footprint is
// drawn at its true mature spread and spacing reads honestly.
const PLOT = { w: 32, h: 20 };

type Placed = { uid: string; id: string; x: number; y: number };

function footprint(id: string) {
  const p = getPlant(id);
  const spread = p ? Math.max(0.8, p.spread.max / 2) : 1;
  const color = p && p.bloomColors[0] ? COLOR.meta[p.bloomColors[0]].color : "#7fae5a";
  const initials = p ? p.commonName.slice(0, 2) : "?";
  return { spread, color, initials, name: p?.commonName ?? id };
}

let seq = 0;

export function DesignPage() {
  const { results } = useCatalog();
  const svgRef = useRef<SVGSVGElement>(null);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ uid: string; dx: number; dy: number; moved: boolean } | null>(null);

  function toFeet(e: ReactPointerEvent): { x: number; y: number } {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: pt.y };
  }

  function add(id: string) {
    seq += 1;
    const jitter = (seq % 5) - 2;
    setPlaced((prev) => [
      ...prev,
      { uid: `p${seq}`, id, x: PLOT.w / 2 + jitter, y: PLOT.h / 2 + jitter },
    ]);
  }

  function onDown(e: ReactPointerEvent, uid: string) {
    e.stopPropagation();
    const p = placed.find((q) => q.uid === uid)!;
    const { x, y } = toFeet(e);
    drag.current = { uid, dx: x - p.x, dy: y - p.y, moved: false };
    setSelected(uid);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onMove(e: ReactPointerEvent) {
    if (!drag.current) return;
    const { x, y } = toFeet(e);
    const d = drag.current;
    d.moved = true;
    setPlaced((prev) =>
      prev.map((q) => {
        if (q.uid !== d.uid) return q;
        const r = footprint(q.id).spread;
        return {
          ...q,
          x: Math.min(PLOT.w - r, Math.max(r, x - d.dx)),
          y: Math.min(PLOT.h - r, Math.max(r, y - d.dy)),
        };
      }),
    );
  }

  function removeSelected() {
    setPlaced((prev) => prev.filter((q) => q.uid !== selected));
    setSelected(null);
  }

  return (
    <div className="page wrap">
      <section className="design-intro">
        <div className="eyebrow">The garden — a working sketch</div>
        <h1>Lay it out in feet.</h1>
        <p>
          Filter the guide to what you want — “yellow blooms that feed bees”, a nitrogen-fixing
          windbreak — then drop those plants onto the plot. Each circle is the plant’s true mature
          spread, so the spacing you see is the spacing you’d plant.
        </p>
      </section>

      <div className="plot-toolbar">
        <span className="result-count">
          <b>{placed.length}</b> placed · palette shows <b>{results.length}</b> matches
        </span>
        <span className="spacer" style={{ marginLeft: "auto" }} />
        {selected && (
          <button className="btn btn--sm" onClick={removeSelected}>
            <IconX width={16} height={16} />
            Remove
          </button>
        )}
        {placed.length > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setPlaced([])}>
            Clear plot
          </button>
        )}
      </div>

      <div className="plot-wrap">
        <div className="compass">N ↑</div>
        <svg
          ref={svgRef}
          className="plot-canvas"
          viewBox={`0 0 ${PLOT.w} ${PLOT.h}`}
          onPointerMove={onMove}
          onPointerUp={() => (drag.current = null)}
          onPointerLeave={() => (drag.current = null)}
          onPointerDown={() => setSelected(null)}
        >
          {/* grid every 2 ft */}
          {Array.from({ length: PLOT.w / 2 - 1 }, (_, i) => (
            <line key={`v${i}`} x1={(i + 1) * 2} y1={0} x2={(i + 1) * 2} y2={PLOT.h} stroke="var(--line)" strokeWidth={0.03} />
          ))}
          {Array.from({ length: PLOT.h / 2 - 1 }, (_, i) => (
            <line key={`h${i}`} x1={0} y1={(i + 1) * 2} x2={PLOT.w} y2={(i + 1) * 2} stroke="var(--line)" strokeWidth={0.03} />
          ))}

          {/* west-perimeter windbreak zone */}
          <rect x={0} y={0} width={2.5} height={PLOT.h} fill="var(--green)" opacity={0.12} />
          <text x={0.35} y={PLOT.h / 2} fontSize={0.62} fill="var(--green)" transform={`rotate(-90 0.9 ${PLOT.h / 2})`} className="mono">
            W · windbreak
          </text>

          {/* wet corner (south-east) */}
          <path d={`M ${PLOT.w} ${PLOT.h - 7} Q ${PLOT.w - 8} ${PLOT.h} ${PLOT.w - 9} ${PLOT.h} L ${PLOT.w} ${PLOT.h} Z`} fill="#4f8fa6" opacity={0.14} />
          <text x={PLOT.w - 5.4} y={PLOT.h - 1} fontSize={0.62} fill="#3f7f96" className="mono">
            wet corner
          </text>

          {/* placed plants */}
          {placed.map((q) => {
            const f = footprint(q.id);
            const on = selected === q.uid;
            return (
              <g key={q.uid} style={{ cursor: "grab" }} onPointerDown={(e) => onDown(e, q.uid)}>
                <circle cx={q.x} cy={q.y} r={f.spread} fill={f.color} fillOpacity={0.5} stroke={on ? "var(--ink)" : "rgba(0,0,0,0.35)"} strokeWidth={on ? 0.12 : 0.05} />
                <text x={q.x} y={q.y + 0.22} fontSize={0.7} textAnchor="middle" fill="var(--ink)" className="mono" style={{ pointerEvents: "none" }}>
                  {f.initials}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="design-hint">Tap a plant below to drop it in, then drag to place. Selected plant can be removed. 1 grid square = 2 ft.</p>

      <div className="palette">
        <div className="palette-head">
          <span className="facet-title">Palette — from your current filter</span>
          <Link to="/" className="facet-clear">
            change filter
          </Link>
        </div>
        {results.length === 0 ? (
          <p className="design-hint">No matches yet — loosen the filters back in the guide.</p>
        ) : (
          <div className="palette-list">
            {results.slice(0, 30).map((p) => {
              const f = footprint(p.id);
              return (
                <button key={p.id} className="palette-item" onClick={() => add(p.id)}>
                  <span className="swatch" style={{ background: f.color, width: 14, height: 14 }} />
                  <span>
                    <span className="pi-name">{p.commonName}</span>
                    <span className="pi-meta">
                      {" "}
                      · {p.spread.min}–{p.spread.max} ft wide
                    </span>
                  </span>
                  <span className="spacer" style={{ marginLeft: "auto" }} />
                  <IconPlus width={18} height={18} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
