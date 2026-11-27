const assert = require('node:assert/strict');
const test = require('node:test');
const { LEVELS, createGame } = require('../../miniprogram/game/macondo.js');
const { TILE } = require('../../miniprogram/game/levels.js');

function play(game, steps) {
  const moves = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
  for (const direction of steps) game.tryMove(...moves[direction]);
}

function solveFirstAct(game) {
  play(game, 'RLDDDDRRRRUUDD');
  game.toggleSkill('JOSE');
  game.handleCanvasClick(6, 4);
  game.toggleSkill('REBECA');
  game.handleCanvasClick(6, 4);
  play(game, 'URRR');
}

test('the original 20-turn first act can be solved and undone', () => {
  let view;
  const game = createGame(update => { view = update; });
  game.resetLevel();
  assert.deepEqual([view.level.cols, view.level.rows], [10, 8]);
  solveFirstAct(game);
  assert.equal(view.turn, 20);
  assert.equal(game.getState().status, 'WON');
  game.undoMove();
  assert.equal(view.turn, 19);
  assert.equal(game.getState().status, 'PLAYING');
  game.tryMove(1, 0);
  assert.equal(game.getState().status, 'WON');
});

test('map dimensions, boundary clicks, hazards and reset follow the loaded act', () => {
  const wide = {
    ...LEVELS[0], id: 99, cols: 13, rows: 9,
    start: { x: 11, y: 8 }, npcs: [], barrels: [],
    terrain: Array.from({ length: 9 }, () => Array(13).fill(0))
  };
  wide.terrain[8][12] = 5;
  let view;
  const game = createGame(update => { view = update; }, [...LEVELS, wide], { read: () => ({ schemaVersion: 1, unlockedLevels: [99] }) });
  assert.equal(game.startLevel(99), true);
  assert.deepEqual([view.level.cols, view.level.rows], [13, 9]);
  game.handleCanvasClick(13, 8);
  assert.equal(view.turn, 0);
  game.handleCanvasClick(12, 8);
  assert.equal(game.getState().status, 'WON');
  game.resetLevel();
  assert.equal(view.level.id, 99);
  assert.equal(view.canUndo, false);
  assert.equal(game.startLevel(404), false);
  assert.equal(game.startLevel(1), true);
  const before = game.getState();
  game.tryMove(1, 0);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
});

function campaign(saved) {
  let view;
  return {
    game: createGame(update => { view = update; }, LEVELS, {
      read: () => saved.value,
      write: value => { saved.value = structuredClone(value); }
    }),
    get view() { return view; }
  };
}

test('victory, undo, settlement and loading the next act preserve only committed rewards', () => {
  const saved = {};
  const { game } = campaign(saved);
  game.resetLevel();
  assert.equal(game.startLevel(2), false);
  play(game, 'RLDDR LDDRRRRUUUU DDDD'.replaceAll(' ', ''));
  assert.equal(game.getState().localFlags.ICE_PRESERVED, true);
  assert.equal(game.getState().relicCollected, true);
  game.toggleSkill('JOSE');
  game.handleCanvasClick(6, 4);
  game.toggleSkill('REBECA');
  game.handleCanvasClick(6, 4);
  play(game, 'URRR');
  assert.equal(game.getState().status, 'WON');
  assert.equal(saved.value, undefined);
  game.undoMove();
  assert.equal(game.commitVictory(), false);
  play(game, 'R');
  assert.equal(game.commitVictory(), true);
  assert.equal(game.commitVictory(), false);
  assert.equal(saved.value.completedLevels[1].relicCollected, true);
  const reopened = campaign(saved).game;
  assert.equal(reopened.startLevel(2, ['JOSE', 'REBECA']), true);
  assert.deepEqual(reopened.preparation(2, ['JOSE', 'REBECA']).picked, ['JOSE']);
  assert.equal(reopened.getState().terrain[5][5], 0);
  play(reopened, 'RRRRRRRRU');
  assert.equal(reopened.getState().status, 'WON');
  assert.equal(reopened.getState().turn, 9);
});

