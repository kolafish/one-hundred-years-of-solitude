// 《马孔多的羊皮纸》的关卡、回合逻辑和 Canvas 2D 绘制，由网页和小程序共用。
const MacondoPuzzle = (() => {
  const COLS = 10;
  const ROWS = 8;

  // 地形类型
  const TILE = {
    FLOOR: 0,
    WALL: 1,
    WATER: 2,
    BRIDGE: 3,
    CRACKED_WALL: 4, // 必须由火药桶爆炸摧毁的裂纹石墙
    GOAL: 5,         // 梅尔基亚德斯的羊皮纸密室
    LASER_EMITTER: 6 // 烈日放大镜发射器（向下发射光束）
  };

  // 第一关地图蓝图 (10列 x 8行)
  // 设计验证：
  // - 玩家起点 (1,1)
  // - 何塞 (2,1) -> 授予 [THROW] 投掷能力
  // - 上校 (2,6) -> 授予 [SHIELD] 宿命护盾（被动中弹不死）
  // - 外河 x=3 (y=1..4, 6)，木桥在 (3,5)
  // - 烈日发射器在 (4,1)，光束垂直向下覆盖 (4,2)~(4,6)，封锁去往右半区的必经之路
  // - 丽贝卡 (5,2) -> 授予 [SNIPE] 开枪必中
  // - 火药桶 (5,6) -> 玩家站在 (5,5) 使用投掷，把火药桶扔到 (6,4) 的木桥上
  // - 内河 x=6 (y=1..3, 5..6)，内河木桥在 (6,4)
  // - 裂纹石墙 (7,4) 挡在羊皮纸密室 (8,4) 前；丽贝卡引爆木桥上的火药桶后可炸开石墙
  const LEVEL_1_TERRAIN = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // y=0
    [1, 0, 0, 2, 6, 0, 2, 1, 1, 1], // y=1: (4,1) 烈日发射器
    [1, 0, 1, 2, 0, 0, 2, 1, 1, 1], // y=2: (5,2) 丽贝卡
    [1, 0, 0, 2, 0, 0, 2, 0, 1, 1], // y=3
    [1, 0, 1, 2, 0, 0, 3, 4, 5, 1], // y=4: (6,4)内桥, (7,4)裂纹墙, (8,4)终点
    [1, 0, 0, 3, 0, 0, 2, 1, 1, 1], // y=5: (3,5)外桥, (4,5)穿过光束
    [1, 0, 0, 2, 0, 0, 2, 1, 1, 1], // y=6: (2,6) 上校, (5,6)火药桶
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // y=7
  ];

  // 家族人物元信息
  const CHARACTER_DEFS = {
    JOSE: {
      id: 'JOSE',
      name: '何塞·阿尔卡蒂奥',
      abilityName: '炼金投掷',
      type: 'ACTIVE_THROW',
      icon: '🧲',
      color: '#8b4513',
      desc: '选中身旁火药桶，越过河流投掷至 3 格内任意空地。',
      quote: '“任何东西都有生命，问题在于如何唤醒它们的灵魂。”——你获得了何塞的【炼金投掷】之力！'
    },
    AURELIANO: {
      id: 'AURELIANO',
      name: '奥雷里亚诺上校',
      abilityName: '宿命护盾',
      type: 'PASSIVE_SHIELD',
      icon: '🎖️',
      color: '#b45309',
      desc: '被动生效：抵挡一次致命光束或子弹，穿胸而不伤及要害。',
      quote: '“他躲过了十四次暗杀、七十三次埋伏和一次枪决。”——上校的【宿命护盾】已庇佑你！'
    },
    REBECA: {
      id: 'REBECA',
      name: '丽贝卡',
      abilityName: '孤注一掷',
      type: 'ACTIVE_SNIPE',
      icon: '🔫',
      color: '#9e2a2b',
      desc: '开枪必中：点击视野内任意目标，隔河精准射爆火药桶。',
      quote: '一声清脆的枪响划破午后的闷热。——你继承了丽贝卡的【孤注一掷】枪法！'
    }
  };

  function createGame(onUpdate) {
    let state = null;
    let historyStack = []; // 用于撤销（Undo）
    let particles = [];    // 粒子特效（光束微粒、爆炸火花、蝴蝶）

    // 交互模式：'MOVE' | 'SELECT_THROW_SOURCE' | 'SELECT_THROW_TARGET' | 'SELECT_SNIPE_TARGET'
    let interactionMode = 'MOVE';
    let selectedBarrelPos = null;
    let banner = '';
    let ctx = null;
    let tileSize = 60;

    // 创建初始关卡状态
    function createInitialState() {
      return {
        turn: 0,
        status: 'PLAYING', // 'PLAYING' | 'WON' | 'DEAD'
        player: { x: 1, y: 1 },
        terrain: LEVEL_1_TERRAIN.map(row => [...row]),
        npcs: [
          { id: 'JOSE', x: 2, y: 1, collected: false },
          { id: 'AURELIANO', x: 2, y: 6, collected: false },
          { id: 'REBECA', x: 5, y: 2, collected: false }
        ],
        barrels: [
          { x: 5, y: 6 }
        ],
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
            text: '多年以后，站在梅尔基亚德斯的羊皮纸密室前，你仍会想起马孔多那个炙热的午后。'
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

    // ==========================================
    // 3. 核心解谜逻辑与回合结算 (Dweep 引擎)
    // ==========================================

    // 重新计算所有发射器的激光路径
    function computeLasers(targetState) {
      const beams = [];
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (targetState.terrain[y][x] === TILE.LASER_EMITTER) {
            // 向下发射光束
            for (let ny = y + 1; ny < ROWS; ny++) {
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
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
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
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
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
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
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

      pushHistory();
      state.player.x = nx;
      state.player.y = ny;
      state.turn += 1;
      resolveTurn();
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
          // 只有一个相邻火药桶时，直接进入选择目标格阶段
          selectedBarrelPos = { ...adjBarrels[0] };
          interactionMode = 'SELECT_THROW_TARGET';
          banner = '🧲 炼金投掷：点击 3 格内高亮的空地投出火药桶（再次点击取消）';
        } else {
          interactionMode = 'SELECT_THROW_SOURCE';
          banner = '🧲 炼金投掷：请先点击身旁要投掷的火药桶';
        }
      } else if (skillId === 'REBECA') {
        if (interactionMode === 'SELECT_SNIPE_TARGET') {
          cancelSkillMode();
          return;
        }
        interactionMode = 'SELECT_SNIPE_TARGET';
        banner = '🔫 孤注一掷：点击视野内的火药桶或裂纹石墙开枪射击';
      }
      renderUI();
    }

    function clearSkillMode() {
      interactionMode = 'MOVE';
      selectedBarrelPos = null;
      banner = '';
    }

    function cancelSkillMode() {
      clearSkillMode();
      renderUI();
    }

    // 处理画布点击
    function handleCanvasClick(gx, gy) {
      if (state.status !== 'PLAYING') return;
      if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

      // 模式 1：选择投掷的火药桶
      if (interactionMode === 'SELECT_THROW_SOURCE') {
        const b = state.barrels.find(item => item.x === gx && item.y === gy);
        if (b && Math.abs(b.x - state.player.x) + Math.abs(b.y - state.player.y) === 1) {
          selectedBarrelPos = { ...b };
          interactionMode = 'SELECT_THROW_TARGET';
          banner = '🧲 炼金投掷：点击 3 格内高亮的空地投出火药桶';
          renderUI();
        } else {
          cancelSkillMode();
        }
        return;
      }

      // 模式 2：选择投掷落点
      if (interactionMode === 'SELECT_THROW_TARGET' && selectedBarrelPos) {
        if (isValidThrowTarget(selectedBarrelPos.x, selectedBarrelPos.y, gx, gy)) {
          pushHistory();
          // 移动火药桶
          const barrel = state.barrels.find(b => b.x === selectedBarrelPos.x && b.y === selectedBarrelPos.y);
          barrel.x = gx;
          barrel.y = gy;
          state.abilities.JOSE.charges = 0;
          state.turn += 1;
          addLog('你效仿何塞·阿尔卡蒂奥的怪力，将火药桶凌空抛了出去！', 'character');
          clearSkillMode();
          resolveTurn();
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
          pushHistory();
          state.abilities.REBECA.charges = 0;
          state.turn += 1;
          addLog('砰！丽贝卡的子弹跨越水面，精准击中了远处的火药桶！', 'character');
          clearSkillMode();
          detonateBarrel(gx, gy);
          resolveTurn();
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
      clearSkillMode();
      renderUI();
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
      ctx.clearRect(0, 0, COLS * tileSize, ROWS * tileSize);

      // 1. 绘制基础地形层
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const px = x * tileSize;
          const py = y * tileSize;
          const t = state.terrain[y][x];

          // 羊皮纸棋盘格底色
          ctx.fillStyle = (x + y) % 2 === 0 ? '#efe3ca' : '#e7d7b9';
          ctx.fillRect(px, py, tileSize, tileSize);

          // 网格细线
          ctx.strokeStyle = 'rgba(139, 90, 43, 0.22)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px, py, tileSize, tileSize);

          if (t === TILE.WALL) {
            drawWallTile(px, py, tileSize);
          } else if (t === TILE.WATER) {
            drawWaterTile(px, py, tileSize, timestamp, x, y);
          } else if (t === TILE.BRIDGE) {
            drawWaterTile(px, py, tileSize, timestamp, x, y);
            drawBridgeTile(px, py, tileSize);
          } else if (t === TILE.CRACKED_WALL) {
            drawCrackedWallTile(px, py, tileSize);
          } else if (t === TILE.GOAL) {
            drawGoalTile(px, py, tileSize, timestamp);
          } else if (t === TILE.LASER_EMITTER) {
            drawEmitterTile(px, py, tileSize);
          }
        }
      }

      // 2. 绘制技能可选范围高亮
      if (interactionMode === 'SELECT_THROW_TARGET' && selectedBarrelPos) {
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            if (isValidThrowTarget(selectedBarrelPos.x, selectedBarrelPos.y, x, y)) {
              ctx.fillStyle = 'rgba(197, 155, 39, 0.35)';
              ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
              ctx.strokeStyle = '#c59b27';
              ctx.lineWidth = 2;
              ctx.strokeRect(x * tileSize + 3, y * tileSize + 3, tileSize - 6, tileSize - 6);
            }
          }
        }
      } else if (interactionMode === 'SELECT_SNIPE_TARGET') {
        state.barrels.forEach(b => {
          if (hasLineOfSight(state.player.x, state.player.y, b.x, b.y)) {
            const cx = (b.x + 0.5) * tileSize;
            const cy = (b.y + 0.5) * tileSize;
            ctx.strokeStyle = '#9e2a2b';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, tileSize * 0.42, 0, Math.PI * 2);
            ctx.stroke();
          }
        });
      }

      // 3. 绘制烈日聚焦激光束
      drawLaserBeams(timestamp);

      // 4. 绘制火药桶
      state.barrels.forEach(b => {
        drawBarrel(b.x * tileSize, b.y * tileSize, tileSize);
      });

      // 5. 绘制尚未遇见的家族人物 (NPC)
      state.npcs.forEach(npc => {
        if (!npc.collected) {
          drawCharacterToken(npc.x * tileSize, npc.y * tileSize, tileSize, CHARACTER_DEFS[npc.id], timestamp);
        }
      });

      // 6. 绘制主角（布恩迪亚后裔）
      drawPlayerToken(state.player.x * tileSize, state.player.y * tileSize, tileSize, timestamp);

      // 7. 鼠标悬停提示框
      if (hoverTile && state.status === 'PLAYING') {
        ctx.strokeStyle = 'rgba(44, 30, 22, 0.45)';
        ctx.lineWidth = 2;
        ctx.strokeRect(hoverTile.x * tileSize + 2, hoverTile.y * tileSize + 2, tileSize - 4, tileSize - 4);
      }

      // 8. 粒子效果
      updateAndDrawParticles();
    }

    function drawWallTile(px, py, s) {
      ctx.fillStyle = '#5c4033';
      ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
      ctx.strokeStyle = '#3b261d';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);
      // 砖缝纹理
      ctx.beginPath();
      ctx.moveTo(px + 4, py + s * 0.5);
      ctx.lineTo(px + s - 4, py + s * 0.5);
      ctx.moveTo(px + s * 0.5, py + 4);
      ctx.lineTo(px + s * 0.5, py + s * 0.5);
      ctx.stroke();
    }

    function drawWaterTile(px, py, s, time, gx, gy) {
      ctx.fillStyle = '#3b6e8c';
      ctx.fillRect(px, py, s, s);
      // 动态水波纹
      const wave = Math.sin(time * 0.003 + gx + gy) * 3;
      ctx.strokeStyle = 'rgba(214, 238, 248, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + s * 0.2, py + s * 0.35 + wave);
      ctx.quadraticCurveTo(px + s * 0.5, py + s * 0.25 + wave, px + s * 0.8, py + s * 0.35 + wave);
      ctx.moveTo(px + s * 0.25, py + s * 0.7 - wave);
      ctx.quadraticCurveTo(px + s * 0.55, py + s * 0.6 - wave, px + s * 0.85, py + s * 0.7 - wave);
      ctx.stroke();
    }

    function drawBridgeTile(px, py, s) {
      ctx.fillStyle = '#9c6635';
      ctx.fillRect(px + 3, py + s * 0.15, s - 6, s * 0.7);
      ctx.strokeStyle = '#4a2e16';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 3, py + s * 0.15, s - 6, s * 0.7);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(px + (s * i) / 4, py + s * 0.15);
        ctx.lineTo(px + (s * i) / 4, py + s * 0.85);
        ctx.stroke();
      }
    }

    function drawCrackedWallTile(px, py, s) {
      ctx.fillStyle = '#7d624d';
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
      ctx.strokeStyle = '#2c1e16';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);
      // 醒目裂纹
      ctx.beginPath();
      ctx.moveTo(px + s * 0.2, py + s * 0.2);
      ctx.lineTo(px + s * 0.5, py + s * 0.48);
      ctx.lineTo(px + s * 0.35, py + s * 0.78);
      ctx.moveTo(px + s * 0.5, py + s * 0.48);
      ctx.lineTo(px + s * 0.8, py + s * 0.65);
      ctx.stroke();
    }

    function drawGoalTile(px, py, s, time) {
      const pulse = 0.85 + Math.sin(time * 0.004) * 0.15;
      ctx.fillStyle = `rgba(197, 155, 39, ${0.28 * pulse})`;
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(px + 4, py + 4, s - 8, s - 8);

      ctx.font = `${Math.floor(s * 0.52)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('📜', px + s * 0.5, py + s * 0.52);
    }

    function drawEmitterTile(px, py, s) {
      ctx.fillStyle = '#3b261d';
      ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
      // 放大镜与烈日核心
      ctx.fillStyle = '#9e2a2b';
      ctx.beginPath();
      ctx.arc(px + s * 0.5, py + s * 0.5, s * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f4a261';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 向下箭头指示发射方向
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(px + s * 0.35, py + s * 0.72);
      ctx.lineTo(px + s * 0.65, py + s * 0.72);
      ctx.lineTo(px + s * 0.5, py + s * 0.92);
      ctx.closePath();
      ctx.fill();
    }

    function drawLaserBeams(time) {
      if (state.laserTiles.length === 0) return;
      const flicker = 0.75 + Math.sin(time * 0.015) * 0.2;
      state.laserTiles.forEach(tile => {
        const cx = (tile.x + 0.5) * tileSize;
        const py = tile.y * tileSize;

        // 外层红晕
        ctx.fillStyle = `rgba(158, 42, 43, ${0.28 * flicker})`;
        ctx.fillRect(cx - tileSize * 0.16, py, tileSize * 0.32, tileSize);

        // 核心光束
        ctx.fillStyle = `rgba(230, 57, 70, ${0.9 * flicker})`;
        ctx.fillRect(cx - tileSize * 0.05, py, tileSize * 0.1, tileSize);
      });
    }

    function drawBarrel(px, py, s) {
      const cx = px + s * 0.5;
      const cy = py + s * 0.5;
      const r = s * 0.34;

      ctx.fillStyle = '#7f2714';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2c1e16';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `${Math.floor(s * 0.44)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🧨', cx, cy + 1);
    }

    function drawCharacterToken(px, py, s, def, time) {
      const bob = Math.sin(time * 0.004) * 2.5;
      const cx = px + s * 0.5;
      const cy = py + s * 0.48 + bob;

      // 光环底座
      ctx.fillStyle = 'rgba(244, 235, 217, 0.92)';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = `${Math.floor(s * 0.44)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, cx, cy);

      // 底部名字标签
      ctx.fillStyle = '#2c1e16';
      ctx.font = `bold ${Math.max(9, Math.floor(s * 0.17))}px "Noto Serif SC", serif`;
      ctx.fillText(def.name.slice(0, 4), cx, py + s * 0.9);
    }

    function drawPlayerToken(px, py, s, time) {
      const cx = px + s * 0.5;
      const cy = py + s * 0.5;

      // 若拥有上校的【宿命护盾】，绘制金色保护光环
      if (state.abilities.AURELIANO.charges > 0) {
        const pulse = 0.38 + Math.sin(time * 0.006) * 0.04;
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.arc(cx, cy, s * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 主角徽记
      ctx.fillStyle = '#2c1e16';
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c59b27';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = `${Math.floor(s * 0.42)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🕯️', cx, cy);
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
      const cards = Object.values(CHARACTER_DEFS).map(({ id, name, abilityName, icon, desc, type }) => {
        const { unlocked, charges } = state.abilities[id];
        const isActive =
          (id === 'JOSE' && (interactionMode === 'SELECT_THROW_SOURCE' || interactionMode === 'SELECT_THROW_TARGET')) ||
          (id === 'REBECA' && interactionMode === 'SELECT_SNIPE_TARGET');

        return { id, name, abilityName, icon, desc, unlocked, charges, isActive, isPassive: type === 'PASSIVE_SHIELD' };
      });

      let ending = null;
      if (state.status === 'WON') {
        ending = {
          icon: '🦋',
          title: '羊皮纸的预言已然应验',
          description: `你在第 ${state.turn} 回合集齐了家族三代人的执念与勇气，成功抵达梅尔基亚德斯的羊皮纸密室。`
        };
      } else if (state.status === 'DEAD') {
        ending = {
          icon: '🥀',
          title: '马孔多的一阵飓风抹去了足迹',
          description: '在没有上校宿命护盾的庇佑下，直面烈日聚焦光束意味着粉身碎骨。你可以撤销上一步，或重新开启轮回。'
        };
      }

      onUpdate({
        turn: state.turn,
        canUndo: historyStack.length > 0,
        banner,
        cards,
        logs: state.logs,
        ending
      });
    }

    return { tryMove, toggleSkill, cancelSkillMode, handleCanvasClick, undoMove, resetLevel, setCanvas, drawBoard };
  }

  return { COLS, ROWS, createGame };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = MacondoPuzzle;
}
