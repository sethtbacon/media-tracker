import { useRef, useState } from "react";
import { importCSV, exportCSV } from "../api.js";

export default function ImportPanel({ onImportDone }) {
  const fileRef = useRef(null);
  const [replaceAll, setReplaceAll] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await importCSV(file, replaceAll);
      setResult(res);
      onImportDone();
    } catch (err) {
      setError(err.message || "Import failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="import-panel">
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <label className="replace-label">
        <input
          type="checkbox"
          checked={replaceAll}
          onChange={(e) => setReplaceAll(e.target.checked)}
        />
        Replace all
      </label>

      <button
        className="btn btn-ghost"
        disabled={loading}
        onClick={() => fileRef.current?.click()}
      >
        {loading ? "Importing…" : "Import CSV"}
      </button>

      <button className="btn btn-ghost" onClick={exportCSV}>
        Export CSV
      </button>

      {result && (
        <span className="import-result">
          Imported {result.imported} · Skipped {result.skipped}
          {result.errors.length > 0 && ` · ${result.errors.length} errors`}
        </span>
      )}

      {error && <span className="import-error">{error}</span>}
    </div>
  );
}
