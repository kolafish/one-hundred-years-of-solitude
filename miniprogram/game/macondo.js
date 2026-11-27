// Shared puzzle logic and Canvas 2D renderer for Web and WeChat Miniprogram.
const { TILE, LEVELS } = typeof require === 'function' ? require('./levels.js') : MacondoLevels;
const Progress = typeof require === 'function' ? require('./progress.js') : MacondoProgress;
const Icons = typeof require === 'function' ? require('./icons.js') : MacondoIcons;

const MacondoPuzzle = (() => {
  const CHARACTER_DEFS = {
    JOSE: {
      id: 'JOSE',
      name: '何塞·阿尔卡蒂奥',
      shortName: '何塞',
      abilityName: '炼金投掷',
      type: 'ACTIVE_THROW',
      charges: 2,
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
      charges: 1,
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
      charges: 1,
      iconId: 'char_rebeca',
      color: '#9e2a2b',
      desc: '开枪必中：点击视野内任意目标，隔河精准射爆火药桶。',
      quote: '一声清脆的枪响划破午后的闷热。——你继承了丽贝卡的【孤注一掷】枪法！'
    },
    URSULA: {
      id: 'URSULA', name: '乌尔苏拉', shortName: '乌尔苏拉',
      abilityName: '持家秩序', type: 'ACTIVE', charges: 2,
      iconId: 'char_ursula', color: '#704c2f',
      desc: '点相邻重物向前推一格，或在相邻河格架木板桥。',
      quote: '乌尔苏拉把家里和河岸的道路重新理出了秩序。'
    },
    MELQUIADES: {
      id: 'MELQUIADES', name: '梅尔基亚德斯', shortName: '梅尔基亚德斯',
      abilityName: '羊皮纸换位', type: 'ACTIVE', charges: 1,
      iconId: 'char_melquiades', color: '#73502d',
      desc: '与视野内四格以内的可移动物体交换位置。',
      quote: '梅尔基亚德斯翻开羊皮纸，两处位置在字迹间悄然对调。'
    },
    AMARANTA: {
      id: 'AMARANTA', name: '阿玛兰妲', shortName: '阿玛兰妲',
      abilityName: '黑纱蔽日', type: 'ACTIVE', charges: 1,
      iconId: 'char_amaranta', color: '#65526d',
      desc: '在视野内空地展开黑纱，遮蔽光束与守卫视线三回合。',
      quote: '阿玛兰妲展开黑纱，把守卫的视线留在帷幕之外。'
    },
    PILAR: {
      id: 'PILAR', name: '庇拉尔·特尔内拉', shortName: '庇拉尔',
      abilityName: '纸牌逆转', type: 'ACTIVE', charges: 1,
      iconId: 'char_pilar', color: '#7b4b3d',
      desc: '翻转机关状态，点棋盘即可施放。',
      quote: '庇拉尔翻过纸牌，机关换了一个方向。'
    }
  };

  function createGame(onUpdate, levels = LEVELS, storage = {}) {
    let level = levels[0];
    let progress = readProgress();
    let loadout = [];
    let campaignFlags = { ...progress.worldFlags };
    let storageFailed = false;
    let state = null;
    let historyStack = []; // 用于撤销（Undo）
    let particles = [];    // 粒子特效（光束微粒、爆炸火花、蝴蝶）

    let interactionMode = 'MOVE';
    let selectedBarrelPos = null;
    let activeAbility = null;
    let banner = '';
    let bannerIconId = '';
    let ctx = null;
    let tileSize = 60;

    function readProgress() {
      try {
        return Progress.normalize(storage.read?.(), levels[0].id);
      } catch {
        return Progress.normalize(null, levels[0].id);
      }
    }

    function preparation(levelId, selected = progress.lastSelectedLoadout) {
      const act = levels.find(candidate => candidate.id === levelId);
      if (!act || !progress.unlockedLevels.includes(levelId)) return null;
      const slots = (progress.completedLevels[act.id] && act.replaySlots) || act.slots;
      const choices = Object.values(CHARACTER_DEFS).map(character => ({
        ...character,
        unlocked: progress.unlockedCharacters.includes(character.id),
        iconUri: Icons.getIconDataUri(character.iconId)
      }));
      const eligible = new Set(choices.filter(character => character.unlocked).map(character => character.id));
      const picked = [...new Set(selected)].filter(id => eligible.has(id)).slice(0, slots);
      return { id: act.id, title: act.title, slots, picked, choices };
    }

    function commitVictory() {
      if (state.status !== 'WON' || state.settled) return false;
      const next = levels[levels.indexOf(level) + 1];
      const rank = state.turn <= level.parTurns ? 'S' : state.turn <= level.parTurns + 5 ? 'A' : 'B';
      const record = Progress.normalize({
        schemaVersion: 1,
        unlockedLevels: next ? [next.id] : [level.id],
        completedLevels: { [level.id]: { bestTurns: state.turn, rank, relicCollected: state.relicCollected } },
        unlockedCharacters: level.unlocks,
        worldFlags: state.localFlags,
        lastSelectedLoadout: loadout
      }, levels[0].id);
      progress = Progress.merge(Progress.merge(readProgress(), progress), record);
      try {
        storage.write?.(progress);
        storageFailed = false;
      } catch {
        storageFailed = true;
      }
      state.settled = true;
      historyStack = [];
      renderUI();
      return true;
    }

    // 创建初始关卡状态
    function createInitialState() {
      const terrain = level.terrain.map(row => [...row]);
      for (const change of level.changes || []) {
        if (campaignFlags[change.flag]) terrain[change.y][change.x] = change.tile;
      }
      return {
        turn: 0,
        settled: false,
        localFlags: {},
        relicCollected: false,
        mistUntil: 0,
        gold: 0,
        archiveDestroyed: false,
        gates: (level.gates || []).map(gate => ({ ...gate, open: false })),
        levers: (level.levers || []).map(lever => ({ ...lever, on: false })),
        guards: (level.guards || []).map(({ path }) => ({
          path, x: path[0].x, y: path[0].y, index: 0, step: 1,
          dx: path[1].x - path[0].x, dy: path[1].y - path[0].y
        })),
        curtains: [],
        reversed: false,
        memoRead: loadout.includes('URSULA'),
        status: 'PLAYING', // 'PLAYING' | 'WON' | 'DEAD'
        player: { ...level.start },
        terrain,
        npcs: level.npcs.map(npc => ({ ...npc, collected: false })),
        barrels: level.barrels.map(barrel => ({ ...barrel })),
        boxes: (level.boxes || []).map(box => ({ ...box })),
        mirrors: (level.mirrors || []).map(mirror => ({ ...mirror })),
        items: (level.items || []).map(item => ({ ...item })),
        abilities: Object.fromEntries(Object.values(CHARACTER_DEFS).map(character => [
          character.id, {
            unlocked: loadout.includes(character.id),
            charges: loadout.includes(character.id) ? startingCharges(character) : 0
          }
        ])),
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
    function startingCharges(character) {
      return character.charges + Number(character.id === 'AURELIANO' && level.id >= 4 && campaignFlags.GOLD_FISH_FORGED);
    }

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
      const previous = state.player;
      change();
      resolveTurn(previous.x !== state.player.x || previous.y !== state.player.y);
    }

    // ==========================================
    // 3. 核心解谜逻辑与回合结算 (Dweep 引擎)
    // ==========================================

    // 重新计算所有发射器的激光路径
    function inBounds(x, y) {
      return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < level.cols && y >= 0 && y < level.rows;
    }

    function at(entities, x, y) {
      return entities.find(item => item.x === x && item.y === y);
    }

    function objects(target = state) {
      return [...target.barrels, ...target.boxes, ...target.mirrors];
    }

    function isSolid(x, y, target = state) {
      const gate = at(target.gates, x, y);
      return [TILE.WALL, TILE.CRACKED_WALL, TILE.LASER_EMITTER].includes(target.terrain[y][x])
        || Boolean(gate && !gate.open);
    }

    function computeLasers(target) {
      const beams = [];
      const emitters = level.emitters || target.terrain.flatMap((row, y) => row.flatMap((tile, x) =>
        tile === TILE.LASER_EMITTER ? [{ x, y, dx: 0, dy: 1 }] : []));
      for (const emitter of emitters) {
        let { x, y, dx, dy } = emitter;
        const visited = new Set();
        while (inBounds(x += dx, y += dy) && !isSolid(x, y, target) && !at(target.curtains, x, y)) {
          const key = [x, y, dx, dy].join(',');
          if (visited.has(key)) break;
          visited.add(key);
          const incoming = { dx, dy };
          const mirror = at(target.mirrors, x, y);
          if (mirror) [dx, dy] = mirror.slash ? [-dy, -dx] : [dy, dx];
          beams.push({ x, y, incoming, outgoing: { dx, dy } });
          if (at(target.barrels, x, y) || at(target.boxes, x, y)) break;
        }
      }
      target.laserTiles = beams;
    }

    function isWalkable(x, y, movingObject) {
      return inBounds(x, y) && !isSolid(x, y)
        && ![TILE.WATER, TILE.HOT].includes(state.terrain[y][x])
        && !at(objects(), x, y)
        && (!movingObject || !(state.player.x === x && state.player.y === y)
          && !at(state.npcs.filter(npc => !npc.collected), x, y));
    }

    function isValidThrowTarget(bx, by, tx, ty) {
      const distance = Math.abs(bx - tx) + Math.abs(by - ty);
      return distance > 0 && distance <= 3 && isWalkable(tx, ty, true)
        && [TILE.FLOOR, TILE.BRIDGE].includes(state.terrain[ty][tx]);
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
          if (isSolid(cx, cy) || at(state.curtains, cx, cy)) {
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
            if (level.archiveWall?.x === nx && level.archiveWall?.y === ny) state.archiveDestroyed = true;
            destroyedWall = true;
            spawnExplosion(nx, ny, '#c59b27');
          }
        }
      });

      if (state.archiveDestroyed && destroyedWall) {
        addLog('裂纹墙轰然倒塌，墙后的档案也没能留下。', 'warning');
      } else if (destroyedWall) {
        addLog('轰然巨响中，火药桶炸碎了古老的裂纹石墙，通往密室的道路豁然开朗！', 'highlight');
      } else {
        addLog('火药桶在空地上炸开，硝烟弥漫在马孔多的空气里。', 'normal');
      }
    }

    // 回合结束后的环境与接触结算
    function resolveTurn(enteredTile) {
      const { x, y } = state.player;
      const item = at(state.items, x, y);
      if (item) {
        state.items = state.items.filter(entry => entry !== item);
        if (item.kind === 'relic') {
          state.relicCollected = true;
          addLog('你找到了这一幕的羊皮纸残页。', 'highlight');
        } else if (item.kind === 'ice') {
          state.localFlags.ICE_PRESERVED = true;
          addLog('你把冷冽的冰块裹好，准备带出庄园。', 'highlight');
        } else if (item.kind === 'gold') {
          state.gold += 1;
          addLog('你拾起一枚熔炉金屑。', 'highlight');
        } else if (item.kind === 'note') {
          state.memoRead = true;
          state.mistUntil = 0;
          addLog('备忘字条让你记住了家族馈赠。', 'highlight');
        }
      }
      if (enteredTile && state.terrain[y][x] === TILE.MIST && !state.memoRead) {
        state.mistUntil = state.turn + 2;
        addLog('失眠迷雾封印了主动能力。再经过两回合即可恢复。', 'warning');
      }
      // 1. 检查是否接触或靠近家族人物（踩上或相邻即可触发对话继承能力）
      state.npcs.forEach(npc => {
        if (!npc.collected) {
          const dist = Math.abs(npc.x - state.player.x) + Math.abs(npc.y - state.player.y);
          if (dist <= 1) {
            npc.collected = true;
            const def = CHARACTER_DEFS[npc.id];
            if (!state.abilities[npc.id].unlocked) {
              state.abilities[npc.id] = { unlocked: true, charges: def.charges };
            }
            addLog(def.quote, 'character');
            spawnExplosion(npc.x, npc.y, '#c59b27');
          }
        }
      });

      if (level.forge && state.gold >= 2 && !state.localFlags.GOLD_FISH_FORGED
        && Math.abs(x - level.forge.x) + Math.abs(y - level.forge.y) <= 1) {
        state.localFlags.GOLD_FISH_FORGED = true;
        addLog('上校用两枚金屑锻成小金鱼。后两幕携带上校时可多挡一次攻击。', 'highlight');
      }

      updateGates();
      advanceGuards();
      state.curtains = state.curtains.filter(curtain => curtain.expires > state.turn);
      computeLasers(state);
      const inLaser = Boolean(at(state.laserTiles, x, y));
      const seenByGuard = state.guards.some(guard => guardSees(guard, x, y));
      if (inLaser || seenByGuard) {
        if (state.abilities.AURELIANO.charges > 0) {
          // 触发奥雷里亚诺上校的【宿命护盾】
          state.abilities.AURELIANO.charges = 0;
          spawnExplosion(state.player.x, state.player.y, '#ffd166');
          addLog(inLaser
            ? '灼热的光束穿透了你的胸膛，却神奇地避开了心脏！奥雷里亚诺上校的【宿命护盾】救了你一命。'
            : '守卫发现了你。上校的宿命护盾挡下攻击并打断警报。', 'highlight');
        } else {
          state.status = 'DEAD';
          addLog(inLaser ? '烈日聚焦光束无情地吞噬了你的身影，一切化作马孔多的尘埃。' : '守卫拉响了警报。', 'danger');
          renderUI();
          return;
        }
      }

      // 4. 检查是否抵达羊皮纸密室 (GOAL)
      if (state.terrain[state.player.y][state.player.x] === TILE.GOAL) {
        state.status = 'WON';
        if (level.archiveWall && !state.archiveDestroyed) {
          state.localFlags.ARCHIVE_INTACT = true;
          addLog('档案完整保留下来。', 'highlight');
        }
        addLog('你推开密室尘封的木门，破译了梅尔基亚德斯的羊皮纸手稿！', 'highlight');
      }

      renderUI();
    }

    function updateGates() {
      for (const gate of state.gates) {
        const weighted = Boolean(at(objects(), gate.plate.x, gate.plate.y));
        const activated = state.levers.some(lever => lever.id === gate.id && lever.on);
        gate.open = (weighted || activated) !== state.reversed;
      }
    }

    function advanceGuards() {
      for (const guard of state.guards) {
        if (!guard.path[guard.index + guard.step]) guard.step *= -1;
        guard.index += guard.step;
        const next = guard.path[guard.index];
        guard.dx = next.x - guard.x;
        guard.dy = next.y - guard.y;
        guard.x = next.x;
        guard.y = next.y;
      }
    }

    function guardSees(guard, x, y) {
      const dx = x - guard.x;
      const dy = y - guard.y;
      const distance = dx * guard.dx + dy * guard.dy;
      const sideways = Math.abs(dx * guard.dy - dy * guard.dx);
      return (dx === 0 && dy === 0) || (distance >= 1 && distance <= 3 && sideways <= Math.floor(distance / 2)
        && !isSolid(x, y) && !at(state.curtains, x, y) && hasLineOfSight(guard.x, guard.y, x, y));
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
      const lane = at(level.oneWay || [], nx, ny);
      const sign = state.reversed ? -1 : 1;
      if (lane && (dx !== lane.dx * sign || dy !== lane.dy * sign)) return;

      takeTurn(() => {
        state.player = { x: nx, y: ny };
      });
    }

    // 切换技能激活状态
    function toggleSkill(skillId) {
      if (state.status !== 'PLAYING') return;
      const ab = state.abilities[skillId];
      if (!ab || ab.charges <= 0 || CHARACTER_DEFS[skillId].type === 'PASSIVE_SHIELD') return;
      if (state.turn < state.mistUntil) return;
      if (activeAbility === skillId) {
        cancelSkillMode();
        return;
      }
      clearSkillMode();
      activeAbility = skillId;

      if (skillId === 'JOSE') {
        // 查找玩家身旁（上下左右）的可移动重物。
        const adjBarrels = objects().filter(b =>
          Math.abs(b.x - state.player.x) + Math.abs(b.y - state.player.y) === 1
        );
        if (adjBarrels.length === 0) {
          addLog('何塞低语道：“你得先走到重物旁边，才能将它抛向远方。”', 'warning');
          cancelSkillMode();
          return;
        }
        if (adjBarrels.length === 1) {
          selectedBarrelPos = { ...adjBarrels[0] };
          interactionMode = 'SELECT_THROW_TARGET';
          bannerIconId = 'char_jose';
          banner = '炼金投掷：点击 3 格内高亮的空地投出重物（再次点击取消）';
        } else {
          interactionMode = 'SELECT_THROW_SOURCE';
          bannerIconId = 'char_jose';
          banner = '炼金投掷：请先点击身旁要投掷的重物';
        }
      } else if (skillId === 'REBECA') {
        interactionMode = 'SELECT_SNIPE_TARGET';
        bannerIconId = 'char_rebeca';
        banner = '孤注一掷：点视野内的火药桶、冰晶或拉杆。';
      } else {
        interactionMode = 'SELECT_ABILITY';
        bannerIconId = CHARACTER_DEFS[skillId].iconId;
        banner = CHARACTER_DEFS[skillId].desc;
      }
      renderUI();
    }

    function clearSkillMode() {
      interactionMode = 'MOVE';
      selectedBarrelPos = null;
      activeAbility = null;
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
      if (!inBounds(gx, gy)) return;
      if (interactionMode === 'SELECT_ABILITY') {
        const effect = abilityTarget(activeAbility, gx, gy);
        if (!effect) return;
        takeTurn(() => {
          state.abilities[activeAbility].charges -= 1;
          effect();
          clearSkillMode();
        });
        return;
      }

      // Mode 1: select adjacent barrel to throw
      if (interactionMode === 'SELECT_THROW_SOURCE') {
        const b = at(objects(), gx, gy);
        if (b && Math.abs(b.x - state.player.x) + Math.abs(b.y - state.player.y) === 1) {
          selectedBarrelPos = { ...b };
          interactionMode = 'SELECT_THROW_TARGET';
          bannerIconId = 'char_jose';
          banner = '炼金投掷：点击 3 格内高亮的空地投出重物';
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
          const object = at(objects(), selectedBarrelPos.x, selectedBarrelPos.y);
          object.x = gx;
          object.y = gy;
            state.abilities.JOSE.charges -= 1;
          addLog('你效仿何塞·阿尔卡蒂奥的怪力，将重物凌空抛了出去！', 'character');
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
        const lever = at(state.levers, gx, gy);
        const crystal = at(state.items.filter(item => item.kind === 'crystal'), gx, gy);

        if (targetBarrel || lever || crystal) {
          takeTurn(() => {
            state.abilities.REBECA.charges = 0;
            if (targetBarrel) {
              addLog('砰！丽贝卡精准击中了远处的火药桶！', 'character');
              detonateBarrel(gx, gy);
            } else if (lever) {
              lever.on = !lever.on;
              addLog('丽贝卡击中了机关拉杆。', 'highlight');
            } else {
              state.items = state.items.filter(item => item !== crystal);
              addLog('一声脆响，挡路的冰晶碎了。', 'highlight');
            }
            clearSkillMode();
          });
        } else if (targetCracked) {
          // 射击坚固裂纹石墙给予提示（需火药桶爆炸才能彻底炸开）
          addLog('子弹在石墙上擦出火花，但这堵石墙太厚了，需要引爆旁边的【火药桶】才能炸毁！', 'warning');
          renderUI();
        } else {
          addLog('请瞄准视野内的火药桶、冰晶或拉杆。', 'warning');
          renderUI();
        }
        return;
      }

      // 模式 0：普通移动（点击相邻格子）
      const dx = gx - state.player.x;
      const dy = gy - state.player.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return;
      const mirror = at(state.mirrors, gx, gy);
      if (mirror) {
        takeTurn(() => {
          mirror.slash = !mirror.slash;
          addLog('你拨转了铜镜。', 'highlight');
        });
      } else if (at(level.repairs || [], gx, gy) && state.terrain[gy][gx] === TILE.WATER) {
        takeTurn(() => repairBridge(gx, gy));
      } else {
        tryMove(dx, dy);
      }
    }

    function repairBridge(x, y) {
      state.terrain[y][x] = TILE.BRIDGE;
      if (at(level.repairs || [], x, y)) state.localFlags.BRIDGE_REPAIRED = true;
      addLog('木板铺稳，河岸之间有了落脚处。', 'highlight');
    }

    function abilityTarget(skill, x, y) {
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      const distance = Math.abs(dx) + Math.abs(dy);
      const object = at(objects(), x, y);
      if (skill === 'URSULA' && distance === 1) {
        if (object && isWalkable(x + dx, y + dy, true)) {
          return () => { object.x += dx; object.y += dy; };
        }
        if (!object && state.terrain[y][x] === TILE.WATER) return () => repairBridge(x, y);
      }
      if (skill === 'MELQUIADES' && object && distance <= 4 && isOpenGround(x, y)
        && hasLineOfSight(state.player.x, state.player.y, x, y)) {
        return () => {
          const previous = state.player;
          state.player = { x, y };
          Object.assign(object, previous);
        };
      }
      if (skill === 'AMARANTA' && distance > 0 && isWalkable(x, y, true)
        && !at(state.curtains, x, y) && hasLineOfSight(state.player.x, state.player.y, x, y)) {
        return () => {
          state.curtains.push({ x, y, expires: state.turn + 3 });
          addLog('黑纱展开，接下来三回合会遮住光束和守卫视线。', 'highlight');
        };
      }
      if (skill === 'PILAR' && distance === 0) {
        return () => {
          state.reversed = !state.reversed;
          addLog('纸牌翻面，二元机关随之逆转。', 'highlight');
        };
      }
      return null;
    }

    function isOpenGround(x, y) {
      return !isSolid(x, y) && ![TILE.WATER, TILE.HOT].includes(state.terrain[y][x]);
    }

    // 撤销操作
    function undoMove() {
      if (historyStack.length === 0) return;
      state = historyStack.pop();
      particles = [];
      clearSkillMode();
      renderUI();
    }

    function startLevel(levelId, selected) {
      const ready = preparation(levelId, selected);
      if (!ready) return false;
      level = levels.find(candidate => candidate.id === levelId);
      loadout = ready.picked;
      campaignFlags = { ...progress.worldFlags };
      resetLevel();
      return true;
    }

    // 重置关卡
    function resetLevel() {
      historyStack = [];
      particles = [];
      state = createInitialState();
      updateGates();
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
          } else if (tile === TILE.HOT || tile === TILE.MIST) {
            ctx.fillStyle = tile === TILE.HOT ? 'rgba(158, 42, 43, 0.45)' : 'rgba(115, 102, 124, 0.43)';
            ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
            drawBoardMark(px, py, tile === TILE.HOT ? '热' : '雾');
          }
        }
      }

      for (const gate of state.gates) {
        drawBoardMark(gate.plate.x * tileSize, gate.plate.y * tileSize, '踏', '#875325');
        drawBoardMark(gate.x * tileSize, gate.y * tileSize, gate.open ? '开' : '栅');
      }
      for (const lever of state.levers) drawBoardMark(lever.x * tileSize, lever.y * tileSize, '杆', '#9e2a2b');
      for (const curtain of state.curtains) drawBoardMark(curtain.x * tileSize, curtain.y * tileSize, '纱', '#574360');
      for (const lane of level.oneWay || []) {
        const sign = state.reversed ? -1 : 1;
        const symbol = lane.dx ? (lane.dx * sign > 0 ? '→' : '←') : (lane.dy * sign > 0 ? '↓' : '↑');
        drawBoardMark(lane.x * tileSize, lane.y * tileSize, symbol, state.reversed ? '#325d78' : '#9e2a2b');
      }
      for (const guard of state.guards) drawGuard(guard);

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
      } else if (interactionMode === 'SELECT_ABILITY') {
        for (let y = 0; y < level.rows; y++) {
          for (let x = 0; x < level.cols; x++) {
            if (abilityTarget(activeAbility, x, y)) markTarget(x, y);
          }
        }
      } else if (interactionMode === 'SELECT_SNIPE_TARGET') {
        const pulse = 0.75 + Math.sin(t * 0.01) * 0.25;
        [...state.barrels, ...state.levers, ...state.items.filter(item => item.kind === 'crystal')].forEach(b => {
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

      for (const box of state.boxes) drawBox(box);
      for (const mirror of state.mirrors) drawMirror(mirror);
      for (const item of state.items) {
        if (item.kind === 'relic') {
          Icons.drawScrollCanvas(ctx, (item.x + 0.5) * tileSize, (item.y + 0.5) * tileSize, tileSize * 0.8);
        } else {
          drawBoardMark(item.x * tileSize, item.y * tileSize, { ice: '冰', note: '签', gold: '金', crystal: '晶' }[item.kind]);
        }
      }
      for (const bridge of level.repairs || []) {
        if (state.terrain[bridge.y][bridge.x] === TILE.WATER) {
          drawBoardMark(bridge.x * tileSize, bridge.y * tileSize, '修', '#fff0c8');
        }
      }

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

    function drawGuard(guard) {
      const s = tileSize;
      ctx.fillStyle = 'rgba(158, 42, 43, 0.25)';
      for (let distance = 1; distance <= 3; distance++) {
        for (let side = -Math.floor(distance / 2); side <= Math.floor(distance / 2); side++) {
          const x = guard.x + guard.dx * distance - guard.dy * side;
          const y = guard.y + guard.dy * distance + guard.dx * side;
          if (inBounds(x, y) && guardSees(guard, x, y)) ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
        }
      }
      drawBoardMark(guard.x * s, guard.y * s, '卫', '#9e2a2b');
    }

    function drawBoardMark(px, py, label, color = '#2c1e16') {
      ctx.fillStyle = color;
      ctx.font = 'bold ' + Math.max(10, Math.floor(tileSize * 0.49)) + 'px serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(label, px + tileSize / 2, py + tileSize / 2);
    }

    function markTarget(x, y) {
      ctx.strokeStyle = '#b47d15';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * tileSize + 3, y * tileSize + 3, tileSize - 6, tileSize - 6);
    }

    function drawBox(box) {
      const s = tileSize;
      const x = (box.x + 0.18) * s;
      const y = (box.y + 0.18) * s;
      ctx.fillStyle = '#ac7849';
      ctx.fillRect(x, y, s * 0.64, s * 0.64);
      ctx.strokeStyle = '#56351f';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, s * 0.64, s * 0.64);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.64, y + s * 0.64);
      ctx.stroke();
    }

    function drawMirror({ x, y, slash }) {
      const s = tileSize;
      const cx = (x + 0.5) * s;
      const cy = (y + 0.5) * s;
      const rise = slash ? -s * 0.3 : s * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.3, cy - rise);
      ctx.lineTo(cx + s * 0.3, cy + rise);
      ctx.strokeStyle = '#69472b';
      ctx.lineWidth = s * 0.20;
      ctx.stroke();
      ctx.strokeStyle = '#edc375';
      ctx.lineWidth = s * 0.11;
      ctx.stroke();
    }

    function drawLaserBeams(time) {
      const flicker = 0.75 + Math.sin(time * 0.015) * 0.2;
      for (const tile of state.laserTiles) {
        const x = (tile.x + 0.5) * tileSize;
        const y = (tile.y + 0.5) * tileSize;
        const half = tileSize / 2;
        ctx.beginPath();
        ctx.moveTo(x - tile.incoming.dx * half, y - tile.incoming.dy * half);
        ctx.lineTo(x, y);
        ctx.lineTo(x + tile.outgoing.dx * half, y + tile.outgoing.dy * half);
        ctx.strokeStyle = `rgba(158, 42, 43, ${0.26 * flicker})`;
        ctx.lineWidth = tileSize * 0.32;
        ctx.stroke();
        ctx.strokeStyle = `rgba(230, 57, 70, ${0.88 * flicker})`;
        ctx.lineWidth = tileSize * 0.10;
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 224, 130, ${0.75 * flicker})`;
        ctx.lineWidth = tileSize * 0.036;
        ctx.stroke();
      }
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
      const present = new Set([...loadout, ...level.npcs.map(npc => npc.id)]);
      const cards = Object.values(CHARACTER_DEFS).filter(character => present.has(character.id)).map(({ id, name, abilityName, iconId, desc, type }) => {
        const { unlocked, charges } = state.abilities[id];
        const isActive = activeAbility === id;
        return {
          id,
          name,
          abilityName,
          iconId,
          iconUri: Icons.getIconDataUri(iconId),
          desc,
          unlocked,
          charges,
          blocked: state.turn < state.mistUntil,
          isActive,
          isPassive: type === 'PASSIVE_SHIELD'
        };
      });

      let ending = null;
      if (state.status === 'WON') {
        ending = {
          won: true,
          settled: state.settled,
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
        campaign: levels.map(act => ({
          id: act.id, title: act.title, unlocked: progress.unlockedLevels.includes(act.id),
          record: progress.completedLevels[act.id] || null,
          causalHints: (act.causalHints || []).map(hint => ({ ...hint, active: progress.worldFlags[hint.flag] }))
        })),
        storageFailed,
        relicCollected: state.relicCollected,
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

    return { startLevel, preparation, commitVictory, tryMove, toggleSkill, cancelSkillMode, handleCanvasClick, undoMove, resetLevel, setCanvas, drawBoard, getState: () => cloneState(state) };
  }

  return { LEVELS, createGame };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = MacondoPuzzle;
}
