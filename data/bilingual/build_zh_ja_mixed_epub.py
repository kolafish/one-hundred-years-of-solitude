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

from semantic_rebalance import semantic_rebalance_pairs


ROOT = Path(__file__).resolve().parents[2]
ALIGNED_JSON = ROOT / "data" / "bilingual" / "aligned_paragraphs.json"
OUT_EPUB = ROOT / "downloads" / "one-hundred-years-of-solitude-zh-ja-mixed-split.epub"
BUILD_DIR = ROOT / "data" / "bilingual" / ".zh_ja_epub_build"
ILLUSTRATION_PLACEHOLDER = "[插图]"


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


def clean_zh_text(text: str) -> str:
    return text.replace(ILLUSTRATION_PLACEHOLDER, "")


def keep_paragraph(text: str) -> bool:
    if len(text) < 2:
        return False
    if re.fullmatch(r"(第\s*)?\d+\s*章", text):
        return False
    return True


def extract_japanese_chapters(epub: Path) -> list[list[Paragraph]]:
    chapters: list[list[Paragraph]] = []
    with zipfile.ZipFile(epub) as zf:
        for chapter_no in range(1, 21):
            parser = BodyParagraphParser()
            parser.feed(zf.read(f"c{chapter_no:02d}.html").decode("utf-8", errors="replace"))
            chapters.append(
                [
                    Paragraph(text=text, index=index)
                    for index, text in enumerate(parser.blocks, start=1)
                    if keep_paragraph(text)
                ]
            )
    return chapters


def text_weight(text: str, lang: str) -> float:
    cjk = len(re.findall(r"[\u4e00-\u9fffぁ-ゟ゠-ヿ]", text))
    punct = len(re.findall(r"[。！？；、，,.!?;:]", text))
    if lang == "zh":
        return max(1.0, cjk * 1.8 + punct * 0.25)
    return max(1.0, cjk * 1.65 + punct * 0.25)


def prefix_weights(items: list[str], lang: str) -> list[float]:
    values = [0.0]
    for item in items:
        values.append(values[-1] + text_weight(item, lang))
    return values


def target_units(paragraphs: list[Paragraph]) -> list[Paragraph]:
    units: list[Paragraph] = []
    for paragraph in paragraphs:
        pieces = split_sentences(paragraph.text, "ja")
        if len(pieces) <= 1:
            units.append(paragraph)
            continue
        for offset, piece in enumerate(pieces, start=1):
            units.append(Paragraph(text=piece, index=paragraph.index * 1000 + offset))
    return units


def distribute_target_group(ref_rows: list[str], target_group: list[Paragraph]) -> list[list[Paragraph]]:
    if not ref_rows:
        return []
    if len(ref_rows) == 1 or not target_group:
        return [target_group]

    units = target_units(target_group)
    if not units:
        return [[] for _ in ref_rows]

    ref_weights = [text_weight(row, "zh") for row in ref_rows]
    unit_weights = [text_weight(unit.text, "ja") for unit in units]
    total_ref = max(sum(ref_weights), 1.0)
    total_target = max(sum(unit_weights), 1.0)
    prefix = [0.0]
    for weight in unit_weights:
        prefix.append(prefix[-1] + weight)

    groups: list[list[Paragraph]] = []
    cursor = 0
    expected = 0.0
    enforce_nonempty = len(units) >= len(ref_rows)
    for idx, ref_weight in enumerate(ref_weights):
        remaining_rows = len(ref_rows) - idx - 1
        if remaining_rows == 0:
            groups.append(units[cursor:])
            break

        expected += total_target * (ref_weight / total_ref)
        min_cut = cursor + 1 if enforce_nonempty else cursor
        max_cut = len(units) - remaining_rows if enforce_nonempty else len(units)
        min_cut = min(max(min_cut, cursor), len(units))
        max_cut = min(max(max_cut, min_cut), len(units))
        cut = min(range(min_cut, max_cut + 1), key=lambda pos: abs(prefix[pos] - expected))
        groups.append(units[cursor:cut])
        cursor = cut

    while len(groups) < len(ref_rows):
        groups.append([])
    return groups


