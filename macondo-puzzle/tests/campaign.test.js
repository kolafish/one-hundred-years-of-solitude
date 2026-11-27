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
  const game = createGame(update => { view = update; }, [...LEVELS, wide]);
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
