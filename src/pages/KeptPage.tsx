import { Link } from "react-router-dom";
import { useDataState } from "@/data/store";
import { useKept } from "@/lib/kept";
import { BloomCalendar } from "@/components/BloomCalendar";
import { PlantCard } from "@/components/PlantCard";
import { IconKeep, IconX } from "@/components/icons";

export function KeptPage() {
  const state = useDataState();
  const { kept, remove } = useKept();
  if (state.status !== "ready") return null;

  // Kept ids outlive the dataset: a plant can be renamed or dropped upstream on
  // a refresh. Resolve against the data she is holding and skip what's gone
  // rather than rendering a hole.
  const plants = kept.map((k) => state.data.byId.get(k.id)).filter((p) => p !== undefined);

  if (plants.length === 0) {
    return (
      <div className="page wrap">
        <div className="empty">
          <IconKeep />
          <h2>Nothing kept yet</h2>
          <p>Open a plant and press Keep. They gather here, and so does their bloom calendar.</p>
          <Link className="btn btn--primary" to="/" style={{ marginTop: "var(--sp-3)" }}>
            Find some plants
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page wrap detail">
      <header className="detail-head">
        <div>
          <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)" }}>
            Kept
          </h1>
          <div className="detail-family eyebrow">
            {plants.length} {plants.length === 1 ? "plant" : "plants"}
          </div>
        </div>
      </header>

      <div style={{ marginTop: "var(--sp-5)" }}>
        <BloomCalendar plants={plants} />
      </div>

      <div className="pgrid" style={{ marginTop: "var(--sp-5)" }}>
        {plants.map((p) => (
          <div key={p.slug} className="kept-item">
            <PlantCard plant={p} />
            <button
              className="icon-btn kept-remove"
              onClick={() => remove(p.id)}
              aria-label={`Remove ${p.name} from kept`}
            >
              <IconX width={18} height={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
