import { useState } from "react";
import { createList, deleteList } from "../api.js";
import ListCard from "./ListCard.jsx";
import CollectionCard from "./CollectionCard.jsx";
import ListCreateModal from "./ListCreateModal.jsx";

export default function ListsHome({ lists, onSelect, onShop, onFromTMDB, onRefetch, onShowToast }) {
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState("lists");

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

  const collections = lists.filter((l) =>  l.source_ref?.startsWith("tmdb-collection:"));
  const regularLists = lists.filter((l) => !l.source_ref?.startsWith("tmdb-collection:"));

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

      <div className="lists-tab-bar">
        <button
          className={`lists-tab${tab === "lists" ? " active" : ""}`}
          onClick={() => setTab("lists")}
        >
          Lists {regularLists.length > 0 && <span className="lists-tab-count">{regularLists.length}</span>}
        </button>
        <button
          className={`lists-tab${tab === "collections" ? " active" : ""}`}
          onClick={() => setTab("collections")}
        >
          Collections {collections.length > 0 && <span className="lists-tab-count">{collections.length}</span>}
        </button>
      </div>

      {tab === "lists" && (
        regularLists.length === 0 ? (
          <div className="empty-state">
            <p>No lists yet. Create one or import from TMDB to start tracking.</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowCreate(true)}>
              Create your first list
            </button>
          </div>
        ) : (
          <div className="lists-grid">
            {regularLists.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                onSelect={() => onSelect(list)}
                onShop={() => onShop(list)}
                onDelete={() => handleDelete(list.id, list.name)}
              />
            ))}
          </div>
        )
      )}

      {tab === "collections" && (
        collections.length === 0 ? (
          <div className="empty-state">
            <p>No franchise collections yet. Go to Settings → Collection Lists and click <strong>Scan for Collections</strong>.</p>
          </div>
        ) : (
          <div className="collections-grid">
            {collections.map((list) => (
              <CollectionCard
                key={list.id}
                list={list}
                onSelect={() => onSelect(list)}
                onDelete={() => handleDelete(list.id, list.name)}
              />
            ))}
          </div>
        )
      )}

      {showCreate && (
        <ListCreateModal
          onSave={handleCreate}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
