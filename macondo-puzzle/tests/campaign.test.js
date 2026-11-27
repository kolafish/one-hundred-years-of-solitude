const assert = require('node:assert/strict');
const test = require('node:test');
const { LEVELS, createGame } = require('../../miniprogram/game/macondo.js');
const { TILE } = require('../../miniprogram/game/levels.js');

function play(game, steps) {
  const moves = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
  for (const direction of steps) {
    const turn = game.getState().turn;
    game.tryMove(...moves[direction]);
    const current = game.getState();
    assert.equal(current.turn, turn + 1, direction + ' → ' + JSON.stringify(current.player));
    assert.notEqual(current.status, 'DEAD', current.deathReason);
  }
}

function use(game, ability, x, y) {
  const turn = game.getState().turn;
  game.toggleSkill(ability);
  game.handleCanvasClick(x, y);
  assert.equal(game.getState().turn, turn + 1, ability);
}

function waitTo(game, turn) {
  while (game.getState().turn < turn) {
    const previous = game.getState().turn;
    game.waitTurn();
    assert.equal(game.getState().turn, previous + 1);
    assert.equal(game.getState().status, 'PLAYING');
  }
}

function campaign(saved = {}, levels = LEVELS) {
  let view;
  return {
    game: createGame(update => { view = update; }, levels, {
      read: () => saved.value,
      write: value => { saved.value = structuredClone(value); }
    }),
    get view() { return view; }
  };
}

function unlocked(ids, characters = [], flags = {}, completedLevels = {}) {
  return { value: {
    schemaVersion: 1, unlockedLevels: ids, unlockedCharacters: characters, worldFlags: flags, completedLevels
  } };
}

function solveFirst(game, rewards = false) {
  play(game, 'RR');
  use(game, 'JOSE', 3, 2);
  if (rewards) {
    play(game, 'U');
    assert.equal(game.getState().gates[0].open, false);
    use(game, 'JOSE', 2, 2);
    play(game, 'LLUUDDDRDRURR');
    play(game, 'URRDRR');
  } else {
    play(game, 'RRURRDRR');
  }
  use(game, 'REBECA', 10, 5);
  play(game, 'RDRR');
}

function turnMirror(game) {
  play(game, 'RRRU');
  assert(game.interactAt(5, 4));
}

function solveSecondSouth(game) {
  turnMirror(game);
  play(game, 'DD');
  assert(game.interactAt(5, 6));
  play(game, 'RRRRURU');
}

function solveSecondRelic(game, withJose = false) {
  turnMirror(game);
  play(game, 'UUURRRDD');
  if (withJose) {
    use(game, 'JOSE', 8, 2);
    play(game, 'RRUUDDD');
  } else {
    play(game, 'DR');
    use(game, 'URSULA', 8, 3);
    play(game, 'URUUDDD');
  }
}

function solveThirdArchive(game) {
  play(game, 'R');
  use(game, 'JOSE', 3, 2);
  play(game, 'DRRRUR');
  waitTo(game, 11);
  play(game, 'RRRUUDDUDDDR');
  game.waitTurn();
  play(game, 'LLRRUU');
}

function enterRain(game) {
  play(game, 'UR');
  use(game, 'REMEDIOS', 6, 4);
}

function solveFourthSouth(game, relic = false) {
  enterRain(game);
  waitTo(game, 10);
  play(game, relic ? 'DRRUURRUDD' : 'DRRRRU');
}

function prepareFinale(game, path = 'RDRRURR') {
  play(game, path);
  assert(game.interactAt(6, 5));
  assert(game.getState().seals[0].open);
  play(game, 'R');
  use(game, 'URSULA', 7, 4);
}

function finishWithMirror(game) {
  prepareFinale(game);
  play(game, 'L');
  const before = game.getState();
  assert(game.interactAt(6, 4));
  const blast = game.getState();
  assert.equal(blast.items.length, 0);
  assert.equal(blast.barrels.length, 0);
  assert.equal(blast.terrain[5][10], TILE.FLOOR);
  assert.equal(blast.emitterOffline, true);
  assert.deepEqual(blast.logs.slice(0, 3).map(log => log.text[0]), ['①', '②', '③']);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  assert(game.interactAt(6, 4));
  play(game, 'RURRRDR');
}

