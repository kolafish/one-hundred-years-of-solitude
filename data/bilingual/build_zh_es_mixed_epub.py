#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import shutil
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[2]
ALIGNED_JSON = ROOT / "data" / "bilingual" / "aligned_paragraphs.json"
OUT_EPUB = ROOT / "downloads" / "one-hundred-years-of-solitude-es-zh-mixed-split.epub"
BUILD_DIR = ROOT / "data" / "bilingual" / ".zh_es_epub_build"


@dataclass
class Paragraph:
    text: str
    index: int


class BodyParagraphParser(HTMLParser):
    BLOCK_TAGS = {"p", "div"}
    SKIP_TAGS = {"head", "style", "script", "title", "aside", "sup", "sub", "a", "table", "ol", "ul"}

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
            self.stack[-1].append(" ")

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


def normalize_text(text: str) -> str:
    text = html.unescape(text).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def keep_paragraph(text: str) -> bool:
    if len(text) < 2:
        return False
    if re.fullmatch(r"Cap[ií]tulo\s+\d+", text, re.I):
        return False
    return True


def extract_spanish_chapters(epub: Path) -> list[list[Paragraph]]:
    chapters: list[list[Paragraph]] = []
    with zipfile.ZipFile(epub) as zf:
        for chapter_no in range(1, 21):
            parser = BodyParagraphParser()
            parser.feed(zf.read(f"OEBPS/Text/capitulo{chapter_no:03d}.xhtml").decode("utf-8", errors="replace"))
            chapters.append(
                [
                    Paragraph(text=text, index=index)
                    for index, text in enumerate(parser.blocks, start=1)
                    if keep_paragraph(text)
                ]
            )
    return chapters


def text_weight(text: str, lang: str) -> float:
    if lang == "zh":
        cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
        punct = len(re.findall(r"[。！？；、，,.!?;:]", text))
        return max(1.0, cjk * 1.8 + punct * 0.25)
    words = len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)?", text))
    punct = len(re.findall(r"[.!?;:]", text))
    multiplier = 5.2 if lang == "es" else 5.25
    return max(1.0, words * multiplier + punct * 0.35)


def prefix_weights(items: list[str], lang: str) -> list[float]:
    values = [0.0]
    for item in items:
        values.append(values[-1] + text_weight(item, lang))
    return values


def align_texts(ref_rows: list[str], target_paragraphs: list[Paragraph]) -> list[list[Paragraph]]:
    n = len(ref_rows)
    m = len(target_paragraphs)
    if not n:
        return []
    if not m:
        return [[] for _ in ref_rows]

    rw = prefix_weights(ref_rows, "en")
    tw = prefix_weights([p.text for p in target_paragraphs], "es")
    ratio = tw[-1] / rw[-1] if rw[-1] else 1.0
    max_ref_group = 2
    max_target_group = 5
    inf = 1e18
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(n + 1):
        for j in range(m + 1):
            current = dp[i][j]
            if current >= inf:
                continue
            for a in range(1, max_ref_group + 1):
                if i + a > n:
                    break
                for b in range(1, max_target_group + 1):
                    if j + b > m:
                        break
                    ref_len = rw[i + a] - rw[i]
                    target_len = tw[j + b] - tw[j]
                    length_cost = abs(ref_len * ratio - target_len) / max(ref_len * ratio, target_len, 1.0)
                    group_cost = (a - 1) * 0.22 + (b - 1) * 0.08
                    position_cost = abs(((i + a) / n) - ((j + b) / m)) * 0.1
                    cost = length_cost + group_cost + position_cost
                    if current + cost < dp[i + a][j + b]:
                        dp[i + a][j + b] = current + cost
                        back[i + a][j + b] = (a, b)

    if back[n][m] is None:
        raise RuntimeError("Could not align Spanish chapter")

    groups: list[list[Paragraph]] = [[] for _ in ref_rows]
    i, j = n, m
    while i > 0 and j > 0:
        step = back[i][j]
        if step is None:
            raise RuntimeError("Broken Spanish alignment")
        a, b = step
        for ref_idx in range(i - a, i):
            groups[ref_idx] = target_paragraphs[j - b:j]
        i -= a
        j -= b
    return groups


