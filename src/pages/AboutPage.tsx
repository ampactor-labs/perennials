import { Link } from "react-router-dom";
import { plantCount } from "@/data";

export function AboutPage() {
  return (
    <div className="page wrap detail">
      <section style={{ maxWidth: "60ch" }}>
        <div className="eyebrow">Field notes</div>
        <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)", marginTop: "var(--sp-2)" }}>
          What this is
        </h1>
        <p className="detail-summary">
          A field guide to temperate perennials you can actually plant — searchable the way a
          gardener thinks: by bloom color, by light and moisture, by the work a plant does in the
          system.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          Where the data comes from
        </h2>
        <p>
          The {plantCount}-plant starter set is modeled on the species-by-function and
          species-by-use tables in <em>Edible Forest Gardens, Vol. 2</em> (Dave Jacke &amp; Eric
          Toensmeier) — dynamic accumulators, best medicinal plants, indicator species — cross-checked
          against Plants For A Future and USDA PLANTS. Each plant lists its sources, and anything I
          couldn’t verify is left blank and named rather than guessed. Hardiness, in particular, is
          never invented.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          Your zone
        </h2>
        <p>
          It defaults to USDA zone 6 — the zone of the book’s Holyoke case study. Change it in the
          filters and it sticks; the guide then shows only what survives your winters.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          The layer mark
        </h2>
        <p>
          The small diagram on every card places the plant in the forest-garden “layer cake” —
          canopy down to root. It’s the same vertical thinking the{" "}
          <Link to="/garden" className="back-link" style={{ display: "inline" }}>
            garden sketch
          </Link>{" "}
          is built on, and where a proper section view and richer rendering are headed next.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          Honest edges
        </h2>
        <p>
          This is a seed, not a census — a few dozen well-described plants rather than a thin
          thousand. Medicinal notes are traditional uses, not medical advice; where a plant needs
          care (toxic parts, aggressive spread, cook-before-eating), the entry says so plainly.
        </p>
      </section>
    </div>
  );
}