test('first act teaches the three abilities in order and the green beam costs no shield', () => {
  const run = campaign();
  const { game } = run;
  game.resetLevel();
  assert.deepEqual([run.view.level.cols, run.view.level.rows], [14, 8]);
  assert.equal(game.getState().abilities.JOSE.unlocked, false);
  play(game, 'RR');
  use(game, 'JOSE', 3, 2);
  play(game, 'RRURR');
  assert.deepEqual(game.getState().player, { x: 7, y: 3 });
  assert.match(game.getState().logs[0].text, /安全示范/);
  assert.equal(game.getState().abilities.AURELIANO.charges, 1);
  assert(run.view.forecast.moves.some(move => move.x === 7 && move.y === 4 && move.label === '护盾 −1'));
  play(game, 'DRR');
  assert.equal(game.getState().abilities.AURELIANO.charges, 0);
  use(game, 'REBECA', 10, 5);
  play(game, 'RDRR');
  assert.equal(game.getState().turn, 16);
  assert.equal(game.getState().status, 'WON');
  game.undoMove();
  assert.equal(game.getState().turn, 15);
  play(game, 'R');
  assert.equal(game.getState().status, 'WON');
});

test('old saves retain their format and only settled chapter rewards open later routes', () => {
  const saved = {};
  const run = campaign(saved);
  const { game } = run;
  game.resetLevel();
  assert.equal(game.startLevel(2), false);
  solveFirst(game, true);
  assert.equal(game.getState().abilities.JOSE.charges, 0);
  assert.equal(game.getState().localFlags.ICE_PRESERVED, true);
  assert.match(run.view.ending.causal[0], /第二幕/);
  assert.equal(run.view.ending.relic, '已找到本幕残页。');
  assert.equal(saved.value, undefined);
  game.undoMove();
  assert.equal(game.commitVictory(), false);
  play(game, 'R');
  assert(game.commitVictory());
  assert.equal(game.commitVictory(), false);
  assert.equal(saved.value.schemaVersion, 1);
  const reopened = campaign(saved).game;
  assert(reopened.startLevel(2, ['JOSE', 'REBECA']));
  assert.deepEqual(reopened.preparation(2, ['JOSE', 'REBECA']).picked, ['JOSE']);
  assert.equal(reopened.getState().terrain[5][5], TILE.FLOOR);
  assert(reopened.getState().gates.filter(gate => gate.mirror).every(gate => !gate.open));
  turnMirror(reopened);
  play(reopened, 'DRRRRRU');
  assert.equal(reopened.getState().status, 'WON');
  assert.equal(reopened.getState().turn, 12);
});

test('the three second-act routes use the mirror, and the southbridge flag settles separately', () => {
  const saved = unlocked([2], ['JOSE']);
  const run = campaign(saved);
  const { game } = run;
  assert(game.startLevel(2));
  assert.equal(game.getState().mirrors[0].slash, true);
  assert([5, 6].every(y => game.getState().laserTiles.some(tile => tile.x === 5 && tile.y === y)));
  solveSecondSouth(game);
  assert.equal(game.getState().turn, 15);
  assert.match(run.view.ending.causal[0], /第四幕/);
  assert.match(run.view.ending.relic, /北侧/);
  assert(game.commitVictory());
  assert.equal(saved.value.worldFlags.BRIDGE_REPAIRED, true);
  assert(game.startLevel(2, []));
  solveSecondRelic(game);
  assert.equal(game.getState().relicCollected, true);
  assert.equal(game.getState().turn, 23);
  assert(game.startLevel(2, ['JOSE']));
  solveSecondRelic(game, true);
  assert.equal(game.getState().relicCollected, true);
  assert.equal(game.getState().turn, 21);
});

test('mist seals an obtained active skill unless the protagonist has the note or Ursula', () => {
  const run = campaign(unlocked([2], ['JOSE', 'URSULA']));
  const { game } = run;
  for (const [carried, opening, blocked] of [
    [['JOSE'], 'URRR', true],
    [['JOSE'], 'URRDRU', false],
    [['URSULA'], 'URRR', false]
  ]) {
    assert(game.startLevel(2, carried));
    play(game, opening);
    assert(game.interactAt(5, 4));
    play(game, 'UUURRRD');
    assert.equal(run.view.cards.find(card => card.id === carried[0]).blocked, blocked);
  }
});

