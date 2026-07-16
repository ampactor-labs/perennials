import { useDataState } from "@/data/store";
import { IconAlert } from "@/components/icons";

/**
 * The colophon, not an essay.
 *
 * This page used to explain the omnibox, the trail, the spots and the guild view
 * in prose — to someone already holding all four. It teaches itself. What it
 * cannot tell her is how much of the record is actually filled in, so that is
 * what this page is now: the counts, where they came from, and the two rules
 * that govern everything else.
 */
export function AboutPage() {
  const state = useDataState();
  if (state.status !== "ready") return null;

  const { plants, meta } = state.data;
  const count = meta.count || plants.length;
  // Counted from the data she is actually holding, so these can never drift
  // away from what the guide really knows.
  const n = {
    edible: meta.edibleCount ?? plants.filter((p) => p.edible).length,
    photo: plants.filter((p) => p.thumb).length,
    visitors: plants.filter((p) => p.attracts?.length).length,
    bloom: plants.filter((p) => p.bloomColor).length,
    companions: plants.filter((p) => p.companions?.length).length,
  };
  const pct = (x: number) => (count ? `${Math.round((x / count) * 100)}%` : "");

  const rows: [string, number][] = [
    ["Edible", n.edible],
    ["Photo", n.photo],
    ["Flower visitors", n.visitors],
    ["Bloom colour", n.bloom],
    ["Companions", n.companions],
  ];

  return (
    <div className="page wrap detail">
      <header className="detail-head">
        <div>
          <h1 className="detail-title" style={{ fontSize: "var(--text-2xl)" }}>
            Field notes
          </h1>
          <div className="detail-family eyebrow">{count.toLocaleString()} plants</div>
        </div>
      </header>

      <section className="panel" style={{ marginTop: "var(--sp-5)" }}>
        <div className="panel-title">How much is filled in</div>
        {rows.map(([label, value]) => (
          <div key={label} className="attr-row">
            <span className="attr-label">{label}</span>
            <span>
              <span className="mono">{value.toLocaleString()}</span>{" "}
              <span className="attr-absent" style={{ fontStyle: "normal" }}>
                {pct(value)}
              </span>
            </span>
          </div>
        ))}
      </section>

      <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
        <div className="panel-title">Sources</div>
        <div className="attr-row">
          <span className="attr-label">
            <a href="https://permapeople.org" target="_blank" rel="noreferrer noopener">
              Permapeople
            </a>
          </span>
          <span>Plants, attributes, descriptions. CC BY-SA 4.0.</span>
        </div>
        <div className="attr-row">
          <span className="attr-label">
            <a
              href="https://www.globalbioticinteractions.org"
              target="_blank"
              rel="noreferrer noopener"
            >
              GloBI
            </a>
          </span>
          <span>Flower visitors, from published field observations. CC BY 4.0.</span>
        </div>
        <div className="attr-row">
          <span className="attr-label">
            <a href="https://plants.usda.gov" target="_blank" rel="noreferrer noopener">
              USDA PLANTS
            </a>
          </span>
          <span>Bloom colour and period, North America. Public domain.</span>
        </div>
      </section>

      <div className="callout" style={{ marginTop: "var(--sp-4)" }}>
        <span>
          A blank is not a no. It means nobody recorded it, and nothing here is invented to fill a
          gap.
        </span>
      </div>

      <div className="callout callout--warn" style={{ marginTop: "var(--sp-3)" }}>
        <IconAlert />
        <span>
          Edibility, medicinal and warning text is what contributors recorded, in their words. It is
          not advice. Check a plant against your own region and a second source before you eat it or
          plant it.
        </span>
      </div>

      {meta.generatedAt && (
        <p className="provenance">
          This copy of the data was generated on <span className="mono">{meta.generatedAt}</span>. It
          refreshes itself weekly, and downloads once so the guide works with no signal.
        </p>
      )}
    </div>
  );
}
