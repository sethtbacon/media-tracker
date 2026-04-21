import io
import json
import os
from datetime import datetime, timezone
from typing import List, Optional
from urllib.error import URLError
from urllib.request import urlopen

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import ListItem, MediaItem, MediaList, SystemSetting
from routers.import_export import parse_int, parse_str
from schemas import (
    ImportListResponse,
    ListCreate,
    ListDetailOut,
    ListItemCreate,
    ListItemOut,
    ListItemUpdate,
    ListOut,
    ListsResponse,
    ListUpdate,
    TMDBImportRequest,
    TMDBPreviewResponse,
    UnownedItemsResponse,
)

router = APIRouter()

# ── TMDB catalog ──────────────────────────────────────────────────────────────

TMDB_LISTS = [
    {"id": "movie/top_rated",   "name": "Top Rated Movies",    "media_type": "Movie"},
    {"id": "movie/popular",     "name": "Popular Movies",      "media_type": "Movie"},
    {"id": "movie/now_playing", "name": "Now Playing Movies",  "media_type": "Movie"},
    {"id": "tv/top_rated",      "name": "Top Rated TV Series", "media_type": "TV Series"},
    {"id": "tv/popular",        "name": "Popular TV Series",   "media_type": "TV Series"},
]

LIST_COLUMN_MAP = {
    "Rank":    "rank",
    "Title":   "title",
    "Year":    "year",
    "IMDB_ID": "imdb_id",
    "TMDB_ID": "tmdb_id",
    "Notes":   "notes",
}
LIST_INT_FIELDS = {"rank", "year"}

# ── Private helpers ───────────────────────────────────────────────────────────

def _get_tmdb_key(db: Session) -> Optional[str]:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "tmdb_api_key").first()
    key = (setting.value if setting and setting.value else "").strip()
    return key or os.getenv("TMDB_API_KEY", "").strip() or None


def _match_item(db: Session, item: ListItem) -> Optional[int]:
    """Return media_items.id matching this list item, or None."""
    # 1. IMDB ID (skip sentinel "NOT_FOUND")
    if item.imdb_id and item.imdb_id != "NOT_FOUND":
        media = db.query(MediaItem).filter(MediaItem.imdb_id == item.imdb_id).first()
        if media:
            return media.id
    # 2. TMDB ID
    if item.tmdb_id:
        media = db.query(MediaItem).filter(MediaItem.tmdb_id == item.tmdb_id).first()
        if media:
            return media.id
    # 3. Title + year fallback
    if item.title:
        q = db.query(MediaItem).filter(MediaItem.title.ilike(item.title))
        if item.year:
            q = q.filter(MediaItem.year == item.year)
        media = q.first()
        if media:
            return media.id
    return None


def _rematch_list(db: Session, list_id: int) -> None:
    """Re-run matching for every item in a list. Caller must commit."""
    items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
    for item in items:
        item.media_id = _match_item(db, item)
    db.flush()
    _update_badge_timestamps(db, list_id)


def _get_raw_stats(db: Session, list_id: int) -> dict:
    """Compute stats without side effects."""
    from sqlalchemy import or_ as sqla_or
    total = db.query(ListItem).filter(ListItem.list_id == list_id).count()
    owned_items = db.query(ListItem).filter(
        ListItem.list_id == list_id,
        ListItem.media_id.isnot(None),
    ).all()
    owned = len(owned_items)

    # Watched: owned items (from media_items) + unowned items watched on the list itself
    watched = 0
    if owned_items:
        media_ids = [i.media_id for i in owned_items]
        watched += db.query(MediaItem).filter(
            MediaItem.id.in_(media_ids),
            MediaItem.watched == True,  # noqa: E712
        ).count()
    watched += db.query(ListItem).filter(
        ListItem.list_id == list_id,
        ListItem.media_id.is_(None),
        sqla_or(
            ListItem.watched_parent1 == True,  # noqa: E712
            ListItem.watched_parent2 == True,  # noqa: E712
            ListItem.watched_kids == True,  # noqa: E712
        ),
    ).count()

    return {"total": total, "owned": owned, "watched": watched, "unowned": total - owned}


