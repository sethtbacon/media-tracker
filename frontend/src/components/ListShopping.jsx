import { useState, useEffect } from "react";
import { getList, getAllUnownedItems } from "../api.js";
import QuickAddModal from "./QuickAddModal.jsx";

function formatMeta(item) {
  const parts = [];
  if (item.year) parts.push(item.year);
  if (item.media_mpaa_rating) parts.push(item.media_mpaa_rating);
  if (item.media_runtime) {
    const h = Math.floor(item.media_runtime / 60);
    const m = item.media_runtime % 60;
    parts.push(h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`);
  }
  return parts.join(" · ");
}

export default function ListShopping({ list, onBack, onAdded, onShowToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickAddItem, setQuickAddItem] = useState(null);

  useEffect(() => {
    loadItems();
  }, [list?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadItems() {
    setLoading(true);
    try {
      if (list) {
        const data = await getList(list.id);
        setItems((data.items || []).filter((i) => !i.owned && !i.not_interested));
      } else {
        const data = await getAllUnownedItems();
        setItems(data.items || []);
      }
    } catch (e) {
      onShowToast("Failed to load items: " + e.message, "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function handleAdded() {
    setQuickAddItem(null);
    loadItems();
    onAdded?.();
  }

  const title = list ? `Shopping: ${list.name}` : "Shopping — All Lists";

  return (
    <div className="list-shopping">
      <div className="list-shopping-header">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div className="list-shopping-header-info">
          <h2 className="list-shopping-title">{title}</h2>
          {!loading && (
            <span className="list-shopping-count">
              {items.length === 0 ? "Nothing left to find!" : `${items.length} item${items.length !== 1 ? "s" : ""} to find`}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p>Loading…</p></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>🎉 You own everything{list ? ` on "${list.name}"` : " across all your lists"}!</p>
        </div>
      ) : (
        <div className="list-shopping-list">
          {items.map((item) => (
            <div key={item.id} className="list-shopping-item">
              <div className="list-shopping-item-info">
                {item.rank != null && (
                  <span className="list-shopping-rank">#{item.rank}</span>
                )}
                <div className="list-shopping-item-main">
                  <span className="list-shopping-item-title">{item.title}</span>
                  {formatMeta(item) && (
                    <span className="list-shopping-item-meta">{formatMeta(item)}</span>
                  )}
                  {!list && item.list_name && (
                    <span className="list-source-badge" style={{ marginTop: 4, alignSelf: "flex-start" }}>
                      {item.list_name}
                    </span>
                  )}
                </div>
              </div>
              <button
                className="list-shopping-cta"
                onClick={() => setQuickAddItem(item)}
              >
                I Found It!
              </button>
            </div>
          ))}
        </div>
      )}

      {quickAddItem && (
        <QuickAddModal
          item={quickAddItem}
          listId={list?.id ?? null}
          onSave={handleAdded}
          onClose={() => setQuickAddItem(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}
