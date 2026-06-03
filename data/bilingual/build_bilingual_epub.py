#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import math
import os
import posixpath
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


ZH_EPUB = Path("/Users/jin/Downloads/百年孤独 = Cien años de soledad ( etc.) (z-library.sk, 1lib.sk, z-lib.sk).epub")
EN_EPUB = Path("/Users/jin/Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat/2.0b4.0.9/9aa55bf227e8cc78e8580c855b12ed7d/Message/MessageTemp/10ef1d098b649627359eac0eb670762f/File/One Hundred Years of Solitude.epub")
OUT_DIR = Path("/Users/jin/Desktop/one_hundred_years_bilingual")


@dataclass
class Paragraph:
    text: str
    source: str
    index: int


@dataclass
class Chapter:
    number: int
    title_zh: str
    title_en: str
    zh: list[Paragraph]
    en: list[Paragraph]


class BodyParagraphParser(HTMLParser):
    """Extract reading-order prose blocks from simple calibre XHTML."""

    BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "h5", "h6"}
    SKIP_TAGS = {"head", "style", "script", "title", "ul", "ol", "table", "sup", "sub"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_body = False
        self.skip_depth = 0
        self.stack: list[dict[str, object]] = []
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
            if tag == "p":
                self._flush_open_div()
            self.stack.append({"tag": tag, "parts": []})
        elif tag == "br" and self.stack:
            self.stack[-1]["parts"].append(" ")

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
        if tag in self.BLOCK_TAGS:
            self._flush_until(tag)

    def handle_data(self, data: str) -> None:
        if not self.in_body or self.skip_depth or not self.stack:
            return
        self.stack[-1]["parts"].append(data)

    def _flush_open_div(self) -> None:
        if self.stack and self.stack[-1]["tag"] == "div":
            self._flush_buffer(self.stack[-1]["parts"])
            self.stack[-1]["parts"] = []

    def _flush_until(self, tag: str) -> None:
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]["tag"] == tag:
                while len(self.stack) > i:
                    self._flush_top()
                return

    def _flush_top(self) -> None:
        item = self.stack.pop()
        text = self._normalize("".join(item["parts"]))
        if text:
            self.blocks.append(text)

    def _flush_buffer(self, parts: object) -> None:
        text = self._normalize("".join(parts))
        if text:
            self.blocks.append(text)

    @staticmethod
    def _normalize(text: str) -> str:
        text = html.unescape(text)
        text = text.replace("\xa0", " ")
        text = re.sub(r"\s+", " ", text)
        return text.strip()


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attrs_dict = dict(attrs)
        self._href = attrs_dict.get("href")
        self._parts = []

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            label = re.sub(r"\s+", " ", "".join(self._parts)).strip()
            self.links.append((self._href, label))
            self._href = None
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._parts.append(data)


def read_zip_text(epub: Path, name: str) -> str:
    with zipfile.ZipFile(epub) as zf:
        return zf.read(name).decode("utf-8", errors="replace")


def opf_path(epub: Path) -> str:
    container = read_zip_text(epub, "META-INF/container.xml")
    root = ET.fromstring(container.encode("utf-8"))
    ns = {"c": "urn:oasis:names:tc:opendocument:xmlns:container"}
    elem = root.find(".//c:rootfile", ns)
    if elem is None:
        raise RuntimeError(f"No OPF rootfile in {epub}")
    return elem.attrib["full-path"]


def parse_opf(epub: Path) -> tuple[str, dict[str, str], list[str]]:
    opf = opf_path(epub)
    data = read_zip_text(epub, opf)
    root = ET.fromstring(data.encode("utf-8"))
    ns = {"opf": "http://www.idpf.org/2007/opf"}
    base = posixpath.dirname(opf)
    manifest: dict[str, str] = {}
    for item in root.findall(".//opf:manifest/opf:item", ns):
        href = item.attrib["href"]
        manifest[item.attrib["id"]] = posixpath.normpath(posixpath.join(base, href))
    spine = []
    for itemref in root.findall(".//opf:spine/opf:itemref", ns):
        idref = itemref.attrib["idref"]
        if idref in manifest:
            spine.append(manifest[idref])
    return opf, manifest, spine


def parse_ncx_chapters(epub: Path) -> list[tuple[str, str]]:
    data = read_zip_text(epub, "toc.ncx")
    root = ET.fromstring(data.encode("utf-8"))
    ns = {"n": "http://www.daisy.org/z3986/2005/ncx/"}
    chapters: list[tuple[str, str]] = []
    for nav in root.findall(".//n:navPoint", ns):
        label = nav.findtext("./n:navLabel/n:text", default="", namespaces=ns).strip()
        content = nav.find("./n:content", ns)
        if content is not None and content.attrib.get("src"):
            chapters.append((content.attrib["src"].split("#", 1)[0], label))
    return chapters


