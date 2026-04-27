import { useState } from "react";
import { createList, deleteList } from "../api.js";
import ListCard from "./ListCard.jsx";
import ListCreateModal from "./ListCreateModal.jsx";

export default function ListsHome({ lists, onSelect, onShop, onFromTMDB, onRefetch, onShowToast }) {
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate(data) {
    try {
      await createList(data);
      setShowCreate(false);
      onRefetch();
    } catch (e) {
      onShowToast("Failed to create list: " + e.message, "error");
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Delete "${name}" and all its items?`)) return;
    try {
      await deleteList(id);
      onRefetch();
    } catch (e) {
      onShowToast("Delete failed: " + e.message, "error");
    }
  }

  return (
    <div className="lists-home">
      <div className="lists-home-header">
        <h1 className="lists-home-title">Lists</h1>
        <div className="lists-home-actions">
          <button className="btn btn-ghost" onClick={() => onShop(null)}>
            🛒 Shopping
          </button>
          <button className="btn btn-ghost" onClick={onFromTMDB}>
            🎬 From TMDB
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New List
          </button>
        </div>
      </div>

      {lists.length === 0 ? (
        <div className="empty-state">
          <p>No lists yet. Create one to start tracking your collection against curated lists.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
            Create your first list
          </button>
        </div>
      ) : (() => {
        const collections = lists.filter((l) => l.source_ref?.startsWith("tmdb-collection:"));
        const others      = lists.filter((l) => !l.source_ref?.startsWith("tmdb-collection:"));
        const renderGrid  = (items) => (
          <div className="lists-grid">
            {items.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                onSelect={() => onSelect(list)}
                onShop={() => onShop(list)}
                onDelete={() => handleDelete(list.id, list.name)}
              />
            ))}
          </div>
        );
        return (
          <>
            {collections.length > 0 && (
              <div className="lists-section">
                <h2 className="lists-section-title">Franchise Collections</h2>
                {renderGrid(collections)}
              </div>
            )}
            {others.length > 0 && (
              <div className="lists-section">
                {collections.length > 0 && <h2 className="lists-section-title">Lists</h2>}
                {renderGrid(others)}
              </div>
            )}
          </>
        );
      })()}

      {showCreate && (
        <ListCreateModal
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
