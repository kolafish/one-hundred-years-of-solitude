from __future__ import annotations

import contextlib
import io
import logging
import os
import sqlite3
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Protocol


MODEL_NAME = "distiluse-base-multilingual-cased-v2"
SHORT_ZH_LIMIT = 45
LONG_RATIO_LIMIT = 8.0


class TargetUnit(Protocol):
    text: str
    index: int


@dataclass
class ZhUnit:
    text: str
    pair_index: int


_MODEL_CACHE: dict[tuple[str, str], object] = {}


def semantic_rebalance_pairs(
    *,
    chapter_no: int,
    pairs: list[dict],
    target_units: list[TargetUnit],
    target_key: str,
    lang: str,
    split_zh_sentences: Callable[[str, str], list[str]],
) -> int:
    candidates = candidate_pair_indexes(pairs, target_key)
    if not candidates:
        return 0

    zh_units = build_zh_units(pairs, split_zh_sentences)
    if not zh_units or not target_units:
        return 0

    mapping = lingtrain_mapping(chapter_no, zh_units, target_units, lang)
    if not mapping:
        return 0

    expected_by_pair = expected_targets_by_pair(zh_units, target_units, mapping)
    changed = 0
    for _ in range(2):
        pass_changed = 0
        for pair_index in candidates:
            expected_bases = expected_by_pair.get(pair_index, set())
            if not expected_bases:
                continue
            local_bases = bases_in_range(pairs, target_key, pair_index - 1, pair_index + 1)
            desired_bases = expected_bases & local_bases
            if not desired_bases:
                continue
            if apply_anchor(pairs, pair_index, target_key, desired_bases):
                pass_changed += 1
        changed += pass_changed
        if not pass_changed:
            break
    changed += cleanup_neighbor_claimed_extras(pairs, target_key, expected_by_pair)
    return changed


def candidate_pair_indexes(pairs: list[dict], target_key: str) -> list[int]:
    indexes: list[int] = []
    for index, pair in enumerate(pairs):
        zh_len = zh_text_len(pair)
        target_len = target_text_len(pair, target_key)
        if zh_len <= SHORT_ZH_LIMIT or target_len / max(zh_len, 1) > LONG_RATIO_LIMIT:
            indexes.append(index)
    return indexes


def build_zh_units(
    pairs: list[dict],
    split_zh_sentences: Callable[[str, str], list[str]],
) -> list[ZhUnit]:
    units: list[ZhUnit] = []
    for pair_index, pair in enumerate(pairs):
        parts: list[str] = []
        for paragraph in pair.get("zh", []):
            parts.extend(split_zh_sentences(paragraph, "zh"))
        if not parts and pair.get("zh"):
            parts = ["".join(pair.get("zh", []))]
        for part in parts:
            units.append(ZhUnit(text=part, pair_index=pair_index))
    return units


def lingtrain_mapping(
    chapter_no: int,
    zh_units: list[ZhUnit],
    target_units: list[TargetUnit],
    lang: str,
) -> dict[int, int]:
    try:
        from lingtrain_aligner import aligner  # type: ignore
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Semantic rebalance requires lingtrain-aligner and sentence-transformers. "
            "Install them or rerun with --no-semantic-rebalance."
        ) from exc

    model = get_model()
    with tempfile.TemporaryDirectory(prefix=f"lingtrain_{lang}_{chapter_no:02d}_") as temp_dir:
        db_path = Path(temp_dir) / "alignment.db"
        aligner.fill_db(
            str(db_path),
            "zh",
            lang,
            splitted_from=[unit.text for unit in zh_units],
            splitted_to=[unit.text for unit in target_units],
            name=f"zh-{lang}-chapter-{chapter_no:02d}",
        )
        # lingtrain prints progress for each batch; suppress it so EPUB builds remain readable.
        with contextlib.redirect_stdout(io.StringIO()):
            aligner.align_db(
                str(db_path),
                model_name=MODEL_NAME,
                batch_size=len(zh_units),
                window=max(len(zh_units), len(target_units)) + 5,
                embed_batch_size=16,
                normalize_embeddings=True,
                show_progress_bar=False,
                model=model,
            )
        with sqlite3.connect(db_path) as db:
            rows = db.execute(
                """
                select f.initial_id, t.initial_id
                from processing_from f
                join processing_to t on f.id = t.id
                order by f.initial_id
                """
            ).fetchall()

    return {int(source_id): int(target_id) for source_id, target_id in rows}


