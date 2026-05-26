const data = window.WEREAD_HIGHLIGHTS_DATA;
const highlights = data.highlights;

const state = {
  query: "",
  chapter: "all",
  sort: "highlight",
};

const els = {
  factHighlights: document.querySelector("#fact-highlights"),
  factComments: document.querySelector("#fact-comments"),
  factTop: document.querySelector("#fact-top"),
  kpis: document.querySelector("#kpi-grid"),
  search: document.querySelector("#search-input"),
  chapter: document.querySelector("#chapter-filter"),
  sort: document.querySelector("#sort-select"),
  chapterSummary: document.querySelector("#chapter-summary"),
  chapterBars: document.querySelector("#chapter-bars"),
  commentBars: document.querySelector("#comment-bars"),
  list: document.querySelector("#highlight-list"),
};

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function rangeLink(item) {
  const [start, end] = item.range.split("-");
  return `weread://bestbookmark?bookId=${data.book.bookId}&chapterUid=${item.chapterUid}&rangeStart=${start}&rangeEnd=${end}`;
}

function topCommentLikes(item) {
  return Math.max(...item.comments.map((comment) => comment.likes), 0);
}

function totalCommentLikes(item) {
  return item.comments.reduce((sum, comment) => sum + comment.likes, 0);
}

function filteredHighlights() {
  const query = state.query.trim().toLowerCase();
  const list = highlights.filter((item) => {
    const text = [
      item.chapter,
      item.cue,
      item.sourceCue,
      item.summary,
      item.themes.join(" "),
      ...item.comments.flatMap((comment) => [comment.author, comment.excerpt, comment.summary]),
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = !query || text.includes(query);
    const matchesChapter = state.chapter === "all" || item.chapter === state.chapter;
    return matchesQuery && matchesChapter;
  });

  return list.sort((a, b) => {
    if (state.sort === "comment") return topCommentLikes(b) - topCommentLikes(a) || a.rank - b.rank;
    if (state.sort === "chapter") return a.chapterOrder - b.chapterOrder || a.rank - b.rank;
    return b.highlightCount - a.highlightCount;
  });
}

function renderChapterFilter() {
  const chapters = [...new Set(highlights.map((item) => item.chapter))];
  els.chapter.innerHTML = [
    '<option value="all">全部章节</option>',
    ...chapters.map((chapter) => `<option value="${chapter}">第 ${chapter} 章</option>`),
  ].join("");
}

function renderFacts() {
  const totalComments = highlights.reduce((sum, item) => sum + item.comments.length, 0);
  const top = Math.max(...highlights.map((item) => item.highlightCount));
  els.factHighlights.textContent = highlights.length;
  els.factComments.textContent = totalComments;
  els.factTop.textContent = formatNumber(top);
}

function renderKpis(list) {
  const topHighlight = [...list].sort((a, b) => b.highlightCount - a.highlightCount)[0];
  const topComment = [...list].sort((a, b) => topCommentLikes(b) - topCommentLikes(a))[0];
  const totalHighlightCount = list.reduce((sum, item) => sum + item.highlightCount, 0);
  const uniqueChapters = new Set(list.map((item) => item.chapter)).size;

  els.kpis.innerHTML = [
    ["筛选划线", `${list.length} 条`, `${uniqueChapters} 个章节`, "accent-blue"],
    ["划线人数合计", formatNumber(totalHighlightCount), "Top 20 热门划线累计", "accent-teal"],
    [
      "最高评论赞数",
      topComment ? formatNumber(topCommentLikes(topComment)) : "--",
      topComment ? `#${topComment.rank} · ${topComment.cue}` : "--",
      "accent-coral",
    ],
    [
      "最高划线热度",
      topHighlight ? formatNumber(topHighlight.highlightCount) : "--",
      topHighlight ? `#${topHighlight.rank} · 第 ${topHighlight.chapter} 章` : "--",
      "accent-gold",
    ],
  ]
    .map(
      ([label, value, note, accent]) => `
        <article class="kpi-card ${accent}">
          <strong>${label}</strong>
          <span class="value">${value}</span>
          <small>${note}</small>
        </article>
      `,
    )
    .join("");
}

function renderChapterBars(list) {
  const rows = [...new Set(highlights.map((item) => item.chapter))]
    .map((chapter) => {
      const chapterItems = list.filter((item) => item.chapter === chapter);
      return {
        chapter,
        count: chapterItems.length,
        heat: chapterItems.reduce((sum, item) => sum + item.highlightCount, 0),
      };
    })
    .filter((row) => row.count > 0);
  const maxHeat = Math.max(...rows.map((row) => row.heat), 1);

  els.chapterSummary.textContent = rows.length ? `${rows.length} 个章节有匹配划线` : "无匹配章节";
  els.chapterBars.innerHTML = rows
    .map((row) => {
      const percent = Math.max((row.heat / maxHeat) * 100, 4);
      return `
        <div class="bar-row">
          <span class="bar-name">第 ${row.chapter} 章</span>
          <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
          <span class="bar-value">${formatNumber(row.heat)}</span>
        </div>
      `;
    })
    .join("");
}

function renderCommentBars(list) {
  const top = [...list].sort((a, b) => totalCommentLikes(b) - totalCommentLikes(a)).slice(0, 6);
  const maxLikes = Math.max(...top.map(totalCommentLikes), 1);
  els.commentBars.innerHTML = top
    .map((item) => {
      const likes = totalCommentLikes(item);
      const percent = Math.max((likes / maxLikes) * 100, 4);
      return `
        <div class="bar-row compact">
          <span class="bar-name">#${item.rank} ${item.cue}</span>
          <div class="bar-track"><div class="bar-fill comment-fill" style="width:${percent}%"></div></div>
          <span class="bar-value">${formatNumber(likes)}</span>
        </div>
      `;
    })
    .join("");
}

function renderList(list) {
  if (!list.length) {
    els.list.innerHTML = '<article class="empty-state">没有匹配的热门划线。</article>';
    return;
  }

  els.list.innerHTML = list
    .map(
      (item) => `
        <article class="highlight-card">
          <div class="highlight-rank">#${item.rank}</div>
          <div class="highlight-body">
            <div class="highlight-meta">
              <span>第 ${item.chapter} 章</span>
              <span>${formatNumber(item.highlightCount)} 人划线</span>
              <span>${item.range}</span>
            </div>
            <h2>${item.cue}</h2>
            <div class="highlight-text-grid">
              <div class="source-panel">
                <span>原文线索</span>
                <p>${item.sourceCue}</p>
              </div>
              <div class="summary-panel">
                <span>总结</span>
                <p>${item.summary}</p>
              </div>
            </div>
            <div class="theme-list">
              ${item.themes.map((theme) => `<span>${theme}</span>`).join("")}
            </div>
            <div class="comment-list">
              ${item.comments
                .map(
                  (comment, index) => `
                    <div class="comment-card">
                      <div class="comment-head">
                        <strong>Top ${index + 1}</strong>
                        <span>${formatNumber(comment.likes)} 赞</span>
                      </div>
                      <div class="comment-section">
                        <span>评论摘录</span>
                        <p>${comment.excerpt}</p>
                      </div>
                      <div class="comment-section">
                        <span>评论总结</span>
                        <p>${comment.summary}</p>
                      </div>
                      <small>${comment.author}</small>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>
          <a class="open-link" href="${rangeLink(item)}">微信读书打开</a>
        </article>
      `,
    )
    .join("");
}

function render() {
  const list = filteredHighlights();
  renderKpis(list);
  renderChapterBars(list);
  renderCommentBars(list);
  renderList(list);
}

renderChapterFilter();
renderFacts();
render();

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.chapter.addEventListener("change", (event) => {
  state.chapter = event.target.value;
  render();
});

els.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});
