# 微信小程序

这是《百年孤独》中文译本盲选小程序的静态 MVP。它从本地题库随机抽取 `ready` 状态的问题，让用户在 A-E 五个匿名译文版本中选择偏好的表达。

## 本地运行

1. 安装微信开发者工具。
2. 在开发者工具中导入仓库根目录。
3. 使用测试号预览时保留 `project.config.json` 里的 `touristappid`；准备上传时换成你的小程序 AppID。
4. 打开后编译 `pages/quiz/index`。

小程序不需要微信云开发环境，也不需要配置 request/download/upload 域名。题库在代码包内，答题统计保存在用户本机 storage。

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

1. 在微信公众平台注册小程序并取得 AppID。
2. 用微信开发者工具导入仓库根目录。
3. 将项目 AppID 设置为真实 AppID。
4. 在开发者工具里完成真机预览。
5. 点击上传，填写版本号和说明。
6. 到微信公众平台提交审核。
7. 审核通过后发布。

由于当前版本没有服务端能力，部署时不需要创建云环境。以后如果要做跨设备同步、全局投票排行或后台题库运营，再单独接微信云开发或自建后端。
