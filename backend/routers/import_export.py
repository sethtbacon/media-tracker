import io
import csv
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models import MediaItem
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
    "My_Rating": "my_rating",
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
                elif model_field == "my_rating":
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
    ("My_Rating", "my_rating"),
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
def export_csv(db: Session = Depends(get_db)):
    items = db.query(MediaItem).order_by(MediaItem.title).all()
    return StreamingResponse(
        generate_csv(items),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=media_collection.csv"},
    )
