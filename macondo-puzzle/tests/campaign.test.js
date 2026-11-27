const assert = require('node:assert/strict');
const test = require('node:test');
const { LEVELS, createGame } = require('../../miniprogram/game/macondo.js');

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
  play(reopened, 'RRRRRRRRUU');
  assert.equal(reopened.getState().status, 'WON');
  assert.equal(reopened.getState().turn, 10);
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
  play(game, 'UUURRRRRDD');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().turn, 15);
  game.startLevel(2, ['JOSE']);
  play(game, 'RRRD');
  game.handleCanvasClick(5, 6);
  assert.equal(game.getState().localFlags.BRIDGE_REPAIRED, true);
  play(game, 'RRRRRUUU');
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
  play(game, 'RURRDRRDDRRRUU');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);
  game.commitVictory();
  assert.equal(saved.value.worldFlags.ARCHIVE_INTACT, true);
  assert.equal(saved.value.worldFlags.GOLD_FISH_FORGED, true);

  game.startLevel(3, []);
  play(game, 'UURR');
  game.toggleSkill('REBECA');
  game.handleCanvasClick(5, 3);
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
  game.handleCanvasClick(2, 4);
  assert.equal(game.getState().turn, 0);
  assert.equal(game.getState().tideHigh, true);
  assert.equal(game.getState().boxes[0].x, 5);
  game.undoMove();
  assert.equal(game.getState().tideHigh, false);
  assert.equal(game.getState().boxes[0].x, 4);
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
  play(game, 'RRRRRUURDD');
  assert.equal(game.getState().status, 'WON');
  assert.equal(game.getState().relicCollected, true);
  game.commitVictory();

  saved.value.worldFlags.BRIDGE_REPAIRED = true;
  const reopened = campaign(saved).game;
  reopened.startLevel(4);
  assert.equal(reopened.getState().terrain[4][5], 3);
  play(reopened, 'RRRRRRRR');
  assert.equal(reopened.getState().status, 'WON');
  assert.equal(reopened.getState().turn, 8);
});