def build_alignment(es_epub: Path) -> list[dict[str, object]]:
    aligned = json.loads(ALIGNED_JSON.read_text(encoding="utf-8"))
    es_chapters = extract_spanish_chapters(es_epub)
    result = []
    for chapter in aligned:
        chapter_no = int(chapter["number"])
        ref_rows_en = [" ".join(pair["en"]) for pair in chapter["pairs"]]
        es_groups = align_texts(ref_rows_en, es_chapters[chapter_no - 1])
        pairs = []
        for pair, es_group in zip(chapter["pairs"], es_groups):
            es_unique = unique_paragraphs(es_group)
            pairs.append(
                {
                    "zh": pair["zh"],
                    "es": [paragraph.text for paragraph in es_unique],
                    "zh_index": pair.get("zh_index", []),
                    "es_index": [paragraph.index for paragraph in es_unique],
                }
            )
        result.append(
            {
                "number": chapter_no,
                "title_zh": chapter["title_zh"],
                "title_es": f"Capítulo {chapter_no}",
                "pairs": pairs,
            }
        )
    return result


def unique_paragraphs(paragraphs: Iterable[Paragraph]) -> list[Paragraph]:
    seen = set()
    values: list[Paragraph] = []
    for paragraph in paragraphs:
        if paragraph.index in seen:
            continue
        seen.add(paragraph.index)
        values.append(paragraph)
    return values


def split_sentences(text: str, lang: str) -> list[str]:
    text = normalize_text(text)
    if not text:
        return []
    if lang == "zh":
        parts = re.findall(r".+?[。！？；]+[”’」』）)]*|.+$", text)
    else:
        parts = split_western_sentences(text)
    refined: list[str] = []
    for part in parts:
        refined.extend(split_oversized_sentence(part.strip(), lang))
    return [part for part in refined if part]


def split_western_sentences(text: str) -> list[str]:
    parts: list[str] = []
    start = 0
    terminal = ".!?"
    closers = "”’»\"')）]"
    for i, char in enumerate(text):
        if char not in terminal:
            continue
        if char == "." and looks_like_abbreviation(text, i):
            continue
        end = i + 1
        while end < len(text) and text[end] in closers:
            end += 1
        if end >= len(text) or text[end].isspace():
            chunk = normalize_text(text[start:end])
            if chunk:
                parts.append(chunk)
            start = end
    tail = normalize_text(text[start:])
    if tail:
        parts.append(tail)
    return parts or [text]


def looks_like_abbreviation(text: str, dot_index: int) -> bool:
    prefix = text[:dot_index].rstrip()
    match = re.search(r"([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)$", prefix)
    if not match:
        return False
    word = match.group(1).lower()
    return len(word) == 1 or word in {"sr", "sra", "srta", "dr", "dra", "ud", "uds", "etc"}


def split_oversized_sentence(text: str, lang: str) -> list[str]:
    hard_max = 380 if lang == "es" else 155
    if len(text) <= hard_max:
        return [text]
    if lang == "zh":
        pieces = re.findall(r".+?[，、：—]+|.+$", text)
        sep = ""
    else:
        pieces = re.findall(r".+?[,;:—]+|.+$", text)
        sep = " "
    chunks: list[str] = []
    current = ""
    for piece in [piece.strip() for piece in pieces if piece.strip()]:
        candidate = f"{current}{sep}{piece}".strip() if current else piece
        if current and len(candidate) > hard_max:
            chunks.append(current)
            current = piece
        else:
            current = candidate
    if current:
        chunks.append(current)

    result: list[str] = []
    for chunk in chunks:
        if len(chunk) > hard_max:
            result.extend(split_by_length(chunk, lang, hard_max))
        else:
            result.append(chunk)
    return [part for part in result if part]


def split_by_length(text: str, lang: str, hard_max: int) -> list[str]:
    if lang == "zh":
        return [text[i:i + hard_max].strip() for i in range(0, len(text), hard_max) if text[i:i + hard_max].strip()]
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0
    for word in words:
        extra = len(word) + (1 if current else 0)
        if current and current_len + extra > hard_max:
            chunks.append(" ".join(current))
            current = [word]
            current_len = len(word)
        else:
            current.append(word)
            current_len += extra
    if current:
        chunks.append(" ".join(current))
    return chunks


