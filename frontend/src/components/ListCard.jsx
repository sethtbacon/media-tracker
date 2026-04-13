function ProgressRow({ label, current, total, colorClass }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="list-progress-row">
      <span className="list-progress-label">{label}</span>
      <div className="progress-bar list-progress-bar">
        <div
          className={`progress-fill${colorClass ? ` ${colorClass}` : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="list-progress-count">{current} / {total}</span>
    </div>
  );
}

export default function ListCard({ list, onSelect, onShop, onDelete }) {
  return (
    <div
      className={`list-card${list.is_archived ? " list-card-archived" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect()}
    >
      <div className="list-card-header">
        <span className="list-card-name">{list.name}</span>
        <div className="list-card-badges-row">
          {list.source_name && (
            <span className="list-source-badge">{list.source_name}</span>
          )}
          {list.is_archived && (
            <span className="list-source-badge list-source-archived">Archived</span>
          )}
        </div>
      </div>

      <div className="list-card-progress">
        <ProgressRow label="Owned" current={list.owned} total={list.total} />
        <ProgressRow
          label="Watched"
          current={list.watched}
          total={list.total}
          colorClass="progress-fill-watched"
        />
      </div>

      <div className="list-card-footer">
        <div className="list-card-footer-left">
          {list.unowned > 0 && !list.is_archived && (
            <button
              className="list-shop-link"
              onClick={(e) => { e.stopPropagation(); onShop(); }}
            >
              🛒 {list.unowned} to find
            </button>
          )}
        </div>
        <div className="list-card-footer-right">
          <span
            className={`list-badge${list.owned_completed_at ? " list-badge-earned" : " list-badge-placeholder"}`}
            title={list.owned_completed_at
              ? `All owned since ${list.owned_completed_at.slice(0, 10)}`
              : "Own all items to earn this badge"}
          >
            📦
          </span>
          <span
            className={`list-badge${list.watched_completed_at ? " list-badge-earned" : " list-badge-placeholder"}`}
            title={list.watched_completed_at
              ? `All watched since ${list.watched_completed_at.slice(0, 10)}`
              : "Watch all items to earn this badge"}
          >
            👁
          </span>
          <button
            className="btn-icon danger"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete list"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}
