// Shared chapter data for the browser and WeChat.
const MacondoLevels = (() => {
  const TILE = {
    FLOOR: 0, WALL: 1, WATER: 2, BRIDGE: 3, CRACKED_WALL: 4, GOAL: 5,
    LASER_EMITTER: 6, HOT: 7, MIST: 8, SHALLOWS: 9, RUBBLE: 10
  };

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
    subtitle: '第一幕 · 依次学会投掷、护盾和远程触发。',
    cols: 14,
    rows: 8,
    slots: 0,
    replaySlots: 1,
    parTurns: 16,
    unlocks: ['JOSE', 'AURELIANO', 'REBECA'],
    terrain: map([
      '##############',
      '#.############',
      '#...#..E######',
      '#...#...#....#',
      '#.....#......#',
      '#...#####..%G#',
      '#...#####...##',
      '##############'
    ]),
    start: { x: 1, y: 4 },
    npcs: [{ id: 'JOSE', x: 2, y: 4 }, { id: 'AURELIANO', x: 5, y: 3 }, { id: 'REBECA', x: 9, y: 4 }],
    practiceBeams: [{ x: 7, y: 3 }],
    barrels: [{ x: 10, y: 5 }],
    boxes: [{ x: 4, y: 4 }],
    gates: [
      { id: 'relic-inner', x: 1, y: 2, plate: { x: 2, y: 2 } },
      { id: 'relic-outer', x: 1, y: 3, plate: { x: 2, y: 2 } }
    ],
    items: [{ kind: 'ice', x: 2, y: 5 }, { kind: 'relic', x: 1, y: 1 }],
    relicArea: '投掷区西北的铁栅门后',
    recommendation: '重玩可带蕾梅黛丝，用飞升越过第一段走廊的木箱，少用一次能力。',
    opening: '先踩上何塞所在的格子。学会一种能力，再去下一段走廊。',
    hints: [
      '先看挡住第一段走廊的木箱。第二段的绿光是安全示范，红光需要护盾。',
      '踩上人物格继承能力。何塞投走木箱，上校的护盾自动生效，丽贝卡可以远程触发桶。',
      '踩上何塞，走到箱子左侧，把箱子投到铜踏板右边的空地。进入第二段，踩上上校的格子再过绿光和红光。踩上丽贝卡的格子后触发墙边的桶，走进密室。想拿西北残页，就用何塞第二次投掷把箱子放到踏板上。'
    ]
  }, {
    id: 2,
    title: '失眠症与镜面广场',
    subtitle: '第二幕 · 拨转铜镜，把灼热的光束引离广场。',
    cols: 11,
    rows: 8,
    slots: 1,
    parTurns: 12,
    unlocks: ['URSULA', 'MELQUIADES'],
    terrain: map([
      '###########',
      '#.......#.#',
      '#....##?..#',
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
    mirrors: [{ x: 5, y: 4, slash: true }],
    emitters: [{ x: 6, y: 4, dx: -1, dy: 0 }],
    gates: [
      { id: 'relic', x: 9, y: 2, plate: { x: 8, y: 2 } },
      ...[[5, 1], [6, 1], [6, 5], [7, 5], [6, 6], [7, 6]].map(([x, y]) => ({
        id: 'mirror-' + x + '-' + y, x, y, mirror: { x: 5, y: 4, slash: false }
      }))
    ],
    repairs: [{ x: 5, y: 6 }],
    items: [{ kind: 'note', x: 3, y: 5 }, { kind: 'relic', x: 9, y: 1 }],
    changes: [{ flag: 'ICE_PRESERVED', x: 5, y: 5, tile: TILE.FLOOR }],
    causalHints: [{ flag: 'ICE_PRESERVED', text: '第一幕带出的冰块会冷却焦土，拨镜后可走中路。' }],
    relicArea: '失眠迷雾北侧的铁栅门后',
    recommendation: '带何塞可把东侧木箱直接投上残页踏板，省去绕到箱子南边。',
    opening: '铜镜把光束引到南岸，联动栅门也封住了北廊。乌尔苏拉在西岸留下了字条。',
    hints: [
      '看广场中央的铜镜。初始光束向南，北廊的门和铜镜联动。',
      '先拨镜。带了冰块可走中路。走南岸可以修桥，北廊的残页可用乌尔苏拉推箱或何塞投箱。',
      '从西岸踩过乌尔苏拉与字条，站到铜镜左边拨转。走南岸时在光束移开后修桥。走北廊时先去左上方找梅尔基亚德斯，过联动门。沿迷雾走到箱子旁，把箱子移到北边踏板上，再从铁门进去拿残页。'
    ]
  }, {
    id: 3,
    title: '十七次战争与金鱼工坊',
    subtitle: '第三幕 · 穿过巡逻线，带出档案与熔炉金屑。',
    cols: 12,
    rows: 9,
    slots: 2,
    parTurns: 17,
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
    npcs: [{ id: 'AMARANTA', x: 3, y: 6 }, { id: 'PILAR', x: 8, y: 7 }],
    barrels: [{ x: 5, y: 3 }],
    boxes: [{ x: 3, y: 5 }],
    gates: [{ id: 'archive', x: 6, y: 5, plate: { x: 3, y: 2 } }],
    levers: [{ id: 'archive', x: 5, y: 4 }],
    fuses: [{ x: 4, y: 3, target: { x: 5, y: 3 } }],
    archiveWall: { x: 6, y: 3 },
    forge: { x: 7, y: 7 },
    guards: [{ path: [{ x: 8, y: 4 }, { x: 8, y: 3 }, { x: 8, y: 2 }] }],
    items: [{ kind: 'gold', x: 9, y: 3 }, { kind: 'gold', x: 9, y: 5 }, { kind: 'relic', x: 10, y: 7 }],
    relicArea: '档案墙东南的工坊角落',
    recommendation: '带何塞可投箱压踏板，或带丽贝卡远程击中拉杆，把档案完整带到第五幕。',
    opening: '走档案门可以保全手稿。北侧还有一面裂纹墙，墙后的档案经不起爆破。',
    hints: [
      '档案墙有两条通道。右半区的金屑贴着守卫视线，虚线是下一回合的范围。',
      '要保全档案，用何塞投箱压踏板，或用丽贝卡点中拉杆。阿玛兰妲的黑纱可以遮住巡逻视线。',
      '带何塞时站到西侧木箱旁，把箱子投到同列北边三格的踏板上。带丽贝卡时可从拉杆下方触发。空队可绕到西北，确认后使用引火机关开墙。过墙后观察虚线，捡东侧两枚金屑并回到东南铁砧。走南侧可以找到庇拉尔和残页。'
    ]
  }, {
    id: 4,
    title: '四年十一个月零两天的大雨',
    subtitle: '第四幕 · 看准潮水，把一个漂流桶送往出口。',
    cols: 12,
    rows: 9,
    slots: 2,
    parTurns: 17,
    unlocks: ['REMEDIOS'],
    terrain: map([
      '############',
      '#....#.#...#',
      '#....~.%...#',
      '#....#.#...#',
      '#....S.#..G#',
      '#....~.....#',
      '#....#.#...#',
      '#....~.#...#',
      '############'
    ]),
    start: { x: 3, y: 5 },
    npcs: [{ id: 'REMEDIOS', x: 4, y: 4 }],
    barrels: [{ x: 4, y: 5 }],
    gates: [{ id: 'river', x: 7, y: 5, plate: { x: 6, y: 6 } }],
    fuses: [{ x: 6, y: 3, target: { x: 6, y: 2 } }],
    tide: true,
    oneWay: [{ x: 3, y: 7, dx: 1, dy: 0 }],
    currents: [
      { x: 4, y: 2, dx: 1, dy: 0 }, { x: 5, y: 2, dx: 1, dy: 0 },
      { x: 4, y: 5, dx: 1, dy: 0 }, { x: 5, y: 5, dx: 1, dy: 0 },
      { x: 6, y: 5, dx: 0, dy: 1, bridgeRoute: { bridge: { x: 5, y: 4 }, dx: 0, dy: -1 } },
      { x: 6, y: 4, dx: 0, dy: -1 }, { x: 6, y: 3, dx: 0, dy: -1 }
    ],
    items: [{ kind: 'relic', x: 10, y: 2 }],
    changes: [{ flag: 'BRIDGE_REPAIRED', x: 5, y: 7, tile: TILE.BRIDGE }],
    causalHints: [
      { flag: 'BRIDGE_REPAIRED', text: '第二幕修的桥在南岸，过河后可提前到踏板。' },
      { flag: 'GOLD_FISH_FORGED', text: '带上校时，小金鱼会增加一次护盾。' }
    ],
    relicArea: '东岸北端的出口旁',
    recommendation: '带梅尔基亚德斯可从踏板与漂流桶换位，省去等涨潮。何塞也能把桶送进北水道。',
    opening: '潮水每两回合换相。漂流桶通常往南，也可以改道送进北水道。',
    hints: [
      '看桶和水面箭头。浅滩描红时，下回合就会涨潮。',
      '走南路时让桶压住踏板。何塞可把桶投往北水道，乌尔苏拉在东岸水口架桥也能让桶改道。',
      '先踩上蕾梅黛丝的格子。用飞升从浅滩西边飞向东岸，或用修好的南桥过河。南路等桶依次漂到铜踏板，如果带了梅尔基亚德斯，可以站在踏板上与桶换位提前开门。北路用何塞把初始桶投入北边水道，或让乌尔苏拉在中央浅滩架桥改流。等桶到裂纹墙旁，再触发引火机关。'
    ]
  }, {
    id: 5,
    title: '飓风中的羊皮纸密室',
    subtitle: '第五幕 · 趁飓风合围前，译开封印并接通光路。',
    cols: 13,
    rows: 9,
    slots: 3,
    parTurns: 19,
    unlocks: ['BABYLON'],
    terrain: map([
      '#############',
      '#.......#...#',
      '#.....E.#...#',
      '#.......#...#',
      '#..........##',
      '#..~....#.%G#',
      '#.......#..##',
      '#############',
      '#############'
    ]),
    start: { x: 1, y: 5 },
    npcs: [{ id: 'URSULA', x: 2, y: 5 }, { id: 'BABYLON', x: 4, y: 6 }],
    archiveCompanion: { id: 'REBECA', x: 2, y: 7 },
    barrels: [{ x: 10, y: 4 }],
    boxes: [{ x: 7, y: 4 }],
    mirrors: [{ x: 6, y: 4, slash: true }],
    seals: [{ x: 8, y: 4 }],
    sealControls: [{ x: 8, y: 4, control: { x: 6, y: 5 } }],
    beamBreak: { x: 10, y: 5, emitter: { x: 6, y: 2 } },
    guards: [{ range: 2, path: [{ x: 5, y: 3 }, { x: 4, y: 3 }, { x: 3, y: 3 }] }],
    items: [{ kind: 'crystal', x: 9, y: 4 }],
    hurricane: { warningTurn: 10, collapseTurn: 14, ringInterval: 8 },
    changes: [{ flag: 'ARCHIVE_INTACT', x: 2, y: 7, tile: TILE.FLOOR }],
    causalHints: [
      { flag: 'ARCHIVE_INTACT', text: '第三幕留下的档案会打开入口旁的秘道，提前遇见丽贝卡。' },
      { flag: 'GOLD_FISH_FORGED', text: '带上校时，小金鱼会增加一次护盾。' }
    ],
    recommendation: '带蕾梅黛丝可飞过西侧窄河。保全档案后带丽贝卡进场，和秘道里的她重逢可补一次能力，用两次远程触发走另一条路线。',
    opening: '译码台在铜镜下方。封印后还有冰晶，光束会在冰晶碎开后接过去。',
    hints: [
      '看译码台、铜镜和镜子右边的箱子。第十回合开始预警。',
      '踩上巴比伦后译开封印。乌尔苏拉能从下方推开箱子，有何塞也能投走。保全档案后能提前找到丽贝卡。',
      '从起点走南边找巴比伦，再到铜镜下方译码。站到箱子下方，用乌尔苏拉把箱子往北推，再回到译码台拨镜。光束会依次击碎冰晶、触发墙边的桶、让墙和灯座失效。沿门廊走到密室。'
    ]
  }];

  return { TILE, LEVELS };
})();

if (typeof module === 'object' && module.exports) module.exports = MacondoLevels;
