import type { Plant } from "@/data/model";
import { noteDate } from "@/lib/notes";
import { sameDay, useSeen } from "@/lib/seen";
import { IconBloom, IconX } from "./icons";

/**
 * "Blooming today": one tap, standing in front of the plant.
 *
 * The note above this is her prose; these are her data points. Each tap stamps
 * a day, the days list here in full, and the bloom calendar coarsens them into
 * its own mark above the printed band. A second tap on the same day un-stamps
 * it, and every listed day carries its own strike-out, because this record is
 * hers to edit; the one column of the guide that is.
 */
export function SeenMark({ plant }: { plant: Plant }) {
  const { seen, markToday, remove } = useSeen();
  const days = seen.filter((s) => s.id === plant.id).sort((a, b) => a.at - b.at);
  const markedToday = days.some((s) => sameDay(s.at, Date.now()));

  return (
    <div className="seen-row">
      <button
        className={markedToday ? "btn btn--primary btn--sm" : "btn btn--ghost btn--sm"}
        onClick={() => markToday(plant.id)}
        aria-pressed={markedToday}
      >
        <IconBloom width={16} height={16} filled={markedToday} />
        Blooming today
      </button>
      {days.length > 0 && (
        <span className="seen-dates">
          Seen in bloom:
          {days.map((s) => (
            <span key={s.at} className="seen-date">
              {noteDate(s.at)}
              <button
                className="icon-btn seen-remove"
                onClick={() => remove(plant.id, s.at)}
                aria-label={`Remove ${noteDate(s.at)} from ${plant.name}'s bloom record`}
              >
                <IconX width={13} height={13} />
              </button>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
