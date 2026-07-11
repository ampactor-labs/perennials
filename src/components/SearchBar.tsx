import { useCatalog } from "@/state/catalog";
import { IconSearch, IconX } from "./icons";

export function SearchBar() {
  const { filters, setText } = useCatalog();
  return (
    <div className="searchbar">
      <IconSearch className="search-icon" />
      <input
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Search a plant, use, or Latin name…"
        value={filters.text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Search plants"
      />
      {filters.text && (
        <button className="search-clear" onClick={() => setText("")} aria-label="Clear search">
          <IconX width={18} height={18} />
        </button>
      )}
    </div>
  );
}
