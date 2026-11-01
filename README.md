# 栖霞山随身文旅智能体

**最终接手入口（2026-11-01）：[项目状态与新机启动](docs/handoffs/PROJECT-STATE-20261101.md) · [空对话接手提示词](docs/handoffs/AI-RESUME-PROMPT.md) · [归档验证](docs/handoffs/ARCHIVE-VERIFICATION-20261101.md) · [删除前私密备份清单](docs/handoffs/PRIVATE-BACKUP-CHECKLIST.md)。** 历史代码在 archive/workspace-20261101，仅用于追溯。服务器MCP已恢复、本机MCP停止；归档不是再次部署。

当前交接分支：**`release/web-watch-cloud02-20261101`**。包含最新秋色主题前端、路线时间线与历史报告、Node.js 后端、小智 MCP、`2.2.6-p9-cloud02` 手表源码和可烧录包，以及最新 Android 测试 App 源码/安装包。**前后端与 MCP 已部署为 cloud02-r15；cloud02已有烧录校验记录，但取码“准备中”问题尚未闭环，真机联合验收未完成。** `main` 不随归档改变。

先阅读 **[从 GitHub 到部署与验收](docs/handoffs/web-watch-cloud02-20261101.md)**。其中有配置清单、服务器启动与回滚、MCP 工具刷新、烧录和分角色验收步骤。

| 目录 | 内容 |
| --- | --- |
| `frontend/` | React 网页、最新主题和路线界面、素材与测试 |
| `backend/`、`shared/` | 行程/定位/知识问答、地图生成、小智工具、公共规则 |
| `stopwatch-nav/firmware/` | 完整小智＋表情＋导航固件，cloud02 |
| `stopwatch-nav/distributions/P9-cloud02/` | 应用与资源 bin、overview02 回滚 bin、校验/烧录脚本和来源许可 |
| `stopwatch-nav/android/` | 最新测试 App `8.3.26-p8-overview01` 源码；网页＋服务器方案不依赖它 |
| `deployment/` | systemd、Nginx 示例，需按实际服务器调整 |
| `scripts/check-deployment.mjs` | 不改用户数据的 HTTP 部署检查 |
| `modeling/` | 原有外壳建模资料，保留历史；大文件使用 Git LFS |

当前线上：[打开新版网站](https://43.160.252.245/?v=cloud02-r15)，详见[本次部署记录](docs/operations/deployment-20261101-cloud02-r15.md)。

## 运行方式

使用 Node.js **24 LTS**（或已验证的 22.22+）、npm、Git。只开发网页/设备时，可跳过建模 LFS 大文件下载：

```sh
git clone --branch release/web-watch-cloud02-20261101 https://github.com/WuJiaxuan1/ai-tour-guide-device.git
cd ai-tour-guide-device
npm --prefix backend ci
npm --prefix frontend ci
```

复制根目录 `.env.example` 为 `.env.local`，填写自己的配置。高德需要 JS API Key、JS 安全码、Web 服务 Key；模型与 MCP 配置由负责同学私下交接，不能提交 Git。

```sh
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend run test:sites
node --env-file=.env.local backend/src/server.mjs
```

打开 `http://127.0.0.1:8787/` 查看构建后的完整网站。开发时另开终端运行 `npm --prefix frontend run dev`，地址以 Vite 输出为准。构建后的后端必须保留完整 checkout，不能只上传前端 dist。

## 网页、语音与地图的合作

手机网页提供 GPS 和当前行程 → 后端转换坐标、规划到下一站、渲染高德底图 → 手表地图页主动下载地图/路线并更新位置。

说“请给我网页行程的配对码” → 手表原生工具申请 8 位码 → 网页填写一次 → 语音问答和地图使用同一行程。网页只保留“连接我的枫叶精灵”，不下载连接 JSON。手表需 cloud02，服务器和 MCP 也需本分支版本；不能只更新前端。

小智云负责 ASR、模型和 TTS；本项目 MCP 提供景点、位置、行程及笔记工具。私下配置后运行：

```sh
node --env-file=.env.local backend/integrations/xiaozhi/mcp_pipe.mjs -- node backend/integrations/xiaozhi/trip-stdio.mjs
```

同一 MCP 接入点只运行一个桥接实例。测试环境使用单独的测试智能体/接入点和数据库，避免抢占正式语音连接。

## 当前边界

- cloud02 前后端与 MCP 已上线、服务器联调通过；手表取码返回“准备中”，失败提示/重试不足已定位，真机网络/TLS根因及端到端地图仍待验收。恢复服务器MCP不代表问题已修复。
- 当前为单智能体、单演示设备绑定，12 小时有效；手表没有独立 GPS。手机锁屏或后台可能停止定位。
- 手表显示到下一站的路线总览和已走进度；不承诺转向播报、自动到达或偏航重算。
- 语音页保留全屏表情及互动，地图页暂停语音；开机重新配网，当前默认音量100。
- 网页/小智共用知识包 v2.1。景点事实与实时行程分开；没有当天实时红叶/活动数据承诺。
- 历史报告读取对应行程；手账仍是本地照片与固定卡演示，没有 AI 照片转贴纸或独立主动播报。
- `.env.local`、用户数据、SQLite、私钥/签名、缓存和依赖不在 Git 中。运行数据在 `.local-work/`，服务器升级必须保留。

上一公网记录为 [kb-r14](docs/operations/deployment-20261101-kb-r14.md)；此前的 [UI 交接](docs/handoffs/team-ui-handoff-kb-r14.md)、[旧验收](docs/testing/web-xiaozhi-kb-r14.md)、[演示脚本](docs/demo/video-script-kb-r14.md)作为历史保留。当前部署与配对方式以本分支交接说明为准。
