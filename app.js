const data = window.WEEKDAY_EVENT_DATA;
const events = data.events;
const dayOrder = data.dayOrder;
const chapters = data.chapters;
const themes = [...new Set(events.map((event) => event.theme))].sort((a, b) =>
  a.localeCompare(b, "zh-CN"),
);

const state = {
  day: "all",
  chapter: "all",
  theme: "all",
  query: "",
  sort: "chapter",
};

const els = {
  factEvents: document.querySelector("#fact-events"),
  factDays: document.querySelector("#fact-days"),
  factTopDay: document.querySelector("#fact-top-day"),
  kpis: document.querySelector("#kpi-grid"),
  tabs: document.querySelector("#day-tabs"),
  search: document.querySelector("#search-input"),
  chapter: document.querySelector("#chapter-filter"),
  theme: document.querySelector("#theme-filter"),
  sort: document.querySelector("#sort-select"),
  dayBars: document.querySelector("#day-bars"),
  heatmap: document.querySelector("#chapter-heatmap"),
  resultSummary: document.querySelector("#result-summary"),
  eventList: document.querySelector("#event-list"),
  sourceNote: document.querySelector("#source-note"),
};

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function dayLabel(day) {
  return data.dayLabels[day] || day;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return chars[char];
  });
}

function countBy(list, keyFn) {
  return list.reduce((map, item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function topEntry(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0];
}

function filteredEvents() {
  const query = state.query.trim().toLowerCase();
  const list = events.filter((event) => {
    const matchesDay = state.day === "all" || event.day === state.day;
    const matchesChapter = state.chapter === "all" || event.chapter === Number(state.chapter);
    const matchesTheme = state.theme === "all" || event.theme === state.theme;
    const haystack = `${event.title} ${event.summary} ${event.theme} ${dayLabel(event.day)}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesDay && matchesChapter && matchesTheme && matchesQuery;
  });

  return list.sort((a, b) => {
    if (state.sort === "day") {
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || a.chapter - b.chapter || a.id - b.id;
    }
    if (state.sort === "theme") {
      return a.theme.localeCompare(b.theme, "zh-CN") || a.chapter - b.chapter || a.id - b.id;
    }
    return a.chapter - b.chapter || dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day) || a.id - b.id;
  });
}

function renderControls() {
  els.chapter.innerHTML = [
    `<option value="all">全部章节</option>`,
    ...chapters.map((chapter) => `<option value="${chapter}">第 ${chapter} 章</option>`),
  ].join("");
  els.theme.innerHTML = [
    `<option value="all">全部主题</option>`,
    ...themes.map((theme) => `<option value="${escapeHtml(theme)}">${escapeHtml(theme)}</option>`),
  ].join("");
  els.sourceNote.textContent = data.method;
}

function renderTabs() {
  const dayCounts = countBy(events, (event) => event.day);
  els.tabs.innerHTML = [
    `<button type="button" data-day="all" aria-pressed="${state.day === "all"}">全部 <span>${events.length}</span></button>`,
    ...dayOrder.map(
      (day) =>
        `<button type="button" data-day="${day}" aria-pressed="${state.day === day}">${dayLabel(day)} <span>${formatNumber(dayCounts.get(day) || 0)}</span></button>`,
    ),
  ].join("");
}

function renderKpis(list) {
  const dayCounts = countBy(events, (event) => event.day);
  const chapterCounts = countBy(events, (event) => event.chapter);
  const topDay = topEntry(dayCounts);
  const topChapter = topEntry(chapterCounts);
  const coveredChapters = new Set(list.map((event) => event.chapter)).size;

  els.factEvents.textContent = events.length;
  els.factDays.textContent = dayOrder.length;
  els.factTopDay.textContent = topDay ? dayLabel(topDay[0]) : "--";

  els.kpis.innerHTML = [
    ["全部提及", formatNumber(events.length), `${dayOrder.length} 个星期词`, "accent-blue"],
    ["最多星期", topDay ? dayLabel(topDay[0]) : "--", `${formatNumber(topDay?.[1] || 0)} 次`, "accent-teal"],
    ["高频章节", topChapter ? `第 ${topChapter[0]} 章` : "--", `${formatNumber(topChapter?.[1] || 0)} 次`, "accent-coral"],
    ["当前结果", formatNumber(list.length), `覆盖 ${coveredChapters} 章`, "accent-gold"],
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

function renderDayBars(list) {
  const counts = countBy(list, (event) => event.day);
  const max = Math.max(...dayOrder.map((day) => counts.get(day) || 0), 1);

  els.dayBars.innerHTML = dayOrder
    .map((day) => {
      const value = counts.get(day) || 0;
      const percent = (value / max) * 100;
      return `
        <button class="day-row" type="button" data-day="${day}">
          <span class="day-name">${dayLabel(day)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${percent}%"></span></span>
          <strong>${formatNumber(value)}</strong>
        </button>
      `;
    })
    .join("");
}

function renderHeatmap() {
  const base = events.filter((event) => {
    const matchesTheme = state.theme === "all" || event.theme === state.theme;
    const query = state.query.trim().toLowerCase();
    const haystack = `${event.title} ${event.summary} ${event.theme} ${dayLabel(event.day)}`.toLowerCase();
    return matchesTheme && (!query || haystack.includes(query));
  });
  const counts = new Map();
  base.forEach((event) => {
    const key = `${event.day}-${event.chapter}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const max = Math.max(...counts.values(), 1);
  const head = `
    <thead>
      <tr>
        <th>星期</th>
        ${chapters.map((chapter) => `<th>${chapter}</th>`).join("")}
      </tr>
    </thead>
  `;
  const body = dayOrder
    .map(
      (day) => `
        <tr>
          <th>${dayLabel(day)}</th>
          ${chapters
            .map((chapter) => {
              const value = counts.get(`${day}-${chapter}`) || 0;
              const ratio = value / max;
              const alpha = value ? 0.12 + ratio * 0.72 : 0;
              const selected = state.day === day && Number(state.chapter) === chapter;
              const color = ratio > 0.55 ? "#ffffff" : "#183248";
              const style = value
                ? `background:rgba(31,99,166,${alpha.toFixed(3)});color:${color}`
                : "background:#f8fafc;color:#9aa6b5";
              return `<td class="${selected ? "is-active" : ""}" style="${style}" data-day="${day}" data-chapter="${chapter}">${value || ""}</td>`;
            })
            .join("")}
        </tr>
      `,
    )
    .join("");
  els.heatmap.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function renderEvents(list) {
  const dayText = state.day === "all" ? "全部星期" : dayLabel(state.day);
  const chapterText = state.chapter === "all" ? "全部章节" : `第 ${state.chapter} 章`;
  const themeText = state.theme === "all" ? "全部主题" : state.theme;
  els.resultSummary.textContent = `${dayText} · ${chapterText} · ${themeText}，${formatNumber(list.length)} 条`;

  els.eventList.innerHTML = list.length
    ? list
        .map(
          (event) => `
            <article class="event-card">
              <div class="event-meta">
                <span class="day-pill">${dayLabel(event.day)}</span>
                <span>第 ${event.chapter} 章</span>
                <span>${escapeHtml(event.theme)}</span>
              </div>
              <h3>${escapeHtml(event.title)}</h3>
              <p>${escapeHtml(event.summary)}</p>
            </article>
          `,
        )
        .join("")
    : `<div class="empty-state">没有匹配结果。</div>`;
}

function render() {
  renderTabs();
  const list = filteredEvents();
  renderKpis(list);
  renderDayBars(list);
  renderHeatmap();
  renderEvents(list);
}

renderControls();
render();

els.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-day]");
  if (!button) return;
  state.day = button.dataset.day;
  render();
});

els.dayBars.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-day]");
  if (!button) return;
  state.day = button.dataset.day;
  render();
});

els.heatmap.addEventListener("click", (event) => {
  const cell = event.target.closest("td[data-day][data-chapter]");
  if (!cell) return;
  state.day = cell.dataset.day;
  state.chapter = cell.dataset.chapter;
  els.chapter.value = state.chapter;
  render();
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

els.chapter.addEventListener("change", (event) => {
  state.chapter = event.target.value;
  render();
});

els.theme.addEventListener("change", (event) => {
  state.theme = event.target.value;
  render();
});

els.sort.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});