test('archive cost requires explicit confirmation and a cancel changes no turn or tiles', () => {
  const run = campaign(unlocked([3], ['REBECA']));
  const { game } = run;
  assert(game.startLevel(3, []));
  play(game, 'UURR');
  const before = game.getState();
  assert(game.interactAt(4, 3));
  assert.match(run.view.decision.detail, /第五幕.*秘道/);
  assert.deepEqual(game.getState(), before);
  game.tryMove(1, 0);
  assert.deepEqual(game.getState(), before);
  game.resolveDecision(false);
  assert.equal(run.view.decision, null);
  assert.deepEqual(game.getState(), before);
  assert(game.interactAt(4, 3));
  game.resolveDecision(true);
  assert.equal(game.getState().archiveDestroyed, true);
  assert.equal(game.getState().turn, before.turn + 1);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  assert(game.interactAt(4, 3));
  game.resolveDecision(true);
  play(game, 'RRRRRRDDR');
  assert.equal(game.getState().localFlags.ARCHIVE_INTACT, undefined);
  assert(game.commitVictory());
  assert(game.startLevel(3, ['REBECA']));
  play(game, 'UU');
  game.toggleSkill('REBECA');
  game.handleCanvasClick(5, 3);
  assert.match(run.view.decision.title, /档案/);
  assert.equal(game.getState().turn, 2);
});

test('the workshop offers both intact routes and forges gold without granting Pilar', () => {
  const run = campaign(unlocked([3], ['JOSE', 'REBECA']));
  const { game } = run;
  assert(game.startLevel(3, ['JOSE']));
  solveThirdArchive(game);
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);
  assert.equal(game.getState().localFlags.GOLD_FISH_FORGED, true);
  assert.equal(game.getState().localFlags.ARCHIVE_INTACT, true);
  assert.equal(run.view.ending.causal.length, 2);
  const room = { ...LEVELS[2], npcs: LEVELS[2].npcs.filter(npc => npc.id !== 'PILAR') };
  const separate = campaign(unlocked([3], ['JOSE']), [room]).game;
  assert(separate.startLevel(3, ['JOSE']));
  solveThirdArchive(separate);
  assert.equal(separate.getState().localFlags.GOLD_FISH_FORGED, true);
  assert.equal(separate.getState().abilities.PILAR.unlocked, false);

  assert(game.startLevel(3, ['REBECA']));
  play(game, 'RU');
  use(game, 'REBECA', 5, 4);
  play(game, 'RRRDR');
  waitTo(game, 11);
  play(game, 'RRRR');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().localFlags.ARCHIVE_INTACT, true);
});

test('forecast matches a real guard move and can be removed by a black curtain', () => {
  const room = {
    ...LEVELS[2], cols: 6, rows: 4, start: { x: 3, y: 2 },
    terrain: Array.from({ length: 4 }, () => Array(6).fill(TILE.FLOOR)),
    npcs: [], barrels: [], boxes: [], gates: [], levers: [], fuses: [], items: [],
    guards: [{ path: [{ x: 1, y: 1 }, { x: 2, y: 1 }] }]
  };
  const run = campaign(unlocked([3], ['AMARANTA']), [room]);
  const { game } = run;
  assert(game.startLevel(3, ['AMARANTA']));
  const before = game.getState();
  assert(run.view.forecast.guardTiles.some(tile => tile.x === 4 && tile.y === 2));
  assert(run.view.forecast.moves.some(tile => tile.x === 4 && tile.y === 2 && tile.label === '致命'));
  game.tryMove(1, 0);
  assert.equal(game.getState().deathReason, 'guard');
  assert.equal(run.view.ending.iconId, 'patrol');
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  use(game, 'AMARANTA', 3, 1);
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().curtains.length, 1);
  assert(!run.view.forecast.moves.some(tile => tile.x === 3 && tile.y === 1));
});

test('Pilar advances one turn and flips tide and direction, leaving the gate untouched', () => {
  const run = campaign(unlocked([3, 4], ['PILAR', 'AURELIANO'], { GOLD_FISH_FORGED: true }));
  const { game } = run;
  assert(game.startLevel(4, ['AURELIANO', 'PILAR']));
  const before = game.getState();
  assert.equal(before.abilities.AURELIANO.charges, 2);
  assert.equal(before.terrain[7][5], TILE.WATER);
  game.toggleSkill('PILAR');
  assert.equal(game.getState().turn, 1);
  assert.equal(game.getState().tideHigh, true);
  assert.equal(game.getState().reversed, true);
  assert.equal(game.getState().barrels[0].x, 5);
  assert.equal(game.getState().gates[0].open, false);
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  assert(game.startLevel(3, ['PILAR']));
  game.toggleSkill('PILAR');
  assert.equal(game.getState().turn, 1);
  assert.equal(game.getState().gates[0].open, false);
});

