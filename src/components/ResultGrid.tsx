import { useEffect, useRef, useState } from "react";
import type { Plant } from "@/data/model";
import { PlantCard } from "./PlantCard";
import { IconLeaf } from "./icons";

const PAGE = 48;

export function ResultGrid({ results }: { results: Plant[] }) {
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => setLimit(PAGE), [results]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((l) => Math.min(l + PAGE, results.length));
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [results.length]);

  if (results.length === 0) {
    return (
      <div className="empty">
        <IconLeaf />
        <h3>No plants match</h3>
        <p>Loosen a constraint — the counts on each filter show what's still reachable.</p>
      </div>
    );
  }

  return (
    <>
      <div className="pgrid">
        {results.slice(0, limit).map((p) => (
          <PlantCard key={p.slug} plant={p} />
        ))}
      </div>
      {limit < results.length && (
        <div ref={sentinel} className="pgrid-sentinel">
          loading more…
        </div>
      )}
    </>
  );
}
