#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from extract_sources import EXTRACTED_DIR, QUIZ_DIR, parse_chapter_heading
from prepare_sources import ROOT, VERSIONS_PATH, read_json


ANCHOR_PATH = ROOT / "data" / "bilingual" / "highlight_multilingual_quotes.json"
ALIGNED_PATH = ROOT / "data" / "bilingual" / "aligned_paragraphs.json"
NAME_MAP_PATH = QUIZ_DIR / "normalization" / "name_map.seed.json"
QUESTIONS_PATH = QUIZ_DIR / "questions.json"
REPORT_PATH = QUIZ_DIR / "question_generation_report.json"

TARGET_VERSION_IDS = ["fanye", "gao_changrong", "huang_shen_chen", "ye_shuyin", "yang_naidong"]
PUNCTUATION_RE = re.compile(r"[。！？!?；;]+[”’」』）】》]*")
NON_TEXT_RE = re.compile(r"[^\u3400-\u9fffA-Za-z0-9]+")
CJK_SPACE_RE = re.compile(r"(?<=[\u3400-\u9fff])\s+(?=[\u3400-\u9fff])")
COMMON_CHARS = set("的一是在不了有人和中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指几九区强放决西被干做必战先回则任取据处理世些只")
FALLBACK_HANT_TO_HANS = str.maketrans(
    {
        "後": "后",
        "對": "对",
        "這": "这",
        "個": "个",
        "們": "们",
        "與": "与",
        "為": "为",
        "時": "时",
        "會": "会",
        "來": "来",
        "說": "说",
        "國": "国",
        "裡": "里",
        "裏": "里",
        "長": "长",
        "兒": "儿",
        "見": "见",
        "過": "过",
        "還": "还",
        "著": "着",
        "點": "点",
        "開": "开",
        "關": "关",
        "發": "发",
        "實": "实",
        "無": "无",
        "從": "从",
        "將": "将",
        "當": "当",
        "聽": "听",
        "讓": "让",
        "問": "问",
        "間": "间",
        "樣": "样",
        "種": "种",
        "頭": "头",
        "歲": "岁",
        "馬": "马",
        "門": "门",
        "風": "风",
        "麼": "么",
        "沒": "没",
        "聲": "声",
        "遠": "远",
        "帶": "带",
        "覺": "觉",
        "記": "记",
        "憶": "忆",
        "愛": "爱",
        "離": "离",
        "滿": "满",
        "處": "处",
        "東": "东",
        "幾": "几",
        "該": "该",
        "雖": "虽",
        "雙": "双",
        "臉": "脸",
        "體": "体",
        "氣": "气",
        "殺": "杀",
        "獨": "独",
        "孤": "孤",
        "許": "许",
        "遙": "遥",
        "親": "亲",
        "鄉": "乡",
        "線": "线",
        "號": "号",
        "萬": "万",
        "夢": "梦",
        "尋": "寻",
        "寫": "写",
        "聖": "圣",
        "讀": "读",
        "羅": "罗",
        "亞": "亚",
        "爾": "尔",
        "諾": "诺",
        "爐": "炉",
        "邊": "边",
        "劍": "剑",
        "縣": "县",
        "圍": "围",
        "電": "电",
        "燈": "灯",
        "齣": "出",
        "轉": "转",
        "傳": "传",
        "亂": "乱",
        "應": "应",
        "報": "报",
        "戰": "战",
        "隊": "队",
        "槍": "枪",
        "決": "决",
        "與": "与",
        "斷": "断",
        "隻": "只",
        "僅": "仅",
        "壓": "压",
        "復": "复",
        "複": "复",
        "餘": "余",
        "餓": "饿",
        "飢": "饥",
        "婦": "妇",
        "書": "书",
        "舊": "旧",
        "難": "难",
        "變": "变",
        "厭": "厌",
        "熱": "热",
        "淚": "泪",
        "塊": "块",
        "黃": "黄",
        "葉": "叶",
        "楊": "杨",
    }
)


@dataclass(frozen=True)
class Sentence:
    index: int
    text: str
    start: int
    end: int


@dataclass
class ChapterModel:
    version_id: str
    chapter_order: int
    text: str
    sentences: list[Sentence]

    @property
    def char_count(self) -> int:
        return len(self.text)