test('the shallow crossing forecasts tide, and a shield cannot absorb flood damage', () => {
  const run = campaign(unlocked([4], ['AURELIANO']));
  const { game } = run;
  assert(game.startLevel(4, ['AURELIANO']));
  play(game, 'UR');
  waitTo(game, 5);
  assert.equal(run.view.forecast.tideRising, true);
  assert(run.view.forecast.moves.some(move => move.cause === 'tide' && move.label === '致命'));
  const before = game.getState();
  game.tryMove(1, 0);
  assert.equal(game.getState().deathReason, 'tide');
  assert.equal(game.getState().abilities.AURELIANO.charges, 1);
  assert.equal(run.view.ending.iconId, 'river');
  game.undoMove();
  assert.deepEqual(game.getState(), before);
});

test('one drifting barrel supports the two exits and the saved bridge is at the south crossing', () => {
  const run = campaign(unlocked([4], ['JOSE', 'URSULA', 'MELQUIADES'], { BRIDGE_REPAIRED: true }));
  const { game } = run;
  assert(game.startLevel(4, ['MELQUIADES']));
  assert.equal(game.getState().terrain[7][5], TILE.BRIDGE);
  assert.equal(game.getState().barrels.length + game.getState().boxes.length, 1);
  play(game, 'DRDRRU');
  use(game, 'MELQUIADES', 6, 5);
  play(game, 'RRRRU');
  assert.equal(game.getState().turn, 12);
  assert.equal(game.getState().status, 'WON');

  assert(game.startLevel(4, ['JOSE']));
  use(game, 'JOSE', 4, 2);
  enterRain(game);
  waitTo(game, 6);
  assert(game.interactAt(6, 3));
  assert.equal(game.getState().terrain[2][7], TILE.FLOOR);
  play(game, 'UURRRRDD');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);

  const alternate = campaign(unlocked([4], ['URSULA'])).game;
  assert(alternate.startLevel(4, ['URSULA']));
  play(alternate, 'UR');
  use(alternate, 'URSULA', 5, 4);
  play(alternate, 'R');
  waitTo(alternate, 18);
  play(alternate, 'R');
  assert(alternate.interactAt(6, 3));
  play(alternate, 'UURRRRDD');
  assert.equal(alternate.getState().status, 'WON');
});

test('a new player can finish all five chapters without companions in the loadout', () => {
  const saved = {};
  const run = campaign(saved);
  const { game } = run;
  game.resetLevel();
  solveFirst(game);
  assert(game.commitVictory());
  assert(game.startLevel(2, []));
  turnMirror(game);
  play(game, 'UUURRRDDDRR');
  assert(game.commitVictory());
  assert(game.startLevel(3, []));
  play(game, 'UURR');
  assert(game.interactAt(4, 3));
  game.resolveDecision(true);
  play(game, 'RRRRRRDDR');
  assert(game.commitVictory());
  assert(game.startLevel(4, []));
  solveFourthSouth(game);
  assert(game.commitVictory());
  assert(Object.values(saved.value.worldFlags).every(value => !value));
  assert(game.startLevel(5, []));
  finishWithMirror(game);
  assert.equal(game.getState().turn, 19);
  assert.equal(game.getState().endingId, 'ESCAPE');
  assert.equal(run.view.ending.missingRelics.length, 4);
  assert(LEVELS[4].parTurns <= game.getState().turn + 2);
  assert(game.commitVictory());
  assert.equal(saved.value.completedLevels[5].ending, 'ESCAPE');
});

test('four relics unlock the true ending and the archive alternate still requires the seal', () => {
  const saved = {};
  const { game } = campaign(saved);
  game.resetLevel();
  solveFirst(game, true);
  assert(game.commitVictory());
  assert(game.startLevel(2, ['JOSE']));
  solveSecondRelic(game, true);
  assert(game.commitVictory());
  assert(game.startLevel(3, ['JOSE']));
  solveThirdArchive(game);
  assert(game.commitVictory());
  assert(game.startLevel(4, []));
  solveFourthSouth(game, true);
  assert(game.commitVictory());
  assert([1, 2, 3, 4].every(id => saved.value.completedLevels[id].relicCollected));

  assert(game.startLevel(5, ['REBECA']));
  play(game, 'RDD');
  assert.equal(game.getState().abilities.REBECA.charges, 2);
  play(game, 'URRURR');
  assert.equal(game.getState().seals[0].open, false);
  assert(game.interactAt(6, 5));
  play(game, 'R');
  use(game, 'URSULA', 7, 4);
  play(game, 'UR');
  use(game, 'REBECA', 9, 4);
  use(game, 'REBECA', 10, 4);
  play(game, 'RRDR');
  assert.equal(game.getState().endingId, 'TRUTH');
  assert(game.commitVictory());
  assert.equal(saved.value.completedLevels[5].ending, 'TRUTH');
});