def chunk_sentence_groups(sentence_groups: list[list[str]], lang: str, target: int) -> list[str]:
    sentences = [sentence for group in sentence_groups for sentence in group]
    if not sentences:
        return []
    total_len = sum(len(sentence) for sentence in sentences)
    soft_max = max(80 if lang == "es" else 45, math.ceil(total_len / target * 1.12))
    sep = " " if lang == "es" else ""
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current}{sep}{sentence}".strip() if current else sentence
        if current and len(candidate) > soft_max:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)

    hard_max = 380 if lang == "es" else 155
    result: list[str] = []
    for chunk in chunks:
        if len(chunk) > hard_max:
            result.extend(split_oversized_sentence(chunk, lang))
        else:
            result.append(chunk)
    return result


def mixed_chunks_balanced(es_paragraphs: list[str], zh_paragraphs: list[str]) -> tuple[list[str], list[str]]:
    es_sentence_groups = [split_sentences(paragraph, "es") for paragraph in es_paragraphs]
    zh_sentence_groups = [split_sentences(paragraph, "zh") for paragraph in zh_paragraphs]
    es_len = sum(len(sentence) for group in es_sentence_groups for sentence in group)
    zh_len = sum(len(sentence) for group in zh_sentence_groups for sentence in group)
    target = max(
        1,
        len(es_paragraphs),
        len(zh_paragraphs),
        math.ceil(es_len / 360),
        math.ceil(zh_len / 140),
    )
    return chunk_sentence_groups(es_sentence_groups, "es", target), chunk_sentence_groups(zh_sentence_groups, "zh", target)


def chapter_file_name(number: int) -> str:
    return f"text/chapter{number:02d}.xhtml"


def xhtml_page(title: str, body: str) -> str:
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head>
  <title>{html.escape(title)}</title>
  <link href="../styles/bilingual.css" rel="stylesheet" type="text/css"/>
</head>
<body>
{body}
</body>
</html>
"""


def write_epub(alignment: list[dict[str, object]], out: Path) -> None:
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    (BUILD_DIR / "META-INF").mkdir(parents=True)
    (BUILD_DIR / "OEBPS" / "text").mkdir(parents=True)
    (BUILD_DIR / "OEBPS" / "styles").mkdir(parents=True)

    (BUILD_DIR / "mimetype").write_text("application/epub+zip", encoding="ascii")
    (BUILD_DIR / "META-INF" / "container.xml").write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
""",
        encoding="utf-8",
    )

    css = """body {
  margin: 0;
  padding: 0;
  color: #1f2328;
  font-family: serif;
  line-height: 1.6;
}
.chapter-title {
  font-family: sans-serif;
  font-size: 1.35em;
  margin: 1em 0 1.2em;
  page-break-after: avoid;
}
.mixed-pair {
  margin: 0 0 .95em;
  padding: .85em 0 .75em;
  border-top: 1px solid #aaa;
  page-break-inside: avoid;
}
.para-es,
.para-zh {
  margin: 0 0 .5em;
  text-align: justify;
  -webkit-hyphens: auto;
  -moz-hyphens: auto;
  -ms-hyphens: auto;
  -epub-hyphens: auto;
  hyphens: auto;
  text-justify: inter-word;
}
.para-es {
  font-family: Georgia, "Times New Roman", serif;
  overflow-wrap: normal;
  word-break: normal;
}
.para-zh {
  font-family: "Songti SC", "Noto Serif CJK SC", serif;
  overflow-wrap: break-word;
}
"""
    (BUILD_DIR / "OEBPS" / "styles" / "bilingual.css").write_text(css, encoding="utf-8")

    nav_items = []
    manifest_items = [
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
        '<item id="css" href="styles/bilingual.css" media-type="text/css"/>',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
    ]
    spine_items = []
    for chapter in alignment:
        number = int(chapter["number"])
        href = chapter_file_name(number)
        file_path = BUILD_DIR / "OEBPS" / href
        title = f"{chapter['title_es']} / {chapter['title_zh']}"
        body_parts = [f"<h1 class=\"chapter-title\">{html.escape(title)}</h1>"]
        for pair in chapter["pairs"]:
            es_chunks, zh_chunks = mixed_chunks_balanced(pair["es"], pair["zh"])
            body_parts.append("<div class=\"mixed-pair\">")
            for idx in range(max(len(es_chunks), len(zh_chunks))):
                if idx < len(es_chunks):
                    body_parts.append(f"<p class=\"para-es\" xml:lang=\"es\" lang=\"es\">{html.escape(es_chunks[idx])}</p>")
                if idx < len(zh_chunks):
                    body_parts.append(f"<p class=\"para-zh\" xml:lang=\"zh-CN\" lang=\"zh-CN\">{html.escape(zh_chunks[idx])}</p>")
            body_parts.append("</div>")
        file_path.write_text(xhtml_page(title, "\n".join(body_parts)), encoding="utf-8")

        item_id = f"chapter{number:02d}"
        manifest_items.append(f'<item id="{item_id}" href="{href}" media-type="application/xhtml+xml"/>')
        spine_items.append(f'<itemref idref="{item_id}"/>')
        nav_items.append((number, title, href))

    book_title = "Cien años de soledad / 百年孤独 - 西中短段混合"
    book_id = f"urn:uuid:{uuid.uuid4()}"
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    opf = f"""<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookId">{book_id}</dc:identifier>
    <dc:title>{html.escape(book_title)}</dc:title>
    <dc:creator opf:role="aut">Gabriel Garcia Marquez</dc:creator>
    <dc:language>mul</dc:language>
    <meta property="dcterms:modified">{modified}</meta>
  </metadata>
  <manifest>
    {chr(10).join(manifest_items)}
  </manifest>
  <spine toc="ncx">
    {chr(10).join(spine_items)}
  </spine>
</package>
"""
    (BUILD_DIR / "OEBPS" / "content.opf").write_text(opf, encoding="utf-8")

    nav_lis = [f'      <li><a href="{href}">{html.escape(title)}</a></li>' for _, title, href in nav_items]
    nav_doc = f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head>
  <title>目录</title>
  <link href="styles/bilingual.css" rel="stylesheet" type="text/css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
{chr(10).join(nav_lis)}
    </ol>
  </nav>