def parse_html_toc_links(epub: Path, toc_name: str, base_dir: str) -> list[tuple[str, str]]:
    parser = LinkParser()
    parser.feed(read_zip_text(epub, toc_name))
    chapters: list[tuple[str, str]] = []
    for href, label in parser.links:
        clean = href.split("#", 1)[0]
        if not clean:
            continue
        chapters.append((posixpath.normpath(posixpath.join(base_dir, clean)), label))
    return chapters


def source_ranges(starts: list[tuple[str, str]], spine: list[str]) -> list[tuple[str, str, list[str]]]:
    index = {name: i for i, name in enumerate(spine)}
    ranges = []
    for pos, (start, label) in enumerate(starts):
        if start not in index:
            continue
        begin = index[start]
        end = len(spine)
        for next_start, _ in starts[pos + 1:]:
            if next_start in index:
                end = index[next_start]
                break
        ranges.append((start, label, spine[begin:end]))
    return ranges


def extract_paragraphs(epub: Path, sources: Iterable[str]) -> list[Paragraph]:
    paragraphs: list[Paragraph] = []
    seen = 0
    for source in sources:
        parser = BodyParagraphParser()
        parser.feed(read_zip_text(epub, source))
        for text in parser.blocks:
            text = clean_paragraph(text)
            if is_trailing_nonfiction_marker(text):
                return paragraphs
            if not text or skip_paragraph(text):
                continue
            seen += 1
            paragraphs.append(Paragraph(text=text, source=source, index=seen))
    return paragraphs


def clean_paragraph(text: str) -> str:
    text = text.replace(" ,", ",").replace(" .", ".")
    text = text.replace("“ ", "“").replace(" ”", "”")
    text = text.replace("‘ ", "‘").replace(" ’", "’")
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    text = re.sub(r"([“‘])\s+", r"\1", text)
    return text.strip()


def skip_paragraph(text: str) -> bool:
    if not text:
        return True
    if re.fullmatch(r"Chapter\s+\d+", text, re.I):
        return True
    if text in {"Table of Contents", "Contents"}:
        return True
    if re.fullmatch(r"THE\s+END\.?", text, re.I):
        return True
    if re.fullmatch(r"第\s*\d+\s*章", text):
        return True
    if len(text) <= 2 and not re.search(r"[\u4e00-\u9fffA-Za-z]", text):
        return True
    return False


def is_trailing_nonfiction_marker(text: str) -> bool:
    return "以下内容为原PDF征求募捐页面" in text


def load_chapters() -> list[Chapter]:
    _, _, zh_spine = parse_opf(ZH_EPUB)
    _, _, en_spine = parse_opf(EN_EPUB)

    zh_starts = parse_html_toc_links(ZH_EPUB, "text/part0025.html", "text")
    zh_starts = [(src, label) for src, label in zh_starts if re.fullmatch(r"第\d+章", label)]
    en_starts = parse_ncx_chapters(EN_EPUB)
    en_starts = [(src, label) for src, label in en_starts if re.fullmatch(r"Chapter\s+\d+", label, re.I)]

    zh_ranges = source_ranges(zh_starts, zh_spine)
    en_ranges = source_ranges(en_starts, en_spine)
    if len(zh_ranges) != len(en_ranges):
        raise RuntimeError(f"Chapter count mismatch: zh={len(zh_ranges)} en={len(en_ranges)}")

    chapters: list[Chapter] = []
    for number, (zh_range, en_range) in enumerate(zip(zh_ranges, en_ranges), start=1):
        _, zh_label, zh_sources = zh_range
        _, en_label, en_sources = en_range
        chapters.append(
            Chapter(
                number=number,
                title_zh=zh_label,
                title_en=en_label,
                zh=extract_paragraphs(ZH_EPUB, zh_sources),
                en=extract_paragraphs(EN_EPUB, en_sources),
            )
        )
    return chapters


def paragraph_weight(text: str, lang: str) -> float:
    if lang == "zh":
        cjk = len(re.findall(r"[\u4e00-\u9fff]", text))
        ascii_words = len(re.findall(r"[A-Za-z]+", text))
        punct = len(re.findall(r"[。！？；：，、,.!?;:]", text))
        return max(1.0, cjk * 1.85 + ascii_words * 1.5 + punct * 0.25)
    words = len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)?", text))
    punct = len(re.findall(r"[.!?;:]", text))
    return max(1.0, words * 5.25 + punct * 0.35)


