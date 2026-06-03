#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import math
import os
import re
import zipfile
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[2]
HIGHLIGHTS_JS = ROOT / "highlights" / "data.js"
ALIGNED_JSON = ROOT / "data" / "bilingual" / "aligned_paragraphs.json"
OUT_JSON = ROOT / "data" / "bilingual" / "highlight_multilingual_quotes.json"
OUT_REVIEW = ROOT / "data" / "bilingual" / "highlight_multilingual_quotes_review.html"


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


def normalize_for_match(text: str) -> str:
    text = normalize_text(text).lower()
    text = re.sub(r"[^\w\u4e00-\u9fffぁ-ゟ゠-ヿ一-龯áéíóúüñÁÉÍÓÚÜÑ]+", "", text)
    return text


def load_highlights() -> dict:
    text = HIGHLIGHTS_JS.read_text(encoding="utf-8")
    match = re.search(r"window\.WEREAD_HIGHLIGHTS_DATA\s*=\s*(\{.*\});?\s*$", text, re.S)
    if not match:
        raise RuntimeError("Could not parse highlights/data.js")
    return json.loads(match.group(1))


def read_epub_text(epub: Path, name: str) -> str:
    with zipfile.ZipFile(epub) as zf:
        return zf.read(name).decode("utf-8", errors="replace")


def extract_paragraphs(epub: Path, chapter_files: Iterable[str]) -> list[list[Paragraph]]:
    chapters: list[list[Paragraph]] = []
    with zipfile.ZipFile(epub) as zf:
        for file_name in chapter_files:
            parser = BodyParagraphParser()
            parser.feed(zf.read(file_name).decode("utf-8", errors="replace"))
            paragraphs = [Paragraph(text=text, index=i) for i, text in enumerate(parser.blocks, start=1) if keep_paragraph(text)]
            chapters.append(paragraphs)
    return chapters


def keep_paragraph(text: str) -> bool:
    if len(text) < 2:
        return False
    if re.fullmatch(r"(Cap[ií]tulo|Chapter)\s+\d+", text, re.I):
        return False
    return True


def text_weight(text: str, lang: str) -> float:
    if lang in {"zh", "ja"}:
        cjk = len(re.findall(r"[\u4e00-\u9fffぁ-ゟ゠-ヿ]", text))
        punct = len(re.findall(r"[。！？；、，,.!?;:]", text))
        return max(1.0, cjk * (1.8 if lang == "zh" else 1.65) + punct * 0.25)
    words = len(re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿ]+)?", text))
    punct = len(re.findall(r"[.!?;:]", text))
    return max(1.0, words * 5.2 + punct * 0.35)


def prefix_weights(items: list[str], lang: str) -> list[float]:
    values = [0.0]
    for item in items:
        values.append(values[-1] + text_weight(item, lang))
    return values


