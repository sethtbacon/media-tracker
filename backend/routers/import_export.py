import io
import csv
import json
import os
import time
from typing import Optional
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import MediaItem, SystemSetting
from schemas import ImportResponse

router = APIRouter()

# CSV column -> model field mapping
COLUMN_MAP = {
    "Title": "title",
    "Media_Type": "media_type",
    "Physical_Bluray": "physical_bluray",
    "Physical_DVD": "physical_dvd",
    "Physical_4K": "physical_4k",
    "Physical_Notes": "physical_notes",
    "Digital_Apple_TV": "digital_apple_tv",
    "Digital_Plex": "digital_plex",
    "Digital_Movies_Anywhere": "digital_movies_anywhere",
    "Location": "location",
    "Watched": "watched",
    "Parent1_Rating": "parent1_rating",
    "Parent2_Rating": "parent2_rating",
    "Kids_Rating": "kids_rating",
    "Loaned_To": "loaned_to",
    "Notes": "notes",
    "Year": "year",
    "Director": "director",
    "Genre": "genre",
    "Runtime": "runtime",
    "MPAA_Rating": "mpaa_rating",
    "Plot": "plot",
    "Cover_URL": "cover_url",
    "IMDB_ID": "imdb_id",
    "TMDB_ID": "tmdb_id",
}

BOOLEAN_FIELDS = {
    "physical_bluray", "physical_dvd", "physical_4k",
    "digital_apple_tv", "digital_plex", "digital_movies_anywhere",
    "watched",
}

INT_FIELDS = {"year", "runtime"}

FLOAT_FIELDS = {"parent1_rating", "parent2_rating", "kids_rating"}


def parse_bool(value) -> bool:
    if pd.isna(value):
        return False
    return str(value).strip().lower() in ("yes", "true", "1", "y")


def parse_int(value) -> Optional[int]:
    if pd.isna(value):
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


def parse_float(value) -> Optional[float]:
    if pd.isna(value):
        return None
    try:
        return float(str(value))
    except (ValueError, TypeError):
        return None


def parse_str(value) -> Optional[str]:
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s if s else None


@router.post("/import/csv", response_model=ImportResponse)
async def import_csv(
    file: UploadFile = File(...),
    replace_all: bool = Query(False),
    db: Session = Depends(get_db),
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents), dtype=str, keep_default_na=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {e}")

    # Replace NaN-like empty strings with actual NaN for easier handling
    df = df.replace("", pd.NA)

    if replace_all:
        db.query(MediaItem).delete()
        db.commit()

    imported = 0
    skipped = 0
    errors = []

    for idx, row in df.iterrows():
        title_raw = row.get("Title", pd.NA)
        if pd.isna(title_raw) or str(title_raw).strip() == "":
            skipped += 1
            continue

        try:
            item_data = {}
            for csv_col, model_field in COLUMN_MAP.items():
                raw = row.get(csv_col, pd.NA)

                if model_field in BOOLEAN_FIELDS:
                    item_data[model_field] = parse_bool(raw)
                elif model_field in INT_FIELDS:
                    item_data[model_field] = parse_int(raw)
                elif model_field in FLOAT_FIELDS:
                    item_data[model_field] = parse_float(raw)
                else:
                    item_data[model_field] = parse_str(raw)

            item = MediaItem(**item_data)
            db.add(item)
            imported += 1
        except Exception as e:
            errors.append(f"Row {idx + 2}: {e}")
            skipped += 1

    db.commit()
    return ImportResponse(imported=imported, skipped=skipped, errors=errors)


# Exact export column order per spec
EXPORT_COLUMNS = [
    ("Title", "title"),
    ("Media_Type", "media_type"),
    ("Physical_Bluray", "physical_bluray"),
    ("Physical_DVD", "physical_dvd"),
    ("Physical_4K", "physical_4k"),
    ("Physical_Notes", "physical_notes"),
    ("Digital_Apple_TV", "digital_apple_tv"),
    ("Digital_Plex", "digital_plex"),
    ("Digital_Movies_Anywhere", "digital_movies_anywhere"),
    ("Location", "location"),
    ("Watched", "watched"),
    ("Parent1_Rating", "parent1_rating"),
    ("Parent2_Rating", "parent2_rating"),
    ("Kids_Rating", "kids_rating"),
    ("Loaned_To", "loaned_to"),
    ("Notes", "notes"),
    ("Year", "year"),
    ("Director", "director"),
    ("Genre", "genre"),
    ("Runtime", "runtime"),
    ("MPAA_Rating", "mpaa_rating"),
    ("Plot", "plot"),
    ("Cover_URL", "cover_url"),
    ("IMDB_ID", "imdb_id"),
    ("TMDB_ID", "tmdb_id"),
]


