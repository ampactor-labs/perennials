import { useEffect, useRef, useState } from "react";
import { BLOOM_SEASONS, BLOOM_SLOTS, SLOT_TICK, type BloomSlot } from "@/lib/bloom";

/**
 * The bloom calendar's axis, turned into a control.
 *
 * Nine slots because USDA records nine places in a year, never months. Resting
 * on "Year" the sketch shows each plant's recorded bloom colour, timeless;
 * pick a slot and the beds light or go quiet for that part of the year. Play
 * steps the whole year so a client can watch the season move without anyone
 * touching the phone.
 */
export function YearScrubber({
  slot,
  onSlot,
}: {
  slot: BloomSlot | null;
  onSlot: (s: BloomSlot | null) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const step = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      onSlot(BLOOM_SLOTS[step.current % BLOOM_SLOTS.length]);
      step.current += 1;
    }, 800);
    return () => clearInterval(t);
  }, [playing, onSlot]);

  const pick = (s: BloomSlot | null) => {
    setPlaying(false);
    onSlot(s);
  };

  return (
    <div className="scrub">
      <button
        className={slot === null ? "scrub-year on" : "scrub-year"}
        onClick={() => pick(null)}
        aria-pressed={slot === null}
      >
        Year
      </button>
      <div className="scrub-mid">
        <div className="scrub-slots" role="group" aria-label="Part of the year">
          {BLOOM_SLOTS.map((s) => (
            <button
              key={s}
              className={slot === s ? "scrub-slot on" : "scrub-slot"}
              onClick={() => pick(s)}
              aria-pressed={slot === s}
              title={s}
            >
              {SLOT_TICK[s]}
            </button>
          ))}
        </div>
        <div className="scrub-seasons" aria-hidden="true">
          {BLOOM_SEASONS.map((s) => (
            <span key={s.name} style={{ flex: s.span }}>
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <button
        className={playing ? "scrub-play on" : "scrub-play"}
        onClick={() => setPlaying((p) => !p)}
        aria-pressed={playing}
        aria-label={playing ? "Stop the year" : "Play the year"}
      >
        {playing ? "◼" : "▶"}
      </button>
    </div>
  );
}
