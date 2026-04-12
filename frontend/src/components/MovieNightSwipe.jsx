import { useState, useEffect, useRef, useCallback } from "react";
import { getMovieNightSession, submitSwipe } from "../api.js";

const SWIPE_THRESHOLD = 100; // px to commit a swipe

function formatRuntime(minutes) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function SwipeCard({ item, onSwipe }) {
  const [dx, setDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(null);
  const cardRef = useRef(null);

  function handleTouchStart(e) {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function handleTouchMove(e) {
    if (startX.current === null) return;
    const delta = e.touches[0].clientX - startX.current;
    setDx(delta);
  }

  function handleTouchEnd() {
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      onSwipe(dx > 0);
    } else {
      setDx(0);
    }
    setSwiping(false);
    startX.current = null;
  }

  const rotation = dx / 15;
  const opacity = Math.max(0, 1 - Math.abs(dx) / 300);
  const style = swiping
    ? { transform: `translate(${dx}px, 0) rotate(${rotation}deg)`, transition: "none" }
    : { transform: "translate(0,0) rotate(0deg)", transition: "transform 0.25s ease" };

  return (
    <div
      ref={cardRef}
      className={`mn-swipe-card${dx > SWIPE_THRESHOLD / 2 ? " swiping-right" : dx < -SWIPE_THRESHOLD / 2 ? " swiping-left" : ""}`}
      style={style}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe direction indicators */}
      <div className="mn-swipe-yes-label" style={{ opacity: Math.max(0, dx / SWIPE_THRESHOLD) }}>YES</div>
      <div className="mn-swipe-no-label"  style={{ opacity: Math.max(0, -dx / SWIPE_THRESHOLD) }}>NO</div>

      <div className="mn-card-poster">
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt=""
            draggable={false}
            onError={(e) => { e.target.style.display = "none"; }}
          />
        ) : (
          <div className="poster-placeholder mn-card-placeholder">{item.title}</div>
        )}
      </div>
      <div className="mn-card-info">
        <div className="mn-card-title">{item.title}</div>
        <div className="mn-card-meta">
          {[item.year, item.mpaa_rating, formatRuntime(item.runtime)]
            .filter(Boolean).join(" · ")}
        </div>
        {item.genre && <div className="mn-card-genre">{item.genre}</div>}
      </div>
    </div>
  );
}

function HandoffScreen({ name, onReady }) {
  return (
    <div className="mn-handoff">
      <div className="mn-handoff-icon">📱</div>
      <h3 className="mn-handoff-title">Hand the phone to</h3>
      <div className="mn-handoff-name">{name}</div>
      <button className="btn btn-primary mn-handoff-btn" onClick={onReady}>
        I'm Ready — Start Swiping
      </button>
    </div>
  );
}