def prefix_sums(items: list[Paragraph], lang: str) -> list[float]:
    sums = [0.0]
    for item in items:
        sums.append(sums[-1] + paragraph_weight(item.text, lang))
    return sums


def align_chapter(chapter: Chapter, max_group: int = 3) -> list[dict[str, object]]:
    zh = chapter.zh
    en = chapter.en
    n = len(zh)
    m = len(en)
    if not n and not m:
        return []
    if not n:
        return [{"zh": [], "en": [p.text for p in en], "cost": 0.0}]
    if not m:
        return [{"zh": [p.text for p in zh], "en": [], "cost": 0.0}]

    zw = prefix_sums(zh, "zh")
    ew = prefix_sums(en, "en")
    total_z = zw[-1]
    total_e = ew[-1]
    ratio = total_e / total_z if total_z else 1.0

    inf = 1e18
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(n + 1):
        for j in range(m + 1):
            current = dp[i][j]
            if current >= inf:
                continue
            for a in range(1, max_group + 1):
                if i + a > n:
                    break
                for b in range(1, max_group + 1):
                    if j + b > m:
                        break
                    z_len = zw[i + a] - zw[i]
                    e_len = ew[j + b] - ew[j]
                    length_cost = abs((z_len * ratio) - e_len) / max((z_len * ratio), e_len, 1.0)
                    group_cost = (a - 1) * 0.16 + (b - 1) * 0.16
                    quote_cost = quote_boundary_penalty(zh[i:i + a], en[j:j + b])
                    position_cost = abs(((i + a) / n) - ((j + b) / m)) * 0.08
                    cost = length_cost + group_cost + quote_cost + position_cost
                    if current + cost < dp[i + a][j + b]:
                        dp[i + a][j + b] = current + cost
                        back[i + a][j + b] = (a, b)

    if back[n][m] is None:
        raise RuntimeError(f"Could not align chapter {chapter.number}")

    pairs = []
    i, j = n, m
    while i > 0 or j > 0:
        step = back[i][j]
        if step is None:
            raise RuntimeError(f"Broken alignment at chapter {chapter.number}: {i}, {j}")
        a, b = step
        start_i = i - a
        start_j = j - b
        z_len = zw[i] - zw[start_i]
        e_len = ew[j] - ew[start_j]
        length_cost = abs((z_len * ratio) - e_len) / max((z_len * ratio), e_len, 1.0)
        pairs.append(
            {
                "zh": [p.text for p in zh[start_i:i]],
                "en": [p.text for p in en[start_j:j]],
                "zh_index": [p.index for p in zh[start_i:i]],
                "en_index": [p.index for p in en[start_j:j]],
                "cost": round(length_cost, 4),
            }
        )
        i, j = start_i, start_j
    pairs.reverse()
    return pairs


def quote_boundary_penalty(zh: list[Paragraph], en: list[Paragraph]) -> float:
    zh_text = " ".join(p.text for p in zh)
    en_text = " ".join(p.text for p in en)
    zh_quote = bool(re.match(r"^[“\"'‘]", zh_text)) or bool(re.search(r"[”\"'’]$", zh_text))
    en_quote = bool(re.match(r"^[“\"'‘]", en_text)) or bool(re.search(r"[”\"'’]$", en_text))
    return 0.04 if zh_quote != en_quote else 0.0


def build_alignment(chapters: list[Chapter]) -> list[dict[str, object]]:
    result = []
    for chapter in chapters:
        result.append(
            {
                "number": chapter.number,
                "title_zh": chapter.title_zh,
                "title_en": chapter.title_en,
                "zh_paragraphs": len(chapter.zh),
                "en_paragraphs": len(chapter.en),
                "pairs": align_chapter(chapter),
            }
        )
    return result


def write_json(alignment: list[dict[str, object]], out: Path) -> None:
    out.write_text(json.dumps(alignment, ensure_ascii=False, indent=2), encoding="utf-8")


