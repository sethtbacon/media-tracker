import { useState, useEffect } from "react";
import { createMedia, rematchList } from "../api.js";

const FORMAT_OPTIONS = [
  { key: "physical_4k",        label: "4K" },
  { key: "physical_bluray",    label: "Blu-ray" },
  { key: "physical_dvd",       label: "DVD" },
  { key: "digital_apple_tv",   label: "Apple TV" },
  { key: "digital_plex",       label: "Plex" },
];

const LOCATION_OPTIONS = [
  { value: "",                label: "—" },
  { value: "home",            label: "Home" },
  { value: "van",             label: "Van" },
  { value: "second location", label: "Second Location" },
];

export default function QuickAddModal({ item, listId, onSave, onClose, onShowToast }) {
  const [formats, setFormats] = useState({
    physical_4k: false,
    physical_bluray: false,
    physical_dvd: false,
    digital_apple_tv: false,
    digital_plex: false,
  });
  const [location, setLocation] = useState("");
  const [physicalNotes, setPhysicalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formatError, setFormatError] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggleFormat(key) {
    setFormats((prev) => ({ ...prev, [key]: !prev[key] }));
    setFormatError(false);
  }

  async function handleSave() {
    const anyFormat = Object.values(formats).some(Boolean);
    if (!anyFormat) { setFormatError(true); return; }

    setSaving(true);
    try {
      await createMedia({
        title: item.title,
        year: item.year ?? null,
        imdb_id: item.imdb_id ?? null,
        tmdb_id: item.tmdb_id ?? null,
        media_type: item.media_type ?? "Movie",
        ...formats,
        location: location || null,
        physical_notes: physicalNotes.trim() || null,
        watched: false,
      });
      if (listId != null) {
        await rematchList(listId);
      }
      onShowToast?.("Added to your collection ✓", "success");
      onSave();
    } catch (e) {
      onShowToast?.("Failed to add item: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-compact">
        <div className="modal-header">
          <h2>I Found It!</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="quick-add-item-info">
            <span className="quick-add-title">{item.title}</span>
            {item.year && <span className="quick-add-year">{item.year}</span>}
          </div>

          <div className="form-section">
            <div className="form-field full">
              <label>Format {formatError && <span className="field-error" style={{ marginLeft: 8 }}>Select at least one</span>}</label>
              <div className="quick-add-formats">
                {FORMAT_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    className={`format-toggle${formats[key] ? " active" : ""}${formatError ? " error" : ""}`}
                    onClick={() => toggleFormat(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Location</label>
                <select value={location} onChange={(e) => setLocation(e.target.value)}>
                  {LOCATION_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Steelbook"
                  value={physicalNotes}
                  onChange={(e) => setPhysicalNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Adding…" : "Add to Collection"}
          </button>
        </div>
      </div>
    </div>
  );
}