export default function MovieNightSwipe({ session: initialSession, participantKey, kidsOnThisDevice, onDone }) {
  const [session, setSession] = useState(initialSession);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deviceQueue, setDeviceQueue] = useState(null);     // array of participant keys for this device
  const [deviceQueueIdx, setDeviceQueueIdx] = useState(0);  // which in deviceQueue is currently swiping
  const [showHandoff, setShowHandoff] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [matchToast, setMatchToast] = useState(null);
  const [prevMatches, setPrevMatches] = useState([]);
  const pollRef = useRef(null);

  // Build device queue: participantKey first, then kids if kidsOnThisDevice=true
  useEffect(() => {
    const participants = session.participants || [];
    const kidParticipants = participants.filter((p) => p.startsWith("kid_"));
    if (kidsOnThisDevice && kidParticipants.length > 0) {
      setDeviceQueue([participantKey, ...kidParticipants]);
    } else {
      setDeviceQueue([participantKey]);
    }
  }, [participantKey, session.participants]);

  const activeParticipant = deviceQueue ? deviceQueue[deviceQueueIdx] : participantKey;

  // Build list of items this participant still needs to swipe
  const mySwipes = session.my_swipes || {};
  const items = session.items || [];
  const unswiped = items.filter((it) => !(String(it.media_id) in mySwipes));

  // After mount, figure out what index to start at
  useEffect(() => {
    const swipedCount = Object.keys(mySwipes).length;
    setCurrentIndex(swipedCount < items.length ? swipedCount : items.length);
  }, [activeParticipant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for session updates (match notifications)
  const pollSession = useCallback(async () => {
    try {
      const updated = await getMovieNightSession(session.code);
      const newMatches = (updated.matches || []).filter(
        (id) => !prevMatches.includes(id)
      );
      if (newMatches.length > 0) {
        const matchedItem = (updated.items || []).find(
          (it) => newMatches.includes(it.media_id)
        );
        if (matchedItem) {
          setMatchToast(matchedItem.title);
          setTimeout(() => setMatchToast(null), 3500);
        }
        setPrevMatches(updated.matches || []);
      }
      setSession(updated);
      if (updated.status === "ended" || updated.status === "completed") {
        clearInterval(pollRef.current);
        onDone(updated);
      }
    } catch {/* ignore poll errors */}
  }, [session.code, prevMatches, onDone]);

  useEffect(() => {
    if (waiting) {
      pollRef.current = setInterval(pollSession, 3000);
      return () => clearInterval(pollRef.current);
    }
  }, [waiting, pollSession]);

  async function handleSwipe(isRight) {
    if (submitting) return;
    const item = items[currentIndex];
    if (!item) return;
    setSubmitting(true);
    try {
      const updated = await submitSwipe(session.code, {
        media_id: item.media_id,
        participant_key: activeParticipant,
        swiped_right: isRight,
      });
      setSession(updated);

      // Check for new matches
      const newMatches = (updated.matches || []).filter(
        (id) => !prevMatches.includes(id)
      );
      if (newMatches.length > 0) {
        const matchedItem = (updated.items || []).find(
          (it) => newMatches.includes(it.media_id)
        );
        if (matchedItem) {
          setMatchToast(matchedItem.title);
          setTimeout(() => setMatchToast(null), 3500);
        }
        setPrevMatches(updated.matches || []);
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) {
        // This participant is done
        const nextDeviceIdx = deviceQueueIdx + 1;
        if (deviceQueue && nextDeviceIdx < deviceQueue.length) {
          // Hand off to next participant on this device
          setDeviceQueueIdx(nextDeviceIdx);
          setCurrentIndex(0);
          setShowHandoff(true);
        } else {
          // All participants on this device are done — check if session is done
          if (updated.status === "ended" || updated.status === "completed") {
            onDone(updated);
          } else {
            setWaiting(true);
          }
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    } catch (e) {
      alert("Swipe failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (showHandoff && deviceQueue) {
    const nextParticipant = deviceQueue[deviceQueueIdx];
    const displayName = session.participant_names?.[nextParticipant] || nextParticipant;
    return (
      <HandoffScreen
        name={displayName}
        onReady={() => setShowHandoff(false)}
      />
    );
  }

  if (waiting) {
    const matchCount = (session.matches || []).length;
    return (
      <div className="mn-waiting">
        <div className="mn-waiting-icon">⏳</div>
        <h3 className="mn-waiting-title">You're done!</h3>
        <p className="mn-waiting-subtitle">Waiting for others to finish…</p>
        {matchCount > 0 && (
          <p className="mn-waiting-matches">
            {matchCount} match{matchCount !== 1 ? "es" : ""} so far
          </p>
        )}
        <p className="mn-waiting-hint">This page will update automatically.</p>
      </div>
    );
  }

  const item = items[currentIndex];
  const total = items.length;
  const progress = currentIndex;
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;
  const activeDisplayName = session.participant_names?.[activeParticipant] || activeParticipant;
  const matchCount = (session.matches || []).length;

  if (!item) {
    return (
      <div className="mn-waiting">
        <p className="mn-empty">All done!</p>
      </div>
    );
  }

  return (
    <div className="mn-swipe-deck">
      {/* Header */}
      <div className="mn-swipe-header">
        <span className="mn-swipe-who">{activeDisplayName}</span>
        <span className="mn-swipe-progress-text">{progress} / {total}</span>
        {matchCount > 0 && (
          <span className="mn-match-badge">{matchCount} match{matchCount !== 1 ? "es" : ""}</span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mn-progress-bar">
        <div className="mn-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Swipe card */}
      <div className="mn-card-area">
        <SwipeCard key={item.media_id} item={item} onSwipe={handleSwipe} />
      </div>

      {/* Buttons for non-touch / accessibility */}
      <div className="mn-swipe-buttons">
        <button
          className="mn-swipe-btn no"
          onClick={() => handleSwipe(false)}
          disabled={submitting}
          aria-label="No"
        >
          ✗
        </button>
        <button
          className="mn-swipe-btn yes"
          onClick={() => handleSwipe(true)}
          disabled={submitting}
          aria-label="Yes"
        >
          ✓
        </button>
      </div>

      {/* Match toast */}
      {matchToast && (
        <div className="mn-match-toast">
          🎬 Match! {matchToast}
        </div>
      )}
    </div>
  );
}
