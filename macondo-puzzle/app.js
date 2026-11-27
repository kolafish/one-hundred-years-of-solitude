const { createGame } = MacondoPuzzle;
const game = createGame(renderUI, MacondoPuzzle.LEVELS, {
  read: () => JSON.parse(localStorage.getItem(MacondoProgress.KEY)),
  write: progress => localStorage.setItem(MacondoProgress.KEY, JSON.stringify(progress))
});
const { tryMove, toggleSkill, cancelSkillMode, handleCanvasClick, undoMove, resetLevel, waitTurn, setCanvas, drawBoard } = game;
const canvas = document.getElementById('game-canvas');
const canvasWrapper = document.getElementById('canvas-wrapper');
const loadoutDialog = document.getElementById('loadout-dialog');
const decisionDialog = document.getElementById('decision-dialog');
const boardActions = document.getElementById('board-actions');
const actLegend = document.getElementById('act-legend');
const tileTooltip = document.getElementById('tile-tooltip');
const chronicleLog = document.getElementById('chronicle-log');
let hoverTile = null;
let tooltipDismissed = false;
let inspectedTile = null;
let inspecting = true;
let legendKey = '';
let actionsKey = '';
let cardsKey = '';
let campaignKey = '';
let displayedLogs = [];
let board = null;
let campaign = [];
let activeEnding = null;
let draft = null;
let hintCount = 1;
let levelHints = [];

