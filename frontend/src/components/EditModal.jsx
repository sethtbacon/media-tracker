import { useState, useEffect, useRef } from "react";
import { lookupMetadata, getMedia, getSettings } from "../api.js";

const EMPTY = {
  title: "",
  media_type: "Movie",
  year: "",
  director: "",
  genre: "",
  runtime: "",
  mpaa_rating: "",
  imdb_id: "",
  tmdb_id: "",
  plot: "",
  cover_url: "",
  physical_bluray: false,
  physical_dvd: false,
  physical_4k: false,
  physical_notes: "",
  digital_apple_tv: false,
  digital_plex: false,
  location: "",
  loaned_to: "",
  watched_parent1: false,
  watched_parent2: false,
  watched_kids: false,
  not_interested: false,
  parent1_rating: "",
  parent2_rating: "",
  kids_rating: "",
  notes: "",
};

function toFormState(item) {
  if (!item) return { ...EMPTY };
  return {
    ...item,
    year: item.year ?? "",
    runtime: item.runtime ?? "",
    parent1_rating: item.parent1_rating ?? "",
    parent2_rating: item.parent2_rating ?? "",
    kids_rating: item.kids_rating ?? "",
    physical_notes: item.physical_notes ?? "",
    location: item.location ?? "",
    loaned_to: item.loaned_to ?? "",
    notes: item.notes ?? "",
    director: item.director ?? "",
    genre: item.genre ?? "",
    mpaa_rating: item.mpaa_rating ?? "",
    imdb_id: item.imdb_id ?? "",
    tmdb_id: item.tmdb_id ?? "",
    plot: item.plot ?? "",
    cover_url: item.cover_url ?? "",
    watched_parent1: item.watched_parent1 ?? false,
    watched_parent2: item.watched_parent2 ?? false,
    watched_kids: item.watched_kids ?? false,
    not_interested: item.not_interested ?? false,
  };
}

