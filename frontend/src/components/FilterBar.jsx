import { useEffect, useRef, useState } from "react";

const DEFAULTS = {
  search: "",
  media_type: "",
  location: "",
  mpaa_rating: "",
  genre: "",
  physical_4k: false,
  physical_bluray: false,
  physical_dvd: false,
  digital_apple_tv: false,
  digital_plex: false,
  digital_movies_anywhere: false,
  loaned: false,
  watched: false,
};

export { DEFAULTS as FILTER_DEFAULTS };

export default function FilterBar({ filters, onChange, displayMode, onDisplayModeChange }) {
  const searchDebounce = useRef(null);
  const genreDebounce = useRef(null);
  const searchRef = useRef(null);
  const genreRef = useRef(null);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  function handleSearch(e) {
    const value = e.target.value;
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      onChange({ ...filters, search: value });
    }, 400);
  }

  function handleGenre(e) {
    const value = e.target.value;
    clearTimeout(genreDebounce.current);
    genreDebounce.current = setTimeout(() => {
      onChange({ ...filters, genre: value });
    }, 400);
  }

  useEffect(() => {
    if (searchRef.current && filters.search === "") searchRef.current.value = "";
  }, [filters.search]);

  useEffect(() => {
    if (genreRef.current && filters.genre === "") genreRef.current.value = "";
  }, [filters.genre]);

  function handleSelect(key, value) {
    onChange({ ...filters, [key]: value });
  }

  function clear() {
    if (searchRef.current) searchRef.current.value = "";
    if (genreRef.current) genreRef.current.value = "";
    onChange({ ...DEFAULTS });
    setSecondaryOpen(false);
  }

  // Count active filters (excluding search which is always visible)
  const secondaryActiveCount = Object.entries(filters).filter(([k, v]) => {
    if (k === "search") return false; // search is always shown
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "";
    return false;
  }).length;

  const totalActiveCount = Object.entries(filters).filter(([, v]) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v !== "";
    return false;
  }).length;

  return (
    <div className={`filter-bar${secondaryOpen ? " filter-bar-open" : ""}`}>
      {/* Always visible: search + mobile filter toggle */}
      <input
        ref={searchRef}
        className="filter-search filter-search-main"
        type="text"
        placeholder="Search title or director..."
        defaultValue={filters.search}
        onChange={handleSearch}
      />

      {/* Mobile-only: expand/collapse secondary filters */}
      <button
        className={`btn filter-expand-btn${secondaryActiveCount > 0 ? " has-active" : ""}`}
        onClick={() => setSecondaryOpen((o) => !o)}
      >
        {secondaryActiveCount > 0 ? `Filters (${secondaryActiveCount})` : "Filters"}
        <span className="filter-expand-chevron">{secondaryOpen ? "▲" : "▼"}</span>
      </button>

      {/* Secondary filters — always visible on desktop, toggle on mobile */}
      <div className="filter-secondary">
        <input
          ref={genreRef}
          className="filter-search"
          type="text"
          placeholder="Genre..."
          defaultValue={filters.genre}
          onChange={handleGenre}
        />

        <select
          className="filter-select"
          value={filters.location}
          onChange={(e) => handleSelect("location", e.target.value)}
        >
          <option value="">All Locations</option>
          <option value="home">Home</option>
          <option value="van">Van</option>
          <option value="second location">Second Location</option>
        </select>

        <select
          className="filter-select"
          value={filters.mpaa_rating}
          onChange={(e) => handleSelect("mpaa_rating", e.target.value)}
        >
          <option value="">All Ratings</option>
          <option value="G">G</option>
          <option value="PG">PG</option>
          <option value="PG-13">PG-13</option>
          <option value="R">R</option>
          <option value="NC-17">NC-17</option>
          <option value="Not Rated">Not Rated</option>
        </select>

        {onDisplayModeChange && (
          <div className="display-toggle">
            <button
              className={`display-toggle-btn${displayMode === "table" ? " active" : ""}`}
              onClick={() => onDisplayModeChange("table")}
            >
              List
            </button>
            <button
              className={`display-toggle-btn${displayMode === "posters" ? " active" : ""}`}
              onClick={() => onDisplayModeChange("posters")}
            >
              Grid
            </button>
          </div>
        )}

        <button className="btn btn-ghost" onClick={clear}>
          {totalActiveCount > 0 ? `Clear (${totalActiveCount})` : "Clear"}
        </button>
      </div>
    </div>
  );
}
