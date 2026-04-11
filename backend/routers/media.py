from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import MediaItem
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
    digital_movies_anywhere = db.query(func.count(MediaItem.id)).filter(MediaItem.digital_movies_anywhere == True).scalar()

    loaned_out = db.query(func.count(MediaItem.id)).filter(
        MediaItem.loaned_to != None,
        MediaItem.loaned_to != "",
    ).scalar()

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
        digital_movies_anywhere=digital_movies_anywhere,
        loaned_out=loaned_out,
    )


@router.get("/media/", response_model=MediaListResponse)
def list_media(
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
    if digital_movies_anywhere is not None:
        query = query.filter(MediaItem.digital_movies_anywhere == digital_movies_anywhere)
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
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
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
