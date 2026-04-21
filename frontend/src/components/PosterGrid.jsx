export default function PosterGrid({ items, onDetail, onLoadMore, hasMore }) {
  if (items.length === 0) {
    return <div className="empty-state"><p>No items found.</p></div>;
  }

  return (
    <div className="poster-grid">
      {items.map((item) => {
        return (
          <div
            key={item.id}
            className="poster-card"
            onClick={() => onDetail(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onDetail(item); }}
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