export default function EditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => toFormState(item));
  const [titleError, setTitleError] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [ratingNames, setRatingNames] = useState({ p1: "Parent 1", p2: "Parent 2", kids: "Kids", kidsCount: 0 });
  const dupDebounce = useRef(null);

  // Load household member names from settings
  useEffect(() => {
    getSettings().then((settings) => {
      const get = (key, def) => settings.find((s) => s.key === key)?.value || def;
      setRatingNames({
        p1: get("person_name_parent1", "Parent 1"),
        p2: get("person_name_parent2", "Parent 2"),
        kids: "Kids",
        kidsCount: parseInt(get("kids_count", "0"), 10),
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setForm(toFormState(item));
    setTitleError(false);
    setDuplicates([]);
    setFetchError(null);
  }, [item]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "title") setTitleError(false);
  }

  // Duplicate check on title blur (only for new items)
  function handleTitleBlur(e) {
    const title = e.target.value.trim();
    if (!title || item) { setDuplicates([]); return; }
    clearTimeout(dupDebounce.current);
    dupDebounce.current = setTimeout(async () => {
      try {
        const data = await getMedia({ search: title, limit: 5 });
        const matches = data.items.filter(
          (i) => i.title.toLowerCase() === title.toLowerCase()
        );
        setDuplicates(matches);
      } catch { /* ignore */ }
    }, 300);
  }

  async function handleFetchMetadata() {
    const title = form.title.trim();
    if (!title) return;
    setFetching(true);
    setFetchError(null);
    try {
      const meta = await lookupMetadata(title, form.year || undefined);
      setForm((f) => ({
        ...f,
        director:    meta.director    ?? f.director,
        genre:       meta.genre       ?? f.genre,
        runtime:     meta.runtime     != null ? String(meta.runtime) : f.runtime,
        mpaa_rating: meta.mpaa_rating ?? f.mpaa_rating,
        plot:        meta.plot        ?? f.plot,
        cover_url:   meta.cover_url   ?? f.cover_url,
        imdb_id:     meta.imdb_id     ?? f.imdb_id,
        year:        meta.year        != null && !f.year ? String(meta.year) : f.year,
      }));
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetching(false);
    }
  }

  function handleSubmit() {
    if (!form.title.trim()) { setTitleError(true); return; }
    const payload = {
      ...form,
      year:           form.year           !== "" ? parseInt(form.year)            || null : null,
      runtime:        form.runtime        !== "" ? parseInt(form.runtime)         || null : null,
      parent1_rating: form.parent1_rating !== "" ? parseFloat(form.parent1_rating) || null : null,
      parent2_rating: form.parent2_rating !== "" ? parseFloat(form.parent2_rating) || null : null,
      kids_rating:    form.kids_rating    !== "" ? parseFloat(form.kids_rating)    || null : null,
      watched:        !!(form.watched_parent1 || form.watched_parent2 || form.watched_kids),
      physical_notes: form.physical_notes || null,
      location:       form.location       || null,
      loaned_to:      form.loaned_to      || null,
      notes:          form.notes          || null,
      director:       form.director       || null,
      genre:          form.genre          || null,
      mpaa_rating:    form.mpaa_rating    || null,
      imdb_id:        form.imdb_id        || null,
      tmdb_id:        form.tmdb_id        || null,
      plot:           form.plot           || null,
      cover_url:      form.cover_url      || null,
    };
    onSave(payload);
  }

  const isEdit = item !== null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{isEdit ? "Edit Item" : "Add New Item"}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Core */}
          <div className="form-section">
            <div className="form-section-title">Core</div>

            <div className="form-row" style={{ alignItems: "flex-end" }}>
              <div className={`form-field${titleError ? " error" : ""}`} style={{ flex: 1 }}>
                <label>Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  onBlur={handleTitleBlur}
                  autoFocus
                />
                {titleError && <span className="field-error">Title is required</span>}
              </div>
              <button
                className="btn btn-ghost fetch-meta-btn"
                type="button"
                disabled={!form.title.trim() || fetching}
                onClick={handleFetchMetadata}
                title="Auto-fill metadata from OMDB"
                style={{ flexShrink: 0 }}
              >
                {fetching ? "Fetching…" : "🔍 Fetch Metadata"}
              </button>
            </div>

            {fetchError && (
              <div className="fetch-error">{fetchError}</div>
            )}

            {duplicates.length > 0 && (
              <div className="duplicate-warning">
                ⚠ Already in collection:{" "}
                {duplicates.map((d) => `${d.title}${d.year ? ` (${d.year})` : ""}`).join(", ")}
              </div>
            )}

            <div className="form-row">
              <div className="form-field">
                <label>Type</label>
                <select value={form.media_type} onChange={(e) => set("media_type", e.target.value)}>
                  <option value="Movie">Movie</option>
                  <option value="TV Series">TV Series</option>
                </select>
              </div>
              <div className="form-field">
                <label>Year</label>
                <input type="number" min="1888" max="2099" value={form.year} onChange={(e) => set("year", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Director</label>
                <input type="text" value={form.director} onChange={(e) => set("director", e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Genre</label>
                <input type="text" placeholder="e.g. Comedy, Drama" value={form.genre} onChange={(e) => set("genre", e.target.value)} />
              </div>
              <div className="form-field">
                <label>Runtime (min)</label>
                <input type="number" min="0" value={form.runtime} onChange={(e) => set("runtime", e.target.value)} />
              </div>
              <div className="form-field">
                <label>MPAA Rating</label>
                <select value={form.mpaa_rating} onChange={(e) => set("mpaa_rating", e.target.value)}>
                  <option value="">—</option>
                  <option value="G">G</option>
                  <option value="PG">PG</option>
                  <option value="PG-13">PG-13</option>
                  <option value="R">R</option>
                  <option value="NC-17">NC-17</option>
                  <option value="Not Rated">Not Rated</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>IMDB ID</label>
                <input type="text" value={form.imdb_id} onChange={(e) => set("imdb_id", e.target.value)} />
              </div>
              <div className="form-field">
                <label>TMDB ID</label>
                <input type="text" value={form.tmdb_id} onChange={(e) => set("tmdb_id", e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field full">
                <label>Cover URL</label>
                <input type="url" placeholder="https://…" value={form.cover_url} onChange={(e) => set("cover_url", e.target.value)} />
              </div>
            </div>

            {form.cover_url && (
              <div className="cover-preview">
                <img
                  src={form.cover_url}
                  alt="Cover preview"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-field full">
                <label>Plot</label>
                <textarea value={form.plot} onChange={(e) => set("plot", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Physical */}
          <div className="form-section">
            <div className="form-section-title">Physical</div>
            <div className="checkbox-group">
              {[
                { key: "physical_4k",     label: "4K Ultra HD" },
                { key: "physical_bluray", label: "Blu-ray" },
                { key: "physical_dvd",    label: "DVD" },
              ].map(({ key, label }) => (
                <label key={key} className="checkbox-item">
                  <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="form-row">
              <div className="form-field full">
                <label>Physical Notes</label>
                <input type="text" placeholder="e.g. Blu-ray+DVD combo, Collector's Edition" value={form.physical_notes} onChange={(e) => set("physical_notes", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Digital */}
          <div className="form-section">
            <div className="form-section-title">Digital</div>
            <div className="checkbox-group">
              {[
                { key: "digital_apple_tv",        label: "Apple TV" },
                { key: "digital_plex",            label: "Plex" },
              ].map(({ key, label }) => (
                <label key={key} className="checkbox-item">
                  <input type="checkbox" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Location & Loans */}
          <div className="form-section">
            <div className="form-section-title">Location &amp; Loans</div>
            <div className="form-row">
              <div className="form-field">
                <label>Location</label>
                <select value={form.location} onChange={(e) => set("location", e.target.value)}>
                  <option value="">—</option>
                  <option value="home">Home</option>
                  <option value="van">Van</option>
                  <option value="second location">Second Location</option>
                </select>
              </div>
              <div className="form-field">
                <label>Loaned To</label>
                <input type="text" value={form.loaned_to} onChange={(e) => set("loaned_to", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Personal */}
          <div className="form-section">
            <div className="form-section-title">Personal</div>
            <div className="form-section-title" style={{ fontSize: 11, marginBottom: 6 }}>Watched</div>
            <div className="checkbox-group">
              <label className="checkbox-item">
                <input type="checkbox" checked={form.watched_parent1} onChange={(e) => set("watched_parent1", e.target.checked)} />
                {ratingNames.p1}
              </label>
              <label className="checkbox-item">
                <input type="checkbox" checked={form.watched_parent2} onChange={(e) => set("watched_parent2", e.target.checked)} />
                {ratingNames.p2}
              </label>
              {ratingNames.kidsCount > 0 && (
                <label className="checkbox-item">
                  <input type="checkbox" checked={form.watched_kids} onChange={(e) => set("watched_kids", e.target.checked)} />
                  Kids
                </label>
              )}
            </div>
            <div className="form-row" style={{ alignItems: "center", marginTop: 6 }}>
              <label className="checkbox-item">
                <input type="checkbox" checked={form.not_interested} onChange={(e) => set("not_interested", e.target.checked)} />
                Not Interested
              </label>
            </div>
            <div className="form-section-title" style={{ fontSize: 11, marginTop: 10, marginBottom: 6 }}>Ratings (0–10)</div>
            <div className="form-row">
              <div className="form-field" style={{ maxWidth: 130 }}>
                <label>{ratingNames.p1}</label>
                <input type="number" min="0" max="10" step="0.1" value={form.parent1_rating} onChange={(e) => set("parent1_rating", e.target.value)} />
              </div>
              <div className="form-field" style={{ maxWidth: 130 }}>
                <label>{ratingNames.p2}</label>
                <input type="number" min="0" max="10" step="0.1" value={form.parent2_rating} onChange={(e) => set("parent2_rating", e.target.value)} />
              </div>
              {ratingNames.kidsCount > 0 && (
                <div className="form-field" style={{ maxWidth: 130 }}>
                  <label>Kids</label>
                  <input type="number" min="0" max="10" step="0.1" value={form.kids_rating} onChange={(e) => set("kids_rating", e.target.value)} />
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-field full">
                <label>Notes</label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