def _update_badge_timestamps(db: Session, list_id: int) -> None:
    """Set/clear badge timestamps based on current stats. Caller must flush/commit."""
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        return
    stats = _get_raw_stats(db, list_id)
    now = datetime.now(timezone.utc)
    if stats["total"] > 0 and stats["owned"] == stats["total"] and ml.owned_completed_at is None:
        ml.owned_completed_at = now
    if stats["owned"] < stats["total"] and ml.owned_completed_at is not None:
        ml.owned_completed_at = None
    if stats["total"] > 0 and stats["watched"] == stats["total"] and ml.watched_completed_at is None:
        ml.watched_completed_at = now
    if stats["watched"] < stats["total"] and ml.watched_completed_at is not None:
        ml.watched_completed_at = None


def _fmt_dt(dt) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)


def _build_list_out(db: Session, ml: MediaList) -> dict:
    stats = _get_raw_stats(db, ml.id)
    return {
        "id": ml.id,
        "name": ml.name,
        "description": ml.description,
        "list_type": ml.list_type,
        "source_name": ml.source_name,
        "source_url": ml.source_url,
        "source_ref": ml.source_ref,
        "version_note": ml.version_note,
        "parent_list_id": ml.parent_list_id,
        "is_archived": bool(ml.is_archived),
        "owned_completed_at": _fmt_dt(ml.owned_completed_at),
        "watched_completed_at": _fmt_dt(ml.watched_completed_at),
        "created_at": _fmt_dt(ml.created_at),
        "updated_at": _fmt_dt(ml.updated_at),
        **stats,
    }


def _get_item_media(db: Session, item: ListItem) -> Optional[MediaItem]:
    if item.media_id is None:
        return None
    return db.query(MediaItem).filter(MediaItem.id == item.media_id).first()


def _build_item_out(item: ListItem, media: Optional[MediaItem], list_name: Optional[str] = None) -> dict:
    # For watched fields: owned items use media_items; unowned use list_items
    if media:
        w_p1   = bool(media.watched_parent1)
        w_p2   = bool(media.watched_parent2)
        w_kids = bool(media.watched_kids)
        ni     = bool(media.not_interested)
    else:
        w_p1   = bool(item.watched_parent1)
        w_p2   = bool(item.watched_parent2)
        w_kids = bool(item.watched_kids)
        ni     = bool(item.not_interested)

    # Effective poster: library cover > TMDB poster stored on list item
    cover = (media.cover_url if media else None) or item.poster_url

    return {
        "id": item.id,
        "list_id": item.list_id,
        "rank": item.rank,
        "title": item.title,
        "year": item.year,
        "imdb_id": item.imdb_id,
        "tmdb_id": item.tmdb_id,
        "notes": item.notes,
        "media_id": item.media_id,
        "owned": media is not None,
        "watched": w_p1 or w_p2 or w_kids,
        "watched_parent1": w_p1,
        "watched_parent2": w_p2,
        "watched_kids": w_kids,
        "not_interested": ni,
        "media_cover_url": cover,
        "poster_url": item.poster_url,
        "media_runtime": media.runtime if media else None,
        "media_mpaa_rating": media.mpaa_rating if media else None,
        "media_title": media.title if media else None,
        "list_name": list_name,
        "added_at": _fmt_dt(item.added_at),
    }


def _propagate_not_interested(db: Session, value: bool, source_item: ListItem) -> None:
    """Globally set not_interested for this title across all list_items and media_items."""
    from sqlalchemy import or_ as sqla_or
    if source_item.media_id:
        media = db.query(MediaItem).filter(MediaItem.id == source_item.media_id).first()
        if media:
            media.not_interested = value
        db.query(ListItem).filter(ListItem.media_id == source_item.media_id).update(
            {"not_interested": value}, synchronize_session=False
        )
    else:
        source_item.not_interested = value
        clauses = []
        if source_item.imdb_id:
            clauses.append(ListItem.imdb_id == source_item.imdb_id)
        if source_item.tmdb_id:
            clauses.append(ListItem.tmdb_id == source_item.tmdb_id)
        if clauses:
            db.query(ListItem).filter(
                sqla_or(*clauses),
                ListItem.id != source_item.id,
            ).update({"not_interested": value}, synchronize_session=False)
    db.flush()


def _delete_list_cascade(db: Session, list_id: int) -> None:
    db.query(ListItem).filter(ListItem.list_id == list_id).delete()
    db.query(MediaList).filter(MediaList.id == list_id).delete()


