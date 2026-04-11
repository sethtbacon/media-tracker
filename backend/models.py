from sqlalchemy import Boolean, Column, Float, Integer, String, Text
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
    digital_movies_anywhere = Column(Boolean, default=False)

    # Location & loans
    location = Column(String, nullable=True)
    loaned_to = Column(String, nullable=True)

    # Personal tracking
    watched = Column(Boolean, default=False)
    my_rating = Column(Float, nullable=True)
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
