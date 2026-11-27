const { createGame } = MacondoPuzzle;
const game = createGame(renderUI, MacondoPuzzle.LEVELS, {
  read: () => JSON.parse(localStorage.getItem(MacondoProgress.KEY)),
  write: progress => localStorage.setItem(MacondoProgress.KEY, JSON.stringify(progress))
});
const { tryMove, toggleSkill, cancelSkillMode, handleCanvasClick, undoMove, resetLevel, waitTurn, setCanvas, drawBoard } = game;
const canvas = document.getElementById('game-canvas');
const loadoutDialog = document.getElementById('loadout-dialog');
let hoverTile = null;
let board = null;
let campaign = [];
let activeEnding = null;
let draft = null;

function resizeCanvas() {
  if (!board) return;
  const wrapper = document.getElementById('canvas-wrapper');
  const tileSize = Math.max(1, Math.floor(wrapper.clientWidth / board.cols));
  canvas.width = tileSize * board.cols;
  canvas.height = tileSize * board.rows;
  setCanvas(canvas.getContext('2d'), tileSize);
}

function gameLoop(timestamp) {
  drawBoard(timestamp, hoverTile);
  requestAnimationFrame(gameLoop);
}

function hydrateStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const iconId = el.dataset.icon;
    el.innerHTML = MacondoIcons.getIconSvg(iconId, 'w-full h-full');
  });
}

