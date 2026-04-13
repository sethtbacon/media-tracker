import { useState, useEffect } from "react";
import { getSettings, updateSetting, fetchMetadataStatus, fetchMissingMetadata } from "../api.js";

export default function SettingsPage() {
  const [omdbKey, setOmdbKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState(null);
  const [keySaving, setKeySaving] = useState(false);

  const [tmdbKey, setTmdbKey] = useState("");
  const [showTmdbKey, setShowTmdbKey] = useState(false);
  const [tmdbKeyStatus, setTmdbKeyStatus] = useState(null);
  const [tmdbKeySaving, setTmdbKeySaving] = useState(false);

  const [missingCount, setMissingCount] = useState(null);
  const [fetchRunning, setFetchRunning] = useState(false);
  const [fetchTotals, setFetchTotals] = useState({ updated: 0, not_found: 0, failed: 0 });
  const [fetchDone, setFetchDone] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Household members
  const [p1Name, setP1Name] = useState("Parent 1");
  const [p2Name, setP2Name] = useState("Parent 2");
  const [kidsCount, setKidsCount] = useState(0);
  const [kidNames, setKidNames] = useState(["Kid 1","Kid 2","Kid 3","Kid 4","Kid 5","Kid 6"]);
  const [memberStatus, setMemberStatus] = useState(null);
  const [memberSaving, setMemberSaving] = useState(false);

  // Movie Night defaults
  const [mnSize, setMnSize] = useState("18");
  const [mnDays, setMnDays] = useState("30");
  const [mnFormat, setMnFormat] = useState("both");
  const [mnStatus, setMnStatus] = useState(null);
  const [mnSaving, setMnSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const get = (key, def) => settings.find((s) => s.key === key)?.value ?? def;
        if (get("omdb_api_key", "")) setOmdbKey(get("omdb_api_key", ""));
        if (get("tmdb_api_key", "")) setTmdbKey(get("tmdb_api_key", ""));
        setP1Name(get("person_name_parent1", "Parent 1"));
        setP2Name(get("person_name_parent2", "Parent 2"));
        setKidsCount(parseInt(get("kids_count", "0"), 10));
        setKidNames([
          get("person_name_kid_1", "Kid 1"),
          get("person_name_kid_2", "Kid 2"),
          get("person_name_kid_3", "Kid 3"),
          get("person_name_kid_4", "Kid 4"),
          get("person_name_kid_5", "Kid 5"),
          get("person_name_kid_6", "Kid 6"),
        ]);
        setMnSize(get("movie_night_session_size", "18"));
        setMnDays(get("movie_night_history_days", "30"));
        setMnFormat(get("movie_night_default_format", "both"));
      })
      .catch(() => {});

    fetchMetadataStatus()
      .then((s) => setMissingCount(s.missing))
      .catch(() => {});
  }, []);

  async function handleSaveKey(e) {
    e.preventDefault();
    setKeySaving(true);
    setKeyStatus(null);
    try {
      await updateSetting("omdb_api_key", omdbKey.trim() || null);
      setKeyStatus({ type: "success", msg: "Saved." });
    } catch (err) {
      setKeyStatus({ type: "error", msg: "Save failed: " + err.message });
    } finally {
      setKeySaving(false);
    }
  }

  async function handleSaveTmdbKey(e) {
    e.preventDefault();
    setTmdbKeySaving(true);
    setTmdbKeyStatus(null);
    try {
      await updateSetting("tmdb_api_key", tmdbKey.trim() || null);
      setTmdbKeyStatus({ type: "success", msg: "Saved." });
    } catch (err) {
      setTmdbKeyStatus({ type: "error", msg: "Save failed: " + err.message });
    } finally {
      setTmdbKeySaving(false);
    }
  }

  async function handleFetchMetadata() {
    setFetchRunning(true);
    setFetchDone(false);
    setFetchError(null);
    setFetchTotals({ updated: 0, not_found: 0, failed: 0 });

    let remaining = 1; // start loop
    let totals = { updated: 0, not_found: 0, failed: 0 };

    try {
      while (remaining > 0) {
        const result = await fetchMissingMetadata(100);
        totals = {
          updated:   totals.updated   + result.updated,
          not_found: totals.not_found + result.not_found,
          failed:    totals.failed    + result.failed,
        };
        remaining = result.remaining;
        setFetchTotals({ ...totals });
        setMissingCount(remaining);
      }
      setFetchDone(true);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFetchRunning(false);
    }
  }

  async function handleSaveMember(e) {
    e.preventDefault();
    setMemberSaving(true);
    setMemberStatus(null);
    try {
      await updateSetting("person_name_parent1", p1Name.trim() || "Parent 1");
      await updateSetting("person_name_parent2", p2Name.trim() || "Parent 2");
      await updateSetting("kids_count", String(kidsCount));
      for (let i = 0; i < kidsCount; i++) {
        await updateSetting(`person_name_kid_${i + 1}`, kidNames[i].trim() || `Kid ${i + 1}`);
      }
      setMemberStatus({ type: "success", msg: "Saved." });
    } catch (err) {
      setMemberStatus({ type: "error", msg: "Save failed: " + err.message });
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleSaveMN(e) {
    e.preventDefault();
    setMnSaving(true);
    setMnStatus(null);
    try {
      await updateSetting("movie_night_session_size", mnSize);
      await updateSetting("movie_night_history_days", mnDays);
      await updateSetting("movie_night_default_format", mnFormat);
      setMnStatus({ type: "success", msg: "Saved." });
    } catch (err) {
      setMnStatus({ type: "error", msg: "Save failed: " + err.message });
    } finally {
      setMnSaving(false);
    }
  }

  const metaLabel = missingCount === null
    ? "Checking…"
    : missingCount === 0
      ? "All items have metadata."
      : `${missingCount} item${missingCount === 1 ? "" : "s"} missing metadata`;

  return (
    <div className="settings-page">
      <h1 className="settings-heading">Settings</h1>

      {/* ── OMDB API Key ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">Metadata</h2>
        <p className="settings-description">
          The OMDB API key enables automatic metadata lookup (title, director, genre, poster) when
          adding or editing items. Get a free key at{" "}
          <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer" className="settings-link">omdbapi.com</a>.
        </p>

        <form className="settings-form" onSubmit={handleSaveKey}>
          <div className="settings-field">
            <label htmlFor="omdb-key">OMDB API Key</label>
            <div className="settings-input-row">
              <input
                id="omdb-key"
                type={showKey ? "text" : "password"}
                value={omdbKey}
                onChange={(e) => setOmdbKey(e.target.value)}
                placeholder="Enter your OMDB API key"
                className="settings-input"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="btn btn-ghost" onClick={() => setShowKey((v) => !v)}>
                {showKey ? "Hide" : "Show"}
              </button>
              <button type="submit" className="btn btn-primary" disabled={keySaving}>
                {keySaving ? "Saving…" : "Save"}
              </button>
            </div>
            {keyStatus && (
              <p className={keyStatus.type === "success" ? "settings-success" : "settings-error"}>
                {keyStatus.msg}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* ── TMDB API Key ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">Lists — TMDB API Key</h2>
        <p className="settings-description">
          The TMDB API key enables importing curated lists (Top Rated, Popular, Now Playing) directly
          from The Movie Database into your Lists tab. Create a free account and request a v3 API key at{" "}
          <a href="https://www.themoviedb.org/signup" target="_blank" rel="noreferrer" className="settings-link">themoviedb.org</a>
          {" "}— once registered, find your key under{" "}
          <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="settings-link">Settings → API</a>.
        </p>
        <form className="settings-form" onSubmit={handleSaveTmdbKey}>
          <div className="settings-field">
            <label htmlFor="tmdb-key">TMDB API Key</label>
            <div className="settings-input-row">
              <input
                id="tmdb-key"
                type={showTmdbKey ? "text" : "password"}
                value={tmdbKey}
                onChange={(e) => setTmdbKey(e.target.value)}
                placeholder="Enter your TMDB API key"
                className="settings-input"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="btn btn-ghost" onClick={() => setShowTmdbKey((v) => !v)}>
                {showTmdbKey ? "Hide" : "Show"}
              </button>
              <button type="submit" className="btn btn-primary" disabled={tmdbKeySaving}>
                {tmdbKeySaving ? "Saving…" : "Save"}
              </button>
            </div>
            {tmdbKeyStatus && (
              <p className={tmdbKeyStatus.type === "success" ? "settings-success" : "settings-error"}>
                {tmdbKeyStatus.msg}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* ── Bulk Metadata Fetch ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">Bulk Metadata Fetch</h2>
        <p className="settings-description">
          Fetch poster, director, genre, runtime, and rating from OMDB for all items that
          haven't had metadata pulled yet. Runs in batches of 100 — uses ~1 request/item
          against your daily OMDB quota (1,000/day on free tier).
        </p>

        <div className="settings-field">
          <div className="settings-meta-status">
            <span className={missingCount === 0 ? "settings-success" : "settings-muted"}>
              {metaLabel}
            </span>
          </div>

          {missingCount !== 0 && (
            <div className="settings-input-row" style={{ marginTop: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleFetchMetadata}
                disabled={fetchRunning || missingCount === 0}
              >
                {fetchRunning ? "Fetching…" : "Fetch Missing Metadata"}
              </button>
            </div>
          )}

          {(fetchRunning || fetchDone) && (
            <div className="settings-fetch-progress">
              <span className="settings-success">
                {fetchTotals.updated} updated
              </span>
              {fetchTotals.not_found > 0 && (
                <span className="settings-muted"> · {fetchTotals.not_found} not found in OMDB</span>
              )}
              {fetchTotals.failed > 0 && (
                <span className="settings-error"> · {fetchTotals.failed} failed</span>
              )}
              {fetchRunning && missingCount > 0 && (
                <span className="settings-muted"> · {missingCount} remaining…</span>
              )}
              {fetchDone && (
                <span className="settings-muted"> · done</span>
              )}
            </div>
          )}

          {fetchError && (
            <p className="settings-error">{fetchError}</p>
          )}
        </div>
      </section>

      {/* ── Household Members ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">Household Members</h2>
        <p className="settings-description">
          Names used for personal ratings and Movie Night participant selection.
        </p>
        <form className="settings-form" onSubmit={handleSaveMember}>
          <div className="settings-field">
            <label>Parent 1 Name</label>
            <input
              type="text"
              value={p1Name}
              onChange={(e) => setP1Name(e.target.value)}
              className="settings-input"
              placeholder="Parent 1"
            />
          </div>
          <div className="settings-field">
            <label>Parent 2 Name</label>
            <input
              type="text"
              value={p2Name}
              onChange={(e) => setP2Name(e.target.value)}
              className="settings-input"
              placeholder="Parent 2"
            />
          </div>
          <div className="settings-field">
            <label>Number of Kids</label>
            <select
              value={kidsCount}
              onChange={(e) => setKidsCount(parseInt(e.target.value, 10))}
              className="settings-input"
              style={{ maxWidth: 100 }}
            >
              {[0,1,2,3,4,5,6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {Array.from({ length: kidsCount }, (_, i) => (
            <div className="settings-field" key={i}>
              <label>Kid {i + 1} Name</label>
              <input
                type="text"
                value={kidNames[i]}
                onChange={(e) => {
                  const next = [...kidNames];
                  next[i] = e.target.value;
                  setKidNames(next);
                }}
                className="settings-input"
                placeholder={`Kid ${i + 1}`}
              />
            </div>
          ))}
          <div className="settings-input-row">
            <button type="submit" className="btn btn-primary" disabled={memberSaving}>
              {memberSaving ? "Saving…" : "Save"}
            </button>
            {memberStatus && (
              <span className={memberStatus.type === "success" ? "settings-success" : "settings-error"}>
                {memberStatus.msg}
              </span>
            )}
          </div>
        </form>
      </section>

      {/* ── Movie Night Defaults ── */}
      <section className="settings-section">
        <h2 className="settings-section-title">Movie Night Defaults</h2>
        <p className="settings-description">
          Default settings for new Movie Night sessions.
        </p>
        <form className="settings-form" onSubmit={handleSaveMN}>
          <div className="settings-field">
            <label>Session Size (items per round, 10–30)</label>
            <input
              type="number"
              min="10"
              max="30"
              value={mnSize}
              onChange={(e) => setMnSize(e.target.value)}
              className="settings-input"
              style={{ maxWidth: 100 }}
            />
          </div>
          <div className="settings-field">
            <label>History Retention (days, 1–365)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={mnDays}
              onChange={(e) => setMnDays(e.target.value)}
              className="settings-input"
              style={{ maxWidth: 100 }}
            />
          </div>
          <div className="settings-field">
            <label>Default Format</label>
            <select
              value={mnFormat}
              onChange={(e) => setMnFormat(e.target.value)}
              className="settings-input"
              style={{ maxWidth: 220 }}
            >
              <option value="both">Both (Physical + Digital)</option>
              <option value="digital">Digital only</option>
              <option value="physical">Physical only</option>
            </select>
          </div>
          <div className="settings-input-row">
            <button type="submit" className="btn btn-primary" disabled={mnSaving}>
              {mnSaving ? "Saving…" : "Save"}
            </button>
            {mnStatus && (
              <span className={mnStatus.type === "success" ? "settings-success" : "settings-error"}>
                {mnStatus.msg}
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
