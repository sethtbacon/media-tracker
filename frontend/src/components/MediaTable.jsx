import { useState, useMemo } from "react";

function Dot({ value }) {
  return <span className={`dot ${value ? "on" : "off"}`} />;
}

const FIXED_COLUMNS = [
  { key: "title",           label: "Title",    sortable: true },
  { key: "year",            label: "Year",     sortable: true },
  { key: "media_type",      label: "Type",     sortable: true },
  { key: "physical_4k",     label: "4K",       sortable: false },
  { key: "physical_bluray", label: "BD",       sortable: false },
  { key: "physical_dvd",    label: "DVD",      sortable: false },
  { key: "digital_apple_tv",label: "ATV",      sortable: false },
  { key: "digital_plex",    label: "Plex",     sortable: false },
  { key: "location",        label: "Location", sortable: true },
  { key: "loaned_to",       label: "Loaned To",sortable: true },
  { key: "genre",           label: "Genre",    sortable: true },
  { key: "mpaa_rating",     label: "Rated",    sortable: true },
];

export default function MediaTable({ items, onEdit, onDelete, onLoadMore, hasMore, onToggleWatchedPerson, personNames }) {
  const [sortCol, setSortCol] = useState("title");
  const [sortDir, setSortDir] = useState("asc");
  const pn = personNames || { p1: "P1", p2: "P2", kidsCount: 0 };

  function handleHeaderClick(col) {
    if (!col.sortable) return;
    if (sortCol === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col.key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortCol, sortDir]);

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No items found.</p>
      </div>
    );
  }

  const totalCols = FIXED_COLUMNS.length + 1 + 1; // +1 watched, +1 actions

  return (
    <div className="table-container">
      <table className="media-table">
        <thead>
          <tr>
            {FIXED_COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleHeaderClick(col)}
                style={{ cursor: col.sortable ? "pointer" : "default" }}
              >
                {col.label}
                {col.sortable && sortCol === col.key && (
                  <span className="sort-indicator">
                    {sortDir === "asc" ? " ↑" : " ↓"}
                  </span>
                )}
              </th>
            ))}
            <th style={{ cursor: "default", textAlign: "center", minWidth: 72 }}>
              <div className="watched-col-header">
                <span>Watched</span>
                <span className="watched-col-sub">
                  {pn.p1.slice(0, 2)}·{pn.p2.slice(0, 2)}{pn.kidsCount > 0 ? "·K" : ""}
                </span>
              </div>
            </th>
            <th style={{ cursor: "default" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.id}>
              <td className="title-cell">
                {item.cover_url && (
                  <a href={item.cover_url} target="_blank" rel="noreferrer">
                    <img
                      src={item.cover_url}
                      alt=""
                      className="poster-thumb"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </a>
                )}
                <a
                  className="title-link"
                  href="#"
                  onClick={(e) => { e.preventDefault(); onEdit(item); }}
                >
                  {item.title}
                </a>
              </td>

              <td>{item.year ?? ""}</td>

              <td>
                {item.media_type && (
                  <span className={`type-badge ${item.media_type === "Movie" ? "movie" : "tv"}`}>
                    {item.media_type === "TV Series" ? "TV" : item.media_type}
                  </span>
                )}
              </td>

              {["physical_4k","physical_bluray","physical_dvd","digital_apple_tv","digital_plex"].map((col) => (
                <td key={col} style={{ textAlign: "center" }}>
                  <Dot value={item[col]} />
                </td>
              ))}

              <td>{item.location ?? ""}</td>

              <td>
                {item.loaned_to ? (
                  <span className="loaned-badge">{item.loaned_to}</span>
                ) : ""}
              </td>

              <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                {item.genre ?? ""}
              </td>

              <td>{item.mpaa_rating ?? ""}</td>

              <td style={{ textAlign: "center" }}>
                <div className="watched-dots">
                  <button
                    className={`watched-dot${item.watched_parent1 ? " on" : ""}`}
                    title={`${pn.p1}: ${item.watched_parent1 ? "Watched — click to unmark" : "Not watched — click to mark"}`}
                    onClick={() => onToggleWatchedPerson(item.id, "watched_parent1", !item.watched_parent1)}
                  />
                  <button
                    className={`watched-dot${item.watched_parent2 ? " on" : ""}`}
                    title={`${pn.p2}: ${item.watched_parent2 ? "Watched — click to unmark" : "Not watched — click to mark"}`}
                    onClick={() => onToggleWatchedPerson(item.id, "watched_parent2", !item.watched_parent2)}
                  />
                  {pn.kidsCount > 0 && (
                    <button
                      className={`watched-dot${item.watched_kids ? " on" : ""}`}
                      title={`Kids: ${item.watched_kids ? "Watched — click to unmark" : "Not watched — click to mark"}`}
                      onClick={() => onToggleWatchedPerson(item.id, "watched_kids", !item.watched_kids)}
                    />
                  )}
                </div>
              </td>

              <td>
                <div className="actions-cell">
                  <button className="btn-icon" title="Edit" onClick={() => onEdit(item)}>
                    ✏️
                  </button>
                  <button
                    className="btn-icon danger"
                    title="Delete"
                    onClick={() => {
                      if (window.confirm(`Delete "${item.title}"?`)) {
                        onDelete(item.id);
                      }
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {hasMore && (
            <tr className="load-more-row">
              <td colSpan={totalCols}>
                <button className="btn btn-ghost" onClick={onLoadMore}>
                  Load more…
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
