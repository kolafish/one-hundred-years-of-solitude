const data = window.WEREAD_HIGHLIGHTS_DATA;
const bookHighlights = data.highlights;
const chapters = data.chapters || [];
const chapterHighlights = chapters.flatMap((chapter) => chapter.highlights);

const state = {
  query: "",
  scope: "book",
  sort: "highlight",
};

const els = {
  factHighlights: document.querySelector("#fact-highlights"),
  factComments: document.querySelector("#fact-comments"),
  factTop: document.querySelector("#fact-top"),
  kpis: document.querySelector("#kpi-grid"),
  search: document.querySelector("#search-input"),
  scope: document.querySelector("#scope-filter"),
  sort: document.querySelector("#sort-select"),
  chapterSummary: document.querySelector("#chapter-summary"),
  chapterBars: document.querySelector("#chapter-bars"),
  commentBars: document.querySelector("#comment-bars"),
  list: document.querySelector("#highlight-list"),
};

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function chapterLabel(chapter) {
  return `第${chapter}章`;
}

function rangeLink(item) {
  const [start, end] = item.range.split("-");
  return `weread://bestbookmark?bookId=${data.book.bookId}&chapterUid=${item.chapterUid}&rangeStart=${start}&rangeEnd=${end}`;
}

function bookSearchLink() {
  return `https://weread.qq.com/web/search/books?keyword=${encodeURIComponent(data.book.title)}`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function rangeStart(item) {
  return Number(String(item.range).split("-")[0]) || 0;
}

function topCommentLikes(item) {
  return Math.max(...item.comments.map((comment) => comment.likes), 0);
}

function totalCommentLikes(item) {
  return item.comments.reduce((sum, comment) => sum + comment.likes, 0);
}

function selectedScope() {
  if (state.scope === "book") {
    return {
      kind: "book",
      label: "全书热门 Top 20",
      list: bookHighlights,
    };
  }

  const chapter = chapters.find((item) => String(item.chapterUid) === state.scope);
  if (!chapter) {
    state.scope = "book";
    return selectedScope();
  }

  return {
    kind: "chapter",
    label: `${chapterLabel(chapter.chapter)}热门 Top ${chapter.highlights.length}`,
    list: chapter.highlights,
    chapter,
  };
}

function filteredHighlights(scope) {
  const query = state.query.trim().toLowerCase();
  const list = scope.list.filter((item) => {
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
    return matchesQuery;
  });

  return list.sort((a, b) => {
    if (state.sort === "comment") return topCommentLikes(b) - topCommentLikes(a) || a.rank - b.rank;
    if (state.sort === "position") return a.chapterOrder - b.chapterOrder || rangeStart(a) - rangeStart(b);
    return b.highlightCount - a.highlightCount;
  });
}

function renderScopeFilter() {
  els.scope.innerHTML = [
    '<option value="book">全书热门 Top 20</option>',
    ...chapters.map(
      (chapter) =>
        `<option value="${chapter.chapterUid}">${chapterLabel(chapter.chapter)}热门 Top ${chapter.highlights.length}</option>`,
    ),
  ].join("");
}

function renderFacts() {
  const totalComments = chapterHighlights.reduce((sum, item) => sum + item.comments.length, 0);
  els.factHighlights.textContent = bookHighlights.length;
  els.factComments.textContent = chapterHighlights.length;
  els.factTop.textContent = formatNumber(totalComments);
}

function renderKpis(list, scope) {
  const topHighlight = [...list].sort((a, b) => b.highlightCount - a.highlightCount)[0];
  const topComment = [...list].sort((a, b) => topCommentLikes(b) - topCommentLikes(a))[0];
  const totalHighlightCount = list.reduce((sum, item) => sum + item.highlightCount, 0);
  const uniqueChapters = new Set(list.map((item) => item.chapter)).size;

  els.kpis.innerHTML = [
    ["当前范围", `${list.length} 条`, `${scope.label} · ${uniqueChapters} 个章节`, "accent-blue"],
    ["划线人数合计", formatNumber(totalHighlightCount), "当前筛选累计", "accent-teal"],
    [
      "最高评论赞数",
      topComment ? formatNumber(topCommentLikes(topComment)) : "--",
      topComment ? `#${topComment.rank} · ${topComment.cue}` : "--",
      "accent-coral",
    ],
    [
      "最高划线热度",
      topHighlight ? formatNumber(topHighlight.highlightCount) : "--",
      topHighlight ? `#${topHighlight.rank} · ${chapterLabel(topHighlight.chapter)}` : "--",
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

function renderChapterBars(scope) {
  const rows = chapters.map((chapter) => ({
    chapter: chapter.chapter,
    chapterUid: chapter.chapterUid,
    count: chapter.highlights.length,
    heat: chapter.highlights.reduce((sum, item) => sum + item.highlightCount, 0),
    selected: scope.kind === "chapter" && scope.chapter.chapterUid === chapter.chapterUid,
  }));
  const maxHeat = Math.max(...rows.map((row) => row.heat), 1);

  els.chapterSummary.textContent = `${chapters.length} 个正文章节，每章最多 20 条热门划线`;
  els.chapterBars.innerHTML = rows
    .map((row) => {
      const percent = Math.max((row.heat / maxHeat) * 100, 4);
      return `
        <div class="bar-row ${row.selected ? "selected" : ""}">
          <span class="bar-name">${chapterLabel(row.chapter)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${percent}%"></div></div>
          <span class="bar-value">${formatNumber(row.heat)}</span>
        </div>
      `;
    })
    .join("");
}

function renderCommentBars(list) {
  const top = [...list].sort((a, b) => totalCommentLikes(b) - totalCommentLikes(a)).slice(0, 6);
  if (!top.length) {
    els.commentBars.innerHTML = '<div class="empty-mini">当前范围没有可展示的评论热度。</div>';
    return;
  }
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

function renderComments(item) {
  if (!item.comments.length) {
    return '<div class="empty-comment">这条划线暂时没有可展示的高赞评论。</div>';
  }

  return item.comments
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
    .join("");
}

function renderList(list, scope) {
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
              <span>${scope.kind === "book" ? "全书热门" : "章内热门"}</span>
              <span>${chapterLabel(item.chapter)}</span>
              <span>${formatNumber(item.highlightCount)} 人划线</span>
              <span>${item.range}</span>
              ${item.globalRank ? `<span>全书 #${item.globalRank}</span>` : ""}
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
              ${renderComments(item)}
            </div>
          </div>
          <div class="card-actions">
            <a class="open-link" href="${bookSearchLink()}" target="_blank" rel="noopener">打开网页版</a>
            <button class="copy-link" type="button" data-app-link="${escapeAttribute(rangeLink(item))}">复制 App 定位</button>
          </div>
        </article>
      `,
    )
    .join("");

  bindCopyButtons();
}

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
    } catch (error) {
      reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  });
}

function bindCopyButtons() {
  document.querySelectorAll("[data-app-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      const originalText = button.textContent;
      try {
        await copyText(button.dataset.appLink);
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败";
      }
      setTimeout(() => {
        button.textContent = originalText;
      }, 1400);
    });
  });
}

function render() {
  const scope = selectedScope();
  const list = filteredHighlights(scope);
  renderKpis(list, scope);
  renderChapterBars(scope);
  renderCommentBars(list);
  renderList(list, scope);
}

renderScopeFilter();
renderFacts();
render();

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.scope.addEventListener("change", (event) => {
  state.scope = event.target.value;
  render();
});

els.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});