</body>
</html>
"""
    (BUILD_DIR / "OEBPS" / "nav.xhtml").write_text(nav_doc, encoding="utf-8")

    nav_points = []
    for play_order, title, href in nav_items:
        nav_points.append(
            f"""    <navPoint id="chapter{play_order:02d}" playOrder="{play_order}">
      <navLabel><text>{html.escape(title)}</text></navLabel>
      <content src="{href}"/>
    </navPoint>"""
        )
    ncx = f"""<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="{book_id}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>{html.escape(book_title)}</text></docTitle>
  <navMap>
{chr(10).join(nav_points)}
  </navMap>
</ncx>
"""
    (BUILD_DIR / "OEBPS" / "toc.ncx").write_text(ncx, encoding="utf-8")

    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w") as zf:
        zf.write(BUILD_DIR / "mimetype", "mimetype", compress_type=zipfile.ZIP_STORED)
        for path in sorted(BUILD_DIR.rglob("*")):
            if path.is_file() and path.name != "mimetype":
                zf.write(path, path.relative_to(BUILD_DIR).as_posix(), compress_type=zipfile.ZIP_DEFLATED)


def validate_epub(epub: Path) -> None:
    with zipfile.ZipFile(epub) as zf:
        names = zf.namelist()
        if not names or names[0] != "mimetype":
            raise RuntimeError("EPUB mimetype must be first entry")
        if zf.read("mimetype") != b"application/epub+zip":
            raise RuntimeError("Invalid EPUB mimetype")
        ET.fromstring(zf.read("META-INF/container.xml"))
        ET.fromstring(zf.read("OEBPS/content.opf"))
        ET.fromstring(zf.read("OEBPS/toc.ncx"))
        for name in names:
            if name.endswith(".xhtml"):
                ET.fromstring(zf.read(name))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a short mixed Spanish/Chinese EPUB.")
    parser.add_argument(
        "--spanish-epub",
        default=os.environ.get("SPANISH_EPUB"),
        help="Path to Cien años de soledad EPUB. Can also be set with SPANISH_EPUB.",
    )
    parser.add_argument("--output", type=Path, default=OUT_EPUB, help="Output EPUB path.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.spanish_epub:
        raise SystemExit("Missing Spanish EPUB path. Pass --spanish-epub or set SPANISH_EPUB.")
    es_epub = Path(args.spanish_epub).expanduser()
    if not es_epub.exists():
        raise SystemExit(f"Spanish EPUB does not exist: {es_epub}")

    alignment = build_alignment(es_epub)
    out = args.output.expanduser()
    write_epub(alignment, out)
    validate_epub(out)
    print(json.dumps({"chapters": len(alignment), "output": str(out)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
