// Shared puzzle logic and Canvas 2D renderer for Web and WeChat Miniprogram.
const { TILE, LEVELS } = typeof require === 'function' ? require('./levels.js') : MacondoLevels;
const Icons = typeof require === 'function' ? require('./icons.js') : MacondoIcons;

const MacondoPuzzle = (() => {
  const CHARACTER_DEFS = {
    JOSE: {
      id: 'JOSE',
      name: '何塞·阿尔卡蒂奥',
      shortName: '何塞',
      abilityName: '炼金投掷',
      type: 'ACTIVE_THROW',
      iconId: 'char_jose',
      color: '#8b4513',
      desc: '选中身旁火药桶，越过河流投掷至 3 格内任意空地。',
      quote: '“任何东西都有生命，问题在于如何唤醒它们的灵魂。”——你获得了何塞的【炼金投掷】之力！'
    },
    AURELIANO: {
      id: 'AURELIANO',
      name: '奥雷里亚诺上校',
      shortName: '上校',
      abilityName: '宿命护盾',
      type: 'PASSIVE_SHIELD',
      iconId: 'char_aureliano',
      color: '#b45309',
      desc: '被动生效：抵挡一次致命光束或子弹，穿胸而不伤及要害。',
      quote: '“他躲过了十四次暗杀、七十三次埋伏和一次枪决。”——上校的【宿命护盾】已庇佑你！'
    },
    REBECA: {
      id: 'REBECA',
      name: '丽贝卡',
      shortName: '丽贝卡',
      abilityName: '孤注一掷',
      type: 'ACTIVE_SNIPE',
      iconId: 'char_rebeca',
      color: '#9e2a2b',
      desc: '开枪必中：点击视野内任意目标，隔河精准射爆火药桶。',
      quote: '一声清脆的枪响划破午后的闷热。——你继承了丽贝卡的【孤注一掷】枪法！'
    }
  };

  function createGame(onUpdate, levels = LEVELS) {
    let level = levels[0];
    let state = null;
    let historyStack = []; // 用于撤销（Undo）
    let particles = [];    // 粒子特效（光束微粒、爆炸火花、蝴蝶）

    let interactionMode = 'MOVE';
    let selectedBarrelPos = null;
    let banner = '';
    let bannerIconId = '';
    let ctx = null;
    let tileSize = 60;

    // 创建初始关卡状态
    function createInitialState() {
      return {
        turn: 0,
        status: 'PLAYING', // 'PLAYING' | 'WON' | 'DEAD'
        player: { ...level.start },
        terrain: level.terrain.map(row => [...row]),
        npcs: level.npcs.map(npc => ({ ...npc, collected: false })),
        barrels: level.barrels.map(barrel => ({ ...barrel })),
        abilities: {
          JOSE: { unlocked: false, charges: 0 },
          AURELIANO: { unlocked: false, charges: 0 },
          REBECA: { unlocked: false, charges: 0 }
        },
        laserTiles: [], // 实时计算的激光射线坐标
        logs: [
          {
            id: 0,
            turn: 0,
            type: 'story',
            text: level.opening
          }
        ]
      };
    }

    // 深拷贝状态用于撤销栈
    function cloneState(s) {
      return JSON.parse(JSON.stringify(s));
    }

    function pushHistory() {
      historyStack.push(cloneState(state));
      if (historyStack.length > 50) historyStack.shift();
    }

    function takeTurn(change) {
      pushHistory();
      state.turn += 1;
      change();
      resolveTurn();
    }

    // ==========================================
    // 3. 核心解谜逻辑与回合结算 (Dweep 引擎)
    // ==========================================

    // 重新计算所有发射器的激光路径
    function computeLasers(targetState) {
      const beams = [];
      for (let y = 0; y < level.rows; y++) {
        for (let x = 0; x < level.cols; x++) {
          if (targetState.terrain[y][x] === TILE.LASER_EMITTER) {
            // 向下发射光束
            for (let ny = y + 1; ny < level.rows; ny++) {
              const t = targetState.terrain[ny][x];
              // 墙壁、裂纹石墙会阻挡光束；河流与木桥不阻挡
              if (t === TILE.WALL || t === TILE.CRACKED_WALL || t === TILE.LASER_EMITTER) {
                break;
              }
              // 火药桶会阻挡光束（且若激光直接射中火药桶会引爆）
              const barrelIdx = targetState.barrels.findIndex(b => b.x === x && b.y === ny);
              beams.push({ x, y: ny });
              if (barrelIdx !== -1) {
                break;
              }
            }
          }
        }
      }
      targetState.laserTiles = beams;
    }

    // 检查网格是否可行走
    function isWalkable(x, y) {
      if (x < 0 || x >= level.cols || y < 0 || y >= level.rows) return false;
      const t = state.terrain[y][x];
      if (t === TILE.WALL || t === TILE.WATER || t === TILE.CRACKED_WALL || t === TILE.LASER_EMITTER) {
        return false;
      }
      // 不能直接穿过未拾取的火药桶
      if (state.barrels.some(b => b.x === x && b.y === y)) {
        return false;
      }
      return true;
    }

    // 检查投掷目标格是否合法（距离<=3，且为空地或木桥，无NPC/玩家/桶）
    function isValidThrowTarget(bx, by, tx, ty) {
      if (tx < 0 || tx >= level.cols || ty < 0 || ty >= level.rows) return false;
      const dist = Math.abs(bx - tx) + Math.abs(by - ty);
      if (dist === 0 || dist > 3) return false;
      const t = state.terrain[ty][tx];
      if (t !== TILE.FLOOR && t !== TILE.BRIDGE) return false;
      if (state.player.x === tx && state.player.y === ty) return false;
      if (state.barrels.some(b => b.x === tx && b.y === ty)) return false;
      if (state.npcs.some(n => !n.collected && n.x === tx && n.y === ty)) return false;
      return true;
    }

    // 检查直线视野（用于丽贝卡开枪必中：允许十字方向或任意无墙壁遮挡直线，这里支持同行/同列及无墙直线，兼容斜向射击！）
    function hasLineOfSight(x0, y0, x1, y1) {
      if (x0 === x1 && y0 === y1) return false;
      // 使用 Bresenham 网格视线检测，任何无实心墙遮挡的格子均可射击
      let dx = Math.abs(x1 - x0);
      let dy = Math.abs(y1 - y0);
      let sx = (x0 < x1) ? 1 : -1;
      let sy = (y0 < y1) ? 1 : -1;
      let err = dx - dy;
      let cx = x0;
      let cy = y0;

      while (true) {
        if (cx === x1 && cy === y1) return true;
        if (!(cx === x0 && cy === y0)) {
          const t = state.terrain[cy][cx];
          if (t === TILE.WALL || t === TILE.CRACKED_WALL || t === TILE.LASER_EMITTER) {
            return false;
          }
        }
        let e2 = 2 * err;
        if (e2 > -dy) { err -= dy; cx += sx; }
        if (e2 < dx) { err += dx; cy += sy; }
      }
    }

    // 添加日志
    function addLog(text, type = 'normal') {
      state.logs.unshift({
        id: state.logs.length,
        turn: state.turn,
        type,
        text
      });
    }

    // 引爆火药桶（摧毁自身及上下左右相邻的裂纹石墙）
    function detonateBarrel(bx, by) {
      state.barrels = state.barrels.filter(b => !(b.x === bx && b.y === by));
      spawnExplosion(bx, by, '#e05a2b');

      const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      let destroyedWall = false;
      dirs.forEach(([dx, dy]) => {
        const nx = bx + dx;
        const ny = by + dy;
        if (nx >= 0 && nx < level.cols && ny >= 0 && ny < level.rows) {
          if (state.terrain[ny][nx] === TILE.CRACKED_WALL) {
            state.terrain[ny][nx] = TILE.FLOOR;
            destroyedWall = true;
            spawnExplosion(nx, ny, '#c59b27');
          }
        }
      });

      if (destroyedWall) {
        addLog('轰然巨响中，火药桶炸碎了古老的裂纹石墙，通往密室的道路豁然开朗！', 'highlight');
      } else {
        addLog('火药桶在空地上炸开，硝烟弥漫在马孔多的空气里。', 'normal');
      }
    }

    // 回合结束后的环境与接触结算
    function resolveTurn() {
      // 1. 检查是否接触或靠近家族人物（踩上或相邻即可触发对话继承能力）
      state.npcs.forEach(npc => {
        if (!npc.collected) {
          const dist = Math.abs(npc.x - state.player.x) + Math.abs(npc.y - state.player.y);
          if (dist <= 1) {
            npc.collected = true;
            state.abilities[npc.id].unlocked = true;
            state.abilities[npc.id].charges = 1;
            const def = CHARACTER_DEFS[npc.id];
            addLog(def.quote, 'character');
            spawnExplosion(npc.x, npc.y, '#c59b27');
          }
        }
      });

      // 2. 重新计算激光
      computeLasers(state);

      // 3. 检查玩家是否处于激光束中
      const inLaser = state.laserTiles.some(l => l.x === state.player.x && l.y === state.player.y);
      if (inLaser) {
        if (state.abilities.AURELIANO.charges > 0) {
          // 触发奥雷里亚诺上校的【宿命护盾】
          state.abilities.AURELIANO.charges = 0;
          spawnExplosion(state.player.x, state.player.y, '#ffd166');
          addLog('灼热的光束穿透了你的胸膛，却神奇地避开了心脏！奥雷里亚诺上校的【宿命护盾】救了你一命。', 'highlight');
        } else {
          state.status = 'DEAD';
          addLog('烈日聚焦光束无情地吞噬了你的身影，一切化作马孔多的尘埃。', 'danger');
          renderUI();
          return;
        }
      }

      // 4. 检查是否抵达羊皮纸密室 (GOAL)
      if (state.terrain[state.player.y][state.player.x] === TILE.GOAL) {
        state.status = 'WON';
        addLog('你推开密室尘封的木门，破译了梅尔基亚德斯的羊皮纸手稿！', 'highlight');
      }

      renderUI();
    }

    // 玩家移动一步
    function tryMove(dx, dy) {
      if (state.status !== 'PLAYING') return;
      if (interactionMode !== 'MOVE') {
        cancelSkillMode();
      }
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;
      if (!isWalkable(nx, ny)) return;

      takeTurn(() => {
        state.player = { x: nx, y: ny };
      });
    }

    // 切换技能激活状态
    function toggleSkill(skillId) {
      if (state.status !== 'PLAYING') return;
      const ab = state.abilities[skillId];
      if (!ab || ab.charges <= 0) return;

      if (skillId === 'JOSE') {
        if (interactionMode === 'SELECT_THROW_SOURCE' || interactionMode === 'SELECT_THROW_TARGET') {
          cancelSkillMode();
          return;
        }
        // 查找玩家身旁（上下左右）是否有火药桶
        const adjBarrels = state.barrels.filter(b =>
          Math.abs(b.x - state.player.x) + Math.abs(b.y - state.player.y) === 1
        );
        if (adjBarrels.length === 0) {
          addLog('何塞低语道：“你得先走到火药桶旁边，才能将它抛向远方。”', 'warning');
          renderUI();
          return;
        }
        if (adjBarrels.length === 1) {
          selectedBarrelPos = { ...adjBarrels[0] };
          interactionMode = 'SELECT_THROW_TARGET';
          bannerIconId = 'char_jose';
          banner = '炼金投掷：点击 3 格内高亮的空地投出火药桶（再次点击取消）';
        } else {
          interactionMode = 'SELECT_THROW_SOURCE';
          bannerIconId = 'char_jose';
          banner = '炼金投掷：请先点击身旁要投掷的火药桶';
        }
      } else if (skillId === 'REBECA') {
        if (interactionMode === 'SELECT_SNIPE_TARGET') {
          cancelSkillMode();
          return;
        }
        interactionMode = 'SELECT_SNIPE_TARGET';
        bannerIconId = 'char_rebeca';
        banner = '孤注一掷：点击视野内的火药桶或裂纹石墙开枪射击';
      }
      renderUI();
    }

    function clearSkillMode() {
      interactionMode = 'MOVE';
      selectedBarrelPos = null;
      banner = '';
      bannerIconId = '';
    }

    function cancelSkillMode() {
      clearSkillMode();
      renderUI();
    }

    // Handle board click
    function handleCanvasClick(gx, gy) {
      if (state.status !== 'PLAYING') return;
      if (gx < 0 || gx >= level.cols || gy < 0 || gy >= level.rows) return;

      // Mode 1: select adjacent barrel to throw
      if (interactionMode === 'SELECT_THROW_SOURCE') {
        const b = state.barrels.find(item => item.x === gx && item.y === gy);
        if (b && Math.abs(b.x - state.player.x) + Math.abs(b.y - state.player.y) === 1) {
          selectedBarrelPos = { ...b };
          interactionMode = 'SELECT_THROW_TARGET';
          bannerIconId = 'char_jose';
          banner = '炼金投掷：点击 3 格内高亮的空地投出火药桶';
          renderUI();
        } else {
          cancelSkillMode();
        }
        return;
      }

      // 模式 2：选择投掷落点
      if (interactionMode === 'SELECT_THROW_TARGET' && selectedBarrelPos) {
        if (isValidThrowTarget(selectedBarrelPos.x, selectedBarrelPos.y, gx, gy)) {
          takeTurn(() => {
            const barrel = state.barrels.find(b => b.x === selectedBarrelPos.x && b.y === selectedBarrelPos.y);
            barrel.x = gx;
            barrel.y = gy;
            state.abilities.JOSE.charges = 0;
            addLog('你效仿何塞·阿尔卡蒂奥的怪力，将火药桶凌空抛了出去！', 'character');
            clearSkillMode();
          });
        } else {
          addLog('那里无法承受火药桶的重量，请选择 3 格内的空地或木桥。', 'warning');
          renderUI();
        }
        return;
      }

      // 模式 3：丽贝卡开枪射击
      if (interactionMode === 'SELECT_SNIPE_TARGET') {
        if (!hasLineOfSight(state.player.x, state.player.y, gx, gy)) {
          addLog('视线被厚重的土坯墙挡住了，丽贝卡无法瞄准那里。', 'warning');
          renderUI();
          return;
        }
        const targetBarrel = state.barrels.find(b => b.x === gx && b.y === gy);
        const targetCracked = state.terrain[gy][gx] === TILE.CRACKED_WALL;

        if (targetBarrel) {
          takeTurn(() => {
            state.abilities.REBECA.charges = 0;
            addLog('砰！丽贝卡的子弹跨越水面，精准击中了远处的火药桶！', 'character');
            clearSkillMode();
            detonateBarrel(gx, gy);
          });
        } else if (targetCracked) {
          // 射击坚固裂纹石墙给予提示（需火药桶爆炸才能彻底炸开）
          addLog('子弹在石墙上擦出火花，但这堵石墙太厚了，需要引爆旁边的【火药桶】才能炸毁！', 'warning');
          renderUI();
        } else {
          addLog('请瞄准视野内的【火药桶】进行射击。', 'warning');
          renderUI();
        }
        return;
      }

      // 模式 0：普通移动（点击相邻格子）
      const dx = gx - state.player.x;
      const dy = gy - state.player.y;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        tryMove(dx, dy);
      }
    }

    // 撤销操作
    function undoMove() {
      if (historyStack.length === 0) return;
      state = historyStack.pop();
      particles = [];
      clearSkillMode();
      renderUI();
    }

    function startLevel(levelId) {
      const next = levels.find(candidate => candidate.id === levelId);
      if (!next) return false;
      level = next;
      resetLevel();
      return true;
    }

    // 重置关卡
    function resetLevel() {
      historyStack = [];
      particles = [];
      state = createInitialState();
      computeLasers(state);
      clearSkillMode();
      renderUI();
    }

    // ==========================================
    // 4. Canvas 视觉渲染 (手绘羊皮纸美学)
    // ==========================================
    function setCanvas(context, size) {
      ctx = context;
      if (tileSize !== size) particles = [];
      tileSize = size;
    }

    function spawnExplosion(gx, gy, color) {
      const cx = (gx + 0.5) * tileSize;
      const cy = (gy + 0.5) * tileSize;
      for (let i = 0; i < 22; i++) {
        const angle = (Math.PI * 2 * i) / 22 + Math.random() * 0.3;
        const speed = 1.5 + Math.random() * 3.5;
        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color,
          size: 3 + Math.random() * 4
        });
      }
    }

    function drawBoard(timestamp, hoverTile) {
      if (!ctx || !state) return;
      const t = timestamp || 0;
      ctx.clearRect(0, 0, level.cols * tileSize, level.rows * tileSize);

      // 1. Base parchment checkerboard & terrain tiles
      for (let y = 0; y < level.rows; y++) {
        for (let x = 0; x < level.cols; x++) {
          const px = x * tileSize;
          const py = y * tileSize;
          const tile = state.terrain[y][x];

          ctx.fillStyle = (x + y) % 2 === 0 ? '#efe3ca' : '#e7d7b8';
          ctx.fillRect(px, py, tileSize, tileSize);

          // Subtle parchment fiber dots
          ctx.fillStyle = 'rgba(110, 71, 43, 0.08)';
          ctx.fillRect(px + tileSize * 0.22, py + tileSize * 0.28, 1.5, 1.5);
          ctx.fillRect(px + tileSize * 0.74, py + tileSize * 0.68, 1.5, 1.5);

          ctx.strokeStyle = 'rgba(139, 90, 43, 0.18)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, tileSize, tileSize);

          if (tile === TILE.WALL) {
            drawWallTile(px, py, tileSize);
          } else if (tile === TILE.WATER) {
            drawWaterTile(px, py, tileSize, t, x, y);
          } else if (tile === TILE.BRIDGE) {
            drawWaterTile(px, py, tileSize, t, x, y);
            drawBridgeTile(px, py, tileSize);
          } else if (tile === TILE.CRACKED_WALL) {
            drawCrackedWallTile(px, py, tileSize, t);
          } else if (tile === TILE.GOAL) {
            drawGoalTile(px, py, tileSize, t);
          } else if (tile === TILE.LASER_EMITTER) {
            drawEmitterTile(px, py, tileSize, t);
          }
        }
      }

      // 2. Active skill targeting highlights
      if (interactionMode === 'SELECT_THROW_TARGET' && selectedBarrelPos) {
        const pulse = 0.7 + Math.sin(t * 0.008) * 0.25;
        for (let y = 0; y < level.rows; y++) {
          for (let x = 0; x < level.cols; x++) {
            if (isValidThrowTarget(selectedBarrelPos.x, selectedBarrelPos.y, x, y)) {
              ctx.fillStyle = `rgba(197, 155, 39, ${0.26 * pulse})`;
              ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
              ctx.strokeStyle = '#b47d15';
              ctx.lineWidth = 2;
              ctx.strokeRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
            }
          }
        }
      } else if (interactionMode === 'SELECT_SNIPE_TARGET') {
        const pulse = 0.75 + Math.sin(t * 0.01) * 0.25;
        state.barrels.forEach(b => {
          if (hasLineOfSight(state.player.x, state.player.y, b.x, b.y)) {
            const cx = (b.x + 0.5) * tileSize;
            const cy = (b.y + 0.5) * tileSize;
            const r = tileSize * 0.43;
            ctx.strokeStyle = `rgba(158, 42, 43, ${pulse})`;
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.moveTo(cx - r * 1.15, cy);
            ctx.lineTo(cx - r * 0.72, cy);
            ctx.moveTo(cx + r * 0.72, cy);
            ctx.lineTo(cx + r * 1.15, cy);
            ctx.moveTo(cx, cy - r * 1.15);
            ctx.lineTo(cx, cy - r * 0.72);
            ctx.moveTo(cx, cy + r * 0.72);
            ctx.lineTo(cx, cy + r * 1.15);
            ctx.stroke();
          }
        });
      }

      // 3. Sunbeam laser
      drawLaserBeams(t);

      // 4. Powder barrels
      state.barrels.forEach(b => {
        drawBarrel(b.x * tileSize, b.y * tileSize, tileSize, t);
      });

      // 5. Uncollected Buendia characters
      state.npcs.forEach(npc => {
        if (!npc.collected) {
          drawCharacterToken(npc.x * tileSize, npc.y * tileSize, tileSize, CHARACTER_DEFS[npc.id], t);
        }
      });

      // 6. Player token
      drawPlayerToken(state.player.x * tileSize, state.player.y * tileSize, tileSize, t);

      // 7. Hover indicator
      if (hoverTile && state.status === 'PLAYING') {
        ctx.strokeStyle = 'rgba(44, 30, 22, 0.45)';
        ctx.lineWidth = 2;
        Icons.roundedRectPath(ctx, hoverTile.x * tileSize + 2, hoverTile.y * tileSize + 2, tileSize - 4, tileSize - 4, 4);
        ctx.stroke();
      }

      // 8. Particle effects
      updateAndDrawParticles();
    }

    function drawWallTile(px, py, s) {
      ctx.fillStyle = '#5a3d2e';
      ctx.fillRect(px + 1, py + 1, s - 2, s - 2);

      // Top bevel highlight & bottom shadow
      ctx.fillStyle = '#73513e';
      ctx.fillRect(px + 2, py + 2, s - 4, s * 0.14);
      ctx.fillStyle = '#3a2419';
      ctx.fillRect(px + 2, py + s - s * 0.14 - 2, s - 4, s * 0.14);

      ctx.strokeStyle = '#331f15';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(px + 2, py + 2, s - 4, s - 4);

      // Staggered masonry joints
      ctx.strokeStyle = 'rgba(40, 24, 16, 0.65)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(px + 3, py + s * 0.38);
      ctx.lineTo(px + s - 3, py + s * 0.38);
      ctx.moveTo(px + 3, py + s * 0.68);
      ctx.lineTo(px + s - 3, py + s * 0.68);
      ctx.moveTo(px + s * 0.5, py + 3);
      ctx.lineTo(px + s * 0.5, py + s * 0.38);
      ctx.moveTo(px + s * 0.28, py + s * 0.38);
      ctx.lineTo(px + s * 0.28, py + s * 0.68);
      ctx.moveTo(px + s * 0.72, py + s * 0.38);
      ctx.lineTo(px + s * 0.72, py + s * 0.68);
      ctx.stroke();
    }

    function drawWaterTile(px, py, s, time, gx, gy) {
      ctx.fillStyle = '#2f5b76';
      ctx.fillRect(px, py, s, s);
      ctx.fillStyle = 'rgba(108, 166, 193, 0.22)';
      ctx.fillRect(px, py, s, s * 0.45);

      // Shoreline edges when adjacent to land
      const leftLand = gx > 0 && state.terrain[gy][gx - 1] !== TILE.WATER && state.terrain[gy][gx - 1] !== TILE.BRIDGE;
      const rightLand = gx < level.cols - 1 && state.terrain[gy][gx + 1] !== TILE.WATER && state.terrain[gy][gx + 1] !== TILE.BRIDGE;
      ctx.fillStyle = 'rgba(239, 227, 202, 0.24)';
      if (leftLand) ctx.fillRect(px, py, s * 0.09, s);
      if (rightLand) ctx.fillRect(px + s * 0.91, py, s * 0.09, s);

      // Animated ripples
      const wave = Math.sin(time * 0.003 + gx * 1.1 + gy * 0.8) * (s * 0.045);
      ctx.strokeStyle = 'rgba(214, 238, 248, 0.46)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.16, py + s * 0.32 + wave);
      ctx.quadraticCurveTo(px + s * 0.5, py + s * 0.22 + wave, px + s * 0.84, py + s * 0.32 + wave);
      ctx.moveTo(px + s * 0.2, py + s * 0.7 - wave);
      ctx.quadraticCurveTo(px + s * 0.52, py + s * 0.6 - wave, px + s * 0.86, py + s * 0.7 - wave);
      ctx.stroke();
    }

    function drawBridgeTile(px, py, s) {
      // Water shadow under bridge
      ctx.fillStyle = 'rgba(20, 35, 48, 0.35)';
      ctx.fillRect(px + 2, py + s * 0.22, s - 4, s * 0.72);

      // Timber planks
      ctx.fillStyle = '#9c6635';
      ctx.fillRect(px + 2, py + s * 0.16, s - 4, s * 0.68);

      // Side wooden rails
      ctx.fillStyle = '#6f421d';
      ctx.fillRect(px + 2, py + s * 0.14, s - 4, s * 0.1);
      ctx.fillRect(px + 2, py + s * 0.76, s - 4, s * 0.1);

      ctx.strokeStyle = '#3b2311';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(px + 2, py + s * 0.14, s - 4, s * 0.72);

      // Plank seams and iron rivets
      for (let i = 1; i <= 3; i++) {
        const lx = px + (s * i) / 4;
        ctx.beginPath();
        ctx.moveTo(lx, py + s * 0.22);
        ctx.lineTo(lx, py + s * 0.78);
        ctx.stroke();

        ctx.fillStyle = '#2c1e16';
        ctx.beginPath();
        ctx.arc(lx - s * 0.1, py + s * 0.28, 1.3, 0, Math.PI * 2);
        ctx.arc(lx - s * 0.1, py + s * 0.72, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawCrackedWallTile(px, py, s, time) {
      ctx.fillStyle = '#755945';
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
      ctx.strokeStyle = '#2c1e16';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);

      // Amber fissure glow hinting destructibility
      const glow = 0.45 + Math.sin(time * 0.005) * 0.2;
      ctx.strokeStyle = `rgba(217, 119, 6, ${glow})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.22, py + s * 0.18);
      ctx.lineTo(px + s * 0.5, py + s * 0.48);
      ctx.lineTo(px + s * 0.34, py + s * 0.8);
      ctx.moveTo(px + s * 0.5, py + s * 0.48);
      ctx.lineTo(px + s * 0.8, py + s * 0.68);
      ctx.stroke();

      ctx.strokeStyle = '#24160e';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    function drawGoalTile(px, py, s, time) {
      const cx = px + s * 0.5;
      const cy = py + s * 0.5;
      const pulse = 0.82 + Math.sin(time * 0.004) * 0.18;

      ctx.fillStyle = `rgba(197, 155, 39, ${0.22 * pulse})`;
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);

      // Double gold frame
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 2;
      Icons.roundedRectPath(ctx, px + 4, py + 4, s - 8, s - 8, 5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(139, 69, 19, 0.45)';
      ctx.lineWidth = 1;
      Icons.roundedRectPath(ctx, px + 7, py + 7, s - 14, s - 14, 3);
      ctx.stroke();

      // Scroll relic + fluttering yellow butterfly
      Icons.drawScrollCanvas(ctx, cx - s * 0.04, cy + s * 0.04, s * 0.82);
      const bx = cx + s * 0.2 + Math.cos(time * 0.003) * (s * 0.06);
      const by = cy - s * 0.2 + Math.sin(time * 0.004) * (s * 0.05);
      Icons.drawButterflyCanvas(ctx, bx, by, s * 0.42, time);
    }

    function drawEmitterTile(px, py, s, time) {
      const cx = px + s * 0.5;
      const cy = py + s * 0.46;
      const pulse = 0.85 + Math.sin(time * 0.009) * 0.15;

      ctx.fillStyle = '#3b261d';
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(px + 4, py + 4, s - 8, s - 8);

      // Brass magnifying ring and glowing sun core
      ctx.fillStyle = '#5c211c';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.fillStyle = `rgba(217, 72, 59, ${pulse})`;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(243, 212, 120, 0.8)';
      ctx.beginPath();
      ctx.arc(cx - s * 0.05, cy - s * 0.05, s * 0.05, 0, Math.PI * 2);
      ctx.fill();

      // Downward brass nozzle
      ctx.fillStyle = '#c59b27';
      ctx.strokeStyle = '#2c1e16';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.14, py + s * 0.72);
      ctx.lineTo(cx + s * 0.14, py + s * 0.72);
      ctx.lineTo(cx, py + s * 0.93);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    function drawLaserBeams(time) {
      if (state.laserTiles.length === 0) return;
      const flicker = 0.75 + Math.sin(time * 0.015) * 0.2;
      state.laserTiles.forEach((tile, idx) => {
        const cx = (tile.x + 0.5) * tileSize;
        const py = tile.y * tileSize;

        // Outer crimson halo
        ctx.fillStyle = `rgba(158, 42, 43, ${0.26 * flicker})`;
        ctx.fillRect(cx - tileSize * 0.16, py, tileSize * 0.32, tileSize);

        // Inner sunbeam core
        ctx.fillStyle = `rgba(230, 57, 70, ${0.88 * flicker})`;
        ctx.fillRect(cx - tileSize * 0.05, py, tileSize * 0.1, tileSize);

        ctx.fillStyle = `rgba(255, 224, 130, ${0.75 * flicker})`;
        ctx.fillRect(cx - tileSize * 0.018, py, tileSize * 0.036, tileSize);

        // Traveling solar mote
        const moteOffset = ((time * 0.04 + idx * 17) % tileSize);
        ctx.fillStyle = 'rgba(255, 240, 180, 0.85)';
        ctx.beginPath();
        ctx.arc(cx, py + moteOffset, Math.max(1.5, tileSize * 0.03), 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawBarrel(px, py, s, time) {
      const cx = px + s * 0.5;
      const cy = py + s * 0.54;

      // Soft ground shadow
      ctx.fillStyle = 'rgba(44, 30, 22, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.22, s * 0.26, 0, Math.PI * 2);
      ctx.fill();

      Icons.drawBarrelCanvas(ctx, cx, cy, s, time);
    }

    function drawCharacterToken(px, py, s, def, time) {
      const bob = Math.sin(time * 0.004) * 2.2;
      const cx = px + s * 0.5;
      const cy = py + s * 0.44 + bob;

      // Medallion shadow
      ctx.fillStyle = 'rgba(44, 30, 22, 0.22)';
      ctx.beginPath();
      ctx.arc(cx, py + s * 0.72, s * 0.26, 0, Math.PI * 2);
      ctx.fill();

      // Engraved parchment seal base
      ctx.fillStyle = '#f6ebd4';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(197, 155, 39, 0.75)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.29, 0, Math.PI * 2);
      ctx.stroke();

      // Custom copperplate emblem
      Icons.drawCharacterEmblemCanvas(ctx, def.id, cx, cy, s * 0.88);

      // Crisp name tag
      const label = def.shortName || def.name.slice(0, 3);
      const tagW = s * 0.72;
      const tagH = Math.max(12, s * 0.22);
      const tagX = cx - tagW * 0.5;
      const tagY = py + s * 0.76;
      ctx.fillStyle = 'rgba(44, 30, 22, 0.86)';
      Icons.roundedRectPath(ctx, tagX, tagY, tagW, tagH, 4);
      ctx.fill();

      ctx.fillStyle = '#f4ebd9';
      ctx.font = `bold ${Math.max(9, Math.floor(s * 0.16))}px "Noto Serif SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, tagY + tagH * 0.54);
    }

    function drawPlayerToken(px, py, s, time) {
      const cx = px + s * 0.5;
      const cy = py + s * 0.5;

      // Orbiting fate shield ring when Colonel Aureliano's shield is active
      if (state.abilities.AURELIANO.charges > 0) {
        const pulse = 0.4 + Math.sin(time * 0.006) * 0.03;
        const rot = time * 0.0012;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, s * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Four gold shield nodes
        ctx.fillStyle = '#f3d478';
        ctx.strokeStyle = '#2c1e16';
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const a = (Math.PI * i) / 2;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * s * pulse, Math.sin(a) * s * pulse, Math.max(2.2, s * 0.045), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // Warm lantern aura
      const aura = 0.18 + Math.sin(time * 0.008) * 0.06;
      ctx.fillStyle = `rgba(243, 212, 120, ${aura})`;
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Player medallion
      ctx.fillStyle = '#241710';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.33, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      Icons.drawLanternCanvas(ctx, cx, cy, s * 0.94, time);
    }

    function updateAndDrawParticles() {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    }

    function renderUI() {
      const cards = Object.values(CHARACTER_DEFS).map(({ id, name, abilityName, iconId, desc, type }) => {
        const { unlocked, charges } = state.abilities[id];
        const isActive =
          (id === 'JOSE' && (interactionMode === 'SELECT_THROW_SOURCE' || interactionMode === 'SELECT_THROW_TARGET')) ||
          (id === 'REBECA' && interactionMode === 'SELECT_SNIPE_TARGET');

        return {
          id,
          name,
          abilityName,
          iconId,
          iconUri: Icons.getIconDataUri(iconId),
          desc,
          unlocked,
          charges,
          isActive,
          isPassive: type === 'PASSIVE_SHIELD'
        };
      });

      let ending = null;
      if (state.status === 'WON') {
        ending = {
          iconId: 'butterfly',
          iconUri: Icons.getIconDataUri('butterfly'),
          title: '羊皮纸的预言已然应验',
          description: `你在第 ${state.turn} 回合集齐了家族三代人的执念与勇气，成功抵达梅尔基亚德斯的羊皮纸密室。`
        };
      } else if (state.status === 'DEAD') {
        ending = {
          iconId: 'wither',
          iconUri: Icons.getIconDataUri('wither'),
          title: '马孔多的一阵飓风抹去了足迹',
          description: '在没有上校宿命护盾的庇佑下，直面烈日聚焦光束意味着粉身碎骨。你可以撤销上一步，或重新开启轮回。'
        };
      }

      onUpdate({
        level: { id: level.id, title: level.title, subtitle: level.subtitle, cols: level.cols, rows: level.rows, hints: level.hints },
        turn: state.turn,
        canUndo: historyStack.length > 0,
        banner,
        bannerIconId,
        bannerIconUri: bannerIconId ? Icons.getIconDataUri(bannerIconId) : '',
        cards,
        logs: state.logs,
        ending
      });
    }

    return { startLevel, tryMove, toggleSkill, cancelSkillMode, handleCanvasClick, undoMove, resetLevel, setCanvas, drawBoard, getState: () => cloneState(state) };
  }

  return { LEVELS, createGame };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = MacondoPuzzle;
}