class ScriptNormalizer:
    def __init__(self, name_map_path: Path) -> None:
        self.name_replacements = load_name_replacements(name_map_path)
        self.opencc = load_opencc()

    @property
    def has_opencc(self) -> bool:
        return self.opencc is not None

    def normalize_visible(self, text: str, script: str) -> str:
        text = normalize_text(text)
        if script == "Hant":
            text = self.hant_to_hans(text)
        for variant, canonical in self.name_replacements:
            text = text.replace(variant, canonical)
        return normalize_text(text)

    def hant_to_hans(self, text: str) -> str:
        if self.opencc:
            return self.opencc.convert(text)
        return text.translate(FALLBACK_HANT_TO_HANS)


def main() -> None:
    args = parse_args()
    normalizer = ScriptNormalizer(args.name_map)
    versions = {item["id"]: item for item in read_json(VERSIONS_PATH)["versions"] if item.get("includeInQuiz")}
    anchors = load_anchor_items(args.anchors)
    aligned_metrics = load_fanye_chapter_metrics(args.aligned)
    chapter_models = load_chapter_models(args.extracted_dir, versions, normalizer)

    questions = []
    report_records = []
    for anchor in anchors:
        question, records = build_question(anchor, aligned_metrics, chapter_models, versions, normalizer)
        questions.append(question)
        report_records.extend(records)

    output = {
        "schemaVersion": 1,
        "source": {
            "anchorFile": "data/bilingual/highlight_multilingual_quotes.json",
            "versionFile": "data/translation-quiz/versions.json",
            "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "notes": "Generated from short WeRead highlight anchors and local extracted translation text. Translator names are hidden in quiz UI.",
        },
        "questions": questions,
    }
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report = build_report(questions, report_records, normalizer)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate static blind-quiz questions from Chinese translation sources.")
    parser.add_argument("--anchors", type=Path, default=ANCHOR_PATH)
    parser.add_argument("--aligned", type=Path, default=ALIGNED_PATH)
    parser.add_argument("--extracted-dir", type=Path, default=EXTRACTED_DIR)
    parser.add_argument("--name-map", type=Path, default=NAME_MAP_PATH)
    parser.add_argument("--output", type=Path, default=QUESTIONS_PATH)
    parser.add_argument("--report", type=Path, default=REPORT_PATH)
    return parser.parse_args()


def load_anchor_items(path: Path) -> list[dict[str, Any]]:
    data = read_json(path)
    seen: set[tuple[int, str]] = set()
    anchors: list[dict[str, Any]] = []
    for item in data["items"]:
        if item.get("scope") != "chapter":
            continue
        key = (item["chapterUid"], item["range"])
        if key in seen:
            continue
        seen.add(key)
        anchors.append(item)
    return sorted(anchors, key=lambda item: (item["chapterOrder"], item["rank"]))


def load_fanye_chapter_metrics(path: Path) -> dict[int, dict[str, int]]:
    chapters = read_json(path)
    metrics: dict[int, dict[str, int]] = {}
    for chapter in chapters:
        text = "".join("".join(pair.get("zh", [])) for pair in chapter["pairs"])
        metrics[chapter["number"]] = {"chars": max(1, len(text)), "rows": max(1, len(chapter["pairs"]))}
    return metrics


def load_chapter_models(
    extracted_dir: Path,
    versions: dict[str, dict[str, Any]],
    normalizer: ScriptNormalizer,
) -> dict[str, dict[int, ChapterModel]]:
    models: dict[str, dict[int, ChapterModel]] = {}
    for version_id in TARGET_VERSION_IDS:
        path = extracted_dir / f"{version_id}.chapters.json"
        if not path.exists():
            raise FileNotFoundError(f"missing extracted text: {path}")
        version = versions[version_id]
        documents = read_json(path)
        models[version_id] = {}
        for document in documents:
            chapter_order = document["chapterOrder"]
            text = chapter_text_from_blocks(document["blocks"], version["script"], normalizer)
            sentences = split_sentences(text)
            models[version_id][chapter_order] = ChapterModel(
                version_id=version_id,
                chapter_order=chapter_order,
                text=text,
                sentences=sentences,
            )
    return models


