import { Link } from "react-router-dom";
import { plantCount } from "@/data";
import { enrichmentSources } from "@/data/enrichment";

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
          Two layers, and the app is honest about which is which. The permaculture traits — function
          (nitrogen fixer, dynamic accumulator and its minerals, groundcover, insectary), edible and
          medicinal use, forest-garden layer, hardiness — are curated by hand across these{" "}
          {plantCount} plants, modeled on the species tables in{" "}
          <em>Edible Forest Gardens, Vol. 2</em> and cross-referenced with Plants For A Future. Where
          a value isn’t certain it’s left blank and named, not guessed.
        </p>
        <p>
          The botanical facts are fetched from open databases by a build-time pipeline, and every one
          records its source: accepted names and families from GBIF, native-versus-introduced status
          and invasive listings from USDA PLANTS, descriptions and photographs from Wikipedia and
          Wikimedia Commons. Each plant’s page shows exactly which source supplied which field, and
          flags anything USDA lists as invasive.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          Sources
        </h2>
        <ul className="source-credits">
          {enrichmentSources.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.name}
              </a>{" "}
              — {s.use}. <span className="src-license">{s.license}</span>
            </li>
          ))}
        </ul>

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