def _archive_list(db: Session, list_id: int) -> int:
    """Rename existing list with date suffix, mark archived. Returns NEW list id."""
    original = db.query(MediaList).filter(MediaList.id == list_id).first()
    date_str = datetime.now(timezone.utc).date().isoformat()
    base_name = original.name.rsplit(" (pulled ", 1)[0]
    original.name = f"{base_name} (pulled {date_str})"
    original.is_archived = True
    db.flush()
    new_list = MediaList(
        name=base_name,
        description=original.description,
        list_type=original.list_type,
        source_name=original.source_name,
        source_url=original.source_url,
        source_ref=original.source_ref,
        parent_list_id=original.id,
    )
    db.add(new_list)
    db.flush()
    return new_list.id


def _tmdb_fetch_page(api_key: str, tmdb_list_id: str, page: int = 1) -> dict:
    url = (
        f"https://api.themoviedb.org/3/{tmdb_list_id}"
        f"?api_key={api_key}&language=en-US&page={page}"
    )
    try:
        with urlopen(url, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"TMDB request failed: {exc}")


def _tmdb_result_to_item(result: dict, rank: int, list_id: int) -> ListItem:
    title = result.get("title") or result.get("name") or ""
    raw_date = result.get("release_date") or result.get("first_air_date") or ""
    year = int(raw_date[:4]) if raw_date and len(raw_date) >= 4 else None
    poster_path = result.get("poster_path")
    poster_url = f"https://image.tmdb.org/t/p/w185{poster_path}" if poster_path else None
    return ListItem(
        list_id=list_id,
        rank=rank,
        title=title,
        year=year,
        tmdb_id=str(result["id"]),
        poster_url=poster_url,
    )


def _do_import_and_match(db: Session, target_id: int, items: List[ListItem]) -> dict:
    """Bulk-insert items, run matching, update badges. Returns stats dict."""
    for item in items:
        db.add(item)
    db.flush()
    matched = 0
    all_items = db.query(ListItem).filter(ListItem.list_id == target_id).all()
    for item in all_items:
        item.media_id = _match_item(db, item)
        if item.media_id is not None:
            matched += 1
    _update_badge_timestamps(db, target_id)
    return {"imported": len(items), "matched": matched, "unmatched": len(items) - matched}


# ── TMDB source endpoints (must be declared before /{list_id} to avoid shadowing) ──

@router.get("/lists/sources/tmdb/lists")
def get_tmdb_catalog(db: Session = Depends(get_db)):
    """Return the hardcoded TMDB list catalog. Requires a TMDB API key in Settings."""
    api_key = _get_tmdb_key(db)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="TMDB API key not configured. Add it in Settings.",
        )
    return {"lists": TMDB_LISTS}


@router.get("/lists/sources/tmdb/preview", response_model=TMDBPreviewResponse)
def preview_tmdb_list(tmdb_list_id: str, db: Session = Depends(get_db)):
    """Return first 20 items + total count for a TMDB list."""
    api_key = _get_tmdb_key(db)
    if not api_key:
        raise HTTPException(status_code=503, detail="TMDB API key not configured.")
    data = _tmdb_fetch_page(api_key, tmdb_list_id, page=1)
    results = data.get("results", [])
    items = []
    for r in results[:20]:
        title = r.get("title") or r.get("name") or ""
        raw_date = r.get("release_date") or r.get("first_air_date") or ""
        year = int(raw_date[:4]) if raw_date and len(raw_date) >= 4 else None
        items.append({"title": title, "year": year, "tmdb_id": str(r["id"])})
    return {"items": items, "total_results": data.get("total_results", 0)}


# ── Unowned items aggregate (before /{list_id}) ───────────────────────────────

@router.get("/lists/unowned-items", response_model=UnownedItemsResponse)
def get_all_unowned_items(db: Session = Depends(get_db)):
    """All unowned items across all non-archived lists, for the shopping view."""
    lists_rows = db.query(MediaList).filter(MediaList.is_archived == False).order_by(MediaList.name).all()  # noqa: E712
    result = []
    for ml in lists_rows:
        items = (
            db.query(ListItem)
            .filter(
                ListItem.list_id == ml.id,
                ListItem.media_id.is_(None),
                ListItem.not_interested.isnot(True),
            )
            .order_by(ListItem.rank.asc().nullslast(), ListItem.id.asc())
            .all()
        )
        for item in items:
            result.append(_build_item_out(item, None, list_name=ml.name))
    return {"items": result, "total": len(result)}


# ── List CRUD ─────────────────────────────────────────────────────────────────

