"""
Idempotent schema migrations for SQLite.
Called on every startup before create_all — safe to run repeatedly.
"""
from sqlalchemy import inspect, text
from database import engine


def run_migrations():
    with engine.begin() as conn:
        cols = {c["name"] for c in inspect(engine).get_columns("media_items")}

        # Per-person rating columns replacing my_rating
        if "parent1_rating" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN parent1_rating FLOAT"))
        if "parent2_rating" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN parent2_rating FLOAT"))
        if "kids_rating" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN kids_rating FLOAT"))

        # One-time data migration: copy existing my_rating → parent1_rating
        if "my_rating" in cols:
            conn.execute(text(
                "UPDATE media_items SET parent1_rating = my_rating "
                "WHERE parent1_rating IS NULL AND my_rating IS NOT NULL"
            ))

        # Movie Night session filter columns
        mn_cols = {c["name"] for c in inspect(engine).get_columns("movie_night_sessions")}
        if "max_mpaa_rating" not in mn_cols:
            conn.execute(text("ALTER TABLE movie_night_sessions ADD COLUMN max_mpaa_rating TEXT"))
        if "media_type_filter" not in mn_cols:
            conn.execute(text("ALTER TABLE movie_night_sessions ADD COLUMN media_type_filter TEXT"))

        # Per-person watched columns + global not_interested on media_items
        if "watched_parent1" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN watched_parent1 BOOLEAN NOT NULL DEFAULT 0"))
            # Migrate existing watched=1 to watched_parent1=1 (attribute to parent1)
            conn.execute(text("UPDATE media_items SET watched_parent1 = 1 WHERE watched = 1"))
        if "watched_parent2" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN watched_parent2 BOOLEAN NOT NULL DEFAULT 0"))
        if "watched_kids" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN watched_kids BOOLEAN NOT NULL DEFAULT 0"))
        if "not_interested" not in cols:
            conn.execute(text("ALTER TABLE media_items ADD COLUMN not_interested BOOLEAN NOT NULL DEFAULT 0"))

        # list_items: poster + per-person watched + not_interested
        li_cols = {c["name"] for c in inspect(engine).get_columns("list_items")}
        if "poster_url" not in li_cols:
            conn.execute(text("ALTER TABLE list_items ADD COLUMN poster_url TEXT"))
        if "watched_parent1" not in li_cols:
            conn.execute(text("ALTER TABLE list_items ADD COLUMN watched_parent1 BOOLEAN NOT NULL DEFAULT 0"))
        if "watched_parent2" not in li_cols:
            conn.execute(text("ALTER TABLE list_items ADD COLUMN watched_parent2 BOOLEAN NOT NULL DEFAULT 0"))
        if "watched_kids" not in li_cols:
            conn.execute(text("ALTER TABLE list_items ADD COLUMN watched_kids BOOLEAN NOT NULL DEFAULT 0"))
        if "not_interested" not in li_cols:
            conn.execute(text("ALTER TABLE list_items ADD COLUMN not_interested BOOLEAN NOT NULL DEFAULT 0"))
