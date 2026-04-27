import { useState, useRef } from "react";
import { importListCSV, addListItem } from "../api.js";

export default function ListImport({ list, onBack, onImportDone, onManualAdded, onShowToast, onTMDB }) {
  const [mode, setMode] = useState("picker"); // "picker" | "csv" | "manual"

  return (
    <div className="list-import">
      <div className="list-import-header">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h2 className="list-import-title">Import to "{list.name}"</h2>
      </div>

      {mode === "picker" && (
        <ImportPicker
          list={list}
          onCSV={() => setMode("csv")}
          onTMDB={onTMDB}
          onManual={() => setMode("manual")}
        />
      )}
      {mode === "csv" && (
        <CSVImport
          list={list}
          onBack={() => setMode("picker")}
          onDone={onImportDone}
          onShowToast={onShowToast}
        />
      )}
      {mode === "manual" && (
        <ManualAdd
          list={list}
          onBack={() => setMode("picker")}
          onDone={onManualAdded}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}

function ImportPicker({ list, onCSV, onTMDB, onManual }) {
  return (
    <div className="import-picker">
      <div className="import-picker-grid">
        <button className="import-picker-card" onClick={onCSV}>
          <span className="import-picker-icon">📄</span>
          <span className="import-picker-label">CSV Upload</span>
          <span className="import-picker-desc">Import from a spreadsheet or exported list</span>
        </button>
        <button className="import-picker-card" onClick={onTMDB}>
          <span className="import-picker-icon">🎬</span>
          <span className="import-picker-label">TMDB</span>
          <span className="import-picker-desc">Top rated, popular, or now-playing lists</span>
        </button>
        <button className="import-picker-card" onClick={onManual}>
          <span className="import-picker-icon">✏️</span>
          <span className="import-picker-label">Add Manually</span>
          <span className="import-picker-desc">Add a single item by title</span>
        </button>
      </div>
    </div>
  );
}

function CSVImport({ list, onBack, onDone, onShowToast }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [importMode, setImportMode] = useState("overwrite");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const hasItems = list.total > 0;

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    try {
      const data = await importListCSV(list.id, file, importMode);
      setResult(data);
      onShowToast(`Imported ${data.imported} items, ${data.matched} matched`, "success");
    } catch (e) {
      onShowToast("Import failed: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="import-result">
        <div className="import-result-stats">
          <div className="import-result-stat">
            <span className="import-result-num">{result.imported}</span>
            <span className="import-result-label">Imported</span>
          </div>
          <div className="import-result-stat">
            <span className="import-result-num">{result.matched}</span>
            <span className="import-result-label">Matched to library</span>
          </div>
          <div className="import-result-stat">
            <span className="import-result-num">{result.unmatched}</span>
            <span className="import-result-label">Not yet owned</span>
          </div>
        </div>
        {result.errors?.length > 0 && (
          <div className="import-result-errors">
            <p>{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} skipped:</p>
            <ul>
              {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
            </ul>
          </div>
        )}
        <div className="modal-footer" style={{ marginTop: 24, padding: 0 }}>
          <button className="btn btn-primary" onClick={() => onDone(result)}>View List</button>
        </div>
      </div>
    );
  }

  return (
    <div className="csv-import-form">
      <div className="form-section">
        <div className="form-field full">
          <label>CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
          <div className="file-pick-row">
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Choose File
            </button>
            <span className="file-pick-name">
              {file ? file.name : "No file selected"}
            </span>
          </div>
          <p className="field-hint">
            Columns: Rank, Title, Year, IMDB_ID, TMDB_ID, Notes (all optional except Title)
          </p>
        </div>

        {hasItems && (
          <div className="form-field full">
            <label>Import Mode</label>
            <div className="import-mode-options">
              <label className="import-mode-option">
                <input
                  type="radio"
                  name="importMode"
                  value="overwrite"
                  checked={importMode === "overwrite"}
                  onChange={() => setImportMode("overwrite")}
                />
                <div>
                  <strong>Overwrite</strong>
                  <span className="field-hint">Replace all {list.total} existing items</span>
                </div>
              </label>
              <label className="import-mode-option">
                <input
                  type="radio"
                  name="importMode"
                  value="archive"
                  checked={importMode === "archive"}
                  onChange={() => setImportMode("archive")}
                />
                <div>
                  <strong>Archive &amp; Replace</strong>
                  <span className="field-hint">Save current as "{list.name} (pulled today)", create fresh list</span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={!file || loading}
        >
          {loading ? "Importing…" : "Import"}
        </button>
      </div>
    </div>
  );
}

function ManualAdd({ list, onBack, onDone, onShowToast }) {
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [imdbId, setImdbId] = useState("");
  const [rank, setRank] = useState("");
  const [titleError, setTitleError] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) { setTitleError(true); return; }
    setSaving(true);
    try {
      await addListItem(list.id, {
        title: title.trim(),
        year: year ? parseInt(year, 10) : null,
        imdb_id: imdbId.trim() || null,
        rank: rank ? parseInt(rank, 10) : null,
      });
      onShowToast("Item added", "success");
      onDone();
    } catch (e) {
      onShowToast("Failed to add item: " + e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="manual-add-form">
      <div className="form-section">
        <div className="form-row">
          <div className={`form-field full${titleError ? " error" : ""}`}>
            <label>Title *</label>
            <input
              type="text"
              value={title}
              autoFocus
              onChange={(e) => { setTitle(e.target.value); setTitleError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            {titleError && <span className="field-error">Title is required</span>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 1994"
            />
          </div>
          <div className="form-field">
            <label>Rank</label>
            <input
              type="number"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field full">
            <label>IMDB ID</label>
            <input
              type="text"
              value={imdbId}
              onChange={(e) => setImdbId(e.target.value)}
              placeholder="e.g. tt0111161"
            />
          </div>
        </div>
      </div>
      <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Adding…" : "Add Item"}
        </button>
      </div>
    </div>
  );
}
