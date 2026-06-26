#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import posixpath
import re
import struct
import zlib
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree as ET

from prepare_sources import (
    LOCAL_VERSIONS_PATH,
    QUIZ_DIR,
    ROOT,
    VERSIONS_PATH,
    read_json,
    read_local_source_paths,
    resolve_source_path,
)


REPORT_PATH = QUIZ_DIR / "source_extraction_report.json"
EXTRACTED_DIR = QUIZ_DIR / "extracted"
MIN_BODY_CHARS = 5000
CHAPTER_COUNT = 20
CHAPTER_HEADING_RE = re.compile(r"^第([一二三四五六七八九十百〇零两0-9]+)章$")
CHINESE_NUMERALS = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}


@dataclass
class TextDocument:
    href: str
    title: str
    blocks: list[str]

    @property
    def text(self) -> str:
        return "\n".join(self.blocks)

    @property
    def char_count(self) -> int:
        return len(self.text)


class BodyTextParser(HTMLParser):
    BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "li"}
    SKIP_TAGS = {"head", "style", "script", "title", "svg", "math", "table"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_body = False
        self.skip_depth = 0
        self.stack: list[list[str]] = []
        self.blocks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag == "body":
            self.in_body = True
            return
        if not self.in_body:
            return
        if tag in self.SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag in self.BLOCK_TAGS:
            self.stack.append([])
        elif tag == "br" and self.stack:
            self.stack[-1].append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "body":
            while self.stack:
                self._flush_top()
            self.in_body = False
            return
        if not self.in_body:
            return
        if tag in self.SKIP_TAGS:
            if self.skip_depth:
                self.skip_depth -= 1
            return
        if self.skip_depth:
            return
        if tag in self.BLOCK_TAGS and self.stack:
            self._flush_top()

    def handle_data(self, data: str) -> None:
        if self.in_body and not self.skip_depth and self.stack:
            self.stack[-1].append(data)

    def _flush_top(self) -> None:
        text = normalize_text("".join(self.stack.pop()))
        if text:
            self.blocks.append(text)


def main() -> None:
    args = parse_args()
    versions = read_json(VERSIONS_PATH)
    local_source_paths = read_local_source_paths(LOCAL_VERSIONS_PATH)

    report_items: list[dict[str, Any]] = []
    extracted: dict[str, Any] = {}
    for version in versions["versions"]:
        if not version.get("includeInQuiz"):
            continue
        source_path = resolve_source_path(version, local_source_paths)
        result = extract_version(version, source_path)
        report_items.append(result["report"])
        if args.write_extracted and result.get("documents") is not None:
            extracted[version["id"]] = result["documents"]

    report = {
        "schemaVersion": 1,
        "source": {
            "versions": "data/translation-quiz/versions.json",
            "localOverrides": "data/translation-quiz/versions.local.json",
        },
        "items": report_items,
    }
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.write_extracted:
        EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
        for version_id, documents in extracted.items():
            output = EXTRACTED_DIR / f"{version_id}.chapters.json"
            output.write_text(json.dumps(documents, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(summarize_report(report), ensure_ascii=False, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract local Chinese translation sources for quiz matching.")
    parser.add_argument("--report", type=Path, default=REPORT_PATH, help="Summary report path to write.")
    parser.add_argument(
        "--write-extracted",
        action="store_true",
        help="Write full extracted text to ignored data/translation-quiz/extracted/*.json files.",
    )
    return parser.parse_args()


def extract_version(version: dict[str, Any], source_path: Path | None) -> dict[str, Any]:
    base_report = {
        "id": version["id"],
        "label": version["label"],
        "sourceType": version["sourceType"],
        "script": version["script"],
        "sourceResolved": bool(source_path),
        "sourceExists": bool(source_path and source_path.exists()),
        "warnings": [],
    }
    if version["sourceType"] == "repo-data":
        return extract_fanye(version, source_path, base_report)
    if not source_path or not source_path.exists():
        base_report["warnings"].append("source_missing")
        return {"report": base_report}
    if version["sourceType"] == "epub":
        return extract_epub_version(version, source_path, base_report)
    if version["sourceType"] == "pdf":
        return extract_pdf_version(version, source_path, base_report)
    base_report["warnings"].append(f"unsupported_source_type:{version['sourceType']}")
    return {"report": base_report}


def extract_fanye(version: dict[str, Any], source_path: Path | None, base_report: dict[str, Any]) -> dict[str, Any]:
    path = source_path or ROOT / "data" / "bilingual" / "highlight_multilingual_quotes.json"
    data = read_json(path)
    chapter_items = [item for item in data["items"] if item.get("scope") == "chapter"]
    by_chapter: dict[int, list[str]] = {}
    for item in chapter_items:
        by_chapter.setdefault(item["chapterOrder"], []).append(item["texts"]["zh"])
    documents = [
        {
            "chapterOrder": chapter_order,
            "href": f"highlight-chapter-{chapter_order:02d}",
            "title": f"第{chapter_order}章热门划线",
            "blocks": blocks,
            "charCount": len("\n".join(blocks)),
        }
        for chapter_order, blocks in sorted(by_chapter.items())
    ]
    base_report.update(document_stats(documents))
    base_report["mode"] = "highlight_anchor_text"
    return {"report": base_report, "documents": documents}


def extract_epub_version(version: dict[str, Any], source_path: Path, base_report: dict[str, Any]) -> dict[str, Any]:
    entries, zip_warnings = read_epub_entries(source_path)
    documents = extract_epub_documents(entries)
    body_documents = infer_body_documents(documents)
    if version["script"] == "Hant":
        base_report["warnings"].append("traditional_conversion_pending")
    report_documents = serialize_documents(body_documents)
    base_report.update(document_stats(report_documents))
    base_report["mode"] = "epub_spine"
    base_report["zipWarnings"] = zip_warnings
    base_report["rawDocuments"] = len(documents)
    return {"report": base_report, "documents": report_documents}


def extract_pdf_version(version: dict[str, Any], source_path: Path, base_report: dict[str, Any]) -> dict[str, Any]:
    try:
        import fitz  # type: ignore
    except ModuleNotFoundError:
        base_report["warnings"].append("pymupdf_missing")
        return {"report": base_report}

    doc = fitz.open(source_path)
    documents = extract_pdf_chapters(doc)
    if documents:
        mode = "pdf_toc_chapters"
    else:
        documents = extract_pdf_pages(doc)
        mode = "pdf_pages"
    body_documents = [item for item in documents if item["charCount"] >= 80]
    base_report.update(document_stats(body_documents))
    base_report["mode"] = mode
    base_report["rawPages"] = doc.page_count
    base_report["chapterHeadingMatches"] = count_chapter_headings(body_documents)
    return {"report": base_report, "documents": body_documents}


def read_epub_entries(path: Path) -> tuple[dict[str, bytes], list[str]]:
    warnings: list[str] = []
    try:
        with ZipFile(path) as zf:
            return {name: zf.read(name) for name in zf.namelist()}, warnings
    except BadZipFile:
        warnings.append("zip_central_directory_unreadable")
        return read_local_zip_entries(path), warnings


def read_local_zip_entries(path: Path) -> dict[str, bytes]:
    data = path.read_bytes()
    entries: dict[str, bytes] = {}
    offset = 0
    while offset + 30 <= len(data):
        signature = data[offset : offset + 4]
        if signature == b"PK\x01\x02" or signature == b"PK\x05\x06":
            break
        if signature != b"PK\x03\x04":
            next_offset = data.find(b"PK\x03\x04", offset + 1)
            if next_offset == -1:
                break
            offset = next_offset
            continue
        header = data[offset : offset + 30]
        _, _, flags, method, _, _, _, compressed_size, _, name_len, extra_len = struct.unpack(
            "<IHHHHHIIIHH", header
        )
        name_start = offset + 30
        name_end = name_start + name_len
        extra_end = name_end + extra_len
        name = data[name_start:name_end].decode("utf-8" if flags & 0x800 else "cp437", errors="replace")
        payload_end = extra_end + compressed_size
        payload = data[extra_end:payload_end]
        if method == 0:
            content = payload
        elif method == 8:
            content = zlib.decompress(payload, -15)
        else:
            content = b""
        entries[name] = content
        offset = payload_end
    return entries


def extract_epub_documents(entries: dict[str, bytes]) -> list[TextDocument]:
    opf_path = find_opf_path(entries)
    html_paths = spine_html_paths(entries, opf_path) if opf_path else []
    if not html_paths:
        html_paths = sorted(name for name in entries if is_html_name(name))
    documents: list[TextDocument] = []
    for href in html_paths:
        blocks = parse_html_blocks(entries[href])
        if blocks:
            documents.append(TextDocument(href=href, title=infer_title(blocks, href), blocks=blocks))
    return documents


def find_opf_path(entries: dict[str, bytes]) -> str | None:
    container = entries.get("META-INF/container.xml")
    if not container:
        candidates = [name for name in entries if name.endswith(".opf")]
        return candidates[0] if candidates else None
    root = ET.fromstring(container)
    for elem in root.iter():
        if elem.tag.endswith("rootfile") and elem.attrib.get("full-path"):
            return elem.attrib["full-path"]
    return None


def spine_html_paths(entries: dict[str, bytes], opf_path: str) -> list[str]:
    opf = ET.fromstring(entries[opf_path])
    manifest: dict[str, str] = {}
    spine_ids: list[str] = []
    opf_dir = posixpath.dirname(opf_path)
    for elem in opf.iter():
        tag = elem.tag.rsplit("}", 1)[-1]
        if tag == "item" and elem.attrib.get("id") and elem.attrib.get("href"):
            manifest[elem.attrib["id"]] = elem.attrib["href"]
        elif tag == "itemref" and elem.attrib.get("idref"):
            spine_ids.append(elem.attrib["idref"])
    paths: list[str] = []
    for item_id in spine_ids:
        href = manifest.get(item_id)
        if not href or not is_html_name(href):
            continue
        full_path = posixpath.normpath(posixpath.join(opf_dir, href))
        if full_path in entries:
            paths.append(full_path)
    return paths


def parse_html_blocks(content: bytes) -> list[str]:
    parser = BodyTextParser()
    parser.feed(content.decode("utf-8", errors="replace"))
    return parser.blocks


def infer_body_documents(documents: list[TextDocument]) -> list[TextDocument]:
    candidates = [
        doc
        for doc in documents
        if doc.char_count >= MIN_BODY_CHARS and not re.search(r"(cover|nav|toc|copyright|titlepage)", doc.href, re.I)
    ]
    chapter_candidates: dict[int, TextDocument] = {}
    for doc in candidates:
        number = infer_chapter_number(doc)
        if number and 1 <= number <= CHAPTER_COUNT:
            chapter_candidates.setdefault(number, doc)
    if len(chapter_candidates) >= CHAPTER_COUNT:
        return [chapter_candidates[index] for index in range(1, CHAPTER_COUNT + 1)]
    if len(candidates) >= CHAPTER_COUNT:
        return candidates[:CHAPTER_COUNT]
    return candidates


def serialize_documents(documents: list[TextDocument]) -> list[dict[str, Any]]:
    return [
        {
            "chapterOrder": index,
            "href": doc.href,
            "title": doc.title,
            "blocks": doc.blocks,
            "charCount": doc.char_count,
        }
        for index, doc in enumerate(documents, start=1)
    ]


def split_pdf_page_text(text: str) -> list[str]:
    lines = [normalize_text(line) for line in text.splitlines()]
    return [line for line in lines if line and not is_pdf_noise_line(line)]


def extract_pdf_chapters(doc: Any) -> list[dict[str, Any]]:
    toc_items = [
        (parse_chapter_heading(title), title, page)
        for _, title, page in doc.get_toc()
        if parse_chapter_heading(title)
    ]
    if len(toc_items) < CHAPTER_COUNT:
        return []
    toc_items = sorted(toc_items, key=lambda item: item[2])
    documents: list[dict[str, Any]] = []
    for index, (chapter_order, title, start_page) in enumerate(toc_items):
        if not chapter_order or chapter_order > CHAPTER_COUNT:
            continue
        next_page = toc_items[index + 1][2] if index + 1 < len(toc_items) else doc.page_count + 1
        blocks: list[str] = []
        for page_number in range(start_page, next_page):
            blocks.extend(split_pdf_page_text(doc[page_number - 1].get_text("text")))
        if blocks:
            documents.append(
                {
                    "chapterOrder": chapter_order,
                    "href": f"pdf-pages-{start_page:03d}-{next_page - 1:03d}",
                    "title": title,
                    "blocks": blocks,
                    "charCount": len("\n".join(blocks)),
                }
            )
    return documents


def extract_pdf_pages(doc: Any) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for index, page in enumerate(doc, start=1):
        blocks = split_pdf_page_text(page.get_text("text"))
        if not blocks:
            continue
        documents.append(
            {
                "chapterOrder": None,
                "href": f"page-{index:03d}",
                "title": f"Page {index}",
                "blocks": blocks,
                "charCount": len("\n".join(blocks)),
            }
        )
    return documents


def document_stats(documents: list[dict[str, Any]]) -> dict[str, Any]:
    char_counts = [item["charCount"] for item in documents]
    block_counts = [len(item["blocks"]) for item in documents]
    return {
        "documents": len(documents),
        "totalChars": sum(char_counts),
        "minChars": min(char_counts) if char_counts else 0,
        "maxChars": max(char_counts) if char_counts else 0,
        "totalBlocks": sum(block_counts),
        "sampleTitles": [item["title"] for item in documents[:5]],
    }


def count_chapter_headings(documents: list[dict[str, Any]]) -> int:
    return sum(1 for item in documents for block in item["blocks"][:10] if parse_chapter_heading(block))


def summarize_report(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "items": len(report["items"]),
        "missing": [item["id"] for item in report["items"] if not item.get("sourceExists")],
        "warnings": {item["id"]: item["warnings"] for item in report["items"] if item["warnings"]},
        "documents": {item["id"]: item.get("documents", 0) for item in report["items"]},
    }


def is_html_name(name: str) -> bool:
    return name.lower().endswith((".html", ".xhtml", ".htm"))


def infer_title(blocks: list[str], href: str) -> str:
    for block in blocks[:5]:
        if len(block) <= 80:
            return block
    return Path(href).name


def infer_chapter_number(document: TextDocument) -> int | None:
    for block in document.blocks[:3]:
        number = parse_chapter_heading(block)
        if number:
            return number
        if block.isdigit():
            return int(block)
    path_match = re.search(r"chapter[_-]?(\d{1,2})(?:\.x?html?$)", document.href, re.I)
    if path_match:
        return int(path_match.group(1))
    return None


def parse_chapter_heading(text: str) -> int | None:
    normalized = re.sub(r"\s+", "", normalize_text(text))
    match = CHAPTER_HEADING_RE.match(normalized)
    if not match:
        return None
    raw = match.group(1)
    if raw.isdigit():
        return int(raw)
    return parse_chinese_number(raw)


def parse_chinese_number(raw: str) -> int | None:
    if raw in CHINESE_NUMERALS:
        return CHINESE_NUMERALS[raw]
    if "十" not in raw:
        return CHINESE_NUMERALS.get(raw)
    left, _, right = raw.partition("十")
    tens = 1 if not left else CHINESE_NUMERALS.get(left)
    ones = 0 if not right else CHINESE_NUMERALS.get(right)
    if tens is None or ones is None:
        return None
    return tens * 10 + ones


def is_pdf_noise_line(text: str) -> bool:
    return bool(
        re.fullmatch(r"\d{1,4}", text)
        or re.fullmatch(r"20\d{6}", text)
        or re.fullmatch(r"[IVXLCDM]{1,8}", text)
    )


def normalize_text(text: str) -> str:
    text = html.unescape(text).replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n+", "\n", text)
    return text.strip()


if __name__ == "__main__":
    main()
