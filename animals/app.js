const data = window.ANIMAL_STATS_DATA;
const animals = data.animals;
const chapters = data.chapters;

const state = {
  category: "all",
  chapter: "all",
  animal: "all",
  query: "",
  sort: "count",
};

const els = {
  factMentions: document.querySelector("#fact-mentions"),
  factAnimals: document.querySelector("#fact-animals"),
  factTop: document.querySelector("#fact-top"),
  kpis: document.querySelector("#kpi-grid"),
  search: document.querySelector("#search-input"),
  category: document.querySelector("#category-filter"),
  chapter: document.querySelector("#chapter-filter"),
  sort: document.querySelector("#sort-select"),
  tabs: document.querySelector("#category-tabs"),
  selectedFilter: document.querySelector("#selected-filter"),
  categoryBars: document.querySelector("#category-bars"),
  heatmap: document.querySelector("#animal-heatmap"),
  resultSummary: document.querySelector("#result-summary"),
  animalList: document.querySelector("#animal-list"),
  sourceNote: document.querySelector("#source-note"),
};

function formatNumber(value) {
  return Number(value).toLocaleString("zh-CN");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return chars[char];
  });
}

function countBy(list, keyFn, valueFn = () => 1) {
  return list.reduce((map, item) => {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + valueFn(item));
    return map;
  }, new Map());
}

function chapterCount(animal, chapter) {
  return animal.chapters.find((item) => item.chapter === Number(chapter))?.count || 0;
}

function chapterText(animal) {
  return animal.chapters.map((item) => item.chapter).join("、");
}

function selectedAnimal() {
  return animals.find((animal) => animal.id === state.animal);
}

function matchesBaseFilters(animal) {
  const query = state.query.trim().toLowerCase();
  const categoryMatch = state.category === "all" || animal.category === state.category;
  const animalMatch = state.animal === "all" || animal.id === state.animal;
  const haystack = `${animal.english} ${animal.zh} ${animal.categoryLabel} ${animal.note} ${animal.terms.join(" ")}`.toLowerCase();
  const queryMatch = !query || haystack.includes(query);
  return categoryMatch && animalMatch && queryMatch;
}

function filteredAnimals() {
  const list = animals.filter((animal) => {
    const chapterMatch = state.chapter === "all" || chapterCount(animal, state.chapter) > 0;
    return matchesBaseFilters(animal) && chapterMatch;
  });

  return list.sort((a, b) => {
    if (state.sort === "chapter") {
      return a.firstChapter - b.firstChapter || b.count - a.count || a.english.localeCompare(b.english);
    }
    if (state.sort === "name") {
      return a.english.localeCompare(b.english) || b.count - a.count;
    }
    return b.count - a.count || a.firstChapter - b.firstChapter || a.english.localeCompare(b.english);
  });
}

function renderControls() {
  els.category.innerHTML = [
    `<option value="all">全部类别</option>`,
    ...data.categoryOrder.map(
      (category) => `<option value="${category}">${escapeHtml(data.categoryLabels[category])}</option>`,
    ),
  ].join("");
  els.chapter.innerHTML = [
    `<option value="all">全部章节</option>`,
    ...chapters.map((chapter) => `<option value="${chapter}">第 ${chapter} 章</option>`),
  ].join("");
  els.sourceNote.textContent = data.method;
}

function renderTabs() {
  const categoryMentions = countBy(animals, (animal) => animal.category, (animal) => animal.count);
  const totalMentions = animals.reduce((sum, animal) => sum + animal.count, 0);
  els.tabs.innerHTML = [
    `<button type="button" data-category="all" aria-pressed="${state.category === "all"}">全部 <span>${formatNumber(totalMentions)}</span></button>`,
    ...data.categoryOrder.map((category) => {
      const value = categoryMentions.get(category) || 0;
      return `<button type="button" data-category="${category}" aria-pressed="${state.category === category}">${escapeHtml(data.categoryLabels[category])} <span>${formatNumber(value)}</span></button>`;
    }),
  ].join("");
}

function renderSelectedFilter() {
  const animal = selectedAnimal();
  if (!animal) {
    els.selectedFilter.hidden = true;
    els.selectedFilter.innerHTML = "";
    return;
  }
  els.selectedFilter.hidden = false;
  els.selectedFilter.innerHTML = `
    <span>已选动物：<strong>${escapeHtml(animal.zh)}</strong> ${escapeHtml(animal.english)}</span>
    <button type="button" data-clear-animal>清除</button>
  `;
}