def generate_csv(items):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[col for col, _ in EXPORT_COLUMNS])
    writer.writeheader()
    for item in items:
        row = {}
        for csv_col, field in EXPORT_COLUMNS:
            value = getattr(item, field, None)
            if value is None:
                row[csv_col] = ""
            elif isinstance(value, bool):
                row[csv_col] = "Yes" if value else ""
            else:
                row[csv_col] = value
        writer.writerow(row)
    output.seek(0)
    yield output.read()


@router.get("/import/export/csv")
def export_csv(
    search: Optional[str] = None,
    media_type: Optional[str] = None,
    physical_bluray: Optional[bool] = None,
    physical_dvd: Optional[bool] = None,
    physical_4k: Optional[bool] = None,
    digital_apple_tv: Optional[bool] = None,
    digital_plex: Optional[bool] = None,
    digital_movies_anywhere: Optional[bool] = None,
    location: Optional[str] = None,
    loaned: Optional[bool] = None,
    watched: Optional[bool] = None,
    genre: Optional[str] = None,
    mpaa_rating: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(MediaItem)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(MediaItem.title.ilike(pattern), MediaItem.director.ilike(pattern))
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
    if digital_movies_anywhere is not None:
        query = query.filter(MediaItem.digital_movies_anywhere == digital_movies_anywhere)
    if location:
        query = query.filter(MediaItem.location.ilike(f"%{location}%"))
    if loaned is True:
        query = query.filter(MediaItem.loaned_to != None, MediaItem.loaned_to != "")
    if watched is not None:
        query = query.filter(MediaItem.watched == watched)
    if genre:
        query = query.filter(MediaItem.genre.ilike(f"%{genre}%"))
    if mpaa_rating:
        query = query.filter(MediaItem.mpaa_rating == mpaa_rating)

    items = query.order_by(MediaItem.title).all()
    return StreamingResponse(
        generate_csv(items),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=media_collection.csv"},
    )


def _get_omdb_key(db: Session) -> Optional[str]:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "omdb_api_key").first()
    key = (setting.value if setting and setting.value else "").strip()
    return key or os.getenv("OMDB_API_KEY", "").strip() or None


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


@router.get("/import/fetch-metadata/status")
def fetch_metadata_status(db: Session = Depends(get_db)):
    """Return count of items that have not had OMDB metadata pulled yet."""
    missing = db.query(func.count(MediaItem.id)).filter(
        or_(MediaItem.imdb_id == None, MediaItem.imdb_id == "")
    ).scalar()
    return {"missing": missing}


@router.post("/import/fetch-metadata")
def fetch_missing_metadata(
    batch_size: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Fetch OMDB metadata for a batch of items that have no imdb_id yet."""
    api_key = _get_omdb_key(db)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OMDB API key is not configured. Add it in Settings.",
        )

    total_missing = db.query(func.count(MediaItem.id)).filter(
        or_(MediaItem.imdb_id == None, MediaItem.imdb_id == "")
    ).scalar()

    items = (
        db.query(MediaItem)
        .filter(or_(MediaItem.imdb_id == None, MediaItem.imdb_id == ""))
        .order_by(MediaItem.title)
        .limit(batch_size)
        .all()
    )

    updated = 0
    not_found = 0
    failed = 0

    for item in items:
        params = {"apikey": api_key, "t": item.title}
        if item.year:
            params["y"] = item.year
        url = "http://www.omdbapi.com/?" + urlencode(params)
        try:
            with urlopen(url, timeout=8) as resp:
                data = json.loads(resp.read().decode())
        except URLError:
            failed += 1
            time.sleep(0.25)
            continue

        if data.get("Response") == "False":
            # Mark as attempted so it doesn't re-queue on every run
            item.imdb_id = "NOT_FOUND"
            not_found += 1
            time.sleep(0.25)
            continue

        item.director    = _safe_str(data.get("Director"))    or item.director
        item.genre       = _safe_str(data.get("Genre"))       or item.genre
        item.runtime     = _safe_int(data.get("Runtime"))     or item.runtime
        item.plot        = _safe_str(data.get("Plot"))        or item.plot
        item.cover_url   = _safe_str(data.get("Poster"))      or item.cover_url
        item.imdb_id     = _safe_str(data.get("imdbID"))
        if not item.year:
            item.year    = _safe_int(data.get("Year", ""))
        rated = _safe_str(data.get("Rated"))
        if rated in ("G", "PG", "PG-13", "R", "NC-17", "Not Rated"):
            item.mpaa_rating = rated

        updated += 1
        time.sleep(0.25)

    db.commit()

    remaining = max(0, total_missing - len(items))
    return {
        "updated":   updated,
        "not_found": not_found,
        "failed":    failed,
        "processed": len(items),
        "remaining": remaining,
    }
