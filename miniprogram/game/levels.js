// Shared chapter data for the browser and WeChat.
const MacondoLevels = (() => {
  const TILE = {
    FLOOR: 0,
    WALL: 1,
    WATER: 2,
    BRIDGE: 3,
    CRACKED_WALL: 4, // 必须由火药桶爆炸摧毁的裂纹石墙
    GOAL: 5,         // 梅尔基亚德斯的羊皮纸密室
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

  const LEVELS = [{
    id: 1,
    title: '吉卜赛人的烈日与磁铁',
    subtitle: '第一幕 · 借用家族之力，打开梅尔基亚德斯的羊皮纸密室。',
    cols: 10,
    rows: 8,
    slots: 0,
    terrain,
    start: { x: 1, y: 1 },
    npcs: [
      { id: 'JOSE', x: 2, y: 1 },
      { id: 'AURELIANO', x: 2, y: 6 },
      { id: 'REBECA', x: 5, y: 2 }
    ],
    barrels: [{ x: 5, y: 6 }],
    opening: '多年以后，站在梅尔基亚德斯的羊皮纸密室前，你仍会想起马孔多那个炙热的午后。',
    hints: [
      '向右靠近何塞，继承炼金投掷。',
      '到下方河岸找上校，带着宿命护盾向右过桥，穿过烈日光束。',
      '向上靠近丽贝卡，继承孤注一掷。',
      '站在桶正上方，把桶投到右上方紧挨裂纹石墙的木桥，再用孤注一掷点木桥上的桶。'
    ]
  }];

  return { TILE, LEVELS };
})();

if (typeof module === 'object' && module.exports) module.exports = MacondoLevels;
