from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, func
from database import Base


class MediaItem(Base):
    __tablename__ = "media_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False, index=True)
    media_type = Column(String, nullable=True)
    year = Column(Integer, nullable=True)

    # Physical formats
    physical_bluray = Column(Boolean, default=False)
    physical_dvd = Column(Boolean, default=False)
    physical_4k = Column(Boolean, default=False)
    physical_notes = Column(String, nullable=True)

    # Digital platforms
    digital_apple_tv = Column(Boolean, default=False)
    digital_plex = Column(Boolean, default=False)
    # digital_movies_anywhere kept as dead column (removed from app, all values were False)

    # Location & loans
    location = Column(String, nullable=True)
    loaned_to = Column(String, nullable=True)

    # Personal tracking
    watched = Column(Boolean, default=False)
    watched_parent1 = Column(Boolean, default=False)
    watched_parent2 = Column(Boolean, default=False)
    watched_kids = Column(Boolean, default=False)
    not_interested = Column(Boolean, default=False)
    # my_rating kept as dead column (data migrated to parent1_rating at startup)
    parent1_rating = Column(Float, nullable=True)
    parent2_rating = Column(Float, nullable=True)
    kids_rating = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)

    # Metadata
    director = Column(String, nullable=True)
    genre = Column(String, nullable=True)
    runtime = Column(Integer, nullable=True)
    mpaa_rating = Column(String, nullable=True)
    plot = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    imdb_id = Column(String, nullable=True)
    tmdb_id = Column(String, nullable=True)


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)


class MovieNightSession(Base):
    __tablename__ = "movie_night_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String, unique=True, index=True, nullable=False)
    participants = Column(Text, nullable=False)   # JSON array of participant keys
    format_filter = Column(String, default="both")      # "digital"|"physical"|"both"
    max_mpaa_rating = Column(String, nullable=True)     # None=any, "G","PG","PG-13","R","NC-17"
    media_type_filter = Column(String, nullable=True)   # None=both, "Movie","TV Series"
    status = Column(String, default="active")           # "active"|"ended"
    mode = Column(String, default="normal")             # "normal"|"final_pick"
    continue_from_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=func.now())
    expires_at = Column(DateTime, nullable=False)


class SessionItem(Base):
    __tablename__ = "session_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, nullable=False, index=True)
    media_id = Column(Integer, nullable=False)
    display_order = Column(Integer, nullable=False)


class SessionSwipe(Base):
    __tablename__ = "session_swipes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, nullable=False, index=True)
    media_id = Column(Integer, nullable=False)
    participant_key = Column(String, nullable=False)  # "parent1","parent2","kid_1"…
    swiped_right = Column(Boolean, nullable=False)
    swiped_at = Column(DateTime, default=func.now())


class MediaList(Base):
    __tablename__ = "lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    list_type = Column(String, default="custom")       # "custom" | "external"
    source_name = Column(String, nullable=True)        # "TMDB" | "AFI" | "Friends" | free-form
    source_url = Column(String, nullable=True)
    source_ref = Column(String, nullable=True)         # e.g. "tmdb:movie/top_rated" for refresh
    version_note = Column(String, nullable=True)       # "pulled 2026-04-12" on archived copies
    parent_list_id = Column(Integer, nullable=True)    # soft FK to lists.id for archived copies
    is_archived = Column(Boolean, default=False)
    owned_completed_at = Column(DateTime, nullable=True)
    watched_completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class ListItem(Base):
    __tablename__ = "list_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    list_id = Column(Integer, nullable=False, index=True)
    rank = Column(Integer, nullable=True)
    title = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    imdb_id = Column(String, nullable=True)
    tmdb_id = Column(String, nullable=True)
    media_id = Column(Integer, nullable=True)          # soft FK to media_items.id when matched
    poster_url = Column(String, nullable=True)
    watched_parent1 = Column(Boolean, default=False)
    watched_parent2 = Column(Boolean, default=False)
    watched_kids = Column(Boolean, default=False)
    not_interested = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    added_at = Column(DateTime, default=func.now())
