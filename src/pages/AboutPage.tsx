import { useDataState } from "@/data/store";

export function AboutPage() {
  const state = useDataState();
  const count = state.status === "ready" ? state.data.meta.count : null;

  return (
    <div className="page wrap detail">
      <section style={{ maxWidth: "60ch" }}>
        <div className="eyebrow">Field notes</div>
        <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)", marginTop: "var(--sp-2)" }}>
          What this is
        </h1>
        <p className="detail-summary">
          A searchable field guide to {count ? count.toLocaleString() : "thousands of"} temperate
          and useful plants, built to be explored by constraint: pick the light, moisture, layer,
          function, or hardiness you have, and watch the set narrow to what fits.
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