function resizeCanvas() {
  if (!board) return;
  const tileSize = Math.max(1, Math.floor(canvasWrapper.clientWidth / board.cols));
  const width = tileSize * board.cols;
  const height = tileSize * board.rows;
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
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

function renderUI({ level, turn, canUndo, canWait, hazardLabel, banner, bannerIconId, cards, logs, ending, campaign: acts, storageFailed, relicCollected, relicCount, interactions, inspecting: canInspect, legend, decision }) {
  if (board?.id !== level.id) {
    board = level;
    const chapter = MacondoPuzzle.LEVELS.find(act => act.id === level.id);
    boardActions.hidden = !['mirrors', 'repairs', 'fuses', 'seals'].some(kind => chapter?.[kind]?.length);
    chronicleLog.scrollTop = 0;
    actLegend.scrollTop = 0;
    hoverTile = null;
    tooltipDismissed = false;
    inspectedTile = null;
    resizeCanvas();
    document.getElementById('act-subtitle').textContent = level.subtitle;
    levelHints = level.hints;
    hintCount = 1;
    renderHints();
  }
  campaign = acts;
  activeEnding = ending;
  inspecting = canInspect;
  renderDecision(decision);
  renderBoardHelp(interactions, legend);
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

  renderAbilityCards(cards);
  renderChronicle(logs);

  document.getElementById('end-modal').classList.toggle('hidden', !ending || ending.settled);
  if (ending && !ending.settled) {
    document.getElementById('end-icon').innerHTML = MacondoIcons.getIconSvg(ending.iconId, 'w-14 h-14');
    document.getElementById('end-title').textContent = ending.title;
    document.getElementById('end-desc').textContent = ending.description;
    document.getElementById('end-details').replaceChildren(...[
      ...(ending.causal || []), ending.relic, ...(ending.missingRelics || []).map(hint => '未找到残页 · ' + hint)
    ].filter(Boolean).map(detail => {
      const item = document.createElement('li');
      item.textContent = detail;
      return item;
    }));
    document.getElementById('end-action-label').textContent = ending.won ? (board.id === 5 ? '结算并返回编年史' : '结算并继续') : '再次踏入马孔多';
  }
  renderTileTooltip();
}

function renderAbilityCards(cards) {
  const key = cards.map(({id, unlocked, charges, blocked, isActive}) =>
    [id, unlocked, charges, blocked, isActive].join(':')).join('|');
  if (key === cardsKey) return;
  cardsKey = key;
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
      <div class="skill-card-copy flex items-start gap-2.5">
        <div class="w-9 h-9 shrink-0 mt-0.5">${MacondoIcons.getIconSvg(iconId, 'w-full h-full')}</div>
        <div class="skill-card-copy">
          <div class="text-xs sm:text-sm font-bold text-[#2c1e16]">
            ${name} <span class="text-[#8b4513] font-semibold">· ${abilityName}</span>
          </div>
          <p class="text-[11px] sm:text-xs text-[#5c4332] mt-0.5 leading-snug">${desc}</p>
        </div>
      </div>
      <div class="skill-card-status">${badgeHtml}</div>
    `;
    invContainer.appendChild(card);
  });

  // Bind skill button events
  invContainer.querySelectorAll('.skill-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleSkill(btn.dataset.skill));
  });
}

function renderChronicle(logs) {
  if (logs.length === displayedLogs.length && logs.every((entry, i) => entry === displayedLogs[i])) return;
  displayedLogs = [...logs];
  const scrollOffset = chronicleLog.scrollTop ? chronicleLog.scrollTop - chronicleLog.scrollHeight : null;
  chronicleLog.innerHTML = logs.map(entry => {
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
  if (scrollOffset !== null) chronicleLog.scrollTop = chronicleLog.scrollHeight + scrollOffset;
}

function renderHints() {
  document.getElementById('act-hints').replaceChildren(...levelHints.slice(0, hintCount).map(({ label, text }) =>
    descriptionNode('li', { name: label, detail: text })));
  const next = document.getElementById('btn-next-hint');
  next.hidden = hintCount >= levelHints.length;
  next.textContent = next.hidden ? '' : '展开' + levelHints[hintCount].label;
}

function renderDecision(decision) {
  if (decision) {
    document.getElementById('decision-title').textContent = decision.title;
    document.getElementById('decision-detail').textContent = decision.detail;
    if (!decisionDialog.open) decisionDialog.showModal();
  } else if (decisionDialog.open) {
    decisionDialog.close();
  }
}

function descriptionNode(tag, { name, detail }) {
  const node = document.createElement(tag);
  const title = document.createElement('strong');
  title.textContent = name;
  node.append(title, ' · ' + detail);
  return node;
}

function legendEntry(entry) {
  const text = descriptionNode('span', entry);
  const icon = document.createElement('span');
  icon.className = 'legend-icon';
  icon.setAttribute('aria-hidden', 'true');
  const sprite = document.createElement('img');
  sprite.src = '../miniprogram/assets/mechanism-legend.png';
  sprite.alt = '';
  sprite.style.left = `${entry.icon.left}%`;
  sprite.style.top = `${entry.icon.top}%`;
  icon.append(sprite);
  const item = document.createElement('li');
  item.append(icon, text);
  return item;
}

function renderTileTooltip() {
  const tile = (!tooltipDismissed && hoverTile) || inspectedTile;
  if (!tile || (activeEnding && !activeEnding.settled) || decisionDialog.open || loadoutDialog.open) {
    tileTooltip.hidden = true;
    return;
  }
  const descriptions = game.inspectTile(tile.x, tile.y)?.descriptions || [];
  const selected = inspectedTile?.x === tile.x && inspectedTile?.y === tile.y;
  const relevant = descriptions.some(({ id }) => id !== 'floor' && id !== 'wall');
  tileTooltip.hidden = !descriptions.length || (!selected && !relevant);
  if (tileTooltip.hidden) return;

  const key = descriptions.map(entry => entry.id).join('|');
  if (tileTooltip.dataset.description !== key) {
    tileTooltip.replaceChildren(...descriptions.map(entry => descriptionNode('p', entry)));
    tileTooltip.dataset.description = key;
  }

  const margin = 12;
  const gap = 8;
  const { clientWidth, clientHeight } = document.documentElement;
  const { left, top, width, height } = canvas.getBoundingClientRect();
  const tileWidth = width / board.cols;
  const tileHeight = height / board.rows;
  const tileLeft = left + tile.x * tileWidth;
  const tileTop = top + tile.y * tileHeight;
  const tooltipWidth = tileTooltip.offsetWidth;
  const tooltipHeight = tileTooltip.offsetHeight;
  const right = tileLeft + tileWidth + gap;
  const leftSide = tileLeft - tooltipWidth - gap;
  const above = tileTop - tooltipHeight - gap;
  const below = tileTop + tileHeight + gap;
  const rightFits = right + tooltipWidth <= clientWidth - margin;
  const leftFits = leftSide >= margin;
  const fitsRightOnBoard = right + tooltipWidth <= left + width;
  const fitsLeftOnBoard = leftSide >= left;
  let x = right;
  let y = tileTop + (tileHeight - tooltipHeight) / 2;
  let side = 'right';
  if (leftFits && (!rightFits || (!fitsRightOnBoard && fitsLeftOnBoard))) {
    side = 'left';
    x = leftSide;
  } else if (!rightFits) {
    side = below + tooltipHeight <= clientHeight - margin || above < margin ? 'below' : 'above';
    x = tileLeft + (tileWidth - tooltipWidth) / 2;
    y = side === 'below' ? below : above;
  }
  tileTooltip.dataset.side = side;
  tileTooltip.style.left = `${Math.max(margin, Math.min(x, clientWidth - tooltipWidth - margin))}px`;
  tileTooltip.style.top = `${Math.max(margin, Math.min(y, clientHeight - tooltipHeight - margin))}px`;
}

function clearHover() {
  if (!hoverTile) return;
  hoverTile = null;
  tooltipDismissed = false;
  renderTileTooltip();
}

function clearInspection() {
  if (!inspectedTile && !hoverTile) return;
  inspectedTile = null;
  hoverTile = null;
  tooltipDismissed = false;
  renderTileTooltip();
}

function renderBoardHelp(interactions, legend) {
  const nextActionsKey = JSON.stringify(interactions);
  if (actionsKey !== nextActionsKey) {
    actionsKey = nextActionsKey;
    const firstReady = interactions.findIndex(candidate => candidate.ready);
    boardActions.replaceChildren(...interactions.map((action, index) => {
      const button = document.createElement('button');
      button.className = 'campaign-button';
      button.disabled = !action.ready;
      button.textContent = action.ready ? action.label : '译码封印 · 需要巴比伦';
      if (index === firstReady) button.title = '快捷键 E 或空格';
      button.addEventListener('click', () => game.interactAt(action.x, action.y));
      return button;
    }));
    if (!interactions.length) {
      const message = document.createElement('span');
      message.className = 'campaign-status';
      message.textContent = '靠近机关后可操作。';
      boardActions.append(message);
    }
  }
  const key = legend.map(entry => entry.id).join('|');
  if (key !== legendKey) {
    legendKey = key;
    actLegend.replaceChildren(...legend.map(legendEntry));
  }
}

function renderCampaign(storageFailed, relicCollected, relicCount) {
  const nav = document.getElementById('campaign-nav');
  const key = board.id + ':' + JSON.stringify(campaign);
  if (campaignKey !== key) {
    campaignKey = key;
    nav.replaceChildren(...campaign.map(act => {
      const button = document.createElement('button');
      button.className = 'campaign-button';
      button.disabled = !act.unlocked;
      const label = `${act.id}. ${act.title}${act.record?.relicCollected ? ' · 残页' : ''}${act.record ? ` · ${act.record.rank}` : ''}`;
      button.setAttribute('aria-label', label);
      const full = document.createElement('span');
      full.className = 'chapter-full';
      full.textContent = label;
      const short = document.createElement('span');
      short.className = 'chapter-short';
      short.textContent = `${act.id}幕${act.record?.relicCollected ? '✦' : ''}`;
      button.append(full, short);
      if (act.record) button.title = `最佳 ${act.record.bestTurns} 回合`;
      if (act.id === board.id) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => openLoadout(act.id));
      return button;
    }));
  }
  const status = document.getElementById('campaign-status');
  const localStatus = storageFailed ? '进度仅保留在此页' : relicCollected ? '本局已找到残页' : '';
  const statusText = `残页 ${relicCount} / 4${localStatus ? ' · ' + localStatus : ''}`;
  if (status.textContent !== statusText) status.textContent = statusText;
}

function openLoadout(id, selected) {
  draft = game.preparation(id, selected);
  if (!draft) return;
  document.getElementById('loadout-title').textContent = draft.title;
  document.getElementById('loadout-slots').textContent = `先祖同行 ${draft.picked.length} / ${draft.slots}`;
  const recommendation = document.getElementById('loadout-recommendation');
  recommendation.hidden = !draft.recommendation;
  recommendation.textContent = draft.recommendation ? '推荐同行 · ' + draft.recommendation : '';
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
  if (!loadoutDialog.open) {
    clearInspection();
    loadoutDialog.showModal();
  }
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
    clearInspection();
  });
  window.addEventListener('scroll', clearInspection, { passive: true });
  document.addEventListener('pointerdown', e => {
    if (inspectedTile && e.target !== canvas && !tileTooltip.contains(e.target)) clearInspection();
  });

  // 键盘控制
  window.addEventListener('keydown', e => {
    if (loadoutDialog.open || decisionDialog.open) return;
    if ((e.target === chronicleLog || e.target === actLegend)
      && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
    if (!document.getElementById('hint-modal').classList.contains('hidden')) {
      if (e.key === 'Escape') document.getElementById('hint-modal').classList.add('hidden');
      return;
    }
    const key = e.key.toLowerCase();
    if (key === 'e' || (key === ' ' && !e.target.closest?.('button,a,input,textarea,select,summary'))) {
      if (!e.repeat && game.interactAt()) e.preventDefault();
      return;
    }
    if (key === 'arrowup' || key === 'w') { e.preventDefault(); tryMove(0, -1); }
    else if (key === 'arrowdown' || key === 's') { e.preventDefault(); tryMove(0, 1); }
    else if (key === 'arrowleft' || key === 'a') { e.preventDefault(); tryMove(-1, 0); }
    else if (key === 'arrowright' || key === 'd') { e.preventDefault(); tryMove(1, 0); }
    else if (key === 'z') { undoMove(); }
    else if (key === 'r') { resetLevel(); }
    else if (key === '.') { waitTurn(); }
    else if (key === 'escape') {
      inspectedTile = null;
      if (!tileTooltip.hidden) tooltipDismissed = true;
      cancelSkillMode();
    }
  });

  // 画布点击与悬停
  function canvasTile(e) {
    const rect = canvas.getBoundingClientRect();
    const tile = {
      x: Math.floor(((e.clientX - rect.left) / rect.width) * board.cols),
      y: Math.floor(((e.clientY - rect.top) / rect.height) * board.rows)
    };
    return tile.x >= 0 && tile.y >= 0 && tile.x < board.cols && tile.y < board.rows ? tile : null;
  }

  function clickBoard(e) {
    const tile = canvasTile(e);
    if (!tile) {
      clearInspection();
      return;
    }
    if (inspecting && game.inspectTile(tile.x, tile.y)?.distant) {
      const isCurrent = inspectedTile?.x === tile.x && inspectedTile?.y === tile.y;
      inspectedTile = isCurrent ? null : tile;
      tooltipDismissed = isCurrent;
      renderTileTooltip();
      return;
    }
    inspectedTile = null;
    renderTileTooltip();
    handleCanvasClick(tile.x, tile.y);
  }

  function hoverBoard(e) {
    if (e.pointerType === 'touch') return;
    const tile = canvasTile(e);
    if (!tile) return clearHover();
    if (hoverTile?.x === tile.x && hoverTile?.y === tile.y) return;
    hoverTile = tile;
    tooltipDismissed = false;
    renderTileTooltip();
  }

  canvas.addEventListener('click', clickBoard);
  canvas.addEventListener('pointermove', hoverBoard);
  canvas.addEventListener('pointerleave', e => {
    if (!tileTooltip.contains(e.relatedTarget)) clearHover();
  });

  tileTooltip.addEventListener('pointerleave', e => {
    if (e.relatedTarget === canvas) hoverBoard(e);
    else clearHover();
  });
  tileTooltip.addEventListener('click', e => {
    clearHover();
    clickBoard(e);
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
    clearInspection();
    document.getElementById('hint-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-hint').addEventListener('click', () => {
    document.getElementById('hint-modal').classList.add('hidden');
  });
  document.getElementById('btn-next-hint').addEventListener('click', () => {
    hintCount += 1;
    renderHints();
  });
  document.getElementById('btn-decision-cancel').addEventListener('click', () => game.resolveDecision(false));
  document.getElementById('btn-decision-accept').addEventListener('click', () => game.resolveDecision(true));
  decisionDialog.addEventListener('cancel', event => {
    event.preventDefault();
    game.resolveDecision(false);
  });
}

hydrateStaticIcons();
initEvents();
game.loadPlayerTokenImage(new Image(), '../miniprogram/assets/player-token.png');
resetLevel();
requestAnimationFrame(gameLoop);