def align_texts(ref_rows: list[str], ref_lang: str, target_paragraphs: list[Paragraph], target_lang: str) -> list[list[Paragraph]]:
    n = len(ref_rows)
    m = len(target_paragraphs)
    if not n:
        return []
    if not m:
        return [[] for _ in ref_rows]

    rw = prefix_weights(ref_rows, ref_lang)
    tw = prefix_weights([p.text for p in target_paragraphs], target_lang)
    ratio = tw[-1] / rw[-1] if rw[-1] else 1.0
    max_ref_group = 2
    max_target_group = 5
    inf = 1e18
    dp = [[inf] * (m + 1) for _ in range(n + 1)]
    back: list[list[tuple[int, int] | None]] = [[None] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(n + 1):
        for j in range(m + 1):
            cur = dp[i][j]
            if cur >= inf:
                continue
            for a in range(1, max_ref_group + 1):
                if i + a > n:
                    break
                for b in range(1, max_target_group + 1):
                    if j + b > m:
                        break
                    ref_len = rw[i + a] - rw[i]
                    tgt_len = tw[j + b] - tw[j]
                    length_cost = abs(ref_len * ratio - tgt_len) / max(ref_len * ratio, tgt_len, 1.0)
                    group_cost = (a - 1) * 0.22 + (b - 1) * 0.08
                    position_cost = abs(((i + a) / n) - ((j + b) / m)) * 0.1
                    cost = length_cost + group_cost + position_cost
                    if cur + cost < dp[i + a][j + b]:
                        dp[i + a][j + b] = cur + cost
                        back[i + a][j + b] = (a, b)

    if back[n][m] is None:
        raise RuntimeError("Could not align chapter")

    groups: list[list[Paragraph]] = [[] for _ in range(n)]
    i, j = n, m
    while i > 0 and j > 0:
        step = back[i][j]
        if step is None:
            raise RuntimeError("Broken alignment")
        a, b = step
        for ref_idx in range(i - a, i):
            groups[ref_idx] = target_paragraphs[j - b:j]
        i -= a
        j -= b
    return groups


def highlight_lists(data: dict) -> list[dict]:
    items = []
    for scope, highlights in [("book", data.get("highlights", []))]:
        for item in highlights:
            copied = dict(item)
            copied["_scope"] = scope
            items.append(copied)
    for chapter in data.get("chapters", []):
        for item in chapter.get("highlights", []):
            copied = dict(item)
            copied["_scope"] = "chapter"
            items.append(copied)
    return items


def best_span_for_highlight(chapter: dict, item: dict) -> tuple[int, int, float]:
    quote = normalize_for_match(item.get("quoteHint", ""))
    if not quote:
        return 0, 1, 0.0

    best_start = 0
    best_end = 1
    best_score = -1.0
    pairs = chapter["pairs"]
    for start in range(len(pairs)):
        for end in range(start + 1, min(len(pairs), start + 3) + 1):
            zh = normalize_for_match("".join("".join(pair.get("zh", [])) for pair in pairs[start:end]))
            score = containment_score(quote, zh)
            span_penalty = (end - start - 1) * 0.015
            adjusted = score - span_penalty
            if adjusted > best_score:
                best_start = start
                best_end = end
                best_score = adjusted
    return best_start, best_end, max(0.0, best_score)


def containment_score(needle: str, haystack: str) -> float:
    if not needle or not haystack:
        return 0.0
    if needle in haystack:
        return 1.0
    if haystack in needle:
        return len(haystack) / len(needle)

    grams = {needle[i:i + 4] for i in range(max(1, len(needle) - 3))}
    if not grams:
        return 0.0
    hit = sum(1 for gram in grams if gram in haystack)
    return hit / len(grams)


def build(es_epub: Path, ja_epub: Path) -> dict:
    data = load_highlights()
    aligned = json.loads(ALIGNED_JSON.read_text(encoding="utf-8"))

    es_chapters = extract_paragraphs(es_epub, [f"OEBPS/Text/capitulo{i:03d}.xhtml" for i in range(1, 21)])
    ja_chapters = extract_paragraphs(ja_epub, [f"c{i:02d}.html" for i in range(1, 21)])

    chapter_maps = {}
    for chapter in aligned:
        chapter_no = int(chapter["number"])
        ref_rows_en = [" ".join(pair["en"]) for pair in chapter["pairs"]]
        ref_rows_zh = ["".join(pair["zh"]) for pair in chapter["pairs"]]
        es_groups = align_texts(ref_rows_en, "en", es_chapters[chapter_no - 1], "es")
        ja_groups = align_texts(ref_rows_zh, "zh", ja_chapters[chapter_no - 1], "ja")
        chapter_maps[chapter_no] = {
            "es": es_groups,
            "ja": ja_groups,
        }

    items = []
    for item in highlight_lists(data):
        chapter_no = int(item["chapterOrder"])
        chapter = aligned[chapter_no - 1]
        row_start, row_end, score = best_span_for_highlight(chapter, item)
        pairs = chapter["pairs"][row_start:row_end]
        es_group = unique_paragraphs(p for idx in range(row_start, row_end) for p in chapter_maps[chapter_no]["es"][idx])
        ja_group = unique_paragraphs(p for idx in range(row_start, row_end) for p in chapter_maps[chapter_no]["ja"][idx])
        items.append(
            {
                "scope": item["_scope"],
                "rank": item.get("rank"),
                "chapter": item.get("chapter"),
                "chapterOrder": chapter_no,
                "chapterUid": item.get("chapterUid"),
                "range": item.get("range"),
                "cue": item.get("cue"),
                "highlightCount": item.get("highlightCount"),
                "match": {
                    "alignedRow": row_start + 1,
                    "alignedRowEnd": row_end,
                    "score": round(score, 4),
                    "zhIndex": flatten_indices(pair.get("zh_index") for pair in pairs),
                    "enIndex": flatten_indices(pair.get("en_index") for pair in pairs),
                    "esIndex": [p.index for p in es_group],
                    "jaIndex": [p.index for p in ja_group],
                },
                "texts": {
                    "zh": item.get("quoteHint", ""),
                    "zh_context": "\n".join(text for pair in pairs for text in pair.get("zh", [])),
                    "en": "\n".join(text for pair in pairs for text in pair.get("en", [])),
                    "es": "\n".join(p.text for p in es_group),
                    "ja": "\n".join(p.text for p in ja_group),
                },
            }
        )

    return {
        "source": {
            "highlights": "highlights/data.js",
            "alignment": "data/bilingual/aligned_paragraphs.json",
            "spanish": es_epub.name,
            "japanese": ja_epub.name,
        },
        "counts": {
            "items": len(items),
            "bookHighlights": len(data.get("highlights", [])),
            "chapterHighlights": sum(len(chapter.get("highlights", [])) for chapter in data.get("chapters", [])),
        },
        "items": items,
    }


def flatten_indices(groups: Iterable[Iterable[int] | None]) -> list[int]:
    values: list[int] = []
    for group in groups:
        if group:
            values.extend(group)
    return values


def unique_paragraphs(paragraphs: Iterable[Paragraph]) -> list[Paragraph]:
    seen = set()
    values: list[Paragraph] = []
    for paragraph in paragraphs:
        if paragraph.index in seen:
            continue
        seen.add(paragraph.index)
        values.append(paragraph)
    return values


def write_review(result: dict, out_review: Path) -> None:
    rows = [
        "<!doctype html><meta charset='utf-8'><title>Highlight multilingual quote review</title>",
        "<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.55;margin:24px}article{border-top:1px solid #ccc;padding:16px 0}.meta{color:#666;font-size:13px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}h2{font-size:18px}.lang{font-size:14px;white-space:pre-wrap}@media(max-width:900px){.grid{grid-template-columns:1fr}}</style>",
        f"<h1>Highlight multilingual quote review</h1><p>{result['counts']}</p>",
    ]
    for item in result["items"][:80]:
        rows.append("<article>")
        rows.append(f"<h2>{html.escape(str(item.get('cue')))} / Chapter {item['chapterOrder']}</h2>")
        rows.append(f"<div class='meta'>scope={item['scope']} rank={item.get('rank')} score={item['match']['score']} row={item['match']['alignedRow']}</div>")
        rows.append("<div class='grid'>")
        for lang in ["zh", "en", "es", "ja"]:
            rows.append(f"<div class='lang'><strong>{lang}</strong><br>{html.escape(item['texts'].get(lang, ''))}</div>")
        rows.append("</div></article>")
    out_review.write_text("\n".join(rows), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Align WeRead highlight snippets with Chinese, English, Spanish, and Japanese source paragraphs.",
    )
    parser.add_argument(
        "--spanish-epub",
        default=os.environ.get("SPANISH_EPUB"),
        help="Path to Cien años de soledad EPUB. Can also be set with SPANISH_EPUB.",
    )
    parser.add_argument(
        "--japanese-epub",
        default=os.environ.get("JAPANESE_EPUB"),
        help="Path to 百年の孤独 EPUB. Can also be set with JAPANESE_EPUB.",
    )
    parser.add_argument("--output", type=Path, default=OUT_JSON, help="Output JSON path.")
    parser.add_argument("--review", type=Path, default=OUT_REVIEW, help="Optional local review HTML path.")
    parser.add_argument("--skip-review", action="store_true", help="Do not write the local review HTML.")
    return parser.parse_args()


def resolve_epub(value: str | None, label: str) -> Path:
    if not value:
        raise SystemExit(f"Missing {label} EPUB path. Pass --{label}-epub or set {label.upper()}_EPUB.")
    path = Path(value).expanduser()
    if not path.exists():
        raise SystemExit(f"{label.title()} EPUB does not exist: {path}")
    return path


def main() -> None:
    args = parse_args()
    es_epub = resolve_epub(args.spanish_epub, "spanish")
    ja_epub = resolve_epub(args.japanese_epub, "japanese")
    out_json = args.output.expanduser()
    out_review = args.review.expanduser()

    result = build(es_epub, ja_epub)
    out_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    if not args.skip_review:
        write_review(result, out_review)
    scores = [item["match"]["score"] for item in result["items"]]
    print(json.dumps({
        "items": len(scores),
        "minScore": min(scores),
        "lowScoreCount": sum(1 for score in scores if score < 0.7),
        "output": str(out_json),
        "review": None if args.skip_review else str(out_review),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
