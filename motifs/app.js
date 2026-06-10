const data = window.MOTIF_THREADS_DATA;
const themes = data.themes;
const entries = themes.flatMap((theme) => theme.entries.map((entry) => ({ ...entry, theme })));

const state = {
  query: "",
  theme: "all",
};

const els = {
  factThemes: document.querySelector("#fact-themes"),
  factEntries: document.querySelector("#fact-entries"),
  factChapters: document.querySelector("#fact-chapters"),
  search: document.querySelector("#search-input"),
  themeFilter: document.querySelector("#theme-filter"),
  kpis: document.querySelector("#kpi-grid"),
  tabs: document.querySelector("#theme-tabs"),
  list: document.querySelector("#theme-list"),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function chapterLabel(entry) {
  return `第 ${entry.chapter} 章 · 对照段 ${entry.pair}`;
}

function themeCount(theme) {
  return theme.entries.length;
}

function entrySearchText(entry) {
  return [
    entry.theme.title,
    entry.theme.subtitle,
    entry.theme.scope,
    entry.label,
    entry.quote,
    entry.note,
    ...(entry.tags || []),
    ...(entry.theme.names || []),
  ]
    .join(" ")
    .toLowerCase();
}

function filteredThemes() {
  const query = state.query.trim().toLowerCase();
  return themes
    .map((theme) => {
      const filteredEntries = theme.entries.filter((entry) => {
        if (state.theme !== "all" && theme.id !== state.theme) return false;
        if (!query) return true;
        return entrySearchText({ ...entry, theme }).includes(query);
      });
      return { ...theme, entries: filteredEntries };
    })
    .filter((theme) => theme.entries.length);
}

function renderFacts() {
  const chapterSet = new Set(entries.map((entry) => entry.chapter));
  els.factThemes.textContent = themes.length;
  els.factEntries.textContent = formatNumber(entries.length);
  els.factChapters.textContent = chapterSet.size;
}

function renderThemeFilter() {
  els.themeFilter.innerHTML = [
    '<option value="all">全部主题</option>',
    ...themes.map((theme) => `<option value="${theme.id}">${escapeHtml(theme.title)} · ${themeCount(theme)} 条</option>`),
  ].join("");
}

function renderKpis(activeThemes) {
  const activeEntries = activeThemes.flatMap((theme) => theme.entries);
  const chapterSet = new Set(activeEntries.map((entry) => entry.chapter));
  const topTheme = [...themes].sort((a, b) => b.entries.length - a.entries.length)[0];
  const exactThemes = activeThemes.length;
  els.kpis.innerHTML = [
    ["当前结果", `${formatNumber(activeEntries.length)} 条`, `${exactThemes} 个主题`, "accent-blue"],
    ["章节覆盖", `${chapterSet.size} 章`, [...chapterSet].sort((a, b) => a - b).map((n) => `第${n}章`).join("、") || "--", "accent-teal"],
    ["最多线索", topTheme.title, `${topTheme.entries.length} 条`, "accent-coral"],
    ["数据来源", "新版中文", data.updated, "accent-gold"],
  ]
    .map(
      ([label, value, note, accent]) => `
        <article class="kpi-card ${accent}">
          <strong>${label}</strong>
          <span class="value">${escapeHtml(value)}</span>
          <small>${escapeHtml(note)}</small>
        </article>
      `,
    )
    .join("");
}

function renderTabs() {
  els.tabs.innerHTML = [
    ["all", "全部", entries.length],
    ...themes.map((theme) => [theme.id, theme.title, theme.entries.length]),
  ]
    .map(
      ([id, label, count]) => `
        <button type="button" data-theme="${id}" aria-pressed="${state.theme === id}">
          <span>${escapeHtml(label)}</span>
          <em>${count}</em>
        </button>
      `,
    )
    .join("");
}

function renderTags(entry) {
  return (entry.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function renderEntry(entry) {
  return `
    <article class="entry-card">
      <div class="entry-meta">
        <span>${chapterLabel(entry)}</span>
        <span>${escapeHtml(entry.label)}</span>
      </div>
      <blockquote>${escapeHtml(entry.quote)}</blockquote>
      <p>${escapeHtml(entry.note)}</p>
      <div class="tag-row">${renderTags(entry)}</div>
    </article>
  `;
}

function renderTheme(theme) {
  const names = theme.names.map((name) => `<span>${escapeHtml(name)}</span>`).join("");
  const excluded = theme.excluded?.length
    ? `
      <details class="excluded">
        <summary>排除项与边界</summary>
        <ul>
          ${theme.excluded.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </details>
    `
    : "";

  return `
    <section class="theme-section" id="${theme.id}">
      <div class="theme-heading">
        <div>
          <p class="theme-count">${theme.entries.length} 条线索</p>
          <h2>${escapeHtml(theme.title)}</h2>
          <p class="theme-subtitle">${escapeHtml(theme.subtitle)}</p>
        </div>
        <div class="name-row">${names}</div>
      </div>
      <div class="scope-note">
        <strong>检索口径</strong>
        <p>${escapeHtml(theme.scope)}</p>
      </div>
      <div class="entry-grid">
        ${theme.entries.map(renderEntry).join("")}
      </div>
      ${excluded}
    </section>
  `;
}

function renderList(activeThemes) {
  if (!activeThemes.length) {
    els.list.innerHTML = '<div class="empty-state">没有匹配的主题线索。</div>';
    return;
  }
  els.list.innerHTML = activeThemes.map(renderTheme).join("");
}

function render() {
  const activeThemes = filteredThemes();
  els.themeFilter.value = state.theme;
  renderKpis(activeThemes);
  renderTabs();
  renderList(activeThemes);
}

function bindEvents() {
  els.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  els.themeFilter.addEventListener("change", (event) => {
    state.theme = event.target.value;
    render();
  });

  els.tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-theme]");
    if (!button) return;
    state.theme = button.dataset.theme;
    render();
  });
}

renderFacts();
renderThemeFilter();
bindEvents();
render();