function renderKpis(list) {
  const totalMentions = animals.reduce((sum, animal) => sum + animal.count, 0);
  const topAnimal = [...animals].sort((a, b) => b.count - a.count)[0];
  const coveredChapters = new Set(list.flatMap((animal) => animal.chapters.map((item) => item.chapter))).size;
  const currentMentions = list.reduce((sum, animal) => {
    if (state.chapter === "all") return sum + animal.count;
    return sum + chapterCount(animal, state.chapter);
  }, 0);

  els.factMentions.textContent = formatNumber(totalMentions);
  els.factAnimals.textContent = animals.length;
  els.factTop.textContent = topAnimal ? topAnimal.english : "--";

  els.kpis.innerHTML = [
    ["全部提及", formatNumber(totalMentions), `${animals.length} 组动物词`, "accent-green"],
    ["最高频动物", topAnimal ? topAnimal.zh : "--", topAnimal ? `${formatNumber(topAnimal.count)} 次` : "--", "accent-blue"],
    ["当前结果", formatNumber(list.length), `${formatNumber(currentMentions)} 次提及`, "accent-clay"],
    ["覆盖章节", formatNumber(coveredChapters), `共 ${chapters.length} 章`, "accent-gold"],
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

function renderCategoryBars(list) {
  const counts = countBy(list, (animal) => animal.category, (animal) => {
    if (state.chapter === "all") return animal.count;
    return chapterCount(animal, state.chapter);
  });
  const max = Math.max(...data.categoryOrder.map((category) => counts.get(category) || 0), 1);

  els.categoryBars.innerHTML = data.categoryOrder
    .map((category) => {
      const value = counts.get(category) || 0;
      const percent = (value / max) * 100;
      return `
        <button class="category-row" type="button" data-category="${category}">
          <span class="category-name">${escapeHtml(data.categoryLabels[category])}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${percent}%"></span></span>
          <strong>${formatNumber(value)}</strong>
        </button>
      `;
    })
    .join("");
}

function renderHeatmap() {
  const base = animals
    .filter(matchesBaseFilters)
    .sort((a, b) => b.count - a.count || a.firstChapter - b.firstChapter)
    .slice(0, 18);
  const max = Math.max(...base.flatMap((animal) => animal.chapters.map((item) => item.count)), 1);
  const head = `
    <thead>
      <tr>
        <th>动物</th>
        ${chapters.map((chapter) => `<th>${chapter}</th>`).join("")}
      </tr>
    </thead>
  `;
  const body = base
    .map(
      (animal) => `
        <tr>
          <th>
            <span>${escapeHtml(animal.zh)}</span>
            <small>${escapeHtml(animal.english)}</small>
          </th>
          ${chapters
            .map((chapter) => {
              const value = chapterCount(animal, chapter);
              const ratio = value / max;
              const alpha = value ? 0.12 + ratio * 0.72 : 0;
              const selected = state.animal === animal.id && Number(state.chapter) === chapter;
              const color = ratio > 0.55 ? "#ffffff" : "#3b2b20";
              const style = value
                ? `background:rgba(161,95,54,${alpha.toFixed(3)});color:${color}`
                : "background:#f8fafc;color:#9aa6b5";
              return `<td class="${selected ? "is-active" : ""}" style="${style}" data-animal="${animal.id}" data-chapter="${chapter}">${value || ""}</td>`;
            })
            .join("")}
        </tr>
      `,
    )
    .join("");
  els.heatmap.innerHTML = `${head}<tbody>${body}</tbody>`;
}

function renderChapterChips(animal) {
  return animal.chapters
    .map(
      (item) => `
        <button type="button" data-chapter="${item.chapter}" aria-label="筛选第 ${item.chapter} 章">
          ${item.chapter}<span>${item.count}</span>
        </button>
      `,
    )
    .join("");
}

function renderAnimals(list) {
  const categoryText = state.category === "all" ? "全部类别" : data.categoryLabels[state.category];
  const chapterLabel = state.chapter === "all" ? "全部章节" : `第 ${state.chapter} 章`;
  const animal = selectedAnimal();
  const animalText = animal ? `${animal.zh} ${animal.english}` : "全部动物";
  els.resultSummary.textContent = `${categoryText} · ${chapterLabel} · ${animalText}，${formatNumber(list.length)} 组`;

  els.animalList.innerHTML = list.length
    ? list
        .map((item) => {
          const activeCount = state.chapter === "all" ? item.count : chapterCount(item, state.chapter);
          return `
            <article class="animal-card">
              <div class="animal-meta">
                <span class="category-pill">${escapeHtml(item.categoryLabel)}</span>
                <span>${formatNumber(activeCount)} 次${state.chapter === "all" ? "" : " / 本章"}</span>
                <span>章节 ${chapterText(item)}</span>
              </div>
              <h3>
                ${escapeHtml(item.zh)}
                <small>${escapeHtml(item.english)}</small>
              </h3>
              <p>${escapeHtml(item.note)}</p>
              <div class="term-line">英文命中：${escapeHtml(item.terms.join(" · "))}</div>
              <div class="chapter-chips" aria-label="${escapeHtml(item.zh)}章节分布">
                ${renderChapterChips(item)}
              </div>
            </article>
          `;
        })
        .join("")
    : `<div class="empty-state">没有匹配结果。</div>`;
}

function render() {
  const list = filteredAnimals();
  renderTabs();
  renderSelectedFilter();
  renderKpis(list);
  renderCategoryBars(list);
  renderHeatmap();
  renderAnimals(list);
}

renderControls();
render();

els.tabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.animal = "all";
  els.category.value = state.category;
  render();
});

els.categoryBars.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  state.animal = "all";
  els.category.value = state.category;
  render();
});

els.heatmap.addEventListener("click", (event) => {
  const cell = event.target.closest("td[data-animal][data-chapter]");
  if (!cell) return;
  state.animal = cell.dataset.animal;
  state.chapter = cell.dataset.chapter;
  els.chapter.value = state.chapter;
  render();
});

els.selectedFilter.addEventListener("click", (event) => {
  if (!event.target.closest("button[data-clear-animal]")) return;
  state.animal = "all";
  render();
});

els.animalList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-chapter]");
  if (!button) return;
  state.chapter = button.dataset.chapter;
  els.chapter.value = state.chapter;
  render();
});

els.search.addEventListener("input", (event) => {
  state.query = event.target.value;
  state.animal = "all";
  render();
});

els.category.addEventListener("change", (event) => {
  state.category = event.target.value;
  state.animal = "all";
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