test('the mirror route works without the ice flag and repairs survive a confirmed victory', () => {
  const saved = { value: { schemaVersion: 1, unlockedLevels: [2], unlockedCharacters: ['JOSE'] } };
  const { game, view } = campaign(saved);
  game.startLevel(2);
  play(game, 'RRRU');
  const before = game.getState();
  game.handleCanvasClick(5, 4);
  assert.equal(game.getState().mirrors[0].slash, true);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  game.handleCanvasClick(5, 4);
  play(game, 'UUURRRDDDRR');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().turn, 16);
  game.startLevel(2, ['JOSE']);
  play(game, 'RRRD');
  game.handleCanvasClick(5, 6);
  assert.equal(game.getState().localFlags.BRIDGE_REPAIRED, true);
  play(game, 'RRRRRUU');
  assert.equal(game.getState().status, 'WON');
  game.commitVictory();
  assert.equal(saved.value.worldFlags.BRIDGE_REPAIRED, true);
});

test('the workshop supports both archive routes, forging, and deterministic patrol undo', () => {
  const saved = { value: { schemaVersion: 1, unlockedLevels: [3] } };
  const { game } = campaign(saved);
  game.startLevel(3);
  play(game, 'DDRRRLULU');
  assert.equal(game.getState().localFlags.GOLD_FISH_FORGED, true);
  const before = game.getState();
  game.toggleSkill('URSULA');
  game.handleCanvasClick(3, 5);
  assert.equal(game.getState().gates[0].open, true);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  game.toggleSkill('URSULA');
  game.handleCanvasClick(3, 5);
  play(game, 'RURRDRRR');
  game.toggleSkill('AMARANTA');
  game.handleCanvasClick(8, 4);
  assert.equal(game.getState().curtains.length, 1);
  play(game, 'RDDRUU');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);
  game.commitVictory();
  assert.equal(saved.value.worldFlags.ARCHIVE_INTACT, true);
  assert.equal(saved.value.worldFlags.GOLD_FISH_FORGED, true);

  game.startLevel(3, []);
  play(game, 'UURR');
  assert(game.interactAt(4, 3));
  assert.equal(game.getState().archiveDestroyed, true);
  play(game, 'RRRRRRDDR');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().localFlags.ARCHIVE_INTACT, undefined);
  game.commitVictory();
  assert.equal(saved.value.worldFlags.ARCHIVE_INTACT, true);
});

test('rain supports both bridge variants, deterministic drift, tide reversal and undo', () => {
  const saved = { value: {
    schemaVersion: 1,
    unlockedLevels: [4],
    unlockedCharacters: ['AURELIANO', 'PILAR'],
    worldFlags: { GOLD_FISH_FORGED: true }
  } };
  const { game } = campaign(saved);
  game.startLevel(4, ['AURELIANO', 'PILAR']);
  assert.equal(game.getState().abilities.AURELIANO.charges, 2);
  assert.equal(game.getState().terrain[4][5], 9);
  game.toggleSkill('PILAR');
  assert.equal(game.getState().turn, 0);
  assert.equal(game.getState().tideHigh, true);
  assert.equal(game.getState().boxes[0].x, 5);
  assert.equal(game.getState().abilities.PILAR.charges, 0);
  const flipped = game.getState();
  game.toggleSkill('PILAR');
  assert.deepEqual(game.getState(), flipped);
  game.undoMove();
  assert.equal(game.getState().tideHigh, false);
  assert.equal(game.getState().boxes[0].x, 4);
  assert.equal(game.getState().abilities.PILAR.charges, 1);
  play(game, 'RR');
  const shore = game.getState();
  play(game, 'R');
  assert.equal(game.getState().status, 'DEAD');
  assert.equal(game.getState().abilities.AURELIANO.charges, 2);
  game.undoMove();
  assert.deepEqual(game.getState(), shore);
  game.waitTurn();
  assert.equal(game.getState().boxes[0].x, 6);
  assert.equal(game.getState().barrels[0].x, 6);
  play(game, 'RRDRRRUUURDD');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);
  game.commitVictory();

  saved.value.worldFlags.BRIDGE_REPAIRED = true;
  const reopened = campaign(saved).game;
  reopened.startLevel(4);
  assert.equal(reopened.getState().terrain[4][5], 3);
  play(reopened, 'RRRR');
  assert(reopened.interactAt(6, 3));
  assert.equal(reopened.getState().terrain[2][7], TILE.FLOOR);
  play(reopened, 'UURRRDDR');
  assert.equal(reopened.getState().status, 'WON');
});

