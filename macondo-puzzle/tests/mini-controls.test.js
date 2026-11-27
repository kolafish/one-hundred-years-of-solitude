const assert = require('node:assert/strict');
const test = require('node:test');

let definition;
global.Page = page => { definition = page; };
global.wx = { getStorageSync() {}, setStorageSync() {} };
require('../../miniprogram/pages/game/index.js');

function startGame() {
  const page = {
    ...definition,
    data: structuredClone(definition.data),
    setData(update, done) {
      Object.assign(this.data, update);
      done?.();
    }
  };
  page.onLoad();
  return page;
}

const touch = (clientX, clientY, identifier = 0) => ({ clientX, clientY, identifier });
const start = touch(100, 100);

function swipe(page, dx, dy) {
  const end = touch(start.clientX + dx, start.clientY + dy);
  page.startBoardTouch({ touches: [start] });
  page.trackBoardTouch({ touches: [end] });
  page.endBoardTouch({ touches: [], changedTouches: [end] });
  return end;
}

function tap(page, col, row, changedTouches) {
  page.tapTile({ target: { dataset: { col, row } }, changedTouches });
}

test('a board swipe moves exactly one tile in the dominant direction', () => {
  const page = startGame();
  for (const [dx, dy, x, y] of [[90, 18, 2, 4], [6, 80, 2, 5], [-50, 8, 1, 5], [5, -40, 1, 4]]) {
    swipe(page, dx, dy);
    assert.deepEqual(page.game.getState().player, { x, y });
  }
  assert.equal(page.data.turn, 4);
  const end = swipe(page, -90, 0); // The wall blocks the move.
  tap(page, 2, 4, [end]); // A tap emitted for that swipe must not cause a second action.
  assert.equal(page.data.turn, 4);
  swipe(page, 3, 2); // A new, slight touch can still be an ordinary tap.
  tap(page, 2, 4, [start]);
  assert.equal(page.data.turn, 5);
  tap(page, 1, 1);
  assert.equal(page.data.tileDescriptions[0].id, 'relic');
});

test('cancelled, reversed, and multi-touch gestures do not walk or select a tile', () => {
  const page = startGame();
  const end = touch(140, 100);
  page.startBoardTouch({ touches: [start] });
  page.trackBoardTouch({ touches: [end] });
  page.endBoardTouch({ touches: [], changedTouches: [start] });
  tap(page, 2, 4, [start]);
  page.startBoardTouch({ touches: [start] });
  page.cancelBoardTouch();
  page.endBoardTouch({ touches: [], changedTouches: [end] });
  page.startBoardTouch({ touches: [start] });
  page.trackBoardTouch({ touches: [end, touch(180, 110, 1)] });
  page.endBoardTouch({ touches: [], changedTouches: [end] });
  assert.equal(page.data.turn, 0);
});

test('swiping leaves an active skill ready for its original tap target', () => {
  const page = startGame();
  swipe(page, 50, 0);
  swipe(page, 50, 0);
  page.game.toggleSkill('JOSE');
  const end = swipe(page, 0, 50);
  tap(page, 4, 4, [end]);
  assert.equal(page.data.turn, 2);
  assert.equal(page.data.inspecting, false);
  tap(page, 4, 4);
  tap(page, 3, 2);
  assert.equal(page.data.turn, 3);
  assert.deepEqual(page.game.getState().boxes[0], { x: 3, y: 2 });
});
