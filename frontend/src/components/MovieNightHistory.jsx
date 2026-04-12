import { useState, useEffect } from "react";
import { getMovieNightHistory, deleteMovieNightSession } from "../api.js";

export default function MovieNightHistory({ onJoin }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getMovieNightHistory()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(code) {
    if (!window.confirm("Delete this session from history?")) return;
    try {
      await deleteMovieNightSession(code);
      setSessions((prev) => prev.filter((s) => s.code !== code));
    } catch (e) {
      alert("Delete failed: " + e.message);
    }
  }

  if (loading) return <p className="mn-empty">Loading history…</p>;
  if (error)   return <p className="mn-empty mn-error">{error}</p>;
  if (sessions.length === 0) return <p className="mn-empty">No past sessions yet.</p>;

  return (
    <div className="mn-history">
      {sessions.map((s) => {
        const date = new Date(s.created_at).toLocaleDateString(undefined, {
          month: "short", day: "numeric", year: "numeric",
        });
        const names = s.participant_names
          ? Object.values(s.participant_names).join(", ")
          : s.participants.join(", ");

        return (
          <div key={s.code} className="mn-history-row">
            <div className="mn-history-info">
              <span className="mn-history-code">{s.code}</span>
              <span className="mn-history-date">{date}</span>
              <span className="mn-history-participants">{names}</span>
            </div>
            <div className="mn-history-meta">
              <span className={`mn-history-status status-${s.status}`}>{s.status}</span>
              <span className="mn-history-matches">
                {s.match_count ?? 0} match{s.match_count !== 1 ? "es" : ""}
              </span>
            </div>
            <div className="mn-history-actions">
              {s.status === "active" && (
                <button className="btn btn-ghost btn-sm" onClick={() => onJoin(s.code)}>
                  Resume
                </button>
              )}
              <button
                className="btn-icon danger"
                title="Delete"
                onClick={() => handleDelete(s.code)}
              >
                🗑️
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
