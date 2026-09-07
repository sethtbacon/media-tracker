#!/usr/bin/env python3
"""Exercise bootstrap, legacy migration, and HTTP CRUD against temporary SQLite DBs."""

from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"


def database_url(path: Path) -> str:
    return f"sqlite:///{path}"


def startup(path: Path) -> None:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url(path)
    subprocess.run(
        [sys.executable, "-c", "import main"],
        cwd=BACKEND,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def columns(connection: sqlite3.Connection, table: str) -> set[str]:
    return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}


def check_fresh_bootstrap(directory: Path) -> Path:
    path = directory / "fresh.db"
    startup(path)
    with sqlite3.connect(path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        required = {
            "media_items",
            "system_settings",
            "movie_night_sessions",
            "session_items",
            "session_swipes",
            "lists",
            "list_items",
        }
        assert required <= tables, f"missing tables: {sorted(required - tables)}"
        assert {
            "watched_parent1",
            "parent1_rating",
            "tmdb_collection_id",
        } <= columns(connection, "media_items")
    return path


def create_legacy_database(path: Path) -> None:
    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            CREATE TABLE media_items (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                watched BOOLEAN NOT NULL DEFAULT 0,
                my_rating FLOAT
            );
            INSERT INTO media_items (id, title, watched, my_rating)
            VALUES (1, 'Migration fixture', 1, 4.5);

            CREATE TABLE movie_night_sessions (
                id INTEGER PRIMARY KEY,
                code TEXT,
                participants TEXT,
                status TEXT,
                expires_at DATETIME
            );

            CREATE TABLE list_items (
                id INTEGER PRIMARY KEY,
                list_id INTEGER,
                title TEXT
            );
            """
        )


def check_legacy_migration(directory: Path) -> None:
    path = directory / "legacy.db"
    create_legacy_database(path)
    startup(path)
    # Running startup twice proves migrations remain idempotent.
    startup(path)
    with sqlite3.connect(path) as connection:
        media_columns = columns(connection, "media_items")
        assert {
            "parent1_rating",
            "parent2_rating",
            "kids_rating",
            "watched_parent1",
            "watched_parent2",
            "watched_kids",
            "not_interested",
            "tmdb_collection_id",
            "tmdb_collection_name",
        } <= media_columns
        rating, watched = connection.execute(
            "SELECT parent1_rating, watched_parent1 FROM media_items WHERE id = 1"
        ).fetchone()
        assert rating == 4.5
        assert watched == 1


def free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def request(url: str, method: str = "GET", body: dict | None = None) -> tuple[int, Any]:
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=5) as response:
        content = response.read()
        return response.status, json.loads(content) if content else None


def check_http_crud(path: Path) -> None:
    port = free_port()
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url(path)
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "warning",
        ],
        cwd=BACKEND,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        deadline = time.monotonic() + 15
        while True:
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                raise RuntimeError(f"API exited during startup: {output}")
            try:
                status, _ = request(base + "/openapi.json")
                if status == 200:
                    break
            except (urllib.error.URLError, TimeoutError):
                pass
            if time.monotonic() >= deadline:
                raise RuntimeError("API did not become ready within 15 seconds")
            time.sleep(0.1)

        status, created = request(
            base + "/api/media/",
            "POST",
            {"title": "CI fixture", "media_type": "Movie", "physical_4k": True},
        )
        assert status == 201
        item_id = created["id"]

        status, listing = request(base + "/api/media/?search=CI%20fixture")
        assert status == 200
        assert listing["total"] == 1
        assert listing["items"][0]["id"] == item_id

        status, updated = request(
            base + f"/api/media/{item_id}",
            "PUT",
            {"watched_parent1": True},
        )
        assert status == 200
        assert updated["watched_parent1"] is True
        assert updated["watched"] is True

        status, stats = request(base + "/api/media/stats")
        assert status == 200
        assert stats["total"] == 1
        assert stats["physical_4k"] == 1
        assert stats["watched"] == 1
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="media-tracker-ci-") as temp:
        directory = Path(temp)
        fresh = check_fresh_bootstrap(directory)
        check_legacy_migration(directory)
        check_http_crud(fresh)
    print("backend_smoke=passed")


if __name__ == "__main__":
    main()