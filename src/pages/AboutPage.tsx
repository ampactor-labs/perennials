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
          Type anything into the box — “wet”, “shade”, “nitrogen”, “zone 6”, or a plant name — and
          pick from what it offers. Each pick becomes a link in the trail, and the trail shows the
          count falling as each constraint lands. Save a place's conditions as a <em>spot</em>{" "}
          (“north bed”, “wet corner”) and re-apply it in one tap. Flip to the <em>Guild</em> view to
          see any result set stacked by forest-garden layer, canopy down to roots. Every search
          lives in the address bar, so a list you build is a link you can send.
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
          what Permapeople doesn't record. Flower visitors — who actually turns up at the blooms —
          come from{" "}
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
          It's real data, so it's also uneven: some entries are richly described, others sparse. The
          two newer sources cover part of the catalog and not all of it — there are visitor records
          for {withVisitors.toLocaleString()} plants and a bloom colour for{" "}
          {withBloom.toLocaleString()}, weighted toward North-American species. A blank means nobody
          recorded it, which is not the same as there being nothing there. Nothing here is invented to
          fill a gap — where the sources are quiet, so is this.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          How it stays fast and current
        </h2>
        <p>
          The guide runs off a small data service. It re-pulls Permapeople every week, and every hour
          it re-checks a few plants against GloBI and USDA, so the whole catalog gets re-verified
          about every ten weeks. Your phone downloads the result once — roughly a megabyte,
          compressed — and then filters entirely on the device. Nothing is fetched while you search,
          which is why it's instant across thousands of plants, and why it keeps working in a garden
          with no signal.
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
          Edibility and medicinal notes are what contributors recorded, not advice. Anything flagged
          toxic, invasive, or weedy is surfaced plainly — always check a plant against your own region
          and a second source before you eat it or put it in the ground.
        </p>
      </section>
    </div>
  );
}
