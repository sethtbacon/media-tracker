#!/usr/bin/env python3
"""Reject tracked runtime data, credentials, and generated build artifacts."""

from __future__ import annotations

from pathlib import Path
import re
import subprocess


ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_NAMES = {".env", ".DS_Store"}
FORBIDDEN_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".pem", ".key", ".p12"}
FORBIDDEN_PARTS = {"node_modules", "__pycache__", ".venv", "dist"}
SECRET_MARKERS = (
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"gh[opusr]_[A-Za-z0-9_]{20,}"),
    re.compile(rb"github_pat_[A-Za-z0-9_]{20,}"),
)


def repository_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    return [ROOT / name.decode() for name in result.stdout.split(b"\0") if name]


def main() -> None:
    failures: list[str] = []
    for path in repository_files():
        relative = path.relative_to(ROOT)
        if (
            path.name in FORBIDDEN_NAMES
            or path.suffix.lower() in FORBIDDEN_SUFFIXES
            or FORBIDDEN_PARTS.intersection(relative.parts)
        ):
            failures.append(f"forbidden tracked path: {relative}")
            continue
        if not path.is_file() or path.stat().st_size > 2_000_000:
            continue
        content = path.read_bytes()
        if any(pattern.search(content) for pattern in SECRET_MARKERS):
            failures.append(f"possible credential material: {relative}")

    if failures:
        raise SystemExit("\n".join(failures))
    print("repo_hygiene=passed")


if __name__ == "__main__":
    main()