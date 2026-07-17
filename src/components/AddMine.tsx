import { useEffect, useRef, useState } from "react";
import { MAX_MINE, useMine, type MineField } from "@/lib/mine";
import { putPhoto, useMinePhoto } from "@/lib/photos";
import { IconPlus, IconX } from "./icons";

/**
 * The "+" on a blank field, and the editor behind it.
 *
 * The guide's blanks are honest but useless: "Not in our sources" is the right
 * sentence and it still leaves her holding a flower she can identify. This turns
 * every blank into somewhere to put what she knows, without ever letting her
 * answer be mistaken for a scraped one. Her value renders as `ptag--mine`, the
 * same ink her bloom marks already use.
 */
export function AddMine({
  id,
  field,
  label,
  value,
}: {
  id: number;
  field: MineField;
  /** The row's label, for the input's accessible name. */
  label: string;
  /** Her current value, or undefined when the field is still blank. */
  value?: string;
}) {
  const { set, remove } = useMine();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [refused, setRefused] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (value !== undefined && !open) {
    return (
      <span className="chip-row">
        <span className="ptag ptag--mine">{value} · yours</span>
        <button className="linkish" onClick={() => (setDraft(value), setOpen(true))}>
          Edit
        </button>
        <button
          className="icon-btn"
          onClick={() => remove(id, field)}
          aria-label={`Remove your ${label.toLowerCase()}`}
        >
          <IconX width={13} height={13} />
        </button>
      </span>
    );
  }

  if (!open) {
    return (
      <button
        className="mine-add"
        onClick={() => setOpen(true)}
        aria-label={`Add your own ${label.toLowerCase()}`}
      >
        <IconPlus width={14} height={14} />
        Add yours
      </button>
    );
  }

  const save = () => {
    // A refused write is the one failure she must hear about: her value is in
    // the session and gone on reload, which looks exactly like success.
    if (!set(id, field, draft)) return setRefused(true);
    setOpen(false);
  };

  return (
    <span className="mine-edit">
      <input
        ref={input}
        className="mine-input"
        value={draft}
        maxLength={MAX_MINE}
        aria-label={`Your ${label.toLowerCase()}`}
        placeholder="What you saw"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button className="btn btn--primary btn--sm" onClick={save}>
        Save
      </button>
      <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {refused && (
        <span className="mine-refused">
          This phone's storage is full, so that didn't save. It's here until you reload.
        </span>
      )}
    </span>
  );
}

/**
 * Her photo of a plant the guide has none for.
 *
 * The file input takes `capture` so a phone opens the camera rather than the
 * gallery, which is where she is: in front of the plant. The blob lives in
 * IndexedDB (see photos.ts) and only its key is in her localStorage.
 */
export function AddMinePhoto({ id, value }: { id: number; value?: string }) {
  const { set, remove } = useMine();
  const url = useMinePhoto(value);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFailed(null);
    try {
      const key = await putPhoto(file);
      if (!set(id, "photo", key)) setFailed("This phone's storage is full, so that didn't save.");
    } catch {
      setFailed("That image couldn't be read.");
    } finally {
      setBusy(false);
    }
  };

  if (value && url) {
    return (
      <figure className="specimen-photo specimen-photo--mine">
        <img src={url} alt="Your photo of this plant" />
        <figcaption>
          Your photo{" "}
          <button className="linkish" onClick={() => remove(id, "photo")}>
            Remove
          </button>
        </figcaption>
      </figure>
    );
  }

  return (
    <div className="mine-photo">
      <input
        ref={pick}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void take(e.target.files?.[0])}
      />
      <button className="mine-add" onClick={() => pick.current?.click()} disabled={busy}>
        <IconPlus width={14} height={14} />
        {busy ? "Saving…" : "Add your photo"}
      </button>
      {failed && <span className="mine-refused">{failed}</span>}
    </div>
  );
}
