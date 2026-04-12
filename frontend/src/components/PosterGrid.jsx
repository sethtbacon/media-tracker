function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function PosterGrid({ items, onEdit, onLoadMore, hasMore }) {
  if (items.length === 0) {
    return <div className="empty-state"><p>No items found.</p></div>;
  }

  return (
    <div className="poster-grid">
      {items.map((item) => {
        const runtime = formatRuntime(item.runtime);
        return (
          <div
            key={item.id}
            className="poster-card"
            onClick={() => onEdit(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(item); }}
          >
            {/* Image area — clipped with rounded corners */}
            <div className="poster-image-wrap">
              {item.cover_url ? (
                <img
                  src={item.cover_url}
                  alt={item.title}
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.parentNode.querySelector(".poster-placeholder").style.display = "flex";
                  }}
                />
              ) : null}

              <div
                className="poster-placeholder"
                style={{ display: item.cover_url ? "none" : "flex" }}
              >
                {item.title}
              </div>

              {/* 4K badge */}
              {item.physical_4k && <span className="poster-badge">4K</span>}

              {/* Hover overlay with title + meta */}
              <div className="poster-overlay">
                <div className="poster-overlay-title">{item.title}</div>
                <div className="poster-overlay-meta">
                  {item.year && <span>{item.year}</span>}
                  {item.mpaa_rating && <span className="poster-rating-pill">{item.mpaa_rating}</span>}
                  {item.watched && <span className="poster-watched-dot">✓</span>}
                </div>
              </div>
            </div>

            {/* Runtime below the image */}
            {runtime && <div className="poster-runtime">{runtime}</div>}
          </div>
        );
      })}

      {hasMore && (
        <div className="poster-load-more">
          <button className="btn btn-ghost" onClick={onLoadMore}>
            Load more…
          </button>
        </div>
      )}
    </div>
  );
}
