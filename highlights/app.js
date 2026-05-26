const data = window.WEREAD_HIGHLIGHTS_DATA;
const bookHighlights = data.highlights;
const chapters = data.chapters || [];
const chapterHighlights = chapters.flatMap((chapter) => chapter.highlights);

const state = {
  query: "",
  scope: "book",
  sort: "highlight",
};

const LONG_COMMENT_EXCERPT_LENGTH = 180;
const LONG_COMMENT_SUMMARY_LENGTH = 96;

const els = {
  factHighlights: document.querySelector("#fact-highlights"),
  factComments: document.querySelector("#fact-comments"),
  factTop: document.querySelector("#fact-top"),
  modeBook: document.querySelector("#mode-book"),
  modeChapter: document.querySelector("#mode-chapter"),
  modeBookCount: document.querySelector("#mode-book-count"),
  modeChapterCount: document.querySelector("#mode-chapter-count"),
  chapterPicker: document.querySelector("#chapter-picker"),
  kpis: document.querySelector("#kpi-grid"),
  search: document.querySelector("#search-input"),
  scope: document.querySelector("#scope-filter"),
  sort: document.querySelector("#sort-select"),
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatQuote(value) {
  const text = String(value || "")
    .trim()
    .replace(/“/g, "『")
    .replace(/”/g, "』");
  return `「${escapeHtml(text)}」`;
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
      item.quoteHint,
      ...(item.sourceTerms || []),
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
  els.scope.innerHTML = chapters
    .map(
      (chapter) =>
        `<option value="${chapter.chapterUid}">${chapterLabel(chapter.chapter)} · Top ${chapter.highlights.length}</option>`,
    )
    .join("");
}

function renderFacts() {
  const totalComments = chapterHighlights.reduce((sum, item) => sum + item.comments.length, 0);
  els.factHighlights.textContent = bookHighlights.length;
  els.factComments.textContent = chapterHighlights.length;
  els.factTop.textContent = formatNumber(totalComments);
}

function renderModeControls(scope) {
  const isBook = scope.kind === "book";
  els.modeBook.setAttribute("aria-pressed", String(isBook));
  els.modeChapter.setAttribute("aria-pressed", String(!isBook));
  els.modeBookCount.textContent = `${bookHighlights.length} 条`;
  els.modeChapterCount.textContent = `${chapters.length} 章`;
  els.chapterPicker.hidden = isBook;
  els.chapterPicker.classList.toggle("is-visible", !isBook);

  if (!isBook && scope.chapter) {
    els.scope.value = String(scope.chapter.chapterUid);
  }
}

function renderKpis(list, scope) {
  const topHighlight = [...list].sort((a, b) => b.highlightCount - a.highlightCount)[0];
  const topComment = [...list].sort((a, b) => topCommentLikes(b) - topCommentLikes(a))[0];
  const totalHighlightCount = list.reduce((sum, item) => sum + item.highlightCount, 0);
  const totalComments = list.reduce((sum, item) => sum + item.comments.length, 0);
  const viewName = scope.kind === "book" ? "全书榜" : "章节榜";
  const viewNote =
    scope.kind === "book"
      ? `${new Set(bookHighlights.map((item) => item.chapter)).size} 个章节进入全书 Top 20`
      : `${chapterLabel(scope.chapter.chapter)} · 章内 Top ${scope.chapter.highlights.length}`;

  els.kpis.innerHTML = [
    ["当前视图", viewName, viewNote, "accent-blue"],
    ["划线人数合计", formatNumber(totalHighlightCount), "当前筛选累计", "accent-teal"],
    ["条目与评论", `${list.length} / ${formatNumber(totalComments)}`, "划线 / 高赞评论", "accent-coral"],
    [
      "最高热度",
      topHighlight ? formatNumber(topHighlight.highlightCount) : "--",
      topHighlight ? `#${topHighlight.rank} · ${topHighlight.cue}` : topComment ? topComment.cue : "--",
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

function renderComments(item) {
  if (!item.comments.length) {
    return '<div class="empty-comment">这条划线暂时没有可展示的高赞评论。</div>';
  }

  return item.comments
    .map((comment, index) => {
      const isLong =
        comment.excerpt.length > LONG_COMMENT_EXCERPT_LENGTH ||
        comment.summary.length > LONG_COMMENT_SUMMARY_LENGTH;
      return `
        <div class="comment-card ${isLong ? "is-collapsed" : ""}">
          <div class="comment-head">
            <strong>Top ${index + 1}</strong>
            <span>${formatNumber(comment.likes)} 赞</span>
          </div>
          <div class="comment-section">
            <span>评论摘录</span>
            <p class="comment-text">${escapeHtml(comment.excerpt)}</p>
          </div>
          <div class="comment-section">
            <span>评论总结</span>
            <p class="comment-summary">${escapeHtml(comment.summary)}</p>
          </div>
          <div class="comment-footer">
            <small>${escapeHtml(comment.author)}</small>
            ${isLong ? '<button class="comment-toggle" type="button">查看全部评论</button>' : ""}
          </div>
        </div>
      `;
    })
    .join("");
}

function renderSourcePanel(item) {
  const terms = item.sourceTerms || [];
  return `
    <span class="panel-label">划线内容</span>
    <blockquote class="quote-hint">${formatQuote(item.quoteHint || item.cue)}</blockquote>
    ${
      terms.length
        ? `<div class="source-terms">${terms.map((term) => `<span>${escapeHtml(term)}</span>`).join("")}</div>`
        : ""
    }
  `;
}

function renderList(list, scope) {
  if (!list.length) {
    els.list.innerHTML = '<article class="empty-state">没有匹配的热门划线。</article>';
    return;
  }

  els.list.innerHTML = list
    .map(
      (item) => `
        <article class="highlight-card ${scope.kind === "book" ? "book-card" : "chapter-card"}">
          <div class="highlight-rank">
            <strong>#${item.rank}</strong>
            <span>${scope.kind === "book" ? "全书" : "章内"}</span>
          </div>
          <div class="highlight-body">
            <div class="highlight-meta">
              <span class="scope-chip">${scope.kind === "book" ? "全书 Top 20" : `${chapterLabel(item.chapter)} Top 20`}</span>
              <span>${chapterLabel(item.chapter)}</span>
              <span>${formatNumber(item.highlightCount)} 人划线</span>
              <span>${item.range}</span>
              ${item.globalRank ? `<span>全书 #${item.globalRank}</span>` : ""}
            </div>
            <h2>${escapeHtml(item.cue)}</h2>
            <div class="highlight-text-grid">
              <div class="source-panel">
                ${renderSourcePanel(item)}
              </div>
              <div class="summary-panel">
                <span class="panel-label">内容总结</span>
                <p>${escapeHtml(item.summary)}</p>
              </div>
            </div>
            <div class="theme-list">
              ${item.themes.map((theme) => `<span>${escapeHtml(theme)}</span>`).join("")}
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
  bindCommentToggles();
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

function bindCommentToggles() {
  document.querySelectorAll(".comment-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".comment-card");
      const isCollapsed = card.classList.toggle("is-collapsed");
      button.textContent = isCollapsed ? "查看全部评论" : "收起评论";
    });
  });
}

function render() {
  const scope = selectedScope();
  const list = filteredHighlights(scope);
  renderModeControls(scope);
  renderKpis(list, scope);
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

els.modeBook.addEventListener("click", () => {
  state.scope = "book";
  render();
});

els.modeChapter.addEventListener("click", () => {
  if (state.scope === "book") {
    state.scope = String(chapters[0]?.chapterUid || "book");
  }
  render();
});
