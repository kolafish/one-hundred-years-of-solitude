# One Hundred Years of Solitude

这个 GitHub Pages 站点整理《百年孤独》相关统计、热门划线，以及中英段落对齐 EPUB 和数据。

## 页面

- `people/`：人物章节热力图。
- `weekday-events/`：从 `One Hundred Years of Solitude.epub` 中整理 Sunday 到 Saturday 的 117 次星期词提及，并按章节、星期和主题展示对应事件摘要。
- `plants/`：基于英文 EPUB 整理 69 组植物词条，附对应西语名，并按类别和章节展示提及次数。
- `animals/`：基于英文 EPUB 整理 75 组动物词条，附对应西语名，并按类别和章节展示提及次数。
- `highlights/`：基于微信读书热门划线接口整理全书前 20 条热门划线，并支持按章节查看每章前 20 条热门划线及高赞评论摘录。

## 中英对照 EPUB 与数据

- `downloads/one-hundred-years-of-solitude-bilingual-columns.epub`：左右分栏中英对照 EPUB。
- `downloads/one-hundred-years-of-solitude-bilingual-alternating.epub`：英文、中文段落交替版 EPUB。
- `downloads/one-hundred-years-of-solitude-bilingual-mixed-split.epub`：长段落切短后的英中短段混合版 EPUB，并用横线标记原始段落起点。
- `downloads/one-hundred-years-of-solitude-zh-ja-mixed-split.epub`：长段落切短后的日中短段混合版 EPUB，并用横线标记原始段落起点。
- `downloads/one-hundred-years-of-solitude-es-zh-mixed-split.epub`：长段落切短后的西中短段混合版 EPUB，并用横线标记原始段落起点。
- `data/bilingual/aligned_paragraphs.json`：20 章段落对齐 JSON。
- `data/bilingual/alignment_summary.md`：段落对齐摘要。
- `data/bilingual/alignment_preview.html`：中英对齐检查页。
- `data/bilingual/build_bilingual_epub.py`：从两个 EPUB 抽取、对齐并生成对照 EPUB 的脚本。
- `data/bilingual/build_zh_ja_mixed_epub.py`：基于既有中文段落和日文 EPUB 生成日中短段混合 EPUB 的脚本。
- `data/bilingual/build_zh_es_mixed_epub.py`：基于既有中英段落和西语 EPUB 生成西中短段混合 EPUB 的脚本。

根目录 `index.html` 是入口页。
