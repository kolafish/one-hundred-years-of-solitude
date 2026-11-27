// Shared chapter data for the browser and WeChat.
const MacondoLevels = (() => {
  const TILE = {
    FLOOR: 0,
    WALL: 1,
    WATER: 2,
    BRIDGE: 3,
    CRACKED_WALL: 4, // 必须由火药桶爆炸摧毁的裂纹石墙
    GOAL: 5,         // 梅尔基亚德斯的羊皮纸密室
    HOT: 7,
    MIST: 8,
    SHALLOWS: 9,
    RUBBLE: 10,
    LASER_EMITTER: 6 // 烈日放大镜发射器（向下发射光束）
  };

  const terrain = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // y=0
    [1, 0, 0, 2, 6, 0, 2, 1, 1, 1], // y=1: (4,1) 烈日发射器
    [1, 0, 1, 2, 0, 0, 2, 1, 1, 1], // y=2: (5,2) 丽贝卡
    [1, 0, 0, 2, 0, 0, 2, 0, 1, 1], // y=3
    [1, 0, 1, 2, 0, 0, 3, 4, 5, 1], // y=4: (6,4)内桥, (7,4)裂纹墙, (8,4)终点
    [1, 0, 0, 3, 0, 0, 2, 1, 1, 1], // y=5: (3,5)外桥, (4,5)穿过光束
    [1, 0, 0, 2, 0, 0, 2, 1, 1, 1], // y=6: (2,6) 上校, (5,6)火药桶
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]  // y=7
  ];

  function map(rows) {
    const legend = { '#': TILE.WALL, '.': TILE.FLOOR, '~': TILE.WATER, '=': TILE.BRIDGE,
      '%': TILE.CRACKED_WALL, 'G': TILE.GOAL, 'E': TILE.LASER_EMITTER, 'H': TILE.HOT, '?': TILE.MIST, 'S': TILE.SHALLOWS };
    return rows.map(row => Array.from(row, symbol => {
      if (!(symbol in legend)) throw new Error('Unknown map tile: ' + symbol);
      return legend[symbol];
    }));
  }

  const LEVELS = [{
    id: 1,
    title: '吉卜赛人的烈日与磁铁',
    subtitle: '第一幕 · 借用家族之力，打开梅尔基亚德斯的羊皮纸密室。',
    cols: 10,
    rows: 8,
    slots: 0,
    replaySlots: 1,
    parTurns: 20,
    unlocks: ['JOSE', 'AURELIANO', 'REBECA'],
    terrain,
    start: { x: 1, y: 1 },
    npcs: [
      { id: 'JOSE', x: 2, y: 1 },
      { id: 'AURELIANO', x: 2, y: 6 },
      { id: 'REBECA', x: 5, y: 2 }
    ],
    barrels: [{ x: 5, y: 6 }],
    items: [
      { kind: 'ice', x: 2, y: 3 },
      { kind: 'relic', x: 5, y: 1 }
    ],
    opening: '多年以后，站在梅尔基亚德斯的羊皮纸密室前，你仍会想起马孔多那个炙热的午后。',
    hints: [
      '向右靠近何塞，继承炼金投掷。',
      '到下方河岸找上校，带着宿命护盾向右过桥，穿过烈日光束。',
      '向上靠近丽贝卡，继承孤注一掷。',
      '站在桶正上方，把桶投到右上方紧挨裂纹石墙的木桥，再用孤注一掷点木桥上的桶。',
      '左岸角落藏着冰块，右岸北端有羊皮纸残页。'
    ]
  }, {
    id: 2,
    title: '失眠症与镜面广场',
    subtitle: '第二幕 · 拨转铜镜，把灼热的光束引离广场。',
    cols: 11,
    rows: 8,
    slots: 1,
    parTurns: 10,
    unlocks: ['URSULA', 'MELQUIADES'],
    terrain: map([
      '###########',
      '#.......#.#',
      '#.....#?..#',
      '#.....#?..#',
      '#.....E?.G#',
      '#....H....#',
      '#....~....#',
      '###########'
    ]),
    start: { x: 1, y: 5 },
    npcs: [{ id: 'URSULA', x: 2, y: 5 }, { id: 'MELQUIADES', x: 4, y: 2 }],
    barrels: [],
    boxes: [{ x: 8, y: 3 }],
    mirrors: [{ x: 5, y: 4, slash: false }],
    emitters: [{ x: 6, y: 4, dx: -1, dy: 0 }],
    gates: [{ id: 'relic', x: 9, y: 2, plate: { x: 8, y: 2 } }],
    repairs: [{ x: 5, y: 6 }],
    items: [{ kind: 'note', x: 3, y: 5 }, { kind: 'relic', x: 9, y: 1 }],
    changes: [{ flag: 'ICE_PRESERVED', x: 5, y: 5, tile: TILE.FLOOR }],
    causalHints: [{ flag: 'ICE_PRESERVED', text: '第一幕带出的冰块可以冷却广场焦土。' }],
    opening: '失眠症让人忘记名字。乌尔苏拉在西岸留下字条，铁门后的残页还没有被迷雾吞没。',
    hints: [
      '速通走中路。带出第一幕的冰块后，冷却的焦土可以直接走过。',
      '想给第四幕留下木桥，就到南岸点破损木桥。通关结算后生效。',
      '想拿残页，先读西岸字条，再拨转铜镜从北路过河。到箱子南面，请乌尔苏拉把箱子向北推上踏板。',
      '备忘字条和乌尔苏拉同行都能抵消迷雾。光束会被箱子挡住，也能击碎冰晶和点燃火药桶。'
    ]
  }, {
    id: 3,
    title: '十七次战争与金鱼工坊',
    subtitle: '第三幕 · 穿过巡逻线，带出档案与熔炉金屑。',
    cols: 12,
    rows: 9,
    slots: 2,
    parTurns: 15,
    unlocks: ['AMARANTA', 'PILAR'],
    terrain: map([
      '############',
      '#.....#....#',
      '#.....#....#',
      '#.....%....#',
      '#.....#....#',
      '#.........G#',
      '#.....#....#',
      '#.....#....#',
      '############'
    ]),
    start: { x: 1, y: 5 },
    npcs: [
      { id: 'URSULA', x: 2, y: 5 }, { id: 'AMARANTA', x: 3, y: 6 }, { id: 'PILAR', x: 8, y: 7 }
    ],
    barrels: [{ x: 5, y: 3 }],
    boxes: [{ x: 3, y: 5 }],
    gates: [{ id: 'archive', x: 6, y: 5, plate: { x: 4, y: 5 } }],
    levers: [{ id: 'archive', x: 5, y: 4 }],
    fuses: [{ x: 4, y: 3, target: { x: 5, y: 3 } }],
    archiveWall: { x: 6, y: 3 },
    forge: { x: 2, y: 7 },
    guards: [{ path: [{ x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }] }],
    items: [{ kind: 'gold', x: 1, y: 7 }, { kind: 'gold', x: 4, y: 7 }, { kind: 'relic', x: 10, y: 7 }],
    opening: '金鱼工坊还亮着灯，巡逻声正从档案室门外穿过。',
    hints: [
      '让乌尔苏拉把箱子推到铜色踏板上，或者用丽贝卡击中红色拉杆。经铁栅门通行可以保全档案。',
      '西侧引火机关可引爆火药桶打开裂纹墙，但会毁掉档案。',
      '集齐西南的两枚金屑后，回到有铁砧标记的熔炉旁。黑纱能遮住守卫视线三回合。',
      '观察守卫朝向和红色警戒区。从南侧绕行可找到残页。'
    ]
  }, {
    id: 4,
    title: '四年十一个月零两天的大雨',
    subtitle: '第四幕 · 等潮水退去，越过被淹没的马孔多。',
    cols: 12,
    rows: 9,
    slots: 2,
    parTurns: 12,
    unlocks: ['REMEDIOS'],
    terrain: map([
      '############',
      '#....#.#...#',
      '#....~.%...#',
      '#....#.#...#',
      '#....S.#..G#',
      '#....~.....#',
      '#....#.#...#',
      '#....=.#...#',
      '############'
    ]),
    start: { x: 2, y: 4 },
    npcs: [{ id: 'REMEDIOS', x: 3, y: 4 }],
    barrels: [{ x: 4, y: 2 }],
    boxes: [{ x: 4, y: 5 }],
    gates: [{ id: 'river', x: 7, y: 5, plate: { x: 6, y: 6 } }],
    fuses: [{ x: 6, y: 3, target: { x: 6, y: 2 } }],
    tide: true,
    oneWay: [{ x: 3, y: 7, dx: 1, dy: 0 }],
    currents: [
      { x: 4, y: 2, dx: 1, dy: 0 }, { x: 5, y: 2, dx: 1, dy: 0 },
      { x: 4, y: 5, dx: 1, dy: 0 }, { x: 5, y: 5, dx: 1, dy: 0 },
      { x: 6, y: 5, dx: 0, dy: 1 }
    ],
    items: [{ kind: 'relic', x: 10, y: 2 }],
    changes: [{ flag: 'BRIDGE_REPAIRED', x: 5, y: 4, tile: TILE.BRIDGE }],
    causalHints: [
      { flag: 'BRIDGE_REPAIRED', text: '第二幕修好的木桥会留在中央浅滩。' },
      { flag: 'GOLD_FISH_FORGED', text: '第三幕锻造小金鱼后，携带上校会增加一次护盾。' }
    ],
    opening: '雨下了四年十一个月零两天。退潮时，旧路只会露出一个回合。',
    hints: [
      '在西岸先遇到美人蕾梅黛丝。站在河边用床单飞升，可以跨过两格。也可等退潮走浅滩，或走修好的桥。',
      '北路等火药桶漂到裂纹墙边。靠近岸上的引火机关，或用丽贝卡从远处引爆。',
      '南路等木箱漂上铜踏板，铁栅门就会打开。箭头表示每次涨潮的漂移方向。',
      '庇拉尔可以翻转潮相和单向门。残页在东北角。'
    ]
  }, {
    id: 5,
    title: '飓风中的羊皮纸密室',
    subtitle: '第五幕 · 在飓风合围前破译最后一道封印。',
    cols: 13,
    rows: 9,
    slots: 3,
    parTurns: 21,
    unlocks: ['BABYLON'],
    terrain: map([
      '#############',
      '#.....E.#...#',
      '#.......#...#',
      '#.......#...#',
      '#..........##',
      '#..~....#.%G#',
      '#.......#..##',
      '#.......#...#',
      '#############'
    ]),
    start: { x: 1, y: 5 },
    npcs: [{ id: 'BABYLON', x: 4, y: 6 }, { id: 'REBECA', x: 9, y: 6 }],
    barrels: [{ x: 10, y: 4 }],
    mirrors: [{ x: 6, y: 4, slash: true }],
    seals: [{ x: 8, y: 4 }],
    sealControls: [{ x: 8, y: 4, control: { x: 6, y: 5 } }],
    beamBreak: { x: 10, y: 5, emitter: { x: 6, y: 1 } },
    guards: [{ path: [{ x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }] }],
    items: [{ kind: 'crystal', x: 9, y: 4 }],
    hurricane: { warningTurn: 15, collapseTurn: 18, ringInterval: 5 },
    changes: [{ flag: 'ARCHIVE_INTACT', x: 8, y: 6, tile: TILE.FLOOR }],
    causalHints: [
      { flag: 'ARCHIVE_INTACT', text: '第三幕完好的档案标出了西侧秘道。' },
      { flag: 'GOLD_FISH_FORGED', text: '锻造小金鱼后，携带上校会增加一次护盾。' }
    ],
    opening: '巴比伦把译码台设在铜镜旁。光束可以先击碎冰晶，再点燃后面的火药桶。',
    hints: [
      '从南岸找到巴比伦。站到铜镜下方的译码台时，先选译码，再拨转铜镜。',
      '观察冰晶、火药桶和裂纹墙依次变化。裂纹墙破开后，灯座会熄灭。沿门廊即可到达密室。',
      '蕾梅黛丝能飞过西侧窄河，乌尔苏拉可以搭桥，上校的护盾可穿过北侧警戒区。档案完整时还能从南侧秘道找丽贝卡。',
      '第 15 回合出现风圈警示，第 18 回合起外围坍塌。任何一次变化都可以撤销。'
    ]
  }];

  return { TILE, LEVELS };
})();

if (typeof module === 'object' && module.exports) module.exports = MacondoLevels;
