import json
import os
from typing import Optional
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import ListItem, MediaItem, SystemSetting
from schemas import MediaItemCreate, MediaItemOut, MediaItemUpdate, MediaListResponse, StatsResponse

router = APIRouter()


@router.get("/media/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(MediaItem.id)).scalar()
    movies = db.query(func.count(MediaItem.id)).filter(MediaItem.media_type == "Movie").scalar()
    tv_series = db.query(func.count(MediaItem.id)).filter(MediaItem.media_type == "TV Series").scalar()

    physical_total = db.query(func.count(MediaItem.id)).filter(
        or_(
            MediaItem.physical_bluray == True,
            MediaItem.physical_dvd == True,
            MediaItem.physical_4k == True,
        )
    ).scalar()

    physical_bluray = db.query(func.count(MediaItem.id)).filter(MediaItem.physical_bluray == True).scalar()
    physical_dvd = db.query(func.count(MediaItem.id)).filter(MediaItem.physical_dvd == True).scalar()
    physical_4k = db.query(func.count(MediaItem.id)).filter(MediaItem.physical_4k == True).scalar()
    digital_apple_tv = db.query(func.count(MediaItem.id)).filter(MediaItem.digital_apple_tv == True).scalar()
    digital_plex = db.query(func.count(MediaItem.id)).filter(MediaItem.digital_plex == True).scalar()

    loaned_out = db.query(func.count(MediaItem.id)).filter(
        MediaItem.loaned_to != None,
        MediaItem.loaned_to != "",
    ).scalar()

    watched = db.query(func.count(MediaItem.id)).filter(MediaItem.watched == True).scalar()

    return StatsResponse(
        total=total,
        movies=movies,
        tv_series=tv_series,
        physical_total=physical_total,
        physical_bluray=physical_bluray,
        physical_dvd=physical_dvd,
        physical_4k=physical_4k,
        digital_apple_tv=digital_apple_tv,
        digital_plex=digital_plex,
        loaned_out=loaned_out,
        watched=watched,
    )


def _safe_str(val):
    if not val or val == "N/A":
        return None
    return val.strip()


def _safe_int(val):
    if not val or val == "N/A":
        return None
    try:
        return int(str(val).replace(" min", "").replace(",", "")[:4])
    except (ValueError, TypeError):
        return None


@router.get("/media/lookup")
def lookup_metadata(
    title: str = Query(...),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    # DB setting takes precedence over env var
    setting = db.query(SystemSetting).filter(SystemSetting.key == "omdb_api_key").first()
    api_key = (setting.value if setting and setting.value else "").strip()
    if not api_key:
        api_key = os.getenv("OMDB_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OMDB API key is not configured. Add it in Settings or set OMDB_API_KEY in your .env file.",
        )

    params = {"apikey": api_key, "t": title}
    if year:
        params["y"] = year

    url = "http://www.omdbapi.com/?" + urlencode(params)
    try:
        with urlopen(url, timeout=8) as resp:
            data = json.loads(resp.read().decode())
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"OMDB request failed: {exc}")

    if data.get("Response") == "False":
        raise HTTPException(status_code=404, detail=data.get("Error", "Title not found"))

    rated = _safe_str(data.get("Rated"))
    if rated not in ("G", "PG", "PG-13", "R", "NC-17", "Not Rated"):
        rated = None

    return {
        "title":       _safe_str(data.get("Title")),
        "year":        _safe_int(data.get("Year", "")),
        "director":    _safe_str(data.get("Director")),
        "genre":       _safe_str(data.get("Genre")),
        "runtime":     _safe_int(data.get("Runtime")),
        "mpaa_rating": rated,
        "plot":        _safe_str(data.get("Plot")),
        "cover_url":   _safe_str(data.get("Poster")),
        "imdb_id":     _safe_str(data.get("imdbID")),
    }


@router.get("/media/", response_model=MediaListResponse)
def list_media(
    search: Optional[str] = None,
    media_type: Optional[str] = None,
    physical_bluray: Optional[bool] = None,
    physical_dvd: Optional[bool] = None,
    physical_4k: Optional[bool] = None,
    digital_apple_tv: Optional[bool] = None,
    digital_plex: Optional[bool] = None,
    location: Optional[str] = None,
    loaned: Optional[bool] = None,
    watched: Optional[bool] = None,
    genre: Optional[str] = None,
    mpaa_rating: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(MediaItem)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                MediaItem.title.ilike(pattern),
                MediaItem.director.ilike(pattern),
            )
        )
    if media_type:
        query = query.filter(MediaItem.media_type == media_type)
    if physical_bluray is not None:
        query = query.filter(MediaItem.physical_bluray == physical_bluray)
    if physical_dvd is not None:
        query = query.filter(MediaItem.physical_dvd == physical_dvd)
    if physical_4k is not None:
        query = query.filter(MediaItem.physical_4k == physical_4k)
    if digital_apple_tv is not None:
        query = query.filter(MediaItem.digital_apple_tv == digital_apple_tv)
    if digital_plex is not None:
        query = query.filter(MediaItem.digital_plex == digital_plex)
    if location:
        query = query.filter(MediaItem.location.ilike(f"%{location}%"))
    if loaned is True:
        query = query.filter(
            MediaItem.loaned_to != None,
            MediaItem.loaned_to != "",
        )
    elif loaned is False:
        query = query.filter(
            or_(MediaItem.loaned_to == None, MediaItem.loaned_to == "")
        )
    if watched is not None:
        query = query.filter(MediaItem.watched == watched)
    if genre:
        query = query.filter(MediaItem.genre.ilike(f"%{genre}%"))
    if mpaa_rating:
        query = query.filter(MediaItem.mpaa_rating == mpaa_rating)

    total = query.count()
    items = query.order_by(MediaItem.title).offset(skip).limit(limit).all()

    return MediaListResponse(items=items, total=total)


@router.get("/media/{item_id}", response_model=MediaItemOut)
def get_media(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.post("/media/", response_model=MediaItemOut, status_code=201)
def create_media(data: MediaItemCreate, db: Session = Depends(get_db)):
    item = MediaItem(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/media/{item_id}", response_model=MediaItemOut)
def update_media(item_id: int, data: MediaItemUpdate, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = data.model_dump(exclude_unset=True)
    watched_person_fields = {"watched_parent1", "watched_parent2", "watched_kids"}

    for field, value in updates.items():
        setattr(item, field, value)

    # Recompute aggregate watched whenever per-person fields change
    if watched_person_fields & updates.keys():
        item.watched = bool(item.watched_parent1 or item.watched_parent2 or item.watched_kids)

    # Propagate not_interested to all list_items linked to this media_item
    if "not_interested" in updates:
        db.query(ListItem).filter(ListItem.media_id == item_id).update(
            {"not_interested": updates["not_interested"]}, synchronize_session=False
        )

    db.commit()
    db.refresh(item)
    return item


@router.delete("/media/{item_id}", status_code=204)
def delete_media(item_id: int, db: Session = Depends(get_db)):
    item = db.query(MediaItem).filter(MediaItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