def write_review_html(alignment: list[dict[str, object]], out: Path, full: bool = False) -> None:
    rows = []
    rows.append("""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>百年孤独中英段落对齐检查</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f7f7f5;color:#202124}
header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:14px 22px;z-index:1}
main{max-width:1200px;margin:0 auto;padding:20px}
.chapter{margin:24px 0 36px}
h2{font-size:20px;margin:0 0 12px}
.row{display:flex;gap:18px;align-items:flex-start;border-top:1px solid #ddd;padding:12px 0}
.lang{flex:1;line-height:1.65;font-size:16px}
.meta{width:74px;color:#777;font-size:12px}
.warn{color:#a33;font-weight:600}
p{margin:.35em 0}
@media (max-width:760px){.row{display:block}.meta{width:auto;margin-bottom:8px}.lang{font-size:15px}}
</style>
</head><body><header><strong>百年孤独中英段落对齐检查</strong></header><main>""")
    for chapter in alignment:
        rows.append(f"<section class='chapter'><h2>{html.escape(chapter['title_zh'])} / {html.escape(chapter['title_en'])}</h2>")
        pairs = chapter["pairs"] if full else chapter["pairs"][:12]
        for idx, pair in enumerate(pairs, start=1):
            warn = " warn" if pair["cost"] > 0.55 else ""
            zh_html = "".join(f"<p>{html.escape(t)}</p>" for t in pair["zh"])
            en_html = "".join(f"<p>{html.escape(t)}</p>" for t in pair["en"])
            rows.append(
                f"<div class='row'><div class='meta{warn}'>#{idx}<br>cost {pair['cost']}</div>"
                f"<div class='lang'>{zh_html}</div><div class='lang'>{en_html}</div></div>"
            )
        if not full and len(chapter["pairs"]) > 12:
            rows.append(f"<p>... preview shows first 12 of {len(chapter['pairs'])} pairs.</p>")
        rows.append("</section>")
    rows.append("</main></body></html>")
    out.write_text("\n".join(rows), encoding="utf-8")


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


