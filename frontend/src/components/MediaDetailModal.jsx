import { useState, useEffect } from "react";

function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

const FORMAT_BADGES = [
  { key: "physical_4k",      label: "4K"   },
  { key: "physical_bluray",  label: "BD"   },
  { key: "physical_dvd",     label: "DVD"  },
  { key: "digital_apple_tv", label: "ATV"  },
  { key: "digital_plex",     label: "Plex" },
];

const LOCATION_ICONS = { home: "📦", van: "🚐" };

// Stored as 1 / 2 / 3 in the existing float column
const RATING_OPTIONS = [
  { value: 1, icon: "👎", label: "Dislike" },
  { value: 2, icon: "👍", label: "Like"    },
  { value: 3, icon: "❤️", label: "Love"    },
];

export default function MediaDetailModal({ item, personNames, onEdit, onDelete, onClose, onToggleWatchedPerson, onSaveField }) {
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const pn = personNames || { p1: "Parent 1", p2: "Parent 2", kidsCount: 0 };

  useEffect(() => {
    setPlotExpanded(false);
    setImgFailed(false);
  }, [item?.id]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      if ((e.key === "e" || e.key === "E") && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") onEdit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onEdit]);

  if (!item) return null;

  const runtime = formatRuntime(item.runtime);
  const genres = item.genre ? item.genre.split(",").map((g) => g.trim()).filter(Boolean) : [];

  // People rows: watched toggle + 1-click rating buttons
  const people = [
    { name: pn.p1,   watchedField: "watched_parent1", ratingField: "parent1_rating", watched: item.watched_parent1, rating: item.parent1_rating },
    { name: pn.p2,   watchedField: "watched_parent2", ratingField: "parent2_rating", watched: item.watched_parent2, rating: item.parent2_rating },
    ...(pn.kidsCount > 0 ? [{ name: "Kids", watchedField: "watched_kids", ratingField: "kids_rating", watched: item.watched_kids, rating: item.kids_rating }] : []),
  ];

  const infoRows = [
    item.director    && { label: "Director",  value: item.director },
    runtime          && { label: "Run Time",   value: runtime },
    item.year        && { label: "Released",   value: item.year },
    item.mpaa_rating && { label: "Rated",      value: item.mpaa_rating },
    item.imdb_id     && {
      label: "IMDb",
      value: <a href={`https://www.imdb.com/title/${item.imdb_id}/`} target="_blank" rel="noreferrer">{item.imdb_id}</a>,
    },
    item.tmdb_id        && { label: "TMDB",           value: item.tmdb_id },
    item.physical_notes && { label: "Physical notes", value: item.physical_notes },
    item.notes          && { label: "Notes",          value: item.notes },
  ].filter(Boolean);

  function handleDelete() {
    if (window.confirm(`Delete "${item.title}"?`)) {
      onClose();
      onDelete(item.id);
    }
  }

  const showHeroImage = item.cover_url && !imgFailed;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-detail">

        {/* Hero */}
        <div className="detail-hero">
          {showHeroImage ? (
            <img
              src={item.cover_url}
              alt={item.title}
              className="detail-hero-img"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="detail-hero-placeholder">{item.title}</div>
          )}
          <div className="detail-hero-gradient" />
          <div className="detail-secondary-actions">
            <button className="detail-action-btn" title="Edit (E)" onClick={onEdit}>✏️</button>
            <button className="detail-action-btn detail-action-btn-danger" title="Delete" onClick={handleDelete}>🗑</button>
            <button className="detail-action-btn" title="Close (Esc)" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="detail-body">

          {/* Title block */}
          <div className="detail-title-block">
            <h1 className="detail-title">{item.title}</h1>
            <div className="detail-meta-line">
              {item.year && <span>{item.year}</span>}
              {runtime && <span>{runtime}</span>}
              {item.mpaa_rating && <span className="detail-mpaa-pill">{item.mpaa_rating}</span>}
              {item.media_type && (
                <span className={`type-badge ${item.media_type === "Movie" ? "movie" : "tv"}`}>
                  {item.media_type === "TV Series" ? "TV" : item.media_type}
                </span>
              )}
            </div>
            {genres.length > 0 && (
              <div className="detail-genres">
                {genres.map((g) => <span key={g} className="detail-genre-chip">{g}</span>)}
              </div>
            )}
          </div>

          {/* Per-person: watched toggle + one-click ratings */}
          <div className="detail-people-section">
            {people.map(({ name, watchedField, ratingField, watched, rating }) => (
              <div key={ratingField} className="detail-person-row">
                <button
                  className={`detail-person-watch-btn${watched ? " on" : ""}`}
                  title={watched ? `${name}: Watched — click to unmark` : `${name}: Not watched`}
                  onClick={() => onToggleWatchedPerson(item.id, watchedField, !watched)}
                >
                  <span className="detail-person-watch-dot" />
                  <span className="detail-person-name">{name}</span>
                </button>
                <div className="detail-rating-btns">
                  {RATING_OPTIONS.map(({ value: v, icon, label }) => (
                    <button
                      key={v}
                      className={`detail-rating-btn${rating === v ? " active" : ""}`}
                      title={label}
                      onClick={() => {
                        const newValue = rating === v ? null : v;
                        onSaveField(item.id, ratingField, newValue);
                        if (newValue !== null && !watched) {
                          onToggleWatchedPerson(item.id, watchedField, true);
                        }
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Format badges + location */}
          <div className="detail-action-row">
            <div className="detail-format-badges">
              {FORMAT_BADGES.map(({ key, label }) => (
                <span key={key} className={`detail-format-badge${item[key] ? "" : " off"}`}>
                  {label}
                </span>
              ))}
              {item.not_interested && (
                <span className="detail-not-interested">Not interested</span>
              )}
            </div>
            {(item.location || item.loaned_to) && (
              <div className="detail-chips">
                {item.location && (
                  <span className="detail-location-chip">
                    {LOCATION_ICONS[item.location] ?? "📍"} {item.location}
                  </span>
                )}
                {item.loaned_to && (
                  <span className="loaned-badge">Loaned to: {item.loaned_to}</span>
                )}
              </div>
            )}
          </div>

          {/* Plot */}
          {item.plot && (
            <div className="detail-plot-section">
              <p className={`detail-plot${plotExpanded ? " expanded" : ""}`}>{item.plot}</p>
              <button
                className="detail-plot-toggle"
                onClick={() => setPlotExpanded((v) => !v)}
              >
                {plotExpanded ? "Less" : "More"}
              </button>
            </div>
          )}

          {/* Information */}
          {infoRows.length > 0 && (
            <div className="detail-info-section">
              <div className="detail-section-heading">Information</div>
              {infoRows.map((row) => (
                <div key={row.label} className="detail-info-row">
                  <span className="detail-info-label">{row.label}</span>
                  <span className="detail-info-value">{row.value}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