def get_model() -> object:
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Semantic rebalance requires sentence-transformers. "
            "Install it or rerun with --no-semantic-rebalance."
        ) from exc

    cache_folder = os.environ.get("LINGTRAIN_MODEL_CACHE")
    if not cache_folder:
        cache_folder = str(Path.home() / ".cache" / "lingtrain-aligner")
    key = (MODEL_NAME, cache_folder)
    if key not in _MODEL_CACHE:
        # Keep HuggingFace/lingtrain informational logging out of normal EPUB build output.
        logging.getLogger("sentence_transformers").setLevel(logging.WARNING)
        _MODEL_CACHE[key] = SentenceTransformer(MODEL_NAME, cache_folder=cache_folder)
    return _MODEL_CACHE[key]


def expected_targets_by_pair(
    zh_units: list[ZhUnit],
    target_units: list[TargetUnit],
    mapping: dict[int, int],
) -> dict[int, set[int]]:
    expected: dict[int, set[int]] = {}
    for source_pos, target_pos in mapping.items():
        if source_pos < 1 or source_pos > len(zh_units):
            continue
        if target_pos < 1 or target_pos > len(target_units):
            continue
        pair_index = zh_units[source_pos - 1].pair_index
        expected.setdefault(pair_index, set()).add(base_index(target_units[target_pos - 1].index))
    return expected


def apply_anchor(
    pairs: list[dict],
    pair_index: int,
    target_key: str,
    desired_bases: set[int],
) -> bool:
    current = pairs[pair_index]
    current_bases = bases_for_pair(current, target_key)
    if current_bases & desired_bases:
        return split_current_around_desired(pairs, pair_index, target_key, desired_bases)

    if current.get(target_key) and target_text_len(current, target_key) / max(zh_text_len(current), 1) <= LONG_RATIO_LIMIT:
        return False

    for source_index in (pair_index - 1, pair_index + 1):
        if source_index < 0 or source_index >= len(pairs):
            continue
        positions = matching_positions(pairs[source_index], target_key, desired_bases)
        if not positions:
            continue
        source_count = len(pairs[source_index].get(target_key, []))
        if len(positions) >= source_count:
            continue
        if source_index < pair_index and not is_suffix(positions, len(pairs[source_index].get(target_key, []))):
            continue
        if source_index > pair_index and not is_prefix(positions):
            continue
        move_neighbor_items_to_current(pairs, source_index, pair_index, target_key, positions)
        return True
    return False


def split_current_around_desired(
    pairs: list[dict],
    pair_index: int,
    target_key: str,
    desired_bases: set[int],
) -> bool:
    current = pairs[pair_index]
    if target_text_len(current, target_key) / max(zh_text_len(current), 1) <= LONG_RATIO_LIMIT:
        return False

    indexes = current.get(f"{target_key}_index", [])
    keep_positions = [pos for pos, index in enumerate(indexes) if base_index(index) in desired_bases]
    if not keep_positions or len(keep_positions) == len(indexes):
        return False

    before = [pos for pos in range(0, keep_positions[0])]
    after = [pos for pos in range(keep_positions[-1] + 1, len(indexes))]
    keep = keep_positions

    if before and pair_index > 0:
        append_positions(pairs[pair_index - 1], current, target_key, before)
    if after and pair_index + 1 < len(pairs):
        prepend_positions(pairs[pair_index + 1], current, target_key, after)

    current[target_key] = [current[target_key][pos] for pos in keep]
    current[f"{target_key}_index"] = [indexes[pos] for pos in keep]
    return True


def cleanup_neighbor_claimed_extras(
    pairs: list[dict],
    target_key: str,
    expected_by_pair: dict[int, set[int]],
) -> int:
    changed = 0
    for _ in range(3):
        pass_changed = 0
        for pair_index, pair in enumerate(pairs):
            expected = expected_by_pair.get(pair_index, set())
            if len(expected) != 1:
                continue
            indexes = pair.get(f"{target_key}_index", [])
            keep_positions = [pos for pos, index in enumerate(indexes) if base_index(index) in expected]
            if not keep_positions or len(keep_positions) == len(indexes):
                continue

            remove_positions_list: list[int] = []
            before = list(range(0, keep_positions[0]))
            after = list(range(keep_positions[-1] + 1, len(indexes)))
            if before and pair_index > 0 and positions_claimed_by_pair(before, indexes, expected_by_pair, pair_index - 1):
                append_positions(pairs[pair_index - 1], pair, target_key, before)
                remove_positions_list.extend(before)
            if after and pair_index + 1 < len(pairs) and positions_claimed_by_pair(after, indexes, expected_by_pair, pair_index + 1):
                prepend_positions(pairs[pair_index + 1], pair, target_key, after)
                remove_positions_list.extend(after)
            if remove_positions_list:
                remove_positions(pair, target_key, sorted(remove_positions_list))
                pass_changed += 1
        changed += pass_changed
        if not pass_changed:
            break
    return changed


