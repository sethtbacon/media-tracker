import json
import random
import string
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import MediaItem, MovieNightSession, SessionItem, SessionSwipe
from routers.settings import _get_setting
from schemas import (
    SessionCreate, SessionOut, SessionHistoryItem, SessionItemOut, SwipeCreate
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _generate_code(db: Session) -> str:
    """4-digit numeric code — easy to type, low collision risk on a home network."""
    for _ in range(50):
        code = "".join(random.choices(string.digits, k=4))
        if not db.query(MovieNightSession).filter(MovieNightSession.code == code).first():
            return code
    raise RuntimeError("Failed to generate unique session code")


def _participant_names(db: Session, participants: list) -> dict:
    names = {}
    for p in participants:
        if p == "parent1":
            names[p] = _get_setting(db, "person_name_parent1", "Parent 1")
        elif p == "parent2":
            names[p] = _get_setting(db, "person_name_parent2", "Parent 2")
        elif p.startswith("kid_"):
            n = p.split("_")[1]
            names[p] = _get_setting(db, f"person_name_kid_{n}", f"Kid {n}")
        else:
            names[p] = p
    return names


def _categorize(participants: list, swipes: list):
    """
    Sort all fully-voted items into matches, carry_over, rejected.
    - With kids: match = ALL kids ✓ AND ≥ 1 parent ✓
                 carry = not match AND ≥ 2 total yes
    - Adults only: match = ALL adults ✓
                   carry = not match AND ≥ 1 yes
    Returns (matches: list[int], carry_over: list[int], rejected: list[int])
    """
    kids = [p for p in participants if p.startswith("kid_")]
    adults = [p for p in participants if p in ("parent1", "parent2")]

    by_media: dict = defaultdict(dict)
    for s in swipes:
        by_media[s.media_id][s.participant_key] = s.swiped_right

    matches, carry_over, rejected = [], [], []
    for media_id, votes in by_media.items():
        if not all(p in votes for p in participants):
            continue  # not everyone has voted yet
        yes_count = sum(1 for v in votes.values() if v)

        if kids:
            all_kids_yes = all(votes.get(k, False) for k in kids)
            any_parent_yes = any(votes.get(a, False) for a in adults) if adults else True
            is_match = all_kids_yes and any_parent_yes
            is_carry = (not is_match) and yes_count >= 2
        else:
            is_match = all(votes.get(a, False) for a in adults)
            is_carry = (not is_match) and yes_count >= 1

        if is_match:
            matches.append(media_id)
        elif is_carry:
            carry_over.append(media_id)
        else:
            rejected.append(media_id)

    return matches, carry_over, rejected


def _build_session_out(session: MovieNightSession, db: Session) -> SessionOut:
    participants = json.loads(session.participants)
    names = _participant_names(db, participants)

    items_q = (
        db.query(SessionItem, MediaItem)
        .join(MediaItem, SessionItem.media_id == MediaItem.id)
        .filter(SessionItem.session_id == session.id)
        .order_by(SessionItem.display_order)
        .all()
    )
    items_out = [
        SessionItemOut(
            media_id=si.media_id,
            title=m.title,
            year=m.year,
            cover_url=m.cover_url,
            mpaa_rating=m.mpaa_rating,
            runtime=m.runtime,
            display_order=si.display_order,
            digital_apple_tv=bool(m.digital_apple_tv),
            digital_plex=bool(m.digital_plex),
            digital_movies_anywhere=bool(m.digital_movies_anywhere),
            physical_4k=bool(m.physical_4k),
            physical_bluray=bool(m.physical_bluray),
            physical_dvd=bool(m.physical_dvd),
        )
        for si, m in items_q
    ]

    swipes = db.query(SessionSwipe).filter(SessionSwipe.session_id == session.id).all()
    matches, carry_over, _ = _categorize(participants, swipes)

    progress = {p: 0 for p in participants}
    for s in swipes:
        if s.participant_key in progress:
            progress[s.participant_key] += 1

    return SessionOut(
        code=session.code,
        status=session.status,
        mode=session.mode,
        participants=participants,
        participant_names=names,
        format_filter=session.format_filter,
        size=len(items_out),
        items=items_out,
        progress=progress,
        matches=matches,
        carry_over_count=len(carry_over),
        created_at=session.created_at.isoformat() if session.created_at else "",
    )


def _delete_session_cascade(session_id: int, db: Session):
    db.query(SessionSwipe).filter(SessionSwipe.session_id == session_id).delete()
    db.query(SessionItem).filter(SessionItem.session_id == session_id).delete()
    db.query(MovieNightSession).filter(MovieNightSession.id == session_id).delete()


def _cleanup_expired(db: Session):
    expired = db.query(MovieNightSession).filter(
        MovieNightSession.expires_at < datetime.utcnow()
    ).all()
    for s in expired:
        _delete_session_cascade(s.id, db)
    if expired:
        db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/movie-night/sessions", response_model=SessionOut)
def create_session(body: SessionCreate, db: Session = Depends(get_db)):
    if not body.participants:
        raise HTTPException(status_code=400, detail="At least one participant required")

    size = body.size or int(_get_setting(db, "movie_night_session_size", "18"))
    size = max(5, min(size, 50))

    history_days = int(_get_setting(db, "movie_night_history_days", "30"))
    expires_at = datetime.utcnow() + timedelta(days=history_days)

    kids = [p for p in body.participants if p.startswith("kid_")]

    # Build carry-over pool from previous session
    carry_over_ids: list = []
    prev_session = None
    if body.continue_from_code:
        prev_session = db.query(MovieNightSession).filter(
            MovieNightSession.code == body.continue_from_code
        ).first()
        if prev_session:
            prev_swipes = db.query(SessionSwipe).filter(
                SessionSwipe.session_id == prev_session.id
            ).all()
            prev_participants = json.loads(prev_session.participants)
            _, prev_carry, _ = _categorize(prev_participants, prev_swipes)
            carry_over_ids = prev_carry

    # Build base media query
    MPAA_ORDER = ["G", "PG", "PG-13", "R", "NC-17"]

    q = db.query(MediaItem)

    # Format filter
    if body.format_filter == "digital":
        q = q.filter(or_(
            MediaItem.digital_apple_tv == True,
            MediaItem.digital_plex == True,
            MediaItem.digital_movies_anywhere == True,
        ))
    elif body.format_filter == "physical":
        q = q.filter(or_(
            MediaItem.physical_4k == True,
            MediaItem.physical_bluray == True,
            MediaItem.physical_dvd == True,
        ))

    # Media type filter
    if body.media_type:
        q = q.filter(MediaItem.media_type == body.media_type)

    # MPAA rating filter — include only ratings at or below the max
    if body.max_mpaa_rating and body.max_mpaa_rating in MPAA_ORDER:
        idx = MPAA_ORDER.index(body.max_mpaa_rating)
        allowed = MPAA_ORDER[:idx + 1]
        q = q.filter(MediaItem.mpaa_rating.in_(allowed))

    # Determine session mode and item pool
    mode = "normal"
    if kids and carry_over_ids and len(carry_over_ids) <= 2:
        # Narrowed to final pick — no swipe deck needed
        mode = "final_pick"
        selected_ids = carry_over_ids
    elif kids and carry_over_ids:
        # With kids: use only carry-over, no top-up
        selected_ids = carry_over_ids
    else:
        # Adults-only or fresh start: carry-over + random fill to size
        existing = set(carry_over_ids)
        fill_count = max(0, size - len(existing))
        random_pool = q.filter(~MediaItem.id.in_(existing)).order_by(func.random()).limit(fill_count * 3).all()
        random_ids = [m.id for m in random_pool]
        random.shuffle(random_ids)
        selected_ids = list(existing) + random_ids[:fill_count]

    # Validate IDs still exist in DB
    valid_items = q.filter(MediaItem.id.in_(selected_ids)).all() if selected_ids else []
    valid_ids = {m.id for m in valid_items}

    # Fall back to random fill if carry-over had invalid IDs
    if len(valid_ids) < size and not (kids and carry_over_ids):
        extra = q.filter(~MediaItem.id.in_(valid_ids)).order_by(func.random()).limit(size - len(valid_ids)).all()
        valid_items += extra
        valid_ids = {m.id for m in valid_items}

    random.shuffle(valid_items)
    final_items = valid_items[:size]

    if not final_items:
        raise HTTPException(status_code=400, detail="No items available for the chosen format filter")

    # Create session
    code = _generate_code(db)
    session = MovieNightSession(
        code=code,
        participants=json.dumps(body.participants),
        format_filter=body.format_filter,
        max_mpaa_rating=body.max_mpaa_rating,
        media_type_filter=body.media_type,
        status="active",
        mode=mode,
        continue_from_id=prev_session.id if prev_session else None,
        expires_at=expires_at,
    )
    db.add(session)
    db.flush()  # get session.id

    for order, media in enumerate(final_items):
        db.add(SessionItem(session_id=session.id, media_id=media.id, display_order=order))

    db.commit()
    db.refresh(session)
    return _build_session_out(session, db)


@router.get("/movie-night/sessions", response_model=List[SessionHistoryItem])
def list_sessions(db: Session = Depends(get_db)):
    _cleanup_expired(db)
    sessions = db.query(MovieNightSession).order_by(MovieNightSession.created_at.desc()).all()

    result = []
    for s in sessions:
        participants = json.loads(s.participants)
        swipes = db.query(SessionSwipe).filter(SessionSwipe.session_id == s.id).all()
        matches, carry_over, _ = _categorize(participants, swipes)
        result.append(SessionHistoryItem(
            code=s.code,
            status=s.status,
            participants=participants,
            participant_names=_participant_names(db, participants),
            match_count=len(matches),
            carry_over_count=len(carry_over),
            created_at=s.created_at.isoformat() if s.created_at else "",
        ))
    return result


@router.get("/movie-night/sessions/{code}", response_model=SessionOut)
def get_session(code: str, db: Session = Depends(get_db)):
    session = db.query(MovieNightSession).filter(MovieNightSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _build_session_out(session, db)


@router.post("/movie-night/sessions/{code}/swipe", response_model=SessionOut)
def submit_swipe(code: str, body: SwipeCreate, db: Session = Depends(get_db)):
    session = db.query(MovieNightSession).filter(MovieNightSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    participants = json.loads(session.participants)
    if body.participant_key not in participants:
        raise HTTPException(status_code=400, detail="Participant not in session")

    # Verify this media_id is actually in the session
    si = db.query(SessionItem).filter(
        SessionItem.session_id == session.id,
        SessionItem.media_id == body.media_id,
    ).first()
    if not si:
        raise HTTPException(status_code=400, detail="Item not in session")

    # Upsert swipe
    existing = db.query(SessionSwipe).filter(
        SessionSwipe.session_id == session.id,
        SessionSwipe.media_id == body.media_id,
        SessionSwipe.participant_key == body.participant_key,
    ).first()
    if existing:
        existing.swiped_right = body.swiped_right
    else:
        db.add(SessionSwipe(
            session_id=session.id,
            media_id=body.media_id,
            participant_key=body.participant_key,
            swiped_right=body.swiped_right,
        ))
    db.commit()

    # Auto-complete session when all participants have swiped all items
    item_count = db.query(SessionItem).filter(SessionItem.session_id == session.id).count()
    for p in participants:
        p_swipes = db.query(SessionSwipe).filter(
            SessionSwipe.session_id == session.id,
            SessionSwipe.participant_key == p,
        ).count()
        if p_swipes < item_count:
            break
    else:
        session.status = "ended"
        db.commit()

    db.refresh(session)
    return _build_session_out(session, db)


@router.post("/movie-night/sessions/{code}/end", response_model=SessionOut)
def end_session(code: str, db: Session = Depends(get_db)):
    session = db.query(MovieNightSession).filter(MovieNightSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.status = "ended"
    db.commit()
    db.refresh(session)
    return _build_session_out(session, db)


@router.delete("/movie-night/sessions/{code}")
def delete_session(code: str, db: Session = Depends(get_db)):
    session = db.query(MovieNightSession).filter(MovieNightSession.code == code).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    _delete_session_cascade(session.id, db)
    db.commit()
    return {"ok": True}
