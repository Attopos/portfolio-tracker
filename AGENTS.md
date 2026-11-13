# Portfolio Tracker

投资组合追踪，monorepo：`pf-web`（Node 22，server + client）和 `pf-iOS`（iOS 客户端），Google 登录。

开工前先读 `docs/STATE.md`（做到哪、下一步）；需要背景时读 `docs/DECISIONS.md`。接口和本地开发见 `pf-web/docs/api-endpoints.md`、`pf-web/docs/local-dev.md`。

## 构建与运行

- Web：在 `pf-web` 里 `npm run dev`。
- iOS 联调：`scripts/ios-dev.sh` 起本地后端（默认 3000 端口）。
- 推到 `pf-web` 的改动会触发部署（CI 只看 pf-web）。

## 规则

- 不用模拟器，直接装真机测试；每次 build 或测试后立即关闭模拟器、删除构建中间文件。
- commit 和 PR 里不加 Co-Authored-By、Claude-Session 等署名行。
- 代码里尽量不写注释，除非是特别关键的功能。

## 文档同步

- 每次修改在同一个提交里更新 `docs/STATE.md`；做了取舍就在 `docs/DECISIONS.md` 末尾追加一条。纯格式化、依赖升级等可在提交说明里写 `[skip-state]`。
- 这三份文档会自动同步到 Atlas（`~/Developer/atlas-ac`，github.com/Attopos/atlas-ac）和 ACdian 的 Atlas 模块，那边只读，只在这里改。
- 出了错或被纠正，把教训补进本文件的规则。