test('hurricane starts at turn 14, with turn 10 warning and deterministic undo', () => {
  const run = campaign(unlocked([5]));
  const { game } = run;
  assert(game.startLevel(5));
  assert.match(run.view.hazardLabel, /第 10 回合预警/);
  waitTo(game, 10);
  assert(game.getState().logs.some(log => /开始围拢/.test(log.text)));
  waitTo(game, 13);
  const before = game.getState();
  game.waitTurn();
  const collapsed = game.getState();
  assert.equal(collapsed.terrain[5][1], TILE.RUBBLE);
  assert.equal(collapsed.deathReason, 'hurricane');
  assert.equal(run.view.ending.iconId, 'hurricane');
  game.undoMove();
  assert.deepEqual(game.getState(), before);
  game.waitTurn();
  assert.deepEqual(game.getState(), collapsed);
});

test('flight offers a faster first-act replay and a final-act route', () => {
  const run = campaign(unlocked([5], ['REMEDIOS'], {}, { 1: { bestTurns: 16, rank: 'S' } }));
  const { game } = run;
  assert(game.startLevel(1, ['REMEDIOS']));
  play(game, 'RR');
  use(game, 'REMEDIOS', 5, 4);
  play(game, 'URRDRR');
  use(game, 'REBECA', 10, 5);
  play(game, 'RDRR');
  assert.equal(game.getState().turn, 14);
  assert.equal(game.getState().status, 'WON');

  assert(game.startLevel(5, ['REMEDIOS']));
  play(game, 'R');
  use(game, 'REMEDIOS', 4, 5);
  prepareFinale(game, 'DURR');
  play(game, 'L');
  assert(game.interactAt(6, 4));
  play(game, 'RURRRDR');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().turn, 18);
});

test('map dimensions, boundary clicks, hazards and reset follow the loaded act', () => {
  const wide = {
    ...LEVELS[0], id: 99, cols: 13, rows: 9,
    start: { x: 11, y: 8 }, npcs: [], barrels: [], boxes: [], gates: [], practiceBeams: [],
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

test('a closed optical loop terminates instead of tracing forever', () => {
  const room = {
    ...LEVELS[0], id: 99, cols: 5, rows: 5, npcs: [], barrels: [], boxes: [], gates: [], practiceBeams: [], items: [],
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

test('the beam forecast agrees with a two-charge shield and a beam defeat', () => {
  const terrain = Array.from({ length: 3 }, () => Array(5).fill(TILE.FLOOR));
  terrain[1][4] = TILE.LASER_EMITTER;
  const room = {
    ...LEVELS[0], id: 5, cols: 5, rows: 3, slots: 1, terrain,
    start: { x: 1, y: 1 }, npcs: [], barrels: [], boxes: [], gates: [], practiceBeams: [], items: [],
    emitters: [{ x: 4, y: 1, dx: -1, dy: 0 }]
  };
  const run = campaign(unlocked([5], ['AURELIANO'], { GOLD_FISH_FORGED: true }), [room]);
  const { game } = run;
  assert(game.startLevel(5, ['AURELIANO']));
  assert.equal(game.getState().abilities.AURELIANO.charges, 2);
  play(game, 'R');
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().abilities.AURELIANO.charges, 1);
  play(game, 'R');
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().abilities.AURELIANO.charges, 0);
  assert(run.view.forecast.moves.some(move => move.cause === 'beam' && move.label === '致命'));
  game.tryMove(-1, 0);
  assert.equal(game.getState().status, 'DEAD');
  assert.equal(run.view.ending.iconId, 'sunbeam');
  game.undoMove();
  game.undoMove();
  assert.equal(game.getState().status, 'PLAYING');
  assert.equal(game.getState().abilities.AURELIANO.charges, 1);
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
    start: { x: 0, y: 0 }, npcs: [], barrels: [], boxes: [], gates: [], practiceBeams: [], items: []
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
  play(game, 'UURR');
  game.toggleSkill('REBECA');
  game.handleCanvasClick(5, 4);
  assert.equal(game.getState().abilities.REBECA.charges, 1);
});
