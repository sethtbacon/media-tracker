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
    location: Optional[str] = None
    loaned_to: Optional[str] = None
    watched: Optional[bool] = False
    watched_parent1: Optional[bool] = False
    watched_parent2: Optional[bool] = False
    watched_kids: Optional[bool] = False
    not_interested: Optional[bool] = False
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
    tmdb_collection_id: Optional[int] = None
    tmdb_collection_name: Optional[str] = None


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
    location: Optional[str] = None
    loaned_to: Optional[str] = None
    watched: Optional[bool] = None
    watched_parent1: Optional[bool] = None
    watched_parent2: Optional[bool] = None
    watched_kids: Optional[bool] = None
    not_interested: Optional[bool] = None
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
    tmdb_collection_id: Optional[int] = None
    tmdb_collection_name: Optional[str] = None


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


# ── Lists ─────────────────────────────────────────────────────────────────────

class ListBase(BaseModel):
    name: str
    description: Optional[str] = None
    list_type: str = "custom"         # "custom" | "external"
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    source_ref: Optional[str] = None  # e.g. "tmdb:movie/top_rated"


class ListCreate(ListBase):
    pass


class ListUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    list_type: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    source_ref: Optional[str] = None


class ListOut(ListBase):
    id: int
    version_note: Optional[str] = None
    parent_list_id: Optional[int] = None
    is_archived: bool = False
    owned_completed_at: Optional[str] = None
    watched_completed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # computed stats
    total: int = 0
    owned: int = 0
    watched: int = 0
    unowned: int = 0

    model_config = {"from_attributes": True}


class ListItemBase(BaseModel):
    title: str
    rank: Optional[int] = None
    year: Optional[int] = None
    imdb_id: Optional[str] = None
    tmdb_id: Optional[str] = None
    notes: Optional[str] = None


class ListItemCreate(ListItemBase):
    pass


class ListItemUpdate(BaseModel):
    title: Optional[str] = None
    rank: Optional[int] = None
    year: Optional[int] = None
    imdb_id: Optional[str] = None
    tmdb_id: Optional[str] = None
    notes: Optional[str] = None
    watched_parent1: Optional[bool] = None
    watched_parent2: Optional[bool] = None
    watched_kids: Optional[bool] = None
    not_interested: Optional[bool] = None


class ListItemOut(ListItemBase):
    id: int
    list_id: int
    media_id: Optional[int] = None
    owned: bool = False
    watched: bool = False
    watched_parent1: bool = False
    watched_parent2: bool = False
    watched_kids: bool = False
    not_interested: bool = False
    poster_url: Optional[str] = None
    media_cover_url: Optional[str] = None
    media_runtime: Optional[int] = None
    media_mpaa_rating: Optional[str] = None
    media_title: Optional[str] = None
    list_name: Optional[str] = None   # populated in aggregate views
    added_at: Optional[str] = None

    model_config = {"from_attributes": True}


class ListDetailOut(ListOut):
    items: List[ListItemOut] = []


class ListsResponse(BaseModel):
    items: List[ListOut]
    total: int


class ImportListResponse(BaseModel):
    imported: int
    matched: int
    unmatched: int
    errors: List[str]


class TMDBListOption(BaseModel):
    id: str
    name: str
    media_type: str


class TMDBPreviewItem(BaseModel):
    title: str
    year: Optional[int] = None
    tmdb_id: str


class TMDBPreviewResponse(BaseModel):
    items: List[TMDBPreviewItem]
    total_results: int


class TMDBImportRequest(BaseModel):
    tmdb_list_id: str
    page_limit: int = 5
    mode: str = "overwrite"   # "overwrite" | "archive"


class UnownedItemsResponse(BaseModel):
    items: List[ListItemOut]
    total: int


class CollectionFromTMDBRequest(BaseModel):
    tmdb_collection_id: int
    name: Optional[str] = None