@router.get("/lists/", response_model=ListsResponse)
def get_lists(archived: bool = False, db: Session = Depends(get_db)):
    query = db.query(MediaList)
    if not archived:
        query = query.filter(MediaList.is_archived == False)  # noqa: E712
    rows = query.order_by(MediaList.created_at.desc()).all()
    return {"items": [_build_list_out(db, r) for r in rows], "total": len(rows)}


@router.post("/lists/", response_model=ListOut, status_code=201)
def create_list(data: ListCreate, db: Session = Depends(get_db)):
    ml = MediaList(**data.model_dump())
    db.add(ml)
    db.commit()
    db.refresh(ml)
    return _build_list_out(db, ml)


@router.get("/lists/{list_id}", response_model=ListDetailOut)
def get_list(list_id: int, db: Session = Depends(get_db)):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    items_rows = (
        db.query(ListItem)
        .filter(ListItem.list_id == list_id)
        .order_by(ListItem.rank.asc().nullslast(), ListItem.id.asc())
        .all()
    )
    items_out = [_build_item_out(item, _get_item_media(db, item)) for item in items_rows]
    out = _build_list_out(db, ml)
    out["items"] = items_out
    return out


@router.put("/lists/{list_id}", response_model=ListOut)
def update_list(list_id: int, data: ListUpdate, db: Session = Depends(get_db)):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(ml, key, value)
    db.commit()
    db.refresh(ml)
    return _build_list_out(db, ml)


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    _delete_list_cascade(db, list_id)
    db.commit()


@router.post("/lists/{list_id}/rematch", response_model=ListOut)
def rematch_list(list_id: int, db: Session = Depends(get_db)):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    _rematch_list(db, list_id)
    db.commit()
    db.refresh(ml)
    return _build_list_out(db, ml)


# ── List item CRUD ────────────────────────────────────────────────────────────

@router.post("/lists/{list_id}/items", response_model=ListItemOut, status_code=201)
def add_list_item(list_id: int, data: ListItemCreate, db: Session = Depends(get_db)):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    item = ListItem(list_id=list_id, **data.model_dump())
    db.add(item)
    db.flush()
    item.media_id = _match_item(db, item)
    _update_badge_timestamps(db, list_id)
    db.commit()
    db.refresh(item)
    return _build_item_out(item, _get_item_media(db, item))


