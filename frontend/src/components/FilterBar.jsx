import { useEffect, useRef } from "react";

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

export default function FilterBar({ filters, onChange }) {
  const searchDebounce = useRef(null);
  const genreDebounce = useRef(null);
  const searchRef = useRef(null);
  const genreRef = useRef(null);

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

  function toggleBool(key) {
    onChange({ ...filters, [key]: !filters[key] });
  }

  function clear() {
    if (searchRef.current) searchRef.current.value = "";
    if (genreRef.current) genreRef.current.value = "";
    onChange({ ...DEFAULTS });
  }

  const toggles = [
    { key: "physical_4k",            label: "4K" },
    { key: "physical_bluray",         label: "Blu-ray" },
    { key: "physical_dvd",            label: "DVD" },
    { key: "digital_apple_tv",        label: "Apple TV" },
    { key: "digital_plex",            label: "Plex" },
    { key: "digital_movies_anywhere", label: "MA" },
    { key: "loaned",                  label: "Loaned" },
    { key: "watched",                 label: "Watched" },
  ];

  return (
    <div className="filter-bar">
      <input
        ref={searchRef}
        className="filter-search"
        type="text"
        placeholder="Search title or director…"
        defaultValue={filters.search}
        onChange={handleSearch}
      />

      <input
        ref={genreRef}
        className="filter-search"
        type="text"
        placeholder="Genre…"
        style={{ width: 120 }}
        defaultValue={filters.genre}
        onChange={handleGenre}
      />

      <select
        className="filter-select"
        value={filters.media_type}
        onChange={(e) => handleSelect("media_type", e.target.value)}
      >
        <option value="">All Types</option>
        <option value="Movie">Movie</option>
        <option value="TV Series">TV Series</option>
      </select>

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

      <div className="filter-divider" />

      <div className="filter-toggles">
        {toggles.map(({ key, label }) => (
          <button
            key={key}
            className={`toggle-btn${filters[key] ? " active" : ""}`}
            onClick={() => toggleBool(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filter-divider" />

      <button className="btn btn-ghost" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