def chapter_text_from_blocks(blocks: list[str], script: str, normalizer: ScriptNormalizer) -> str:
    cleaned: list[str] = []
    for block in blocks:
        text = normalize_text(block)
        if not text or parse_chapter_heading(text) or text.isdigit():
            continue
        cleaned.append(text)
    joined = "\n".join(cleaned)
    joined = repair_pdf_spacing(joined)
    return normalizer.normalize_visible(joined, script)


def build_question(
    anchor: dict[str, Any],
    aligned_metrics: dict[int, dict[str, int]],
    chapter_models: dict[str, dict[int, ChapterModel]],
    versions: dict[str, dict[str, Any]],
    normalizer: ScriptNormalizer,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    chapter_order = anchor["chapterOrder"]
    anchor_text = normalizer.normalize_visible(anchor["texts"]["zh"], versions["fanye"]["script"])
    start, end = parse_range(anchor["range"])
    chapter_metrics = aligned_metrics.get(chapter_order, {"chars": 1, "rows": 1})
    range_ratio = max(0.0, min(1.0, ((start + end) / 2) / chapter_metrics["chars"]))
    ratio = anchor_position_ratio(anchor, range_ratio, chapter_metrics["rows"])
    options: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []

    for version_id in TARGET_VERSION_IDS:
        if version_id == "fanye":
            options.append(
                {
                    "versionId": version_id,
                    "text": anchor_text,
                    "confidence": 1.0,
                    "normalized": True,
                    "source": {
                        "chapterOrder": chapter_order,
                        "paragraphIndex": anchor["match"].get("alignedRow"),
                        "sentenceIndex": anchor["match"].get("sentenceIndex", {}).get("zh", []),
                    },
                }
            )
            continue
        model = chapter_models[version_id][chapter_order]
        match = match_excerpt(anchor_text, model, ratio)
        options.append(
            {
                "versionId": version_id,
                "text": match["text"],
                "confidence": match["confidence"],
                "normalized": versions[version_id]["script"] == "Hant",
                "source": {
                    "chapterOrder": chapter_order,
                    "sentenceIndex": match["sentenceIndex"],
                },
            }
        )
        records.append(
            {
                "questionId": question_id(anchor),
                "versionId": version_id,
                "confidence": match["confidence"],
                "lengthRatio": round(safe_ratio(len(match["text"]), len(anchor_text)), 3),
                "positionRatio": round(ratio, 4),
            }
        )

    warnings = quality_warnings(anchor_text, options)
    min_confidence = min(option["confidence"] for option in options if option["versionId"] != "fanye")
    status = "ready"
    if min_confidence < 0.18 or any(not option["text"] for option in options):
        status = "disabled"
    elif min_confidence < 0.32 or warnings:
        status = "review"

    question = {
        "id": question_id(anchor),
        "chapter": anchor["chapter"],
        "chapterOrder": chapter_order,
        "chapterUid": anchor["chapterUid"],
        "range": anchor["range"],
        "rank": anchor["rank"],
        "cue": anchor.get("cue"),
        "highlightCount": anchor["highlightCount"],
        "anchor": {"versionId": "fanye", "text": anchor_text},
        "options": options,
        "quality": {
            "status": status,
            "minConfidence": round(min_confidence, 3),
            "warnings": warnings,
        },
    }
    return question, records


def match_excerpt(anchor_text: str, model: ChapterModel, position_ratio: float) -> dict[str, Any]:
    if not model.sentences:
        return {"text": "", "confidence": 0.0, "sentenceIndex": []}
    target = position_ratio * model.char_count
    window = max(1200, model.char_count * 0.1)
    candidates = [
        sentence
        for sentence in model.sentences
        if abs(((sentence.start + sentence.end) / 2) - target) <= window
    ]
    if not candidates:
        candidates = nearest_sentences(model.sentences, target, limit=12)
    content_candidates = sorted(
        model.sentences,
        key=lambda sentence: content_similarity(anchor_text, sentence.text),
        reverse=True,
    )[:24]
    candidates = unique_sentences([*candidates, *content_candidates])
    scored = [(candidate_score(anchor_text, sentence, target, window), sentence) for sentence in candidates]
    scored.sort(key=lambda item: item[0], reverse=True)
    best_score, best = scored[0]
    excerpt, indices = expand_excerpt(anchor_text, model.sentences, best.index)
    score = calibrate_confidence(best_score * length_guard(anchor_text, excerpt))
    return {"text": excerpt, "confidence": score, "sentenceIndex": indices}


def candidate_score(anchor_text: str, sentence: Sentence, target: float, window: float) -> float:
    content_score = content_similarity(anchor_text, sentence.text)
    sentence_mid = (sentence.start + sentence.end) / 2
    position_score = max(0.0, 1.0 - abs(sentence_mid - target) / max(1.0, window))
    return 0.9 * content_score + 0.1 * position_score


def content_similarity(anchor_text: str, candidate_text: str) -> float:
    anchor_full = comparable_text(anchor_text, keep_common=True)
    candidate_full = comparable_text(candidate_text, keep_common=True)
    anchor_key = comparable_text(anchor_text, keep_common=False)
    candidate_key = comparable_text(candidate_text, keep_common=False)
    if not candidate_full:
        return 0.0
    full_overlap = jaccard(char_ngrams(anchor_full), char_ngrams(candidate_full))
    key_overlap = jaccard(char_ngrams(anchor_key), char_ngrams(candidate_key))
    sequence = SequenceMatcher(None, anchor_full[:180], candidate_full[:180]).ratio()
    length_score = length_similarity(len(anchor_full), len(candidate_full))
    return 0.4 * full_overlap + 0.32 * key_overlap + 0.22 * sequence + 0.06 * length_score


def unique_sentences(sentences: list[Sentence]) -> list[Sentence]:
    seen: set[int] = set()
    output: list[Sentence] = []
    for sentence in sentences:
        if sentence.index in seen:
            continue
        seen.add(sentence.index)
        output.append(sentence)
    return output


def expand_excerpt(anchor_text: str, sentences: list[Sentence], center_index: int) -> tuple[str, list[int]]:
    center = sentences[center_index]
    parts = [center.text]
    indices = [center.index]
    anchor_len = len(anchor_text)
    max_len = max(90, min(220, math.ceil(anchor_len * 1.85)))
    if len(center.text) < anchor_len * 0.75 and center_index + 1 < len(sentences):
        nxt = sentences[center_index + 1]
        if len(center.text) + len(nxt.text) <= max_len:
            parts.append(nxt.text)
            indices.append(nxt.index)
    excerpt = normalize_text("".join(parts))
    if len(excerpt) > 240:
        excerpt = excerpt[:238].rstrip("，,、；;") + "。"
    return excerpt, indices


def quality_warnings(anchor_text: str, options: list[dict[str, Any]]) -> list[str]:
    warnings: list[str] = []
    anchor_len = len(anchor_text)
    for option in options:
        if option["versionId"] == "fanye":
            continue
        ratio = safe_ratio(len(option["text"]), anchor_len)
        if option["confidence"] < 0.32:
            warnings.append(f"low_confidence:{option['versionId']}")
        if ratio < 0.35 or ratio > 2.2:
            warnings.append(f"length_ratio_outlier:{option['versionId']}")
    return warnings


def build_report(
    questions: list[dict[str, Any]],
    records: list[dict[str, Any]],
    normalizer: ScriptNormalizer,
) -> dict[str, Any]:
    status_counts = Counter(question["quality"]["status"] for question in questions)
    warning_counts = Counter(warning for question in questions for warning in question["quality"].get("warnings", []))
    by_version: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_version[record["versionId"]].append(record)

    version_summary = {}
    for version_id, items in by_version.items():
        confidences = [item["confidence"] for item in items]
        length_ratios = [item["lengthRatio"] for item in items]
        version_summary[version_id] = {
            "items": len(items),
            "averageConfidence": round(sum(confidences) / len(confidences), 3),
            "minConfidence": min(confidences),
            "averageLengthRatio": round(sum(length_ratios) / len(length_ratios), 3),
            "lengthOutliers": sum(1 for value in length_ratios if value < 0.35 or value > 2.2),
        }

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "normalization": {
            "opencc": normalizer.has_opencc,
            "fallbackHantMapSize": len(FALLBACK_HANT_TO_HANS),
        },
        "summary": {
            "questions": len(questions),
            "statusCounts": dict(sorted(status_counts.items())),
            "warningCounts": dict(warning_counts.most_common()),
            "versions": version_summary,
        },
    }


