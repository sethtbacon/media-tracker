import { useState, useEffect, useCallback, useRef } from "react";
import { getMedia, getStats, createMedia, updateMedia, deleteMedia, getMediaById, getSettings } from "./api.js";
import StatsBar from "./components/StatsBar.jsx";
import FilterBar, { FILTER_DEFAULTS } from "./components/FilterBar.jsx";
import MediaTable from "./components/MediaTable.jsx";
import EditModal from "./components/EditModal.jsx";
import MediaDetailModal from "./components/MediaDetailModal.jsx";
import ImportPanel from "./components/ImportPanel.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import PosterGrid from "./components/PosterGrid.jsx";
import MovieNightPage from "./components/MovieNightPage.jsx";
import ListsPage from "./components/ListsPage.jsx";

const PAGE_SIZE = 200;

export default function App() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({ ...FILTER_DEFAULTS });
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [personNames, setPersonNames] = useState({ p1: "Parent 1", p2: "Parent 2", kidsCount: 0 });

  // Edit modal state: null = new item, object = edit item
  const [modalItem, setModalItem] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Detail modal state
  const [detailItem, setDetailItem] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // When edit is opened from detail, store the id so we can re-open detail after save
  const editFromDetailId = useRef(null);
  const [displayMode, setDisplayMode] = useState("posters"); // "table" | "posters"

  // Check URL for ?session= param to auto-navigate to Movie Night
  const urlSession = new URLSearchParams(window.location.search).get("session");
  const [view, setView] = useState(urlSession ? "movie-night" : "library"); // "library" | "settings" | "movie-night" | "lists"

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
    getSettings().then((settings) => {
      const get = (key, def) => settings.find((s) => s.key === key)?.value ?? def;
      setPersonNames({
        p1: get("person_name_parent1", "Parent 1"),
        p2: get("person_name_parent2", "Parent 2"),
        kidsCount: parseInt(get("kids_count", "0"), 10),
      });
    }).catch(() => {});
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

  function openNew()          { setModalItem(null); setModalOpen(true); }
  function openEdit(item)     { setModalItem(item); setModalOpen(true); }
  function closeModal()       { setModalOpen(false); setModalItem(null); }
  function openDetail(item)   { setDetailItem(item); setDetailOpen(true); }
  function closeDetail()      { setDetailOpen(false); setDetailItem(null); }
  function openEditFromDetail() {
    editFromDetailId.current = detailItem?.id ?? null;
    setDetailOpen(false);
    setModalItem(detailItem);
    setModalOpen(true);
  }

  async function handleSave(formData) {
    try {
      const savedId = modalItem?.id;
      if (modalItem) {
        await updateMedia(modalItem.id, formData);
      } else {
        await createMedia(formData);
      }
      closeModal();
      setSkip(0);
      fetchMedia(filters, 0);
      fetchStats();
      if (editFromDetailId.current && savedId) {
        const refreshed = await getMediaById(savedId);
        openDetail(refreshed);
        editFromDetailId.current = null;
      }
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

  async function handleSaveField(id, field, value) {
    setDetailItem((prev) => prev?.id === id ? { ...prev, [field]: value } : prev);
    setItems((prev) => prev.map((i) => i.id !== id ? i : { ...i, [field]: value }));
    try {
      await updateMedia(id, { [field]: value });
    } catch (e) {
      console.error("Failed to save field", field, e);
    }
  }

  function applyWatchedUpdate(item, field, value) {
    const updated = { ...item, [field]: value };
    updated.watched = !!(updated.watched_parent1 || updated.watched_parent2 || updated.watched_kids);
    return updated;
  }

  async function handleToggleWatchedPerson(id, field, value) {
    setItems((prev) => prev.map((i) => i.id !== id ? i : applyWatchedUpdate(i, field, value)));
    setDetailItem((prev) => prev?.id === id ? applyWatchedUpdate(prev, field, value) : prev);
    try {
      await updateMedia(id, { [field]: value });
    } catch (e) {
      setItems((prev) => prev.map((i) => i.id !== id ? i : applyWatchedUpdate(i, field, !value)));
      setDetailItem((prev) => prev?.id === id ? applyWatchedUpdate(prev, field, !value) : prev);
      console.error("Failed to toggle watched", e);
    }
  }

  async function handleOpenInLibrary(id) {
    try {
      const item = await getMediaById(id);
      setView("library");
      openDetail(item);
    } catch (e) {
      console.error("Failed to open item in library", e);
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
        <span className="header-title">🎬 <span className="header-title-text">Media Tracker</span></span>
        <nav className="header-nav">
          <button
            className={`nav-btn${view === "library" ? " active" : ""}`}
            onClick={() => setView("library")}
          >
            Library
          </button>
          <button
            className={`nav-btn${view === "settings" ? " active" : ""}`}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
          <button
            className={`nav-btn${view === "movie-night" ? " active" : ""}`}
            onClick={() => setView("movie-night")}
          >
            Movie Night
          </button>
          <button
            className={`nav-btn${view === "lists" ? " active" : ""}`}
            onClick={() => setView("lists")}
          >
            Lists
          </button>
        </nav>
        <div className="header-actions">
          {view === "library" && (
            <>
              <ImportPanel onImportDone={handleImportDone} filters={filters} />
              <button className="btn btn-primary" onClick={openNew}>
                + Add Item
              </button>
            </>
          )}
        </div>
      </header>

      {view === "library" && (
        <>
          <StatsBar stats={stats} filters={filters} onToggleFilter={setFilters} />
          <FilterBar
            filters={filters}
            onChange={setFilters}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
          />
          {displayMode === "table" ? (
            <MediaTable
              items={items}
              onDetail={openDetail}
              onEdit={openEdit}
              onDelete={handleDelete}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              onToggleWatchedPerson={handleToggleWatchedPerson}
              personNames={personNames}
            />
          ) : (
            <PosterGrid
              items={items}
              onDetail={openDetail}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
            />
          )}
        </>
      )}

      {view === "settings" && <SettingsPage />}

      {view === "movie-night" && <MovieNightPage initialSessionCode={urlSession} onOpenInLibrary={handleOpenInLibrary} />}

      {view === "lists" && <ListsPage onOpenInLibrary={handleOpenInLibrary} />}

      {detailOpen && detailItem && (
        <MediaDetailModal
          item={detailItem}
          personNames={personNames}
          onEdit={openEditFromDetail}
          onDelete={handleDelete}
          onClose={closeDetail}
          onToggleWatchedPerson={handleToggleWatchedPerson}
          onSaveField={handleSaveField}
        />
      )}

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
