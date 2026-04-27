import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getMovieNightSession, endMovieNightSession, createMovieNightSession } from "../api.js";
import MovieNightSetup from "./MovieNightSetup.jsx";
import MovieNightSwipe from "./MovieNightSwipe.jsx";
import MovieNightMatches from "./MovieNightMatches.jsx";
import MovieNightHistory from "./MovieNightHistory.jsx";

function QRModal({ url, code, onClose }) {
  return (
    <div className="mn-qr-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mn-qr-modal">
        <div className="mn-qr-header">
          <span className="mn-qr-title">Scan to Join</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="mn-qr-body">
          <div className="mn-qr-code">
            <QRCodeSVG value={url} size={220} bgColor="#ffffff" fgColor="#0f1117" level="M" />
          </div>
          <p className="mn-qr-hint">Point your phone camera at this code</p>
          <div className="mn-qr-code-label">{code}</div>
          <p className="mn-qr-url">{url}</p>
        </div>
      </div>
    </div>
  );
}

// "home" | "setup" | "join" | "active" | "results" | "history"

export default function MovieNightPage({ initialSessionCode, onOpenInLibrary }) {
  const [view, setView] = useState(initialSessionCode ? "join" : "home");
  const [session, setSession] = useState(null);
  const [participantKey, setParticipantKey] = useState(null);
  const [joinCode, setJoinCode] = useState(initialSessionCode || "");
  const [joinParticipant, setJoinParticipant] = useState("");
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [kidsOnThisDevice, setKidsOnThisDevice] = useState(true);
  const [showQR, setShowQR] = useState(false);

  // Auto-load session when coming in from URL param
  useEffect(() => {
    if (initialSessionCode) {
      setJoinCode(initialSessionCode);
      setView("join");
    }
  }, [initialSessionCode]);

  function handleSessionCreated(newSession, myKey) {
    setSession(newSession);
    setParticipantKey(myKey);
    setKidsOnThisDevice(true); // creator always gets kids on their device
    setView("active");
  }

  async function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    // Step 1 — session not loaded yet (or code changed): fetch it and show participant picker
    if (!session || session.code !== code) {
      setJoining(true);
      setJoinError(null);
      try {
        const s = await getMovieNightSession(code);
        setSession(s);
        setJoinParticipant(s.participants[0]); // pre-select first participant
      } catch (err) {
        setJoinError("Session not found: " + err.message);
      } finally {
        setJoining(false);
      }
      return; // show picker before proceeding
    }

    // Step 2 — session loaded, participant chosen: go to swipe
    setParticipantKey(joinParticipant || session.participants[0]);
    setView("active");
  }

  async function handleEndSession() {
    if (!session) return;
    try {
      const updated = await endMovieNightSession(session.code);
      setSession(updated);
    } catch {/* ignore */}
    setView("results");
  }

  async function handleStartNextRound() {
    if (!session) return;
    try {
      const body = {
        participants: session.participants,
        format_filter: session.format_filter,
        size: session.size || 18,
        continue_from_code: session.code,
      };
      const newSession = await createMovieNightSession(body);
      setSession(newSession);
      setParticipantKey(participantKey);
      setView("active");
    } catch (e) {
      alert("Failed to start next round: " + e.message);
    }
  }

  function handleSwipeDone(updatedSession) {
    setSession(updatedSession);
    setView("results");
  }

  // Home view
  if (view === "home") {
    return (
      <div className="mn-page">
        <h1 className="mn-page-title">Movie Night</h1>
        <p className="mn-page-subtitle">Find a movie everyone wants to watch</p>
        <div className="mn-home-grid">
          <button className="mn-home-btn" onClick={() => setView("setup")}>
            <span className="mn-home-btn-icon">🎬</span>
            <span className="mn-home-btn-label">Start New Session</span>
          </button>
          <button className="mn-home-btn" onClick={() => setView("join")}>
            <span className="mn-home-btn-icon">📲</span>
            <span className="mn-home-btn-label">Join by Code</span>
          </button>
          <button className="mn-home-btn" onClick={() => setView("history")}>
            <span className="mn-home-btn-icon">📋</span>
            <span className="mn-home-btn-label">History</span>
          </button>
        </div>
      </div>
    );
  }

  // Setup
  if (view === "setup") {
    return (
      <div className="mn-page">
        <MovieNightSetup
          onSessionCreated={handleSessionCreated}
          onCancel={() => setView("home")}
        />
      </div>
    );
  }

  // Join by code
  if (view === "join") {
    return (
      <div className="mn-page">
        <div className="mn-page-nav">
          <button className="btn btn-ghost" onClick={() => { setView("home"); setSession(null); }}>← Back</button>
          <h2 className="mn-setup-title">Join Session</h2>
        </div>
        <form className="mn-setup-form" onSubmit={handleJoin}>
          <div className="settings-field">
            <label>Session Code</label>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="e.g. 3847"
              className="settings-input"
              style={{ maxWidth: 120, fontFamily: "monospace", letterSpacing: "0.2em", fontSize: 20 }}
              autoFocus
            />
          </div>
          {session && (
            <>
              <div className="settings-field">
                <label>I am…</label>
                <select
                  value={joinParticipant}
                  onChange={(e) => setJoinParticipant(e.target.value)}
                  className="settings-input"
                  style={{ maxWidth: 200 }}
                >
                  {session.participants
                    .filter((p) => !p.startsWith("kid_"))
                    .map((p) => (
                      <option key={p} value={p}>
                        {session.participant_names?.[p] || p}
                      </option>
                    ))}
                </select>
              </div>
              {session.participants.some((p) => p.startsWith("kid_")) && (
                <label className="mn-continue-label">
                  <input
                    type="checkbox"
                    checked={kidsOnThisDevice}
                    onChange={(e) => setKidsOnThisDevice(e.target.checked)}
                  />
                  Kids will swipe on this device after me
                </label>
              )}
            </>
          )}
          {joinError && <p className="settings-error">{joinError}</p>}
          <div className="mn-setup-actions">
            <button type="submit" className="btn btn-primary" disabled={joining}>
              {joining ? "Looking up…" : session ? "Start Swiping" : "Look Up Session"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Active swipe session
  if (view === "active" && session) {
    const joinUrl = `${window.location.origin}/?session=${session.code}`;
    return (
      <div className="mn-page mn-page-swipe">
        {showQR && (
          <QRModal url={joinUrl} code={session.code} onClose={() => setShowQR(false)} />
        )}
        <div className="mn-session-header">
          <span className="mn-session-code">{session.code}</span>
          <button
            className="btn btn-ghost btn-sm"
            title="Show QR code to invite others"
            onClick={() => setShowQR(true)}
          >
            QR
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleEndSession}>
            End
          </button>
        </div>
        <MovieNightSwipe
          session={session}
          participantKey={participantKey}
          kidsOnThisDevice={kidsOnThisDevice}
          onDone={handleSwipeDone}
        />
      </div>
    );
  }

  // Results / matches
  if (view === "results" && session) {
    return (
      <div className="mn-page">
        <div className="mn-session-header">
          <span className="mn-session-code">{session.code}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setView("home")}>
            ← Back
          </button>
        </div>
        <MovieNightMatches
          session={session}
          onStartNextRound={handleStartNextRound}
          onEndSession={() => setView("home")}
          onOpenInLibrary={onOpenInLibrary}
        />
      </div>
    );
  }

  // History
  if (view === "history") {
    return (
      <div className="mn-page">
        <div className="mn-page-nav">
          <button className="btn btn-ghost" onClick={() => setView("home")}>← Back</button>
          <h2 className="mn-setup-title">Session History</h2>
        </div>
        <MovieNightHistory
          onJoin={(code) => {
            setJoinCode(code);
            setView("join");
          }}
        />
      </div>
    );
  }

  // Fallback
  return null;
}
