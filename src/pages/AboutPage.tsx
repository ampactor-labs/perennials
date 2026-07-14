import { useDataState } from "@/data/store";

export function AboutPage() {
  const state = useDataState();
  const meta = state.status === "ready" ? state.data.meta : null;
  const count = meta?.count ?? null;

  // Counted from the data she is actually holding, so the coverage numbers below
  // can never drift away from what the guide really knows.
  const plants = state.status === "ready" ? state.data.plants : [];
  const withVisitors = plants.filter((p) => p.attracts?.length).length;
  const withBloom = plants.filter((p) => p.bloomColor).length;

  return (
    <div className="page wrap detail">
      <section style={{ maxWidth: "60ch" }}>
        <div className="eyebrow">Field notes</div>
        <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)", marginTop: "var(--sp-2)" }}>
          What this is
        </h1>
        <p className="detail-summary">
          A field guide to {count ? count.toLocaleString() : "thousands of"} useful plants, searched
          the way a gardener stands in a yard: state your conditions, then your wishes, and watch
          the field narrow to what fits.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          How to ask
        </h2>
        <p>
          Type what you have. “Wet shade”, “nitrogen”, “zone 6”, a plant name; it will offer you
          constraints and you pick from them. Each pick becomes a link in the trail, and the trail
          shows the count falling as it lands. Save a place's conditions as a <em>spot</em> (“north
          bed”, “wet corner”) and re-apply it in one tap. The <em>Guild</em> view stacks the same
          results by forest-garden layer, canopy down to roots. Every search lives in the address
          bar, so a list you build is a link you can send.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          The data
        </h2>
        <p>
          The plants, their descriptions, and most of their attributes come from{" "}
          <a href="https://permapeople.org" target="_blank" rel="noreferrer noopener">
            Permapeople
          </a>
          , an open, community-built plant database, licensed CC BY-SA 4.0. Two other sources fill in
          what Permapeople doesn't record. Flower visitors, meaning who has actually been seen at
          the blooms, come from{" "}
          <a
            href="https://www.globalbioticinteractions.org"
            target="_blank"
            rel="noreferrer noopener"
          >
            GloBI
          </a>
          , the Global Biotic Interactions database (CC BY 4.0), which aggregates published field
          observations. Bloom colour and bloom period come from{" "}
          <a href="https://plants.usda.gov" target="_blank" rel="noreferrer noopener">
            USDA PLANTS
          </a>{" "}
          (public domain).
        </p>
        <p>
          It's real data, so it's uneven. Some entries are richly described and others are a name and
          a family. The two newer sources cover part of the catalogue and not all of it: visitor
          records for {withVisitors.toLocaleString()} plants, a bloom colour for{" "}
          {withBloom.toLocaleString()}. Those numbers look thin because they are numbers about the
          whole world. USDA is a North-American database, so once you have said zone 6 and North
          America it knows a good deal more; the facets tell you the coverage for the plants you are
          actually looking at, not for 8,800 taxa you will never plant.
        </p>
        <p>
          A blank is not a no. It means nobody recorded it. Nothing here is invented to fill a gap,
          so where the sources are quiet, so is this.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          How it stays fast and current
        </h2>
        <p>
          The guide runs off a small data service. It re-pulls Permapeople every week, and every hour
          it re-checks a few plants against GloBI and USDA, so the whole catalogue comes round again
          about every ten weeks. Your phone downloads the result once, roughly a megabyte
          compressed, and then filters on the device. Nothing is fetched while you search. That is
          why it stays instant across thousands of plants, and why it keeps working in a garden with
          no signal.
          {meta?.generatedAt && (
            <>
              {" "}
              This copy of the data was generated on <span className="mono">{meta.generatedAt}</span>.
            </>
          )}
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          Cautions
        </h2>
        <p>
          Edibility and medicinal notes are what contributors recorded. They are not advice. Warnings
          are shown in the source's own words, because “Toxic” and “Toxic fruits” are not the same
          sentence to someone standing over an asparagus bed. Check a plant against your own region
          and a second source before you eat it or put it in the ground.
        </p>
      </section>
    </div>
  );
}
