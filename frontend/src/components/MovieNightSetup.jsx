import { useState, useEffect } from "react";
import { getSettings, createMovieNightSession, getMovieNightHistory } from "../api.js";

export default function MovieNightSetup({ onSessionCreated, onCancel }) {
  const [settings, setSettings] = useState({
    p1: "Parent 1", p2: "Parent 2",
    kidsCount: 0, kidNames: [],
    sessionSize: "18", historyDays: "30", defaultFormat: "both",
  });
  const [participants, setParticipants] = useState(new Set(["parent1"]));
  const [format, setFormat] = useState("both");
  const [maxRating, setMaxRating] = useState("");       // "" = any
  const [mediaType, setMediaType] = useState("");       // "" = both
  const [size, setSize] = useState("18");
  const [continueFrom, setContinueFrom] = useState(null);
  const [prevSession, setPrevSession] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        const get = (key, def) => s.find((x) => x.key === key)?.value ?? def;
        const kidsCount = parseInt(get("kids_count", "0"), 10);
        const kidNames = Array.from({ length: kidsCount }, (_, i) =>
          get(`person_name_kid_${i + 1}`, `Kid ${i + 1}`)
        );
        const defaultFormat = get("movie_night_default_format", "both");
        const sessionSize = get("movie_night_session_size", "18");
        setSettings({
          p1: get("person_name_parent1", "Parent 1"),
          p2: get("person_name_parent2", "Parent 2"),
          kidsCount,
          kidNames,
          sessionSize,
          defaultFormat,
        });
        setFormat(defaultFormat);
        setSize(sessionSize);
        // Default: include parent1
        setParticipants(new Set(["parent1"]));
      })
      .catch(() => {});

    // Check for a recent ended/active session to offer "continue narrowing"
    getMovieNightHistory()
      .then((sessions) => {
        const recent = sessions.find(
          (s) => s.status === "ended" || s.status === "active"
        );
        if (recent) setPrevSession(recent);
      })
      .catch(() => {});
  }, []);

  const hasKids = (participantSet) => [...participantSet].some((p) => p.startsWith("kid_"));

  function toggleParticipant(key) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      // Auto-set rating to PG when any kid is added; clear when all kids removed
      const kidsNow = [...next].some((p) => p.startsWith("kid_"));
      setMaxRating((r) => {
        if (kidsNow && !r) return "PG";
        if (!kidsNow && r === "PG") return "";
        return r;
      });
      return next;
    });
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (participants.size === 0) {
      setError("Select at least one participant.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const body = {
        participants: Array.from(participants),
        format_filter: format,
        size: parseInt(size, 10),
      };
      if (maxRating)    body.max_mpaa_rating = maxRating;
      if (mediaType)    body.media_type = mediaType;
      if (continueFrom) body.continue_from_code = continueFrom;
      const session = await createMovieNightSession(body);
      onSessionCreated(session, "parent1" in participants ? "parent1" : Array.from(participants)[0]);
    } catch (e) {
      setError(e.message);
      setCreating(false);
    }
  }

  const { p1, p2, kidsCount, kidNames } = settings;
  const kidKeys = Array.from({ length: kidsCount }, (_, i) => `kid_${i + 1}`);
  const kidLabelMap = Object.fromEntries(kidKeys.map((k, i) => [k, kidNames[i] || `Kid ${i + 1}`]));

  return (
    <div className="mn-setup">
      <h2 className="mn-setup-title">New Movie Night</h2>

      <form className="mn-setup-form" onSubmit={handleCreate}>
        {/* Participants */}
        <div className="settings-field">
          <label>Who's participating?</label>
          <div className="mn-participant-grid">

            {[
              { key: "parent1", label: p1 },
              { key: "parent2", label: p2 },
              ...kidKeys.map((k) => ({ key: k, label: kidLabelMap[k] })),
            ].map(({ key, label }) => (
              <label key={key} className={`mn-participant-chip${participants.has(key) ? " active" : ""}`}>
                <input
                  type="checkbox"
                  checked={participants.has(key)}
                  onChange={() => toggleParticipant(key)}
                />
                {label}
              </label>
            ))}
          </div>
          {kidKeys.some((k) => participants.has(k)) && (
            <p className="settings-description" style={{ fontSize: 12, marginTop: 8 }}>
              Kids will swipe on your device after you finish. The other parent joins separately on their own device.
            </p>
          )}
        </div>

        {/* Format filter */}
        <div className="settings-field">
          <label>Format</label>
          <div className="mn-radio-group">
            {[
              { value: "both",     label: "Both" },
              { value: "digital",  label: "Digital" },
              { value: "physical", label: "Physical" },
            ].map(({ value, label }) => (
              <label key={value} className={`mn-radio-chip${format === value ? " active" : ""}`}>
                <input
                  type="radio"
                  name="format"
                  value={value}
                  checked={format === value}
                  onChange={() => setFormat(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Media type */}
        <div className="settings-field">
          <label>Type</label>
          <div className="mn-radio-group">
            {[
              { value: "",           label: "Both" },
              { value: "Movie",      label: "Movies" },
              { value: "TV Series",  label: "TV Series" },
            ].map(({ value, label }) => (
              <label key={value} className={`mn-radio-chip${mediaType === value ? " active" : ""}`}>
                <input
                  type="radio"
                  name="mediaType"
                  value={value}
                  checked={mediaType === value}
                  onChange={() => setMediaType(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Max MPAA rating */}
        <div className="settings-field">
          <label>
            Max Rating
            {hasKids(participants) && (
              <span className="settings-muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                (auto-set to PG with kids)
              </span>
            )}
          </label>
          <div className="mn-radio-group">
            {[
              { value: "",      label: "Any" },
              { value: "G",     label: "G" },
              { value: "PG",    label: "PG" },
              { value: "PG-13", label: "PG-13" },
              { value: "R",     label: "R" },
            ].map(({ value, label }) => (
              <label key={value} className={`mn-radio-chip${maxRating === value ? " active" : ""}`}>
                <input
                  type="radio"
                  name="maxRating"
                  value={value}
                  checked={maxRating === value}
                  onChange={() => setMaxRating(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Session size */}
        <div className="settings-field">
          <label>Items per round</label>
          <input
            type="number"
            min="10"
            max="30"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="settings-input"
            style={{ maxWidth: 80 }}
          />
        </div>

        {/* Continue from previous session */}
        {prevSession && (
          <div className="settings-field">
            <label className="mn-continue-label">
              <input
                type="checkbox"
                checked={continueFrom === prevSession.code}
                onChange={(e) => setContinueFrom(e.target.checked ? prevSession.code : null)}
              />
              Continue narrowing from last session ({prevSession.code})
            </label>
          </div>
        )}

        {error && <p className="settings-error">{error}</p>}

        <div className="mn-setup-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? "Starting…" : "Start Session"}
          </button>
        </div>
      </form>
    </div>
  );
}
