import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "@/state/search";
import { buildLexicon, suggest, type Suggestion } from "@/lib/suggest";
import { IconSearch, IconX } from "./icons";
import { Thumb } from "./Thumb";

// One input that speaks the whole grammar: type "wet shade" and get both
// constraints; type "mulberry" and jump to the plant; Enter keeps free text.
export function Omnibox() {
  const s = useSearch();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  // -1 means "she has not chosen a row". Enter behaves differently when she has.
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const lexicon = useMemo(() => (s.data ? buildLexicon(s.data) : []), [s.data]);
  const suggestions = useMemo<Suggestion[]>(
    () =>
      s.data && draft.trim()
        ? suggest(s.data, lexicon, draft, { constraints: s.constraints, counts: s.counts })
        : [],
    [s.data, lexicon, draft, s.constraints, s.counts],
  );

  useEffect(() => setCursor(-1), [draft]);

  // Close on outside tap.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  function pick(sug: Suggestion) {
    if (sug.type === "constraint") {
      for (const a of sug.atoms) s.add(a);
      // Clear the draft, not the committed search. Wiping the text here meant
      // that searching "currant" and then adding Water: Wet dropped the text step
      // out of the trail and made the results *grow* — an added constraint that
      // widens the set teaches exactly the wrong model.
      setDraft("");
      inputRef.current?.focus();
    } else {
      setOpen(false);
      setDraft("");
      navigate(`/plant/${sug.plant.slug}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!draft.trim()) return;
      if (cursor >= 0) {
        // She picked this row on purpose. Whatever it is, do it.
        pick(suggestions[cursor]);
        return;
      }
      // Bare Enter takes the top *constraint*, never a plant. On a phone this key
      // is rendered as "Search", and navigating to a plant page is the one action
      // that throws away what she typed — so it must not be what Search does.
      const top = suggestions.find((x) => x.type === "constraint");
      if (top) pick(top);
      else {
        s.setText(draft);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (
      e.key === "Backspace" &&
      draft === "" &&
      // Not on key repeat. Holding backspace to clear a typed word keeps firing
      // past empty, and each extra one silently ate a constraint off the trail.
      !e.repeat &&
      s.constraints.atoms.length > 0
    ) {
      s.remove(s.constraints.atoms[s.constraints.atoms.length - 1]);
    }
  }

  const showDrop = open && suggestions.length > 0;
  const constraintSugs = suggestions.filter((x) => x.type === "constraint");
  const plantSugs = suggestions.filter((x) => x.type === "plant");
  let flat = -1;

  return (
    <div className="omnibox" ref={boxRef}>
      <div className="searchbar">
        <IconSearch className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder='Try “wet shade”, “nitrogen”, “zone 6”, or a plant name…'
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            if (e.target.value === "") s.setText("");
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showDrop}
          aria-controls="omnibox-listbox"
          aria-autocomplete="list"
          aria-activedescendant={showDrop && cursor >= 0 ? `omni-opt-${cursor}` : undefined}
          aria-label="Search plants or add constraints"
        />
        {(draft || s.constraints.text) && (
          <button
            className="search-clear"
            onClick={() => {
              setDraft("");
              s.setText("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <IconX width={18} height={18} />
          </button>
        )}
      </div>

      {showDrop && (
        <div className="omni-drop" id="omnibox-listbox" role="listbox">
          {constraintSugs.length > 0 && (
            <div className="omni-group" role="presentation">
              <div className="omni-group-label">Add a constraint</div>
              {constraintSugs.map((sug) => {
                flat += 1;
                const i = flat;
                return (
                  <button
                    key={`c${i}`}
                    id={`omni-opt-${i}`}
                    role="option"
                    aria-selected={cursor === i}
                    className={`omni-item${cursor === i ? " hot" : ""}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(sug)}
                  >
                    <span className="omni-tag">{sug.group}</span>
                    <span className="omni-label">{sug.label}</span>
                    <span className="omni-n mono">{sug.count.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          )}
          {plantSugs.length > 0 && (
            <div className="omni-group" role="presentation">
              <div className="omni-group-label">Plants</div>
              {plantSugs.map((sug) => {
                flat += 1;
                const i = flat;
                const p = sug.plant;
                return (
                  <button
                    key={p.slug}
                    id={`omni-opt-${i}`}
                    role="option"
                    aria-selected={cursor === i}
                    className={`omni-item${cursor === i ? " hot" : ""}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={() => pick(sug)}
                  >
                    <span className="omni-thumb">
                      <Thumb id={p.id} has={!!p.thumb} sizes="30px" />
                    </span>
                    <span className="omni-label">
                      {p.name} <em className="binomial">{p.scientificName}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="omni-hint">Enter adds the top filter. Tap a plant to open it.</div>
        </div>
      )}
    </div>
  );
}