function renderUI({ level, turn, canUndo, canWait, hazardLabel, banner, bannerIconId, cards, logs, ending, campaign: acts, storageFailed, relicCollected, relicCount }) {
  if (board?.id !== level.id) {
    board = level;
    hoverTile = null;
    resizeCanvas();
    document.getElementById('act-subtitle').textContent = level.subtitle;
    document.getElementById('act-hints').replaceChildren(...level.hints.map(hint => {
      const item = document.createElement('li');
      item.textContent = hint;
      return item;
    }));
  }
  campaign = acts;
  activeEnding = ending;
  renderCampaign(storageFailed, relicCollected, relicCount);
  const hazard = document.getElementById('hazard-status');
  hazard.textContent = hazardLabel;
  hazard.hidden = !hazardLabel;
  const wait = document.getElementById('btn-wait');
  wait.hidden = !canWait;
  wait.disabled = Boolean(ending);
  document.getElementById('turn-count').textContent = turn;
  const actionBanner = document.getElementById('action-banner');
  const bannerIconEl = document.getElementById('action-banner-icon');
  const bannerTextEl = document.getElementById('action-banner-text');
  bannerTextEl.textContent = banner;
  bannerIconEl.innerHTML = bannerIconId ? MacondoIcons.getIconSvg(bannerIconId, 'w-full h-full') : '';
  bannerIconEl.classList.toggle('inline-flex', Boolean(bannerIconId));
  bannerIconEl.classList.toggle('hidden', !bannerIconId);
  actionBanner.classList.toggle('flex', Boolean(banner));
  actionBanner.classList.toggle('hidden', !banner);

  // Undo button availability
  const undoBtn = document.getElementById('btn-undo');
  undoBtn.disabled = !canUndo;
  undoBtn.style.opacity = canUndo ? '1' : '0.45';

  // Render character capability cards
  const invContainer = document.getElementById('inventory-list');
  invContainer.innerHTML = '';

  cards.forEach(({ id, name, abilityName, iconId, desc, unlocked, charges, blocked, isActive, isPassive, passiveLabel }) => {

    const card = document.createElement('div');
    card.className = `parchment-card rounded-lg p-2.5 flex items-center justify-between gap-2 ${
      isActive ? 'active-skill' : ''
    } ${!unlocked ? 'opacity-60' : ''}`;

    let badgeHtml = '';
    if (!unlocked) {
      badgeHtml = `<span class="px-2 py-1 rounded text-[11px] bg-[#cbb894] text-[#5c4332]">未相遇</span>`;
    } else if (charges > 0) {
      if (isPassive) {
        badgeHtml = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-[#d97706]/20 text-[#92400e] border border-[#d97706]">${MacondoIcons.getIconSvg('shield', 'w-4 h-4 shrink-0')}<span>${passiveLabel}</span></span>`;
      } else {
        badgeHtml = `<button data-skill="${id}" ${blocked ? 'disabled' : ''} aria-label="${isActive ? '取消' : '施放'}${abilityName}" class="skill-btn campaign-button">
          ${blocked ? '迷雾封印' : isActive ? '取消施放' : `施放能力 (${charges})`}
        </button>`;
      }
    } else {
      badgeHtml = `<span class="px-2 py-1 rounded text-[11px] bg-[#cbb894]/70 text-[#5c4332] line-through">执念已尽</span>`;
    }

    card.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="w-9 h-9 shrink-0 mt-0.5">${MacondoIcons.getIconSvg(iconId, 'w-full h-full')}</div>
        <div>
          <div class="text-xs sm:text-sm font-bold text-[#2c1e16]">
            ${name} <span class="text-[#8b4513] font-semibold">· ${abilityName}</span>
          </div>
          <p class="text-[11px] sm:text-xs text-[#5c4332] mt-0.5 leading-snug">${desc}</p>
        </div>
      </div>
      <div class="shrink-0">${badgeHtml}</div>
    `;
    invContainer.appendChild(card);
  });

  // Bind skill button events
  document.querySelectorAll('.skill-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleSkill(btn.dataset.skill));
  });

  // Render chronicle log
  const logContainer = document.getElementById('chronicle-log');
  logContainer.innerHTML = logs.map(entry => {
    let colorClass = 'text-[#3d291a]';
    if (entry.type === 'character') colorClass = 'text-[#7c2d12] font-semibold';
    if (entry.type === 'highlight') colorClass = 'text-[#92400e] font-bold';
    if (entry.type === 'danger') colorClass = 'text-[#9e2a2b] font-bold';
    if (entry.type === 'warning') colorClass = 'text-[#6e472b] italic';

    return `<div class="border-b border-[#8b5a2b]/20 pb-1.5 ${colorClass}">
      <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#d8c39e] text-[#4a3525] mr-1">T${entry.turn}</span>
      ${entry.text}
    </div>`;
  }).join('');

  document.getElementById('end-modal').classList.toggle('hidden', !ending || ending.settled);
  if (ending && !ending.settled) {
    document.getElementById('end-icon').innerHTML = MacondoIcons.getIconSvg(ending.iconId, 'w-14 h-14');
    document.getElementById('end-title').textContent = ending.title;
    document.getElementById('end-desc').textContent = ending.description;
    document.getElementById('end-action-label').textContent = ending.won ? (board.id === 5 ? '结算并返回编年史' : '结算并继续') : '再次踏入马孔多';
  }
}

function renderCampaign(storageFailed, relicCollected, relicCount) {
  const nav = document.getElementById('campaign-nav');
  nav.replaceChildren(...campaign.map(act => {
    const button = document.createElement('button');
    button.className = 'campaign-button';
    button.disabled = !act.unlocked;
    button.textContent = `${act.id}. ${act.title}${act.record?.relicCollected ? ' · 残页' : ''}${act.record ? ` · ${act.record.rank}` : ''}`;
    if (act.record) button.title = `最佳 ${act.record.bestTurns} 回合`;
    if (act.id === board.id) button.setAttribute('aria-current', 'step');
    button.addEventListener('click', () => openLoadout(act.id));
    return button;
  }));
  const status = document.getElementById('campaign-status');
  const localStatus = storageFailed ? '进度暂时只保留在此页面。' : relicCollected ? '本局已找到残页。通关结算后收入编年史。' : '';
  status.textContent = `残页 ${relicCount} / 4${localStatus ? ' · ' + localStatus : ''}`;
  status.hidden = !status.textContent;
}

function openLoadout(id, selected) {
  draft = game.preparation(id, selected);
  if (!draft) return;
  document.getElementById('loadout-title').textContent = draft.title;
  document.getElementById('loadout-slots').textContent = `先祖同行 ${draft.picked.length} / ${draft.slots}`;
  const act = campaign.find(item => item.id === id);
  document.getElementById('loadout-effects').replaceChildren(...act.causalHints.map(hint => {
    const item = document.createElement('li');
    item.textContent = `${hint.active ? '已生效' : '待达成'} · ${hint.text}`;
    return item;
  }));
  document.getElementById('loadout-options').replaceChildren(...draft.choices.map(character => {
    const button = document.createElement('button');
    const picked = draft.picked.includes(character.id);
    button.className = 'campaign-button';
    button.disabled = !character.unlocked || (!picked && draft.picked.length >= draft.slots);
    button.setAttribute('aria-pressed', String(picked));
    button.innerHTML = `${MacondoIcons.getIconSvg(character.iconId, 'w-7 h-7')}<span>${character.name} · ${character.abilityName}<small>${character.unlocked ? character.desc : '尚未解锁'}</small>${character.unlocked ? `<small>${character.epigraph}</small>` : ''}</span>`;
    button.addEventListener('click', () => openLoadout(id, picked
      ? draft.picked.filter(item => item !== character.id) : [...draft.picked, character.id]));
    return button;
  }));
  if (!loadoutDialog.open) loadoutDialog.showModal();
}

function finishAttempt() {
  if (!activeEnding?.won) {
    resetLevel();
    return;
  }
  if (game.commitVictory()) {
    const next = campaign.find(act => act.id > board.id && act.unlocked);
    openLoadout(next?.id || board.id);
  }
}

function initEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // 键盘控制
  window.addEventListener('keydown', e => {
    if (loadoutDialog.open) return;
    if (!document.getElementById('hint-modal').classList.contains('hidden')) {
      if (e.key === 'Escape') document.getElementById('hint-modal').classList.add('hidden');
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'arrowup' || key === 'w') { e.preventDefault(); tryMove(0, -1); }
    else if (key === 'arrowdown' || key === 's') { e.preventDefault(); tryMove(0, 1); }
    else if (key === 'arrowleft' || key === 'a') { e.preventDefault(); tryMove(-1, 0); }
    else if (key === 'arrowright' || key === 'd') { e.preventDefault(); tryMove(1, 0); }
    else if (key === 'z') { undoMove(); }
    else if (key === 'r') { resetLevel(); }
    else if (key === '.') { waitTurn(); }
    else if (key === 'escape') { cancelSkillMode(); }
  });

  // 画布点击与悬停
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) / rect.width) * board.cols);
    const gy = Math.floor(((e.clientY - rect.top) / rect.height) * board.rows);
    handleCanvasClick(gx, gy);
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) / rect.width) * board.cols);
    const gy = Math.floor(((e.clientY - rect.top) / rect.height) * board.rows);
    if (gx >= 0 && gx < board.cols && gy >= 0 && gy < board.rows) {
      hoverTile = { x: gx, y: gy };
    } else {
      hoverTile = null;
    }
  });

  canvas.addEventListener('mouseleave', () => {
    hoverTile = null;
  });

  // 移动端虚拟十字键
  document.querySelectorAll('.dpad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.dir;
      if (dir === 'up') tryMove(0, -1);
      if (dir === 'down') tryMove(0, 1);
      if (dir === 'left') tryMove(-1, 0);
      if (dir === 'right') tryMove(1, 0);
    });
  });

  // 顶部与弹窗按钮
  document.getElementById('btn-undo').addEventListener('click', undoMove);
  document.getElementById('btn-reset').addEventListener('click', resetLevel);
  document.getElementById('btn-wait').addEventListener('click', waitTurn);
  document.getElementById('btn-end-undo').addEventListener('click', undoMove);
  document.getElementById('btn-end-restart').addEventListener('click', finishAttempt);
  document.getElementById('loadout-start').addEventListener('click', () => {
    if (draft && game.startLevel(draft.id, draft.picked)) loadoutDialog.close();
  });
  document.getElementById('loadout-cancel').addEventListener('click', () => loadoutDialog.close());

  document.getElementById('btn-hint').addEventListener('click', () => {
    document.getElementById('hint-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-hint').addEventListener('click', () => {
    document.getElementById('hint-modal').classList.add('hidden');
  });
}

hydrateStaticIcons();
initEvents();
resetLevel();
requestAnimationFrame(gameLoop);
