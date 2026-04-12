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
