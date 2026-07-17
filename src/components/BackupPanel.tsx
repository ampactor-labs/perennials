import { useRef, useState } from "react";
import { useDataState } from "@/data/store";
import {
  backupText,
  buildBackup,
  countOf,
  parseBackup,
  restoreBackup,
  type Backup,
  type Restored,
} from "@/lib/backup";
import { shareFiles } from "@/lib/share";

const stamp = () => new Date().toISOString().slice(0, 10);

const line = (r: Restored) =>
  [
    `${r.kept} kept`,
    `${r.notes} ${r.notes === 1 ? "note" : "notes"}`,
    `${r.seen} bloom ${r.seen === 1 ? "mark" : "marks"}`,
    `${r.mine} of your own ${r.mine === 1 ? "value" : "values"}`,
    `${r.photos} ${r.photos === 1 ? "photo" : "photos"}`,
    `${r.spots} ${r.spots === 1 ? "spot" : "spots"}`,
    `${r.yards} ${r.yards === 1 ? "yard" : "yards"}`,
  ].join(" · ");

/**
 * Save a copy, and put one back.
 *
 * It lives here rather than on the Kept page because it stopped being about the
 * kept list. It carries her yards, her spots, her zone, every value she filled
 * in and every photo she took, and a control that saves all of that does not
 * belong in the corner of one of the seven things it saves.
 *
 * Two files go out together: the .json restores, the .txt outlives. Only the
 * .json comes back in.
 */
export function BackupPanel() {
  const state = useDataState();
  const [busy, setBusy] = useState<null | "out" | "in">(null);
  const [saved, setSaved] = useState<Restored | null>(null);
  const [offer, setOffer] = useState<Backup | null>(null);
  const [done, setDone] = useState<Restored | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const save = async () => {
    setBusy("out");
    setFailed(null);
    try {
      const b = await buildBackup();
      const data = state.status === "ready" ? state.data : null;
      await shareFiles([
        new File([JSON.stringify(b)], `perennials-backup-${stamp()}.json`, {
          type: "application/json",
        }),
        new File([backupText(data, b)], `perennials-notebook-${stamp()}.txt`, {
          type: "text/plain",
        }),
      ]);
      setSaved(countOf(b));
    } catch {
      setFailed("That didn't save. Nothing on this phone changed.");
    } finally {
      setBusy(null);
    }
  };

  // Read and check the file, then stop and show her what is in it. A restore is
  // the one action here that can overwrite her own work, so it never happens on
  // the same tap that opened a file.
  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy("in");
    setFailed(null);
    setDone(null);
    try {
      const b = parseBackup(await file.text());
      if (!b) return setFailed("That isn't a Perennials backup. Nothing changed.");
      setOffer(b);
    } catch {
      setFailed("That file couldn't be read. Nothing changed.");
    } finally {
      setBusy(null);
      if (pick.current) pick.current.value = "";
    }
  };

  // No reload. restoreBackup writes through the stores, so every subscriber has
  // already re-rendered by the time this returns: her kept list, her notes, the
  // bloom calendar, the yards, the theme and the zone the whole catalogue sorts
  // by are live behind this panel before she navigates to them.
  const run = async (mode: "merge" | "replace") => {
    if (!offer) return;
    setBusy("in");
    try {
      const r = await restoreBackup(offer, mode);
      setOffer(null);
      setDone(r);
      if (r.refused) {
        setFailed(
          "This phone's storage is full, so some of that is only here until you close the app.",
        );
      }
    } catch {
      setFailed("The restore didn't finish. Nothing was removed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel" style={{ marginTop: "var(--sp-4)" }}>
      <div className="panel-title">Your copy</div>
      <p className="backup-say">
        Everything you've written lives on this phone and nowhere else, so it is one factory reset
        from gone. Saving writes two files: a <span className="mono">.json</span> that puts all of
        it back, photos included, and a <span className="mono">.txt</span> you can read on any
        machine ever built.
      </p>

      <div className="backup-actions">
        <button className="btn btn--primary btn--sm" onClick={() => void save()} disabled={busy !== null}>
          {busy === "out" ? "Saving…" : "Save a copy"}
        </button>
        <input
          ref={pick}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => void take(e.target.files?.[0])}
        />
        <button
          className="btn btn--sm"
          onClick={() => pick.current?.click()}
          disabled={busy !== null}
        >
          {busy === "in" ? "Reading…" : "Restore from a copy"}
        </button>
      </div>

      {saved && <p className="backup-say backup-say--ok">Saved: {line(saved)}.</p>}
      {failed && <p className="backup-say backup-say--bad">{failed}</p>}

      {offer && (
        <div className="callout" style={{ marginTop: "var(--sp-3)" }}>
          <span>
            <b>
              This copy is from{" "}
              {offer.at ? new Date(offer.at).toLocaleDateString() : "an unknown date"}.
            </b>{" "}
            It holds {line(countOf(offer))}.
            <span className="backup-choice">
              <button className="btn btn--primary btn--sm" onClick={() => void run("merge")}>
                Merge into this phone
              </button>
              <button className="btn btn--sm" onClick={() => void run("replace")}>
                Replace everything here
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setOffer(null)}>
                Cancel
              </button>
            </span>
            <span className="backup-say">
              Merge keeps both sides and takes the newer of any two entries for the same plant.
              Replace throws away what's on this phone first.
            </span>
          </span>
        </div>
      )}

      {done && (
        <p className="backup-say backup-say--ok">
          Restored: {line(done)}. It's all in the guide now, nothing to reload.
        </p>
      )}
    </section>
  );
}
