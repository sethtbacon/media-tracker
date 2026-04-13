import { useState, useEffect } from "react";
import { getTMDBSources, previewTMDBList, importFromTMDB } from "../api.js";

export default function ListTMDBPicker({ list, onBack, onImportDone, onShowToast }) {
  const [step, setStep] = useState("catalog"); // "catalog" | "preview"
  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pageLimit, setPageLimit] = useState(5);
  const [importMode, setImportMode] = useState("overwrite");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const hasItems = list.total > 0;

  useEffect(() => {
    getTMDBSources()
      .then(setSources)
      .catch((e) => setSourcesError(e.message))
      .finally(() => setSourcesLoading(false));
  }, []);

  async function handleSelect(source) {
    setSelected(source);
    setPreviewLoading(true);
    setStep("preview");
    try {
      const data = await previewTMDBList(source.id);
      setPreview(data);
    } catch (e) {
      onShowToast("Preview failed: " + e.message, "error");
      setStep("catalog");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const data = await importFromTMDB(list.id, {
        tmdb_list_id: selected.id,
        page_limit: pageLimit,
        mode: importMode,
      });
      setResult(data);
      onImportDone?.(data);
    } catch (e) {
      onShowToast("Import failed: " + e.message, "error");
    } finally {
      setImporting(false);
    }
  }

  if (result) {
    return (
      <div className="list-import">
        <div className="list-import-header">
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <h2 className="list-import-title">Import Complete</h2>
        </div>
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
          <div className="modal-footer" style={{ marginTop: 24, padding: 0 }}>
            <button className="btn btn-primary" onClick={() => onImportDone?.(result)}>View List</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="list-import">
      <div className="list-import-header">
        <button
          className="btn btn-ghost"
          onClick={() => { if (step === "preview") { setStep("catalog"); setPreview(null); } else onBack(); }}
        >
          ← Back
        </button>
        <h2 className="list-import-title">
          {step === "catalog" ? "Browse TMDB Lists" : `Preview: ${selected?.name}`}
        </h2>
      </div>

      {step === "catalog" && (
        <>
          {sourcesLoading && <div className="empty-state"><p>Loading…</p></div>}
          {sourcesError && (
            <div className="empty-state">
              <p style={{ color: "var(--danger)" }}>
                {sourcesError.includes("TMDB API key")
                  ? "TMDB API key not configured. Add it in Settings."
                  : `Error: ${sourcesError}`}
              </p>
            </div>
          )}
          {!sourcesLoading && !sourcesError && (
            <div className="tmdb-catalog">
              {sources.map((source) => (
                <button
                  key={source.id}
                  className="tmdb-catalog-card"
                  onClick={() => handleSelect(source)}
                >
                  <span className="tmdb-catalog-name">{source.name}</span>
                  <span className="tmdb-catalog-type">{source.media_type}</span>
                  <span className="tmdb-catalog-arrow">→</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === "preview" && (
        <div className="tmdb-preview">
          {previewLoading && <div className="empty-state"><p>Loading preview…</p></div>}
          {!previewLoading && preview && (
            <>
              <p className="tmdb-preview-total">
                {preview.total_results} titles available
              </p>

              <div className="tmdb-preview-list">
                {preview.items.map((item, i) => (
                  <div key={i} className="tmdb-preview-item">
                    <span className="tmdb-preview-rank">{i + 1}</span>
                    <span className="tmdb-preview-title">{item.title}</span>
                    {item.year && <span className="tmdb-preview-year">{item.year}</span>}
                  </div>
                ))}
                {preview.total_results > preview.items.length && (
                  <div className="tmdb-preview-more">
                    + {preview.total_results - preview.items.length} more…
                  </div>
                )}
              </div>

              <div className="form-section" style={{ marginTop: 24 }}>
                <div className="form-field full">
                  <label>Pages to import</label>
                  <select value={pageLimit} onChange={(e) => setPageLimit(Number(e.target.value))}>
                    <option value={1}>1 page (~20 items)</option>
                    <option value={5}>5 pages (~100 items)</option>
                    <option value={10}>10 pages (~200 items)</option>
                  </select>
                </div>

                {hasItems && (
                  <div className="form-field full">
                    <label>Import Mode</label>
                    <div className="import-mode-options">
                      <label className="import-mode-option">
                        <input
                          type="radio"
                          name="tmdbImportMode"
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
                          name="tmdbImportMode"
                          value="archive"
                          checked={importMode === "archive"}
                          onChange={() => setImportMode("archive")}
                        />
                        <div>
                          <strong>Archive &amp; Replace</strong>
                          <span className="field-hint">Save current as "{list.name} (pulled today)"</span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: 0, marginTop: 24 }}>
                <button className="btn btn-ghost" onClick={() => { setStep("catalog"); setPreview(null); }}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                  {importing ? "Importing…" : `Import ${pageLimit === 1 ? "~20" : pageLimit === 5 ? "~100" : "~200"} items`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
