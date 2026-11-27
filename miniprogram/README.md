# 微信小程序

这是《百年孤独》微信小程序。首页提供两个入口：

- `pages/quiz/index`（译本盲选）从本地题库抽题，每题展示三个匿名译文选项。
- `pages/game/index`（马孔多的羊皮纸）是回合制机关解谜，用小程序的 Canvas 2D 绘制棋盘。关卡和绘制代码在 `game/macondo.js`，与 GitHub Pages 的网页版共用。

## 本地运行

1. 安装微信开发者工具。
2. 在开发者工具中导入仓库根目录。
3. 保留 `project.config.json` 中现有小程序的 AppID。开发者工具默认编译 `pages/home/index`。
4. 从首页分别打开盲选和游戏，返回后可切换入口。也可通过自定义编译条件直达对应页面。

游戏和题库都随代码包提供，小程序无需配置业务域名或云开发环境。答题统计保存在用户本机 storage。

## 刷新题库

题库源文件是：

```bash
data/translation-quiz/questions.json
```

同步到小程序包内：

```bash
node miniprogram/scripts/sync_questions.mjs
```

同步后会更新：

```bash
miniprogram/data/questions.js
```

## 当前题库质量

当前生成报告在 `data/translation-quiz/question_generation_report.json`：

- `ready`: 225 题，默认抽题池。
- `review`: 158 题，保留给后续人工检查。
- `disabled`: 17 题，默认不进入答题池。

## 发布流程

1. 用拥有现有 AppID 开发权限的账号登录微信开发者工具，并导入仓库根目录。
2. 在开发者工具里完成真机预览。
3. 点击上传，填写版本号和说明。
4. 在微信公众平台确认服务类目，提交审核。
5. 审核通过后发布。

由于当前版本没有服务端能力，部署时不需要创建云环境。以后如果要做跨设备同步、全局投票排行或后台题库运营，再单独接微信云开发或自建后端。