def load_name_replacements(path: Path) -> list[tuple[str, str]]:
    data = read_json(path)
    replacements: list[tuple[str, str]] = []
    for entry in data["entries"]:
        canonical = entry["canonical"]
        for variant in entry["variants"]:
            if variant != canonical:
                replacements.append((variant, canonical))
    replacements.sort(key=lambda item: len(item[0]), reverse=True)
    return replacements


def load_opencc() -> Any | None:
    try:
        from opencc import OpenCC  # type: ignore
    except ModuleNotFoundError:
        return None
    return OpenCC("t2s")


def split_sentences(text: str) -> list[Sentence]:
    sentences: list[Sentence] = []
    start = 0
    index = 0
    for match in PUNCTUATION_RE.finditer(text):
        end = match.end()
        raw = normalize_text(text[start:end])
        for part in split_long_sentence(raw):
            if part:
                sentences.append(Sentence(index=index, text=part, start=start, end=end))
                index += 1
        start = end
    tail = normalize_text(text[start:])
    for part in split_long_sentence(tail):
        if part:
            sentences.append(Sentence(index=index, text=part, start=start, end=len(text)))
            index += 1
    return sentences


def split_long_sentence(text: str) -> list[str]:
    if len(text) <= 180:
        return [text] if text else []
    parts = re.split(r"(?<=[，,、：:])", text)
    output: list[str] = []
    current = ""
    for part in parts:
        if len(current) + len(part) > 140 and current:
            output.append(current.rstrip("，,、：:") + "。")
            current = part
        else:
            current += part
    if current:
        output.append(current)
    return output


