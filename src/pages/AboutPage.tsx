import { useDataState } from "@/data/store";

export function AboutPage() {
  const state = useDataState();
  const meta = state.status === "ready" ? state.data.meta : null;
  const count = meta?.count ?? null;

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
          Every plant, description, and attribute comes from{" "}
          <a href="https://permapeople.org" target="_blank" rel="noreferrer noopener">
            Permapeople
          </a>
          , an open, community-built plant database, licensed CC BY-SA 4.0. It's real data, so it's
          also uneven: some entries are richly described, others sparse. Nothing here is invented to
          fill a gap — where Permapeople is quiet, so is this.
        </p>

        <h2 className="panel-title" style={{ marginTop: "var(--sp-6)" }}>
          How it stays fast and current
        </h2>
        <p>
          The whole dataset is pulled and normalized ahead of time into one static file the app loads
          once and caches for offline use. Nothing is fetched from an API while you search — filtering
          runs entirely in your browser, which is why it's instant even across thousands of plants. A
          scheduled job re-pulls Permapeople on a regular cadence and redeploys, so the guide stays
          current without ever depending on a live service.
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