@router.put("/lists/{list_id}/items/{item_id}", response_model=ListItemOut)
def update_list_item(
    list_id: int, item_id: int, data: ListItemUpdate, db: Session = Depends(get_db)
):
    item = db.query(ListItem).filter(ListItem.id == item_id, ListItem.list_id == list_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = data.model_dump(exclude_unset=True)
    watched_person_fields = {"watched_parent1", "watched_parent2", "watched_kids"}
    watched_updates = {k: v for k, v in updates.items() if k in watched_person_fields}
    meta_updates = {k: v for k, v in updates.items()
                    if k not in watched_person_fields and k != "not_interested"}

    # Watched fields: route to media_items if owned, else update list_item directly
    if watched_updates:
        if item.media_id:
            media = db.query(MediaItem).filter(MediaItem.id == item.media_id).first()
            if media:
                for k, v in watched_updates.items():
                    setattr(media, k, v)
                media.watched = bool(media.watched_parent1 or media.watched_parent2 or media.watched_kids)
        else:
            for k, v in watched_updates.items():
                setattr(item, k, v)

    # Metadata fields
    for k, v in meta_updates.items():
        setattr(item, k, v)

    # not_interested: global propagation
    if "not_interested" in updates:
        _propagate_not_interested(db, updates["not_interested"], item)

    if meta_updates:
        item.media_id = _match_item(db, item)

    _update_badge_timestamps(db, list_id)
    db.commit()
    db.refresh(item)
    return _build_item_out(item, _get_item_media(db, item))


@router.delete("/lists/{list_id}/items/{item_id}", status_code=204)
def delete_list_item(list_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.query(ListItem).filter(ListItem.id == item_id, ListItem.list_id == list_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.flush()
    _update_badge_timestamps(db, list_id)
    db.commit()


# ── CSV import ────────────────────────────────────────────────────────────────

@router.post("/lists/{list_id}/import/csv", response_model=ImportListResponse)
async def import_list_csv(
    list_id: int,
    file: UploadFile,
    mode: str = "overwrite",  # "overwrite" | "archive"
    db: Session = Depends(get_db),
):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")

    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False)
        df = df.replace("", pd.NA)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}")

    # Determine target list
    has_items = db.query(ListItem).filter(ListItem.list_id == list_id).count() > 0
    if mode == "archive" and has_items:
        target_id = _archive_list(db, list_id)
        db.flush()
    else:
        db.query(ListItem).filter(ListItem.list_id == list_id).delete()
        db.flush()
        target_id = list_id

    new_items = []
    errors = []
    for idx, row in df.iterrows():
        item_data = {}
        for csv_col, model_field in LIST_COLUMN_MAP.items():
            raw = row.get(csv_col, pd.NA)
            item_data[model_field] = parse_int(raw) if model_field in LIST_INT_FIELDS else parse_str(raw)

        if not item_data.get("title"):
            errors.append(f"Row {idx + 2}: missing title, skipped")
            continue
        try:
            new_items.append(ListItem(list_id=target_id, **item_data))
        except Exception as exc:
            errors.append(f"Row {idx + 2}: {exc}")

    stats = _do_import_and_match(db, target_id, new_items)
    db.commit()
    return {**stats, "errors": errors}


# ── TMDB import ───────────────────────────────────────────────────────────────

@router.post("/lists/{list_id}/import/tmdb", response_model=ImportListResponse)
def import_from_tmdb(list_id: int, body: TMDBImportRequest, db: Session = Depends(get_db)):
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    api_key = _get_tmdb_key(db)
    if not api_key:
        raise HTTPException(status_code=503, detail="TMDB API key not configured.")

    # Determine target list
    has_items = db.query(ListItem).filter(ListItem.list_id == list_id).count() > 0
    if body.mode == "archive" and has_items:
        target_id = _archive_list(db, list_id)
        db.flush()
    else:
        db.query(ListItem).filter(ListItem.list_id == list_id).delete()
        db.flush()
        target_id = list_id

    # Update source_ref on target list
    target_ml = db.query(MediaList).filter(MediaList.id == target_id).first()
    if target_ml:
        target_ml.source_ref = f"tmdb:{body.tmdb_list_id}"
        target_ml.source_name = "TMDB"
    db.flush()

    new_items = []
    errors = []
    rank = 1
    for page_num in range(1, body.page_limit + 1):
        try:
            data = _tmdb_fetch_page(api_key, body.tmdb_list_id, page=page_num)
        except HTTPException as exc:
            errors.append(f"Page {page_num}: {exc.detail}")
            break
        results = data.get("results", [])
        if not results:
            break
        for result in results:
            new_items.append(_tmdb_result_to_item(result, rank, target_id))
            rank += 1
        if page_num >= data.get("total_pages", 1):
            break

    stats = _do_import_and_match(db, target_id, new_items)
    db.commit()
    return {**stats, "errors": errors}


# ── Poster backfill ───────────────────────────────────────────────────────────

@router.post("/lists/{list_id}/refresh-posters")
def refresh_posters(list_id: int, db: Session = Depends(get_db)):
    """Re-fetch the TMDB source list and fill in any missing poster_url values.
    Does NOT touch watched_* or not_interested — safe to run on existing data."""
    ml = db.query(MediaList).filter(MediaList.id == list_id).first()
    if not ml:
        raise HTTPException(status_code=404, detail="List not found")
    if not ml.source_ref or not ml.source_ref.startswith("tmdb:"):
        raise HTTPException(status_code=400, detail="List has no TMDB source reference")
    api_key = _get_tmdb_key(db)
    if not api_key:
        raise HTTPException(status_code=503, detail="TMDB API key not configured.")

    tmdb_list_id = ml.source_ref[len("tmdb:"):]

    # Build tmdb_id → poster_url map by fetching all pages of the source list
    tmdb_posters: dict = {}
    page = 1
    while True:
        try:
            data = _tmdb_fetch_page(api_key, tmdb_list_id, page=page)
        except HTTPException:
            break
        for result in data.get("results", []):
            poster_path = result.get("poster_path")
            if poster_path:
                tmdb_posters[str(result["id"])] = f"https://image.tmdb.org/t/p/w185{poster_path}"
        if page >= data.get("total_pages", 1):
            break
        page += 1

    # Update list_items that have a matching tmdb_id
    items = db.query(ListItem).filter(ListItem.list_id == list_id).all()
    updated = 0
    for item in items:
        if item.tmdb_id and item.tmdb_id in tmdb_posters:
            new_url = tmdb_posters[item.tmdb_id]
            if item.poster_url != new_url:
                item.poster_url = new_url
                updated += 1

    db.commit()
    return {"updated": updated, "total": len(items)}
