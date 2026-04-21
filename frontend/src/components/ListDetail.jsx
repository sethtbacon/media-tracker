import { useState, useEffect } from "react";
import { getList, deleteListItem, updateMedia, updateListItem, getSettings, refreshPosters } from "../api.js";

const FILTER_OPTIONS = [
  ["all", "All"],
  ["owned", "Owned"],
  ["unowned", "Unowned"],
  ["watched", "Watched"],
  ["unwatched", "Unwatched"],
  ["skipped", "Skipped"],
];

function formatRuntime(min) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function WatchedDots({ item, listId, onToggle, personNames }) {
  const pn = personNames || { p1: "P1", p2: "P2", kidsCount: 0 };
  return (
    <div className="watched-dots">
      <button
        className={`watched-dot${item.watched_parent1 ? " on" : ""}`}
        title={`${pn.p1}: ${item.watched_parent1 ? "Watched — click to unmark" : "Not watched"}`}
        onClick={() => onToggle(item, "watched_parent1", !item.watched_parent1)}
      />
      <button
        className={`watched-dot${item.watched_parent2 ? " on" : ""}`}
        title={`${pn.p2}: ${item.watched_parent2 ? "Watched — click to unmark" : "Not watched"}`}
        onClick={() => onToggle(item, "watched_parent2", !item.watched_parent2)}
      />
      {pn.kidsCount > 0 && (
        <button
          className={`watched-dot${item.watched_kids ? " on" : ""}`}
          title={`Kids: ${item.watched_kids ? "Watched — click to unmark" : "Not watched"}`}
          onClick={() => onToggle(item, "watched_kids", !item.watched_kids)}
        />
      )}
    </div>
  );
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
  const [personNames, setPersonNames] = useState({ p1: "Parent 1", p2: "Parent 2", kidsCount: 0 });

  useEffect(() => {
    getSettings().then((settings) => {
      const get = (key, def) => settings.find((s) => s.key === key)?.value ?? def;
      setPersonNames({
        p1: get("person_name_parent1", "Parent 1"),
        p2: get("person_name_parent2", "Parent 2"),
        kidsCount: parseInt(get("kids_count", "0"), 10),
      });
    }).catch(() => {});
  }, []);

  async function loadList(silent = false) {
    if (!silent) setLoading(true);
    try {
      const data = await getList(listId);
      setList(data);
    } catch (e) {
      onShowToast("Failed to load list: " + e.message, "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadList();
  }, [listId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function handleToggleWatched(item, field, value) {
    try {
      if (item.media_id) {
        // Owned — update media_items
        await updateMedia(item.media_id, { [field]: value });
      } else {
        // Unowned — update list_items
        await updateListItem(listId, item.id, { [field]: value });
      }
      await loadList(true); // silent — don't reset scroll
      onRefresh?.();
    } catch (e) {
      onShowToast("Update failed: " + e.message, "error");
    }
  }

  async function handleToggleNotInterested(item) {
    const newVal = !item.not_interested;
    try {
      await updateListItem(listId, item.id, { not_interested: newVal });
      await loadList(true); // silent — don't reset scroll
      onRefresh?.();
      if (newVal) onShowToast(`Skipped "${item.title}" — won't show in shopping`, "info");
    } catch (e) {
      onShowToast("Update failed: " + e.message, "error");
    }
  }

  const [refreshingPosters, setRefreshingPosters] = useState(false);
  async function handleRefreshPosters() {
    setRefreshingPosters(true);
    try {
      const result = await refreshPosters(listId);
      await loadList(true);
      onShowToast(`Updated ${result.updated} poster${result.updated !== 1 ? "s" : ""}`, "success");
    } catch (e) {
      onShowToast("Poster refresh failed: " + e.message, "error");
    } finally {
      setRefreshingPosters(false);
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
    if (filter === "unowned")  return !item.owned && !item.not_interested;
    if (filter === "watched")  return item.watched;
    if (filter === "unwatched") return !item.watched;
    if (filter === "skipped")  return item.not_interested;
    // "all" — exclude skipped items by default (they are in "Skipped" tab)
    return !item.not_interested;
  });

  const pctOwned   = list.total > 0 ? Math.round((list.owned   / list.total) * 100) : 0;
  const pctWatched = list.total > 0 ? Math.round((list.watched / list.total) * 100) : 0;
  const skippedCount = (list.items || []).filter(i => i.not_interested).length;

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
          {skippedCount > 0 && (
            <>
              <span className="stats-sep">·</span>
              <span style={{ color: "var(--text-muted)" }}>{skippedCount} skipped</span>
            </>
          )}
        </div>

        {!list.is_archived && (
          <div className="list-detail-actions">
            <button className="btn btn-ghost" onClick={onImport}>Import Items</button>
            {list.unowned > 0 && (
              <button className="btn btn-ghost" onClick={onShop}>🛒 Shopping List</button>
            )}
            {list.source_ref?.startsWith("tmdb:") && (
              <button
                className="btn btn-ghost"
                onClick={handleRefreshPosters}
                disabled={refreshingPosters}
                title="Fetch missing posters from TMDB"
              >
                {refreshingPosters ? "Refreshing…" : "🖼 Refresh Posters"}
              </button>
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
              {label}{val === "skipped" && skippedCount > 0 ? ` (${skippedCount})` : ""}
            </button>
          ))}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          {filter === "skipped" ? (
            <p>No skipped items.</p>
          ) : (list.items?.length ?? 0) === 0 ? (
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
                <th style={{ width: 88, textAlign: "center" }}>
                  <div className="watched-col-header">
                    <span>Watched</span>
                    <span className="watched-col-sub">
                      {personNames.p1.slice(0,2)}·{personNames.p2.slice(0,2)}{personNames.kidsCount > 0 ? "·K" : ""}
                    </span>
                  </div>
                </th>
                {!list.is_archived && <th style={{ width: 60, textAlign: "center" }}></th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={item.not_interested ? "list-item-skipped" : ""}>
                  <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {item.rank ?? "—"}
                  </td>

                  <td>
                    <div className="list-title-inner">
                      {(item.media_cover_url || item.poster_url) && (
                        <img
                          src={item.media_cover_url || item.poster_url}
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
                    </div>
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
                    <WatchedDots
                      item={item}
                      listId={listId}
                      onToggle={handleToggleWatched}
                      personNames={personNames}
                    />
                  </td>

                  {!list.is_archived && (
                    <td style={{ textAlign: "center" }}>
                      <div className="actions-cell" style={{ justifyContent: "center" }}>
                        <button
                          className={`not-interested-btn${item.not_interested ? " active" : ""}`}
                          title={item.not_interested ? "Skipped — click to undo" : "Skip this title"}
                          onClick={() => handleToggleNotInterested(item)}
                        >
                          {item.not_interested ? "↩" : "✕"}
                        </button>
                        <button
                          className="btn-icon danger"
                          title="Remove from list"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          🗑️
                        </button>
                      </div>
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