function finishWithMirror(game) {
  play(game, 'RDRRURR');
  assert(game.interactAt());
  assert.equal(game.getState().seals[0].open, true);
  const before = game.getState();
  assert(game.interactAt());
  const blast = game.getState();
  assert.equal(blast.items.length, 0);
  assert.equal(blast.barrels.length, 0);
  assert.equal(blast.terrain[5][10], TILE.FLOOR);
  assert.equal(blast.emitterOffline, true);
  assert.deepEqual(blast.logs.slice(0, 3).map(log => log.text[0]), ['①', '②', '③']);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  assert(game.interactAt());
  play(game, 'RURRDRR');
}

test('an empty save reaches all five acts with every optional flag off', () => {
  const saved = {};
  const { game } = campaign(saved);
  game.resetLevel();
  solveFirstAct(game);
  assert(game.commitVictory());

  assert(game.startLevel(2, []));
  play(game, 'RRRU');
  game.handleCanvasClick(5, 4);
  play(game, 'UUURRRDDDRR');
  assert(game.commitVictory());

  assert(game.startLevel(3, []));
  play(game, 'UURR');
  assert(game.interactAt(4, 3));
  play(game, 'RRRRRRDDR');
  assert(game.commitVictory());

  assert(game.startLevel(4, []));
  play(game, 'RR');
  game.waitTurn();
  play(game, 'RRDRRRUR');
  assert(game.commitVictory());
  assert.deepEqual(Object.values(saved.value.worldFlags), [false, false, false, false]);

  assert(game.startLevel(5, []));
  finishWithMirror(game);
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().endingId, 'ESCAPE');
  assert.equal(game.getState().turn, 16);
  assert(game.commitVictory());
  assert.equal(saved.value.completedLevels[5].ending, 'ESCAPE');
  assert.equal(saved.value.unlockedCharacters.length, 9);
});

test('four real relic pickups unlock the true ending via the archive shortcut', () => {
  const saved = {};
  const { game } = campaign(saved);
  game.resetLevel();
  play(game, 'RLDDRLDDRRRRUUUUDDDD');
  game.toggleSkill('JOSE');
  game.handleCanvasClick(6, 4);
  game.toggleSkill('REBECA');
  game.handleCanvasClick(6, 4);
  play(game, 'URRR');
  assert(game.commitVictory());

  assert(game.startLevel(2, []));
  play(game, 'RRRD');
  game.handleCanvasClick(5, 6);
  play(game, 'RRRRUU');
  game.toggleSkill('URSULA');
  game.handleCanvasClick(8, 3);
  play(game, 'URUUDDD');
  assert(game.commitVictory());

  assert(game.startLevel(3, []));
  play(game, 'DDRRRLULU');
  game.toggleSkill('URSULA');
  game.handleCanvasClick(3, 5);
  play(game, 'RURRDRRR');
  game.toggleSkill('AMARANTA');
  game.handleCanvasClick(8, 4);
  assert.equal(game.getState().curtains.length, 1);
  play(game, 'RDDRUU');
  assert(game.commitVictory());

  assert(game.startLevel(4, []));
  play(game, 'RRRR');
  game.waitTurn();
  play(game, 'DRRRUUURDD');
  assert(game.commitVictory());

  assert.deepEqual(Object.values(saved.value.worldFlags), [true, true, true, true]);
  assert.deepEqual([1, 2, 3, 4].map(id => saved.value.completedLevels[id].relicCollected), [true, true, true, true]);
  const reopened = campaign(saved).game;
  assert(reopened.startLevel(5, ['AURELIANO', 'URSULA', 'JOSE', 'PILAR']));
  assert.equal(reopened.getState().abilities.AURELIANO.charges, 2);
  assert.equal(reopened.getState().abilities.PILAR.unlocked, false);
  play(reopened, 'RDRRRRRRR');
  reopened.toggleSkill('REBECA');
  reopened.handleCanvasClick(10, 4);
  play(reopened, 'RUR');
  assert.equal(reopened.getState().status, 'WON');
  assert.equal(reopened.getState().endingId, 'TRUTH');
  assert(reopened.commitVictory());
  assert.equal(saved.value.completedLevels[5].ending, 'TRUTH');
});