def positions_claimed_by_pair(
    positions: list[int],
    indexes: list[int],
    expected_by_pair: dict[int, set[int]],
    pair_index: int,
) -> bool:
    expected = expected_by_pair.get(pair_index, set())
    if not expected:
        return False
    return all(base_index(indexes[pos]) in expected for pos in positions)


def move_neighbor_items_to_current(
    pairs: list[dict],
    source_index: int,
    target_index: int,
    target_key: str,
    positions: list[int],
) -> None:
    source = pairs[source_index]
    current = pairs[target_index]
    current_texts = current.get(target_key, [])[:]
    current_indexes = current.get(f"{target_key}_index", [])[:]

    moved_texts = [source[target_key][pos] for pos in positions]
    moved_indexes = [source[f"{target_key}_index"][pos] for pos in positions]
    remove_positions(source, target_key, positions)

    if source_index < target_index:
        if target_index + 1 < len(pairs) and current_texts:
            pairs[target_index + 1][target_key] = current_texts + pairs[target_index + 1].get(target_key, [])
            pairs[target_index + 1][f"{target_key}_index"] = current_indexes + pairs[target_index + 1].get(
                f"{target_key}_index", []
            )
    else:
        if target_index > 0 and current_texts:
            pairs[target_index - 1][target_key] = pairs[target_index - 1].get(target_key, []) + current_texts
            pairs[target_index - 1][f"{target_key}_index"] = pairs[target_index - 1].get(
                f"{target_key}_index", []
            ) + current_indexes

    current[target_key] = moved_texts
    current[f"{target_key}_index"] = moved_indexes


def append_positions(destination: dict, source: dict, target_key: str, positions: Iterable[int]) -> None:
    indexes = source.get(f"{target_key}_index", [])
    destination[target_key] = destination.get(target_key, []) + [source[target_key][pos] for pos in positions]
    destination[f"{target_key}_index"] = destination.get(f"{target_key}_index", []) + [indexes[pos] for pos in positions]


def prepend_positions(destination: dict, source: dict, target_key: str, positions: Iterable[int]) -> None:
    indexes = source.get(f"{target_key}_index", [])
    destination[target_key] = [source[target_key][pos] for pos in positions] + destination.get(target_key, [])
    destination[f"{target_key}_index"] = [indexes[pos] for pos in positions] + destination.get(f"{target_key}_index", [])


def remove_positions(pair: dict, target_key: str, positions: list[int]) -> None:
    remove = set(positions)
    pair[target_key] = [text for pos, text in enumerate(pair.get(target_key, [])) if pos not in remove]
    index_key = f"{target_key}_index"
    pair[index_key] = [index for pos, index in enumerate(pair.get(index_key, [])) if pos not in remove]


def matching_positions(pair: dict, target_key: str, desired_bases: set[int]) -> list[int]:
    return [
        pos
        for pos, index in enumerate(pair.get(f"{target_key}_index", []))
        if base_index(index) in desired_bases
    ]


def bases_in_range(pairs: list[dict], target_key: str, start: int, end: int) -> set[int]:
    bases: set[int] = set()
    for index in range(max(start, 0), min(end + 1, len(pairs))):
        bases.update(bases_for_pair(pairs[index], target_key))
    return bases


def bases_for_pair(pair: dict, target_key: str) -> set[int]:
    return {base_index(index) for index in pair.get(f"{target_key}_index", [])}


def base_index(index: int) -> int:
    return index // 1000 if index >= 1000 else index


def is_prefix(positions: list[int]) -> bool:
    return positions == list(range(len(positions)))


def is_suffix(positions: list[int], length: int) -> bool:
    return positions == list(range(length - len(positions), length))


def zh_text_len(pair: dict) -> int:
    return len("".join(pair.get("zh", [])))


def target_text_len(pair: dict, target_key: str) -> int:
    return len(" ".join(pair.get(target_key, [])))
