const { COLS, ROWS, createGame } = require("../../game/macondo.js");
const MacondoIcons = require("../../game/icons.js");

Page({
  data: {
    turn: 0,
    canUndo: false,
    banner: "",
    bannerIconUri: "",
    ending: null,
    cards: [],
    logs: [],
    showHints: false,
    canvasError: false,
    uiIcons: {
      undo: MacondoIcons.getIconDataUri("undo"),
      reset: MacondoIcons.getIconDataUri("reset"),
      hint: MacondoIcons.getIconDataUri("hint"),
      crest: MacondoIcons.getIconDataUri("crest"),
      quill: MacondoIcons.getIconDataUri("quill"),
      shield: MacondoIcons.getIconDataUri("shield"),
      scroll: MacondoIcons.getIconDataUri("scroll")
    },
    rows: Array.from({ length: ROWS }, (_, row) => row),
    columns: Array.from({ length: COLS }, (_, col) => col)
  },

  onLoad() {
    this.game = createGame((view) => {
      this.setData({ ...view, logs: view.logs.slice(0, 30) });
    });
    this.game.resetLevel();
  },

  onReady() {
    this.prepareBoard();
  },

  onShow() {
    this.visible = true;
    this.startDrawing();
  },

  onHide() {
    this.visible = false;
    this.stopDrawing();
  },

  onUnload() {
    this.visible = false;
    this.stopDrawing();
    this.game = null;
    this.canvas = null;
  },

  onResize() {
    this.prepareBoard();
  },

  prepareBoard() {
    this.createSelectorQuery().select("#game-canvas").fields({ node: true, size: true }).exec((result) => {
      if (!this.game) return;
      const board = result && result[0];
      if (!board || !board.node || !board.width || !board.height) {
        this.setData({ canvasError: true });
        return;
      }

      this.stopDrawing();
      const canvas = board.node;
      const pixelRatio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 1;
      canvas.width = Math.round(board.width * pixelRatio);
      canvas.height = Math.round(board.height * pixelRatio);
      const context = canvas.getContext("2d");
      context.scale(canvas.width / board.width, canvas.height / board.height);
      this.canvas = canvas;
      this.game.setCanvas(context, board.width / COLS);
      this.setData({ canvasError: false });
      this.startDrawing();
    });
  },

  startDrawing() {
    if (!this.visible || !this.canvas || this.frameId != null) return;
    const draw = (time) => {
      this.frameId = null;
      if (!this.visible || !this.game) return;
      this.game.drawBoard(time);
      this.frameId = this.canvas.requestAnimationFrame(draw);
    };
    this.frameId = this.canvas.requestAnimationFrame(draw);
  },

  stopDrawing() {
    if (this.frameId == null) return;
    this.canvas.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  },

  tapTile(event) {
    const { col, row } = event.target.dataset;
    if (col !== undefined && row !== undefined) {
      this.game.handleCanvasClick(Number(col), Number(row));
    }
  },

  move(event) {
    const { dx, dy } = event.currentTarget.dataset;
    this.game.tryMove(Number(dx), Number(dy));
  },

  useSkill(event) {
    this.game.toggleSkill(event.currentTarget.dataset.skill);
  },

  undo() {
    this.game.undoMove();
  },

  reset() {
    this.game.resetLevel();
  },

  toggleHints() {
    this.setData({ showHints: !this.data.showHints });
  },

  onShareAppMessage() {
    return {
      title: "马孔多的羊皮纸",
      path: "/pages/game/index"
    };
  }
});