test('the hurricane warning, collapse and defeat can be replayed exactly after undo', () => {
  const saved = { value: { schemaVersion: 1, unlockedLevels: [5] } };
  const run = campaign(saved);
  run.game.startLevel(5);
  assert.match(run.view.hazardLabel, /第 15 回合预警/);
  for (let turn = 1; turn <= 17; turn++) run.game.waitTurn();
  assert.equal(run.game.getState().status, 'PLAYING');
  const previous = run.game.getState();
  run.game.waitTurn();
  assert.equal(run.game.getState().status, 'DEAD');
  assert.equal(run.game.getState().terrain[5][1], 10);
  assert.match(run.view.ending.description, /飓风/);
  const collapsed = run.game.getState();
  run.game.undoMove();
  assert.deepEqual(run.game.getState(), previous);
  run.game.waitTurn();
  assert.deepEqual(run.game.getState(), collapsed);
});

test('a closed optical loop terminates instead of tracing forever', () => {
  const room = {
    ...LEVELS[0], id: 99, cols: 5, rows: 5, npcs: [], barrels: [], items: [],
    start: { x: 0, y: 0 },
    terrain: Array.from({ length: 5 }, () => Array(5).fill(0)),
    emitters: [{ x: 2, y: 1, dx: 1, dy: 0 }],
    mirrors: [
      { x: 1, y: 1, slash: true }, { x: 3, y: 1, slash: false },
      { x: 3, y: 3, slash: true }, { x: 1, y: 3, slash: false }
    ]
  };
  const game = createGame(() => {}, [room]);
  assert(game.startLevel(99));
  assert.equal(game.getState().laserTiles.length, 8);
});

test('a forged goldfish blocks two separate hits and undo restores the corresponding charge', () => {
  const terrain = Array.from({ length: 3 }, () => Array(5).fill(TILE.FLOOR));
  terrain[1][4] = TILE.LASER_EMITTER;
  const room = {
    ...LEVELS[0], id: 5, cols: 5, rows: 3, slots: 1, terrain,
    start: { x: 1, y: 1 }, npcs: [], barrels: [], items: [],
    emitters: [{ x: 4, y: 1, dx: -1, dy: 0 }]
  };
  const game = createGame(() => {}, [room], {
    read: () => ({
      schemaVersion: 1,
      unlockedCharacters: ['AURELIANO'],
      worldFlags: { GOLD_FISH_FORGED: true }
    })
  });
  assert(game.startLevel(5, ['AURELIANO']));
  assert.equal(game.getState().abilities.AURELIANO.charges, 2);
  play(game, 'R');
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().abilities.AURELIANO.charges, 1);
  play(game, 'R');
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().abilities.AURELIANO.charges, 0);
  play(game, 'L');
  assert.equal(game.getState().status, 'DEAD');
  game.undoMove();
  game.undoMove();
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().abilities.AURELIANO.charges, 1);
});

test('Pilar flips a gate immediately and the action uses one ordinary turn', () => {
  const { game } = campaign({ value: {
    schemaVersion: 1, unlockedLevels: [3], unlockedCharacters: ['PILAR']
  } });
  assert(game.startLevel(3, ['PILAR']));
  const initial = game.getState();
  assert.equal(initial.gates[0].open, false);
  game.toggleSkill('PILAR');
  assert.equal(game.getState().gates[0].open, true);
  assert.equal(game.getState().turn, 1);
  game.undoMove();
  assert.deepEqual(game.getState(), initial);
});