def nearest_sentences(sentences: list[Sentence], target: float, limit: int) -> list[Sentence]:
    return sorted(sentences, key=lambda item: abs(((item.start + item.end) / 2) - target))[:limit]


def char_ngrams(text: str, size: int = 2) -> set[str]:
    if len(text) <= size:
        return {text} if text else set()
    return {text[index : index + size] for index in range(len(text) - size + 1)}


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def length_similarity(left: int, right: int) -> float:
    if not left or not right:
        return 0.0
    return max(0.0, 1.0 - abs(left - right) / max(left, right))


def length_guard(anchor_text: str, excerpt: str) -> float:
    ratio = safe_ratio(len(excerpt), len(anchor_text))
    if 0.45 <= ratio <= 1.9:
        return 1.0
    if ratio < 0.25 or ratio > 3.0:
        return 0.55
    return 0.78


def calibrate_confidence(raw_score: float) -> float:
    # Raw cross-translation character similarity is compressed: genuinely good
    # matches often land around 0.20-0.35 because translators choose different
    # words. Map that band into a reviewer-friendly confidence scale.
    return round(max(0.0, min(0.99, (raw_score - 0.06) / 0.36)), 3)


def comparable_text(text: str, keep_common: bool) -> str:
    text = NON_TEXT_RE.sub("", text)
    if keep_common:
        return text
    return "".join(char for char in text if char not in COMMON_CHARS)


def parse_range(value: str) -> tuple[int, int]:
    start, end = value.split("-", 1)
    return int(start), int(end)


def anchor_position_ratio(anchor: dict[str, Any], range_ratio: float, aligned_rows: int) -> float:
    match = anchor.get("match", {})
    aligned_row = match.get("alignedRow")
    if not aligned_row:
        return range_ratio
    row_ratio = max(0.0, min(1.0, (aligned_row - 0.5) / aligned_rows))
    if abs(row_ratio - range_ratio) > 0.18:
        return 0.72 * row_ratio + 0.28 * range_ratio
    return 0.45 * row_ratio + 0.55 * range_ratio


def safe_ratio(left: int, right: int) -> float:
    return left / right if right else 0.0


def question_id(anchor: dict[str, Any]) -> str:
    return f"ch{anchor['chapterOrder']:02d}-{anchor['rank']:03d}"


def repair_pdf_spacing(text: str) -> str:
    text = CJK_SPACE_RE.sub("", text)
    text = re.sub(r"第\s*([一二三四五六七八九十百〇零两0-9]+)\s*章", r"第\1章", text)
    return text


def normalize_text(text: str) -> str:
    text = text.replace("\u200b", "").replace("\xa0", " ")
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


if __name__ == "__main__":
    main()
