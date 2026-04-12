from typing import Any, Dict, List, Optional
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
    parent1_rating: Optional[float] = None
    parent2_rating: Optional[float] = None
    kids_rating: Optional[float] = None
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
    parent1_rating: Optional[float] = None
    parent2_rating: Optional[float] = None
    kids_rating: Optional[float] = None
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
    watched: int


class ImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


class SettingOut(BaseModel):
    key: str
    value: Optional[str] = None

    model_config = {"from_attributes": True}


class SettingUpdate(BaseModel):
    value: Optional[str] = None


# ── Movie Night ──────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    participants: List[str]                    # ["parent1", "parent2", "kid_1"]
    format_filter: str = "both"               # "digital"|"physical"|"both"
    max_mpaa_rating: Optional[str] = None     # None=any, "G","PG","PG-13","R","NC-17"
    media_type: Optional[str] = None          # None=both, "Movie","TV Series"
    size: Optional[int] = None                # falls back to setting default (18)
    continue_from_code: Optional[str] = None


class SwipeCreate(BaseModel):
    media_id: int
    participant_key: str
    swiped_right: bool


class SessionItemOut(BaseModel):
    media_id: int
    title: str
    year: Optional[int] = None
    cover_url: Optional[str] = None
    mpaa_rating: Optional[str] = None
    runtime: Optional[int] = None
    display_order: int
    # availability flags for the matches view
    digital_apple_tv: bool = False
    digital_plex: bool = False
    digital_movies_anywhere: bool = False
    physical_4k: bool = False
    physical_bluray: bool = False
    physical_dvd: bool = False


class SessionOut(BaseModel):
    code: str
    status: str
    mode: str
    participants: List[str]
    participant_names: Dict[str, str]
    format_filter: str
    size: int
    items: List[SessionItemOut]
    progress: Dict[str, int]      # {participant_key: swipes_submitted}
    matches: List[int]            # media_ids of confirmed matches
    carry_over_count: int
    created_at: str


class SessionHistoryItem(BaseModel):
    code: str
    status: str
    participants: List[str]
    participant_names: Dict[str, str]
    match_count: int
    carry_over_count: int
    created_at: str
