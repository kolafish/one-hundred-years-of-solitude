# Translation Quiz Data

This directory contains the data pipeline for a WeChat Mini Program that asks users to choose their preferred Chinese translation of selected popular highlights from *One Hundred Years of Solitude*.

The Mini Program is designed to be static first:

- The quiz question JSON is bundled with the Mini Program.
- User answers are stored locally with Mini Program storage.
- No WeChat Cloud Development environment is required for the MVP.
- Cross-user leaderboards or global vote aggregation are intentionally out of scope for the first implementation.

## Source Boundaries

The repository stores scripts, metadata, short quiz excerpts, and quality reports. It does not store full source EPUB/PDF files or full extracted translator text.

Source metadata is recorded in `versions.json` so extraction scripts can identify the expected files. Generated full-text intermediates should stay under ignored directories:

- `data/translation-quiz/extracted/`
- `data/translation-quiz/build/`

Public `versions.json` does not store absolute local file paths. For local extraction, provide paths either with the `sourcePathEnv` environment variables declared in `versions.json`, or with an ignored `data/translation-quiz/versions.local.json` file:

```json
{
  "sourcePaths": {
    "gao_changrong": "/absolute/path/to/source.epub"
  }
}
```

## Version Pool

The initial Chinese translation pool is:

- `fanye`: Fan Ye, the current WeRead popular-highlight baseline.
- `gao_changrong`: Gao Changrong, simplified Chinese EPUB.
- `huang_shen_chen`: Huang Jinyan, Shen Guozheng, Chen Quan, simplified Chinese PDF.
- `ye_shuyin`: Ye Shuyin, traditional Chinese EPUB, normalized to simplified Chinese for display.
- `yang_naidong`: Yang Naidong, traditional Chinese EPUB, normalized to simplified Chinese for display.

## Anchor Pool

The quiz anchor pool comes from `data/bilingual/highlight_multilingual_quotes.json`.

Current expected counts:

- 400 chapter highlights: 20 highlights for each of 20 chapters.
- 20 book-level highlights that duplicate items already present in the chapter pool.
- 400 unique `(chapterUid, range)` anchors after deduplication.

The Mini Program should use the 400 chapter highlights by default.

## Blind Quiz Rules

- Options must not reveal translator names before the user chooses.
- Option order is randomized per question.
- Names should be normalized to the Fan Ye style where possible.
- Traditional Chinese sources are converted to simplified Chinese before matching and display.
- English, Japanese, and Spanish text can be used internally for alignment checks, but they are not shown as quiz options.

## Planned Pipeline

1. Read the 400 WeRead highlight anchors.
2. Extract chapter text from each Chinese source.
3. Normalize traditional Chinese to simplified Chinese.
4. Normalize character/place/person names using `normalization/name_map.seed.json`.
5. Match each anchor to corresponding short excerpts in each translation.
6. Emit `questions.json` plus a quality report and preview page.

Run the current source preflight:

```bash
python3 data/translation-quiz/scripts/prepare_sources.py
```