def write_epub(alignment: list[dict[str, object]], out: Path, layout: str = "columns") -> None:
    if layout not in {"columns", "alternating"}:
        raise ValueError(f"Unsupported layout: {layout}")

    build_dir = OUT_DIR / "epub_build"
    if build_dir.exists():
        shutil.rmtree(build_dir)
    (build_dir / "META-INF").mkdir(parents=True)
    (build_dir / "OEBPS" / "text").mkdir(parents=True)
    (build_dir / "OEBPS" / "styles").mkdir(parents=True)

    (build_dir / "mimetype").write_text("application/epub+zip", encoding="ascii")
    (build_dir / "META-INF" / "container.xml").write_text(
        """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
""",
        encoding="utf-8",
    )

    if layout == "columns":
        css = """body {
  margin: 0;
  padding: 0;
  color: #1f2328;
  font-family: serif;
  line-height: 1.55;
}
.chapter-title {
  font-family: sans-serif;
  font-size: 1.35em;
  margin: 1em 0 1.2em;
  page-break-after: avoid;
}
.row {
  display: flex;
  gap: 1.2em;
  align-items: flex-start;
  margin: 0 0 1.15em;
  padding: 0 0 1.15em;
  border-bottom: 1px solid #ddd;
  page-break-inside: avoid;
}
.lang-left,
.lang-right {
  flex: 1 1 0;
  min-width: 0;
}
.lang-left {
  font-family: Georgia, "Times New Roman", serif;
}
.lang-right {
  font-family: "Songti SC", "Noto Serif CJK SC", serif;
}
p {
  margin: 0 0 .45em;
}
@media (max-width: 680px) {
  .row {
    display: block;
  }
  .lang-left {
    margin-bottom: .55em;
  }
}
"""
    else:
        css = """body {
  margin: 0;
  padding: 0;
  color: #1f2328;
  font-family: serif;
  line-height: 1.58;
}
.chapter-title {
  font-family: sans-serif;
  font-size: 1.35em;
  margin: 1em 0 1.2em;
  page-break-after: avoid;
}
.pair {
  margin: 0 0 1.05em;
  padding: 0 0 .85em;
  border-bottom: 1px solid #ddd;
  page-break-inside: avoid;
}
.para-en {
  font-family: Georgia, "Times New Roman", serif;
  margin: 0 0 .42em;
}
.para-zh {
  font-family: "Songti SC", "Noto Serif CJK SC", serif;
  margin: 0 0 .72em;
}
"""
    (build_dir / "OEBPS" / "styles" / "bilingual.css").write_text(css, encoding="utf-8")

    book_title = "One Hundred Years of Solitude / 百年孤独 - 中英对照"
    if layout == "alternating":
        book_title = "One Hundred Years of Solitude / 百年孤独 - 段落交替中英对照"

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
        file_path = build_dir / "OEBPS" / href
        body_parts = [f"<h1 class=\"chapter-title\">{html.escape(chapter['title_en'])} / {html.escape(chapter['title_zh'])}</h1>"]
        for pair in chapter["pairs"]:
            if layout == "columns":
                en_html = "".join(f"<p>{html.escape(t)}</p>" for t in pair["en"])
                zh_html = "".join(f"<p>{html.escape(t)}</p>" for t in pair["zh"])
                body_parts.append(f"<div class=\"row\"><div class=\"lang-left\">{en_html}</div><div class=\"lang-right\">{zh_html}</div></div>")
            else:
                body_parts.append("<div class=\"pair\">")
                max_parts = max(len(pair["en"]), len(pair["zh"]))
                for idx in range(max_parts):
                    if idx < len(pair["en"]):
                        body_parts.append(f"<p class=\"para-en\">{html.escape(pair['en'][idx])}</p>")
                    if idx < len(pair["zh"]):
                        body_parts.append(f"<p class=\"para-zh\">{html.escape(pair['zh'][idx])}</p>")
                body_parts.append("</div>")
        file_path.write_text(xhtml_page(f"{chapter['title_en']} / {chapter['title_zh']}", "\n".join(body_parts)), encoding="utf-8")
        item_id = f"chapter{number:02d}"
        manifest_items.append(f'<item id="{item_id}" href="{href}" media-type="application/xhtml+xml"/>')
        spine_items.append(f'<itemref idref="{item_id}"/>')
        nav_items.append((number, chapter["title_en"], chapter["title_zh"], href))

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
    (build_dir / "OEBPS" / "content.opf").write_text(opf, encoding="utf-8")

    nav_lis = []
    for number, en_title, zh_title, href in nav_items:
        nav_lis.append(f'      <li><a href="{href}">{html.escape(en_title)} / {html.escape(zh_title)}</a></li>')
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
    (build_dir / "OEBPS" / "nav.xhtml").write_text(nav_doc, encoding="utf-8")

    nav_points = []
    for play_order, en_title, zh_title, href in nav_items:
        nav_points.append(
            f"""    <navPoint id="chapter{play_order:02d}" playOrder="{play_order}">
      <navLabel><text>{html.escape(en_title)} / {html.escape(zh_title)}</text></navLabel>
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
    (build_dir / "OEBPS" / "toc.ncx").write_text(ncx, encoding="utf-8")

    if out.exists():
        out.unlink()
    with zipfile.ZipFile(out, "w") as zf:
        zf.write(build_dir / "mimetype", "mimetype", compress_type=zipfile.ZIP_STORED)
        for path in sorted(build_dir.rglob("*")):
            if path.is_file() and path.name != "mimetype":
                arcname = path.relative_to(build_dir).as_posix()
                zf.write(path, arcname, compress_type=zipfile.ZIP_DEFLATED)


def write_summary(chapters: list[Chapter], alignment: list[dict[str, object]], out: Path) -> None:
    lines = []
    lines.append("# Alignment summary")
    lines.append("")
    total_zh = sum(len(c.zh) for c in chapters)
    total_en = sum(len(c.en) for c in chapters)
    total_pairs = sum(len(ch["pairs"]) for ch in alignment)
    high_cost = sum(1 for ch in alignment for pair in ch["pairs"] if pair["cost"] > 0.55)
    lines.append(f"- Chapters: {len(chapters)}")
    lines.append(f"- Chinese paragraphs: {total_zh}")
    lines.append(f"- English paragraphs: {total_en}")
    lines.append(f"- Aligned rows: {total_pairs}")
    lines.append(f"- High-cost rows (>0.55): {high_cost}")
    lines.append("")
    lines.append("| Chapter | Chinese paragraphs | English paragraphs | Rows | High-cost rows |")
    lines.append("| --- | ---: | ---: | ---: | ---: |")
    for chapter, aligned in zip(chapters, alignment):
        high = sum(1 for pair in aligned["pairs"] if pair["cost"] > 0.55)
        lines.append(f"| {chapter.number} | {len(chapter.zh)} | {len(chapter.en)} | {len(aligned['pairs'])} | {high} |")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-epub", action="store_true", help="only write alignment artifacts")
    parser.add_argument("--full-review", action="store_true", help="write full HTML review, not just chapter previews")
    parser.add_argument("--layout", choices=["columns", "alternating"], default="columns", help="EPUB reading layout")
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    chapters = load_chapters()
    alignment = build_alignment(chapters)

    write_json(alignment, OUT_DIR / "aligned_paragraphs.json")
    write_review_html(alignment, OUT_DIR / "alignment_preview.html", full=args.full_review)
    write_summary(chapters, alignment, OUT_DIR / "alignment_summary.md")

    if not args.no_epub:
        if args.layout == "alternating":
            epub = OUT_DIR / "One Hundred Years of Solitude - bilingual alternating zh-en.epub"
        else:
            epub = OUT_DIR / "One Hundred Years of Solitude - bilingual zh-en.epub"
        write_epub(alignment, epub, layout=args.layout)
        validate_epub(epub)


if __name__ == "__main__":
    main()