def align_texts(ref_rows: list[str], target_paragraphs: list[Paragraph]) -> list[list[Paragraph]]:
    n = len(ref_rows)
    m = len(target_paragraphs)
    if not n:
        return []
    if not m:
        return [[] for _ in ref_rows]

    rw = prefix_weights(ref_rows, "zh")
    tw = prefix_weights([p.text for p in target_paragraphs], "ja")
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
        raise RuntimeError("Could not align Japanese chapter")

    groups: list[list[Paragraph]] = [[] for _ in ref_rows]
    i, j = n, m
    while i > 0 and j > 0:
        step = back[i][j]
        if step is None:
            raise RuntimeError("Broken Japanese alignment")
        a, b = step
        distributed = distribute_target_group(ref_rows[i - a:i], target_paragraphs[j - b:j])
        for offset, group in enumerate(distributed):
            groups[i - a + offset] = group
        i -= a
        j -= b
    return groups


def build_alignment(ja_epub: Path, semantic_rebalance: bool = True) -> list[dict[str, object]]:
    aligned = json.loads(ALIGNED_JSON.read_text(encoding="utf-8"))
    ja_chapters = extract_japanese_chapters(ja_epub)
    result = []
    for chapter in aligned:
        chapter_no = int(chapter["number"])
        ref_rows_zh = ["".join(clean_zh_text(text) for text in pair["zh"]) for pair in chapter["pairs"]]
        ja_groups = align_texts(ref_rows_zh, ja_chapters[chapter_no - 1])
        pairs = []
        for pair, ja_group in zip(chapter["pairs"], ja_groups):
            pairs.append(
                {
                    "zh": [clean_zh_text(text) for text in pair["zh"]],
                    "ja": [paragraph.text for paragraph in unique_paragraphs(ja_group)],
                    "zh_index": pair.get("zh_index", []),
                    "ja_index": [paragraph.index for paragraph in unique_paragraphs(ja_group)],
                }
            )
        if semantic_rebalance:
            semantic_rebalance_pairs(
                chapter_no=chapter_no,
                pairs=pairs,
                target_units=target_units(ja_chapters[chapter_no - 1]),
                target_key="ja",
                lang="ja",
                split_zh_sentences=split_sentences,
            )
        result.append(
            {
                "number": chapter_no,
                "title_zh": chapter["title_zh"],
                "title_ja": f"第{chapter_no}章",
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
    parts = re.findall(r".+?[。！？；]+[”’」』）)]*|.+$", text)
    refined: list[str] = []
    for part in parts:
        refined.extend(split_oversized_sentence(part.strip(), lang))
    return [part for part in refined if part]


def split_oversized_sentence(text: str, lang: str) -> list[str]:
    hard_max = 170 if lang == "ja" else 155
    if len(text) <= hard_max:
        return [text]
    pieces = re.findall(r".+?[，、：—]+|.+$", text)
    chunks: list[str] = []
    current = ""
    for piece in [piece.strip() for piece in pieces if piece.strip()]:
        candidate = f"{current}{piece}" if current else piece
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
            result.extend(chunk[i:i + hard_max].strip() for i in range(0, len(chunk), hard_max))
        else:
            result.append(chunk)
    return [part for part in result if part]


def chunk_sentence_groups(sentence_groups: list[list[str]], lang: str, target: int) -> list[str]:
    sentences = [sentence for group in sentence_groups for sentence in group]
    if not sentences:
        return []
    total_len = sum(len(sentence) for sentence in sentences)
    soft_max = max(45, math.ceil(total_len / target * 1.12))
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        candidate = f"{current}{sentence}" if current else sentence
        if current and len(candidate) > soft_max:
            chunks.append(current)
            current = sentence
        else:
            current = candidate
    if current:
        chunks.append(current)

    hard_max = 170 if lang == "ja" else 155
    result: list[str] = []
    for chunk in chunks:
        if len(chunk) > hard_max:
            result.extend(split_oversized_sentence(chunk, lang))
        else:
            result.append(chunk)
    return result


def mixed_chunks_balanced(ja_paragraphs: list[str], zh_paragraphs: list[str]) -> tuple[list[str], list[str]]:
    ja_sentence_groups = [split_sentences(paragraph, "ja") for paragraph in ja_paragraphs]
    zh_sentence_groups = [split_sentences(paragraph, "zh") for paragraph in zh_paragraphs]
    ja_len = sum(len(sentence) for group in ja_sentence_groups for sentence in group)
    zh_len = sum(len(sentence) for group in zh_sentence_groups for sentence in group)
    target = max(
        1,
        len(zh_paragraphs),
        math.ceil(ja_len / 150),
        math.ceil(zh_len / 140),
    )
    return chunk_sentence_groups(ja_sentence_groups, "ja", target), chunk_sentence_groups(zh_sentence_groups, "zh", target)


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
  line-height: 1.62;
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
.para-ja,
.para-zh {
  margin: 0 0 .5em;
}
.para-ja {
  font-family: "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", serif;
}
.para-zh {
  font-family: "Songti SC", "Noto Serif CJK SC", serif;
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
        title = f"{chapter['title_ja']} / {chapter['title_zh']}"
        body_parts = [f"<h1 class=\"chapter-title\">{html.escape(title)}</h1>"]
        for pair in chapter["pairs"]:
            ja_chunks, zh_chunks = mixed_chunks_balanced(pair["ja"], pair["zh"])
            body_parts.append("<div class=\"mixed-pair\">")
            for idx in range(max(len(ja_chunks), len(zh_chunks))):
                if idx < len(ja_chunks):
                    body_parts.append(f"<p class=\"para-ja\" xml:lang=\"ja\" lang=\"ja\">{html.escape(ja_chunks[idx])}</p>")
                if idx < len(zh_chunks):
                    body_parts.append(f"<p class=\"para-zh\" xml:lang=\"zh-CN\" lang=\"zh-CN\">{html.escape(zh_chunks[idx])}</p>")
            body_parts.append("</div>")
        file_path.write_text(xhtml_page(title, "\n".join(body_parts)), encoding="utf-8")

        item_id = f"chapter{number:02d}"
        manifest_items.append(f'<item id="{item_id}" href="{href}" media-type="application/xhtml+xml"/>')
        spine_items.append(f'<itemref idref="{item_id}"/>')
        nav_items.append((number, title, href))

    book_title = "百年の孤独 / 百年孤独 - 日中短段混合"
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
    parser = argparse.ArgumentParser(description="Build a short mixed Japanese/Chinese EPUB.")
    parser.add_argument(
        "--japanese-epub",
        default=os.environ.get("JAPANESE_EPUB"),
        help="Path to 百年の孤独 EPUB. Can also be set with JAPANESE_EPUB.",
    )
    parser.add_argument("--output", type=Path, default=OUT_EPUB, help="Output EPUB path.")
    parser.add_argument(
        "--no-semantic-rebalance",
        action="store_true",
        help="Disable lingtrain semantic anchor rebalance.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.japanese_epub:
        raise SystemExit("Missing Japanese EPUB path. Pass --japanese-epub or set JAPANESE_EPUB.")
    ja_epub = Path(args.japanese_epub).expanduser()
    if not ja_epub.exists():
        raise SystemExit(f"Japanese EPUB does not exist: {ja_epub}")

    alignment = build_alignment(ja_epub, semantic_rebalance=not args.no_semantic_rebalance)
    write_epub(alignment, args.output.expanduser())
    validate_epub(args.output.expanduser())
    print(json.dumps({"chapters": len(alignment), "output": str(args.output.expanduser())}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
