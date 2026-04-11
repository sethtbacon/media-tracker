import { useState, useEffect, useCallback } from "react";
import { getMedia, getStats, createMedia, updateMedia, deleteMedia } from "./api.js";
import StatsBar from "./components/StatsBar.jsx";
import FilterBar, { FILTER_DEFAULTS } from "./components/FilterBar.jsx";
import MediaTable from "./components/MediaTable.jsx";
import EditModal from "./components/EditModal.jsx";
import ImportPanel from "./components/ImportPanel.jsx";

const PAGE_SIZE = 200;

export default function App() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ ...FILTER_DEFAULTS });
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);

  // Modal state: null = new item, object = edit item, modalOpen controls visibility
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try { setStats(await getStats()); } catch (e) { console.error(e); }
  }, []);

  const fetchMedia = useCallback(async (currentFilters, currentSkip, append = false) => {
    setLoading(true);
    try {
      const params = { ...currentFilters, skip: currentSkip, limit: PAGE_SIZE };
      // Only send truthy boolean filters
      for (const k of Object.keys(params)) {
        if (params[k] === false || params[k] === "") delete params[k];
      }
      const data = await getMedia(params);
      setTotal(data.total);
      setItems((prev) => append ? [...prev, ...data.items] : data.items);
    } catch (e) {
      console.error("Failed to fetch media", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchMedia(filters, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSkip(0);
    fetchMedia(filters, 0);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoadMore() {
    const newSkip = skip + PAGE_SIZE;
    setSkip(newSkip);
    fetchMedia(filters, newSkip, true);
  }

  function openNew()        { setModalItem(null); setModalOpen(true); }
  function openEdit(item)   { setModalItem(item); setModalOpen(true); }
  function closeModal()     { setModalOpen(false); setModalItem(null); }

  async function handleSave(formData) {
    try {
      if (modalItem) {
        await updateMedia(modalItem.id, formData);
      } else {
        await createMedia(formData);
      }
      closeModal();
      setSkip(0);
      fetchMedia(filters, 0);
      fetchStats();
    } catch (e) {
      alert("Save failed: " + e.message);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteMedia(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => t - 1);
      fetchStats();
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }

  async function handleToggleWatched(id, watched) {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, watched } : i));
    try {
      await updateMedia(id, { watched });
    } catch (e) {
      // Revert on error
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, watched: !watched } : i));
      console.error("Failed to toggle watched", e);
    }
  }

  async function handleInlineRate(id, my_rating) {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, my_rating } : i));
    try {
      await updateMedia(id, { my_rating });
    } catch (e) {
      console.error("Failed to update rating", e);
    }
  }

  function handleImportDone() {
    setSkip(0);
    fetchMedia(filters, 0);
    fetchStats();
  }

  const hasMore = items.length < total;

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">🎬 Media Tracker</span>
        <div className="header-actions">
          <ImportPanel onImportDone={handleImportDone} filters={filters} />
          <button className="btn btn-primary" onClick={openNew}>
            + Add Item
          </button>
        </div>
      </header>

      <StatsBar stats={stats} />

      <FilterBar filters={filters} onChange={setFilters} />

      <MediaTable
        items={items}
        onEdit={openEdit}
        onDelete={handleDelete}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        onToggleWatched={handleToggleWatched}
        onInlineRate={handleInlineRate}
      />

      {modalOpen && (
        <EditModal
          item={modalItem}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
