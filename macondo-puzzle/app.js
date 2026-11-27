const { COLS, ROWS, createGame } = MacondoPuzzle;
const { tryMove, toggleSkill, cancelSkillMode, handleCanvasClick, undoMove, resetLevel, setCanvas, drawBoard } =
  createGame(renderUI);
const canvas = document.getElementById('game-canvas');
let hoverTile = null;

function resizeCanvas() {
  const wrapper = document.getElementById('canvas-wrapper');
  const tileSize = Math.floor(wrapper.clientWidth / COLS);
  canvas.width = tileSize * COLS;
  canvas.height = tileSize * ROWS;
  setCanvas(canvas.getContext('2d'), tileSize);
}

function gameLoop(timestamp) {
  drawBoard(timestamp, hoverTile);
  requestAnimationFrame(gameLoop);
}

function renderUI({ turn, canUndo, banner, cards, logs, ending }) {
  document.getElementById('turn-count').textContent = turn;
  const actionBanner = document.getElementById('action-banner');
  actionBanner.textContent = banner;
  actionBanner.classList.toggle('hidden', !banner);

  // 撤销按钮可用性
  const undoBtn = document.getElementById('btn-undo');
  undoBtn.disabled = !canUndo;
  undoBtn.style.opacity = canUndo ? '1' : '0.45';

  // 渲染三张人物能力卡片
  const invContainer = document.getElementById('inventory-list');
  invContainer.innerHTML = '';

  cards.forEach(({ id, name, abilityName, icon, desc, unlocked, charges, isActive, isPassive }) => {

    const card = document.createElement('div');
    card.className = `parchment-card rounded-lg p-2.5 flex items-center justify-between gap-2 ${
      isActive ? 'active-skill' : ''
    } ${!unlocked ? 'opacity-60' : ''}`;

    let badgeHtml = '';
    if (!unlocked) {
      badgeHtml = `<span class="px-2 py-1 rounded text-[11px] bg-[#cbb894] text-[#5c4332]">未相遇</span>`;
    } else if (charges > 0) {
      if (isPassive) {
        badgeHtml = `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-[#d97706]/20 text-[#92400e] border border-[#d97706]">🛡️ 庇护生效中</span>`;
      } else {
        badgeHtml = `<button data-skill="${id}" aria-label="${isActive ? '取消' : '施放'}${abilityName}" class="skill-btn min-h-10 px-3 py-1.5 rounded-md text-xs font-bold bg-[#8b4513] hover:bg-[#6e350d] text-[#f4ebd9] shadow-sm active:scale-[0.96] transition">
          ${isActive ? '取消施放' : '施放能力 (1)'}
        </button>`;
      }
    } else {
      badgeHtml = `<span class="px-2 py-1 rounded text-[11px] bg-[#cbb894]/70 text-[#5c4332] line-through">执念已尽</span>`;
    }

    card.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="text-2xl leading-none mt-0.5">${icon}</div>
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

  // 绑定技能按钮事件
  document.querySelectorAll('.skill-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleSkill(btn.dataset.skill));
  });

  // 渲染编年史日志
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

  document.getElementById('end-modal').classList.toggle('hidden', !ending);
  if (ending) {
    document.getElementById('end-icon').textContent = ending.icon;
    document.getElementById('end-title').textContent = ending.title;
    document.getElementById('end-desc').textContent = ending.description;
  }
}

function initEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
  });

  // 键盘控制
  window.addEventListener('keydown', e => {
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
    else if (key === 'escape') { cancelSkillMode(); }
  });

  // 画布点击与悬停
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const gy = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    handleCanvasClick(gx, gy);
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const gy = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
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
  document.getElementById('btn-end-undo').addEventListener('click', undoMove);
  document.getElementById('btn-end-restart').addEventListener('click', resetLevel);

  document.getElementById('btn-hint').addEventListener('click', () => {
    document.getElementById('hint-modal').classList.remove('hidden');
  });
  document.getElementById('btn-close-hint').addEventListener('click', () => {
    document.getElementById('hint-modal').classList.add('hidden');
  });
}

resizeCanvas();
initEvents();
resetLevel();
requestAnimationFrame(gameLoop);
