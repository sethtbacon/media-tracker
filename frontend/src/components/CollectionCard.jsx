export default function CollectionCard({ list, onSelect, onDelete }) {
  const ownedPct  = list.total > 0 ? Math.round((list.owned  / list.total) * 100) : 0;
  const watchPct  = list.total > 0 ? Math.round((list.watched / list.total) * 100) : 0;

  return (
    <div
      className="collection-card"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
    >
      <div className="collection-card-poster-area">
        {list.preview_poster ? (
          <img
            className="collection-card-img"
            src={list.preview_poster}
            alt={list.name}
            loading="lazy"
          />
        ) : (
          <div className="collection-card-placeholder">🎬</div>
        )}
        <button
          className="collection-card-delete"
          title="Delete collection"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          ×
        </button>
      </div>

      <div className="collection-card-body">
        <div className="collection-card-name">{list.name}</div>

        <div className="collection-card-stat-row">
          <span className="collection-card-stat-label">Owned</span>
          <div className="collection-card-bar">
            <div className="collection-card-bar-fill" style={{ width: `${ownedPct}%` }} />
          </div>
          <span className="collection-card-stat-count">{list.owned}/{list.total}</span>
        </div>

        <div className="collection-card-stat-row">
          <span className="collection-card-stat-label">Watched</span>
          <div className="collection-card-bar">
            <div className="collection-card-bar-fill collection-card-bar-watched" style={{ width: `${watchPct}%` }} />
          </div>
          <span className="collection-card-stat-count">{list.watched}/{list.total}</span>
        </div>
      </div>
    </div>
  );
}
