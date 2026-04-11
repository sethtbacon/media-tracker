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

  // Modal state: null = closed, undefined = new item, object = edit item
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
    } catch (e) {
      console.error("Failed to fetch stats", e);
    }
  }, []);

  const fetchMedia = useCallback(async (currentFilters, currentSkip, append = false) => {
    setLoading(true);
    try {
      const params = {
        ...currentFilters,
        skip: currentSkip,
        limit: PAGE_SIZE,
      };
      // Convert boolean toggle filters: only send if true
      const boolKeys = [
        "physical_4k", "physical_bluray", "physical_dvd",
        "digital_apple_tv", "digital_plex", "digital_movies_anywhere", "loaned",
      ];
      for (const k of boolKeys) {
        if (!params[k]) delete params[k];
      }
      // Remove empty strings
      for (const k of Object.keys(params)) {
        if (params[k] === "" || params[k] === false) delete params[k];
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

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchMedia(filters, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when filters change
  useEffect(() => {
    setSkip(0);
    fetchMedia(filters, 0);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoadMore() {
    const newSkip = skip + PAGE_SIZE;
    setSkip(newSkip);
    fetchMedia(filters, newSkip, true);
  }

  function openNew() {
    setModalItem(null);
    setModalOpen(true);
  }

  function openEdit(item) {
    setModalItem(item);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setModalItem(null);
  }

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
          <ImportPanel onImportDone={handleImportDone} />
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
