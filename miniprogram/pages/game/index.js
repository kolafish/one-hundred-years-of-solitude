const { createGame, LEVELS } = require("../../game/macondo.js");
const MacondoIcons = require("../../game/icons.js");
const { KEY } = require("../../game/progress.js");
const SOUND_KEY = "macondo_relic_sound";

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
    hintCount: 1,
    showLegend: false,
    soundEnabled: true,
    tileDescriptions: [],
    canvasError: false,
    campaign: [],
    preparation: null,
    uiIcons: {
      undo: MacondoIcons.getIconDataUri("undo"),
      reset: MacondoIcons.getIconDataUri("reset"),
      hint: MacondoIcons.getIconDataUri("hint"),
      crest: MacondoIcons.getIconDataUri("crest"),
      quill: MacondoIcons.getIconDataUri("quill"),
      shield: MacondoIcons.getIconDataUri("shield"),
      scroll: MacondoIcons.getIconDataUri("scroll")
    },
    rows: [],
    columns: [],
    boardRatio: 80
  },

  onLoad() {
    try {
      if (wx.getStorageSync(SOUND_KEY) === "off") this.setData({ soundEnabled: false });
    } catch {}
    this.game = createGame(({ level, ...view }) => {
      const sameAct = level.id === this.data.level?.id;
      if (!sameAct) this.inspectedTile = null;
      const tile = this.inspectedTile;
      const tileDescriptions = tile ? this.game.inspectTile(tile.x, tile.y)?.descriptions || [] : [];
      const update = { level, ...view, tileDescriptions, logs: view.logs.slice(0, 30) };
      if (view.relicCollected !== Boolean(this.relicCollected)) {
        if (view.relicCollected && this.data.soundEnabled && this.visible) this.playRelicSound();
        else this.relicSound?.stop();
        this.relicCollected = view.relicCollected;
      }
      if (sameAct) {
        this.setData(update);
        return;
      }
      const chapter = LEVELS.find(act => act.id === level.id);
      this.setData({
        ...update,
        hasInteractions: ["mirrors", "repairs", "fuses", "seals"].some(kind => chapter?.[kind]?.length),
        hintCount: 1,
        rows: Array.from({ length: level.rows }, (_, row) => row),
        columns: Array.from({ length: level.cols }, (_, col) => col),
        boardRatio: (level.rows / level.cols) * 100
      }, () => {
        if (this.boardReady) this.prepareBoard();
      });
    }, LEVELS, {
      read: () => wx.getStorageSync(KEY),
      write: progress => wx.setStorageSync(KEY, progress)
    });
    this.game.resetLevel();
  },

  onReady() {
    this.boardReady = true;
    this.prepareBoard();
    this.prepareRelicSound();
  },

  onShow() {
    this.visible = true;
    this.startDrawing();
  },

  onHide() {
    this.visible = false;
    this.stopDrawing();
    this.relicSound?.stop();
  },

  onUnload() {
    this.visible = false;
    this.stopDrawing();
    this.relicSound?.destroy();
    this.relicSound = null;
    this.game = null;
    this.canvas = null;
  },

  onResize() {
    this.prepareBoard();
  },

  prepareRelicSound() {
    if (this.relicSound || !wx.createInnerAudioContext) return;
    try {
      this.relicSound = wx.createInnerAudioContext();
      this.relicSound.obeyMuteSwitch = true;
      this.relicSound.src = "/assets/relic-chime.mp3";
    } catch {}
  },

  playRelicSound() {
    this.relicSound?.play();
  },

  toggleSound() {
    const soundEnabled = !this.data.soundEnabled;
    if (!soundEnabled) this.relicSound?.stop();
    this.setData({ soundEnabled });
    try { wx.setStorageSync(SOUND_KEY, soundEnabled ? "on" : "off"); } catch {}
  },

  prepareBoard() {
    if (!this.data.level) return;
    const levelId = this.data.level.id;
    this.createSelectorQuery().select("#game-canvas").fields({ node: true, size: true }).exec((result) => {
      if (!this.game || this.data.level.id !== levelId) return;
      const board = result && result[0];
      if (!board || !board.node || !board.width || !board.height) {
        this.setData({ canvasError: true });
        return;
      }

      const canvas = board.node;
      const pixelRatio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 1;
      const width = Math.round(board.width * pixelRatio);
      const height = Math.round(board.height * pixelRatio);
      const tileSize = board.width / this.data.level.cols;
      if (canvas === this.canvas && width === canvas.width && height === canvas.height && tileSize === this.tileSize) {
        if (this.data.canvasError) this.setData({ canvasError: false });
        this.startDrawing();
        return;
      }
      this.stopDrawing();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.scale(canvas.width / board.width, canvas.height / board.height);
      if (this.canvas !== canvas && typeof canvas.createImage === "function") {
        this.game.loadPlayerTokenImage(canvas.createImage(), "/assets/player-token.png");
      }
      this.canvas = canvas;
      this.tileSize = tileSize;
      this.game.setCanvas(context, tileSize);
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
      const x = Number(col);
      const y = Number(row);
      const tile = this.game.inspectTile(x, y);
      if (this.data.inspecting && tile?.distant) {
        this.inspectedTile = { x, y };
        this.setData({ tileDescriptions: tile.descriptions });
        return;
      }
      this.game.handleCanvasClick(x, y);
    }
  },

  useInteraction(event) {
    const { x, y } = event.currentTarget.dataset;
    this.game.interactAt(Number(x), Number(y));
  },

  toggleLegend() {
    this.setData({ showLegend: !this.data.showLegend });
  },

  move(event) {
    const { dx, dy } = event.currentTarget.dataset;
    this.game.tryMove(Number(dx), Number(dy));
  },

  waitTurn() {
    this.game.waitTurn();
  },

  useSkill(event) {
    this.game.toggleSkill(event.currentTarget.dataset.skill);
  },

  undo() {
    this.game.undoMove();
  },

  reset() {
    this.inspectedTile = null;
    this.game.resetLevel();
  },

  toggleHints() {
    this.setData({ showHints: !this.data.showHints });
  },

  revealHint() {
    this.setData({ hintCount: Math.min(this.data.hintCount + 1, this.data.level.hints.length) });
  },

  cancelDecision() {
    this.game.resolveDecision(false);
  },

  confirmDecision() {
    this.game.resolveDecision(true);
  },

  selectAct(event) {
    this.openPreparation(Number(event.currentTarget.dataset.id));
  },

  openPreparation(id, selected) {
    const draft = this.game.preparation(id, selected);
    if (!draft) return;
    const hints = this.data.campaign.find(act => act.id === id).causalHints;
    const choices = draft.choices.map(character => ({
      ...character,
      selected: draft.picked.includes(character.id),
      disabled: !character.unlocked || (!draft.picked.includes(character.id) && draft.picked.length >= draft.slots)
    }));
    this.setData({ preparation: { ...draft, choices, hints } });
  },

  toggleCompanion(event) {
    const { id, picked } = this.data.preparation;
    const character = event.currentTarget.dataset.id;
    this.openPreparation(id, picked.includes(character) ? picked.filter(item => item !== character) : [...picked, character]);
  },

  closePreparation() {
    this.setData({ preparation: null });
  },

  beginAct() {
    const { id, picked } = this.data.preparation;
    const inspectedTile = this.inspectedTile;
    this.inspectedTile = null;
    if (this.game.startLevel(id, picked)) this.setData({ preparation: null, showHints: false, showLegend: false });
    else this.inspectedTile = inspectedTile;
  },

  settle() {
    if (!this.game.commitVictory()) return;
    const next = this.data.campaign.find(act => act.id > this.data.level.id && act.unlocked);
    this.openPreparation(next ? next.id : this.data.level.id);
  },

  onShareAppMessage() {
    return {
      title: "马孔多的羊皮纸",
      path: "/pages/game/index"
    };
  }
});
