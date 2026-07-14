import { useEffect, useRef } from "react";
import type { Plant } from "@/data/model";
import { useSearch } from "@/state/search";
import { PlantCard } from "./PlantCard";
import { IconLeaf } from "./icons";

export function ResultGrid({ results }: { results: Plant[] }) {
  const s = useSearch();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) s.showMore();
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [results.length, s.showMore]);

  if (results.length === 0) return <NoMatch />;

  return (
    <>
      <div className="pgrid">
        {results.slice(0, s.limit).map((p) => (
          <PlantCard key={p.slug} plant={p} />
        ))}
      </div>
      {s.limit < results.length && (
        <div ref={sentinel} className="pgrid-sentinel">
          loading more…
        </div>
      )}
    </>
  );
}

/**
 * The moment she is most stuck. The old copy sent her to "the counts on each
 * filter" — which, on a phone, are behind the Filters button and not on screen.
 * The thing that *is* on screen is the trail, directly above, so name it, and
 * hand her the last step as a button.
 */
function NoMatch() {
  const s = useSearch();
  const last = s.trail[s.trail.length - 1];
  return (
    <div className="empty">
      <IconLeaf />
      <h2>No plants match</h2>
      {last ? (
        <>
          <p>
            The last thing you asked for was <b>{last.key ? `${last.key} ` : ""}{last.label}</b>.
          </p>
          <button
            className="btn btn--primary"
            onClick={() => (last.atoms.length ? s.removeAll(last.atoms) : s.setText(""))}
          >
            Take that back
          </button>
        </>
      ) : (
        <p>Nothing matches that. Try another word.</p>
      )}
    </div>
  );
}
