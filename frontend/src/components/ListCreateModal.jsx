import { useState, useEffect } from "react";

export default function ListCreateModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listType, setListType] = useState("custom");
  const [sourceName, setSourceName] = useState("");
  const [nameError, setNameError] = useState(false);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleSave() {
    if (!name.trim()) { setNameError(true); return; }
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      list_type: listType,
      source_name: sourceName.trim() || null,
    });
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-compact">
        <div className="modal-header">
          <h2>New List</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-section">
            <div className="form-row">
              <div className={`form-field full${nameError ? " error" : ""}`}>
                <label>Name *</label>
                <input
                  type="text"
                  value={name}
                  autoFocus
                  onChange={(e) => { setName(e.target.value); setNameError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                />
                {nameError && <span className="field-error">Name is required</span>}
              </div>
            </div>
            <div className="form-row">
              <div className="form-field full">
                <label>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Type</label>
                <select value={listType} onChange={(e) => setListType(e.target.value)}>
                  <option value="custom">Custom</option>
                  <option value="external">External / Curated</option>
                </select>
              </div>
              <div className="form-field">
                <label>Source</label>
                <input
                  type="text"
                  placeholder="e.g. AFI, TMDB, Friends"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Create List</button>
        </div>
      </div>
    </div>
  );
}
