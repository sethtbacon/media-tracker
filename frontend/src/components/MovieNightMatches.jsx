import { useState } from "react";

function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatPlatforms(item) {
  const parts = [];
  if (item.physical_4k)              parts.push("4K");
  if (item.physical_bluray)          parts.push("Blu-ray");
  if (item.physical_dvd)             parts.push("DVD");
  if (item.digital_apple_tv)         parts.push("Apple TV");
  if (item.digital_plex)             parts.push("Plex");
  return parts.join(" · ") || "—";
}

function MatchCard({ item, onClick, selected }) {
  return (
    <div
      className={`mn-match-card${selected ? " selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
    >
      <div className="mn-match-poster-wrap">
        {item.cover_url ? (
          <img src={item.cover_url} alt="" onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="poster-placeholder">{item.title}</div>
        )}
      </div>
      <div className="mn-match-info">
        <div className="mn-match-title">{item.title}</div>
        <div className="mn-match-meta">
          {[item.year, item.mpaa_rating, formatRuntime(item.runtime)]
            .filter(Boolean).join(" · ")}
        </div>
        <div className="mn-match-platforms">{formatPlatforms(item)}</div>
      </div>
    </div>
  );
}

function HeroMatch({ item, onClose }) {
  return (
    <div className="mn-hero-match">
      <div className="mn-hero-poster">
        {item.cover_url ? (
          <img src={item.cover_url} alt="" onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="poster-placeholder">{item.title}</div>
        )}
      </div>
      <div className="mn-hero-details">
        <h2 className="mn-hero-title">{item.title}</h2>
        <p className="mn-hero-meta">
          {[item.year, item.mpaa_rating, formatRuntime(item.runtime), item.genre]
            .filter(Boolean).join(" · ")}
        </p>
        {item.plot && <p className="mn-hero-plot">{item.plot}</p>}
        <p className="mn-hero-platforms">{formatPlatforms(item)}</p>
        {onClose && (
          <button className="btn btn-ghost mn-hero-back" onClick={onClose}>← Back</button>
        )}
      </div>
    </div>
  );
}

export default function MovieNightMatches({
  session,
  onStartNextRound,
  onEndSession,
  onOpenInLibrary,
}) {
  const [expanded, setExpanded] = useState(null);

  const matchItems = (session.items || []).filter(
    (it) => session.matches?.includes(it.media_id)
  );
  const carryCount = session.carry_over_count ?? 0;
  const count = matchItems.length;

  // Final-pick mode: ≤2 items and kids involved — big "Pick This One" buttons
  if (session.mode === "final_pick") {
    return (
      <div className="mn-matches-container">
        <div className="mn-matches-header">
          <h2 className="mn-matches-headline">Final Pick!</h2>
          <p className="mn-matches-subtitle">Kids — choose one to watch tonight</p>
        </div>

        <div className="mn-final-pick-grid">
          {(session.items || []).slice(0, 2).map((item) => (
            <div key={item.media_id} className="mn-final-pick-card">
              <div className="mn-final-pick-poster">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" onError={(e) => { e.target.style.display = "none"; }} />
                ) : (
                  <div className="poster-placeholder">{item.title}</div>
                )}
              </div>
              <div className="mn-final-pick-title">{item.title}</div>
              <button
                className="btn btn-primary mn-final-pick-btn"
                onClick={() => onEndSession && onEndSession()}
              >
                Pick This One
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Expanded single item view (from grid/carousel)
  if (expanded) {
    return (
      <div className="mn-matches-container">
        <HeroMatch item={expanded} onClose={() => setExpanded(null)} />
        <div className="mn-matches-footer">
          {carryCount > 0 && (
            <button className="btn btn-ghost" onClick={onStartNextRound}>
              Start Next Round ({carryCount} carry forward)
            </button>
          )}
          <button className="btn btn-ghost" onClick={onEndSession}>End Session</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mn-matches-container">
      <div className="mn-matches-header">
        <h2 className="mn-matches-headline">
          <span className="mn-match-count">{count}</span>
          {" "}{count === 1 ? "Match!" : count === 0 ? "Matches" : "Matches!"}
        </h2>
        {count === 0 && carryCount > 0 && (
          <p className="mn-matches-subtitle">
            No consensus yet — {carryCount} item{carryCount !== 1 ? "s" : ""} carry forward
          </p>
        )}
      </div>

      {/* 0 matches */}
      {count === 0 && (
        <div className="mn-empty">
          {carryCount > 0 ? "Keep narrowing — start the next round!" : "No items to continue with."}
        </div>
      )}

      {/* 1 match — hero */}
      {count === 1 && (
        <HeroMatch item={matchItems[0]} />
      )}

      {/* 2 matches — side-by-side */}
      {count === 2 && (
        <div className="mn-matches-pair">
          {matchItems.map((item) => (
            <MatchCard key={item.media_id} item={item} onClick={() => setExpanded(item)} />
          ))}
        </div>
      )}

      {/* 3–5 matches — grid */}
      {count >= 3 && count <= 5 && (
        <div className="mn-matches-grid">
          {matchItems.map((item) => (
            <MatchCard key={item.media_id} item={item} onClick={() => setExpanded(item)} />
          ))}
        </div>
      )}

      {/* 6+ matches — scrollable carousel */}
      {count >= 6 && (
        <div className="mn-matches-carousel">
          {matchItems.map((item) => (
            <MatchCard key={item.media_id} item={item} onClick={() => setExpanded(item)} />
          ))}
        </div>
      )}

      <div className="mn-matches-footer">
        {carryCount > 0 && (
          <button className="btn btn-primary" onClick={onStartNextRound}>
            Start Next Round
            <span className="mn-carry-count"> ({carryCount} carry forward)</span>
          </button>
        )}
        <button className="btn btn-ghost" onClick={onEndSession}>End Session</button>
        {count === 1 && onOpenInLibrary && (
          <button className="btn btn-ghost" onClick={() => onOpenInLibrary(matchItems[0].media_id)}>
            Open in Library
          </button>
        )}
      </div>
    </div>
  );
}