test('Canvas emitter nozzles point in the four configured beam directions', () => {
  const emitters = [
    { x: 2, y: 2, dx: -1, dy: 0 },
    { x: 4, y: 2, dx: 1, dy: 0 },
    { x: 2, y: 4, dx: 0, dy: -1 },
    { x: 4, y: 4, dx: 0, dy: 1 }
  ];
  const terrain = Array.from({ length: 7 }, () => Array(7).fill(TILE.FLOOR));
  for (const { x, y } of emitters) terrain[y][x] = TILE.LASER_EMITTER;
  const room = {
    ...LEVELS[0], id: 99, cols: 7, rows: 7, terrain, emitters,
    start: { x: 0, y: 0 }, npcs: [], barrels: [], items: []
  };
  const triangles = [];
  let points;
  const context = new Proxy({
    beginPath() { points = []; },
    moveTo(x, y) { points.push({ x, y }); },
    lineTo(x, y) { points.push({ x, y }); },
    fill() { if (points?.length === 3) triangles.push(points); },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const game = createGame(() => {}, [room]);
  const size = 40;
  assert(game.startLevel(99));
  game.setCanvas(context, size);
  game.drawBoard(0);
  for (const { x, y, dx, dy } of emitters) {
    const tipX = (x + 0.5 + dx * 0.43) * size;
    const tipY = (y + 0.5 + dy * 0.43) * size;
    assert(triangles.some(([, , tip]) => Math.hypot(tip.x - tipX, tip.y - tipY) < 0.001),
      `nozzle tip missing for (${dx}, ${dy})`);
  }
});

test('the legend and inspector describe nearby mechanisms and keyboard interaction is undoable', () => {
  const run = campaign({ value: { schemaVersion: 1, unlockedLevels: [2] } });
  const { game } = run;
  assert(game.startLevel(2));
  assert(run.view.legend.some(entry => entry.id === 'mist'));
  assert(game.inspectTile(5, 4).descriptions.some(entry => entry.id === 'mirror'));
  assert.equal(game.inspectTile(5, 4).distant, true);
  assert.equal(game.interactAt(), false);
  play(game, 'RRRU');
  const previous = game.getState();
  assert(run.view.interactions.some(action => action.label === '拨转铜镜' && action.ready));
  assert.equal(game.interactAt(), true);
  assert.equal(game.getState().mirrors[0].slash, !previous.mirrors[0].slash);
  game.undoMove();
  assert.deepEqual(game.getState(), previous);
});

test('a carried character gains exactly one charge when meeting the map character', () => {
  const room = { ...LEVELS[2], npcs: [{ id: 'REBECA', x: 1, y: 4 }] };
  const game = createGame(() => {}, [room], {
    read: () => ({ schemaVersion: 1, unlockedCharacters: ['REBECA'] })
  });
  assert(game.startLevel(3, ['REBECA']));
  assert.equal(game.getState().abilities.REBECA.charges, 1);
  play(game, 'U');
  assert.equal(game.getState().abilities.REBECA.charges, 2);
  play(game, 'UD');
  assert.equal(game.getState().abilities.REBECA.charges, 2);
  play(game, 'URR');
  game.toggleSkill('REBECA');
  game.handleCanvasClick(5, 3);
  assert.equal(game.getState().abilities.REBECA.charges, 1);
});

test('crossing the mist without the note delays the box skill on the relic route', () => {
  const run = campaign({ value: { schemaVersion: 1, unlockedLevels: [2] } });
  const { game } = run;
  assert(game.startLevel(2));
  play(game, 'URRR');
  assert(game.interactAt(5, 4));
  play(game, 'UUURRRDDDR');
  assert.deepEqual(game.getState().player, { x: 8, y: 4 });
  assert.equal(game.getState().memoRead, false);
  assert(run.view.cards.find(card => card.id === 'URSULA').blocked);
  game.toggleSkill('URSULA');
  game.handleCanvasClick(8, 3);
  assert.equal(game.getState().gates[0].open, false);
  play(game, 'DU');
  game.toggleSkill('URSULA');
  game.handleCanvasClick(8, 3);
  assert.equal(game.getState().gates[0].open, true);
  play(game, 'URUUDDD');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);
});

test('the rain chapter grants flight before the river and the finale rewards carrying it', () => {
  const { game } = campaign({ value: {
    schemaVersion: 1, unlockedLevels: [4, 5], unlockedCharacters: ['REMEDIOS']
  } });
  assert(game.startLevel(4, []));
  play(game, 'RR');
  game.toggleSkill('REMEDIOS');
  game.handleCanvasClick(6, 4);
  assert.deepEqual(game.getState().player, { x: 6, y: 4 });
  assert.equal(game.getState().status, 'PLAYING');

  assert(game.startLevel(5, ['REMEDIOS']));
  play(game, 'R');
  game.toggleSkill('REMEDIOS');
  game.handleCanvasClick(4, 5);
  play(game, 'RR');
  assert.equal(game.getState().turn, 4);
  assert(game.getState().abilities.BABYLON.unlocked);
  assert(game.interactAt());
  assert(game.interactAt());
  play(game, 'RURRDRR');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().turn, 13);
});
