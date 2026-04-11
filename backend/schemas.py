from typing import List, Optional
from pydantic import BaseModel


class MediaItemBase(BaseModel):
    title: str
    media_type: Optional[str] = None
    year: Optional[int] = None
    physical_bluray: Optional[bool] = False
    physical_dvd: Optional[bool] = False
    physical_4k: Optional[bool] = False
    physical_notes: Optional[str] = None
    digital_apple_tv: Optional[bool] = False
    digital_plex: Optional[bool] = False
    digital_movies_anywhere: Optional[bool] = False
    location: Optional[str] = None
    loaned_to: Optional[str] = None
    watched: Optional[bool] = False
    my_rating: Optional[float] = None
    notes: Optional[str] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    runtime: Optional[int] = None
    mpaa_rating: Optional[str] = None
    plot: Optional[str] = None
    cover_url: Optional[str] = None
    imdb_id: Optional[str] = None
    tmdb_id: Optional[str] = None


class MediaItemCreate(MediaItemBase):
    pass


class MediaItemUpdate(BaseModel):
    title: Optional[str] = None
    media_type: Optional[str] = None
    year: Optional[int] = None
    physical_bluray: Optional[bool] = None
    physical_dvd: Optional[bool] = None
    physical_4k: Optional[bool] = None
    physical_notes: Optional[str] = None
    digital_apple_tv: Optional[bool] = None
    digital_plex: Optional[bool] = None
    digital_movies_anywhere: Optional[bool] = None
    location: Optional[str] = None
    loaned_to: Optional[str] = None
    watched: Optional[bool] = None
    my_rating: Optional[float] = None
    notes: Optional[str] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    runtime: Optional[int] = None
    mpaa_rating: Optional[str] = None
    plot: Optional[str] = None
    cover_url: Optional[str] = None
    imdb_id: Optional[str] = None
    tmdb_id: Optional[str] = None


class MediaItemOut(MediaItemBase):
    id: int

    model_config = {"from_attributes": True}


class MediaListResponse(BaseModel):
    items: List[MediaItemOut]
    total: int


class StatsResponse(BaseModel):
    total: int
    movies: int
    tv_series: int
    physical_total: int
    physical_bluray: int
    physical_dvd: int
    physical_4k: int
    digital_apple_tv: int
    digital_plex: int
    digital_movies_anywhere: int
    loaned_out: int


class ImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]
