import { useState, useEffect } from "react";
import { getList, deleteListItem, updateMedia } from "../api.js";

const FILTER_OPTIONS = [
  ["all", "All"],
  ["owned", "Owned"],
  ["unowned", "Unowned"],
  ["watched", "Watched"],
  ["unwatched", "Unwatched"],
];

function formatRuntime(min) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ListDetail({
  listId,
  onBack,
  onImport,
  onShop,
  onOpenInLibrary,
  onRefresh,
  onShowToast,
}) {
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  async function loadList() {
    setLoading(true);
    try {
      const data = await getList(listId);
      setList(data);
    } catch (e) {
      onShowToast("Failed to load list: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, [listId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose refresh to parent
  useEffect(() => {
    if (onRefresh) {
      // Parent calls onRefresh() which we intercept by listening to prop changes.
      // Instead, parent triggers via key change or we expose loadList via ref.
      // Simple approach: reload when onRefresh is called by updating a counter.
    }
  }, []);

  async function handleDeleteItem(itemId) {
    if (!window.confirm("Remove this item from the list?")) return;
    try {
      await deleteListItem(listId, itemId);
      await loadList();
      onRefresh?.();
    } catch (e) {
      onShowToast("Remove failed: " + e.message, "error");
    }
  }

  async function handleToggleWatched(mediaId, watched) {
    try {
      await updateMedia(mediaId, { watched });
      await loadList();
      onRefresh?.();
    } catch (e) {
      onShowToast("Update failed: " + e.message, "error");
    }
  }

  if (loading || !list) {
    return (
      <div className="list-detail">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div className="empty-state"><p>Loading…</p></div>
      </div>
    );
  }

  const filteredItems = (list.items || []).filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "owned")    return item.owned;
    if (filter === "unowned")  return !item.owned;
    if (filter === "watched")  return item.watched;
    if (filter === "unwatched") return item.owned && !item.watched;
    return true;
  });

  const pctOwned   = list.total > 0 ? Math.round((list.owned   / list.total) * 100) : 0;
  const pctWatched = list.total > 0 ? Math.round((list.watched / list.total) * 100) : 0;

  return (
    <div className="list-detail">
      <div className="list-detail-header">
        <div className="list-detail-nav">
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        </div>

        <div className="list-detail-title-row">
          <h2 className="list-detail-name">{list.name}</h2>
          <div className="list-title-meta">
            {list.source_name && (
              <span className="list-source-badge">{list.source_name}</span>
            )}
            {list.is_archived && (
              <span className="list-source-badge list-source-archived">
                Archived{list.version_note ? ` · ${list.version_note}` : ""}
              </span>
            )}
            <span
              className={`list-badge${list.owned_completed_at ? " list-badge-earned" : " list-badge-placeholder"}`}
              title={list.owned_completed_at ? "All owned!" : "Own all items to earn this badge"}
            >📦</span>
            <span
              className={`list-badge${list.watched_completed_at ? " list-badge-earned" : " list-badge-placeholder"}`}
              title={list.watched_completed_at ? "All watched!" : "Watch all items to earn this badge"}
            >👁</span>
          </div>
        </div>

        <div className="list-detail-stats">
          <span>{list.owned} / {list.total} owned ({pctOwned}%)</span>
          <span className="stats-sep">·</span>
          <span>{list.watched} / {list.total} watched ({pctWatched}%)</span>
          {list.unowned > 0 && (
            <>
              <span className="stats-sep">·</span>
              <span className="list-still-shopping">{list.unowned} still shopping</span>
            </>
          )}
        </div>

        {!list.is_archived && (
          <div className="list-detail-actions">
            <button className="btn btn-ghost" onClick={onImport}>Import Items</button>
            {list.unowned > 0 && (
              <button className="btn btn-ghost" onClick={onShop}>🛒 Shopping List</button>
            )}
          </div>
        )}
      </div>

      <div className="list-filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search within list…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="list-filter-tabs">
          {FILTER_OPTIONS.map(([val, label]) => (
            <button
              key={val}
              className={`list-filter-tab${filter === val ? " active" : ""}`}
              onClick={() => setFilter(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          {(list.items?.length ?? 0) === 0 ? (
            <>
              <p>No items yet.</p>
              {!list.is_archived && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onImport}>
                  Import Items
                </button>
              )}
            </>
          ) : (
            <p>No items match the current filter.</p>
          )}
        </div>
      ) : (
        <div className="table-container">
          <table className="media-table list-item-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Title</th>
                <th style={{ width: 52 }}>Year</th>
                <th style={{ width: 60 }}>Rated</th>
                <th style={{ width: 60 }}>Runtime</th>
                <th style={{ width: 88, textAlign: "center" }}>Owned</th>
                <th style={{ width: 72, textAlign: "center" }}>Watched</th>
                {!list.is_archived && <th style={{ width: 44 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {item.rank ?? "—"}
                  </td>

                  <td className="title-cell">
                    {item.media_cover_url && (
                      <img
                        src={item.media_cover_url}
                        alt=""
                        className="poster-thumb"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    )}
                    {item.owned ? (
                      <a
                        className="title-link"
                        href="#"
                        onClick={(e) => { e.preventDefault(); onOpenInLibrary(item.media_id); }}
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span>{item.title}</span>
                    )}
                  </td>

                  <td>{item.year ?? ""}</td>
                  <td>{item.media_mpaa_rating ?? ""}</td>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {formatRuntime(item.media_runtime) ?? ""}
                  </td>

                  <td style={{ textAlign: "center" }}>
                    {item.owned ? (
                      <span className="list-owned-badge">✓</span>
                    ) : (
                      <button className="list-find-btn" onClick={onShop}>
                        Find It →
                      </button>
                    )}
                  </td>

                  <td style={{ textAlign: "center" }}>
                    {item.owned ? (
                      <button
                        className={`watched-toggle${item.watched ? " on" : ""}`}
                        title={item.watched ? "Watched — click to unmark" : "Not watched — click to mark"}
                        onClick={() => handleToggleWatched(item.media_id, !item.watched)}
                      >
                        {item.watched ? "✓" : "○"}
                      </button>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>

                  {!list.is_archived && (
                    <td>
                      <button
                        className="btn-icon danger"
                        title="Remove from list"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
