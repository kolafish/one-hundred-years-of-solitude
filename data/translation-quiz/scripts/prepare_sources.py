#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[3]
QUIZ_DIR = ROOT / "data" / "translation-quiz"
VERSIONS_PATH = QUIZ_DIR / "versions.json"
LOCAL_VERSIONS_PATH = QUIZ_DIR / "versions.local.json"
MULTILINGUAL_QUOTES_PATH = ROOT / "data" / "bilingual" / "highlight_multilingual_quotes.json"
HIGHLIGHTS_DATA_JS = ROOT / "highlights" / "data.js"


def main() -> None:
    versions = read_json(VERSIONS_PATH)
    multilingual = read_json(MULTILINGUAL_QUOTES_PATH)
    highlights = read_highlights_data_js(HIGHLIGHTS_DATA_JS)

    local_source_paths = read_local_source_paths(LOCAL_VERSIONS_PATH)
    source_status = validate_versions(versions, local_source_paths)
    anchor_stats = summarize_anchors(multilingual)
    highlights_stats = summarize_highlights_page(highlights)

    report = {
        "versions": {
            "count": len(versions["versions"]),
            "includeInQuiz": [item["id"] for item in versions["versions"] if item.get("includeInQuiz")],
            "sourceStatus": source_status,
        },
        "anchors": anchor_stats,
        "highlightsPage": highlights_stats,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))

    missing = [item for item in source_status if not item["exists"]]
    if missing:
        raise SystemExit(f"{len(missing)} source path(s) are missing")
    if anchor_stats["uniqueChapterAnchors"] != 400:
        raise SystemExit("Expected 400 unique chapter anchors")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_local_source_paths(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data = read_json(path)
    return data.get("sourcePaths", {})


def read_highlights_data_js(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.WEREAD_HIGHLIGHTS_DATA\s*=\s*(\{.*\});?\s*$", text, re.S)
    if not match:
        raise ValueError(f"Could not parse {path}")
    return json.loads(match.group(1))


def validate_versions(versions: dict[str, Any], local_source_paths: dict[str, str]) -> list[dict[str, Any]]:
    status: list[dict[str, Any]] = []
    for item in versions["versions"]:
        source_path = resolve_source_path(item, local_source_paths)
        exists = source_path.exists() if source_path else False
        path_value = str(source_path) if source_path else None
        if source_path and not source_path.is_absolute():
            source_path = ROOT / source_path
        status.append(
            {
                "id": item["id"],
                "label": item["label"],
                "sourceType": item["sourceType"],
                "script": item["script"],
                "exists": exists,
                "path": path_value,
                "sourcePathEnv": item.get("sourcePathEnv"),
            }
        )
    return status


def resolve_source_path(item: dict[str, Any], local_source_paths: dict[str, str]) -> Path | None:
    if item.get("sourcePath"):
        path = Path(item["sourcePath"])
        return path if path.is_absolute() else ROOT / path

    env_name = item.get("sourcePathEnv")
    if env_name and os.environ.get(env_name):
        return Path(os.environ[env_name])

    if item["id"] in local_source_paths:
        return Path(local_source_paths[item["id"]])

    return None


def summarize_anchors(multilingual: dict[str, Any]) -> dict[str, Any]:
    items = multilingual["items"]
    chapter_items = [item for item in items if item.get("scope") == "chapter"]
    book_items = [item for item in items if item.get("scope") == "book"]
    chapter_keys = {(item["chapterUid"], item["range"]) for item in chapter_items}
    book_keys = {(item["chapterUid"], item["range"]) for item in book_items}
    per_chapter = Counter(item["chapterOrder"] for item in chapter_items)
    return {
        "totalItems": len(items),
        "chapterItems": len(chapter_items),
        "bookItems": len(book_items),
        "uniqueChapterAnchors": len(chapter_keys),
        "bookAnchorsAlreadyInChapterPool": len(book_keys & chapter_keys),
        "perChapter": dict(sorted(per_chapter.items())),
        "qualityWarnings": multilingual.get("quality", {}).get("length", {}).get("warningCounts", {}),
    }


def summarize_highlights_page(highlights: dict[str, Any]) -> dict[str, Any]:
    items = highlights["highlights"]
    per_chapter = Counter(item["chapterOrder"] for item in items)
    return {
        "book": highlights.get("book", {}),
        "items": len(items),
        "perChapter": dict(sorted(per_chapter.items())),
        "notes": highlights.get("notes", ""),
    }


if __name__ == "__main__":
    main()
