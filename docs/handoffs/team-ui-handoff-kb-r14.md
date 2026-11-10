# 前端页面调整交接：kb-r14

日期：2026-11-01。线上版本 `0.5.2-20261101-kb-r14`，应用代码基线提交 `8ef7b06`。本次交接只增加文档，未改变线上功能。

## 获取完整软件基线

- 仓库：https://github.com/WuJiaxuan1/ai-tour-guide-device
- 当前完整实现分支：`codex/full-implementation-photo-r12`。分支名称是历史名称，内容已经包含 ui-r13 和 kb-r14。
- 实际网页：https://43.160.252.245/?v=kb-r14
- `main` 是原始基线，不要以 main 开始本次 UI 调整，也不要用 main 覆盖当前实现。

```sh
git clone --branch codex/full-implementation-photo-r12 https://github.com/WuJiaxuan1/ai-tour-guide-device.git
cd ai-tour-guide-device
git switch -c team/ui-refresh-kb-r14
npm --prefix backend ci
npm --prefix frontend ci
```

团队建议从交接分支另建自己的 UI 分支开发，再合并回交接分支。后续若共享分支已有新提交，先拉取并解决冲突，不强制推送。

仓库包含前后端源码、公共规则、知识包、预设路线/地图数据、页面和沉浸素材、锁文件、测试及部署说明。`node_modules`、可重新生成的 `dist`、密钥、运行数据库和用户照片不纳入 Git。GitHub 源码上传不是网页自动部署；UI 完成后还需构建、检查并部署。

本机运行和环境变量见 [当前安装部署说明](../operations/current-release-setup.md)。模型和高德密钥由团队通过私下配置 `.env.local`，不要写进前端或提交仓库。已有线上环境保留原配置，无需因换 UI 更换密钥。不要为本地预览额外启动同一小智 MCP 接入点，避免与正式设备争用连接。

## 页面改动入口

以下路径均相对仓库根目录。

| 范围 | 当前有效文件 | 调整时保留什么 |
| --- | --- | --- |
| 页面入口、聊天、景点卡片、弹层 | `frontend/src/Qixia.jsx`；`App.jsx` 转导出该页面 | 问答请求、聊天状态、当前行程接入、标签和弹层事件 |
| 路线主页面和偏好选择 | `frontend/src/features/navigation/RoutePage.jsx`、`PresetRoutePanel.jsx` | 原四步向导、跳过、选择/合并路线、停留和出入口设置 |
| 游览状态与配对 | `frontend/src/features/navigation/ServerTourControls.jsx` | 开始后的到达、跳过、暂停/恢复、结束、8 位配对码操作 |
| 地图与定位 | `frontend/src/components/NavigationMap.jsx`、`services/useVisitorLocation.js` | 手机定位、路线几何、点位选择及错误状态 |
| 服务端状态 | `frontend/src/services/travel-api.js`、`useServerTrip.js`、`route-compat.mjs` | 身份凭证、行程 ID、请求格式、状态版本和 SSE 重连 |
| 沉浸入口与内容 | `components/ImmersiveTag.jsx`、`features/navigation/ImmersiveArrivalPrompt.jsx`、`ServerImmersivePage.jsx`、`frontend/public/immersive/qixia-temple/` | 栖霞寺限定、iframe 通信、选择存档、手机资源优化 |
| 历史记录 | `ServerHistoryPage.jsx`、`ServerTripRecord.jsx` | 读取真实记录、删除确认、查看历史不切换当前配对 |
| 报告与手账 | `ReportPage.jsx`、`JournalPage.jsx` | 当前固定模板和导出行为，不误接回已撤下的照片服务 |
| 样式和图片 | `frontend/src/*.css`、各功能 CSS、公共素材目录 | 手机布局、加载状态、按钮可用状态、焦点与关闭行为 |
| 知识文本 | `backend/knowledge/qixia-deepseek-v2.1/`；生成的 `frontend/src/content/knowledge.json` | 01+02 完整知识和 06/07 结构化数据；构建会重生成前端知识，不在生成文件中单独维护事实 |

`ServerRoutePage`、`ServerPresetRoutePanel`、`ServerMemoryPage`、`PhotoStudioPage` 是保留的历史实现，不是本轮主页面入口。不要因文件名含 Server 就换回这些页面，否则会恢复用户已经撤下的交互。

## UI 可以变化，数据契约保持一致

1. 布局、字体、颜色、间距、图标与展示顺序可以调整；本轮不增加交互。保留现有回调、参数、错误/加载/禁用状态，不用静态数据替代接口。
2. 网页问答继续调用 `/api/v1/chat`。网页和小智共享知识与行程状态，但不是共享同一个前端聊天窗口；小智闲聊也不等于已存入旅行问答记录。
3. 原路线预览使用 `/api/routes/plan`；开始时通过 `/api/v1/trips/from-selection` 在服务器重建权威行程，再执行开始命令。不要仅切换本地“游览中”状态。
4. 操作保留 `client_event_id`、`expected_version`、`trip.id` 与服务端 `stop_id`；景点 ID 和停靠 ID 不能互换，因为入口/出口可能重复经过。
5. 保留 `qixia.server-session.v1`、`qixia.server-trip.v1` 存储键及现有身份恢复逻辑。会话请求携带 Authorization，不能把令牌放进网址或图片链接。
6. 手机上报 WGS84 原始定位，由服务器转换；不要在 UI 调整中再转换一次。到访由用户确认，地图上的接近状态不等于已到访。
7. 保留 SSE 事件顺序、刷新恢复、断线提示、旧响应保护。收到成功响应后再更新操作结果，不把本地点击当作服务器已成功。
8. 沉浸 iframe 的 `postMessage` origin/source/channel 校验、choice ID、保存成功应答必须保留。没有行程时是自由浏览，不写入存档。
9. 预设路线仍由固定资料筛选。自选路线道路优化是现有功能；不要宣传成任意大模型生成路线或行走中自动重规划。
10. 正式部署沿用持久化目录和 `.env.local`，不能覆盖用户 SQLite、媒体或重新绑定演示设备。

## UI 完成后的交付

```sh
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
```

除自动检查，还需在手机上走通问答→R02→开始→配对→到达同步→沉浸→历史。详情见 [逐项验收清单](../testing/web-xiaozhi-kb-r14.md)。如果 UI 改了文案或元素结构导致测试失败，核对业务行为后再调整测试，不能删掉同步/身份/错误处理检查。

提交 UI 分支及 commit、变更文件、测试结果和手机效果。接手部署的人需要拉取该 UI 分支并联调实际接口，但只调整视觉且遵守契约时，一般不需要重写后端。生产发布后再做一次真实网页和设备冒烟测试；源码推送成功不等于发布成功。

## 能力口径

当前可演示：知识问答、路线选择和编辑、网页地图/手机定位、行程状态、小智配对和查询/确认到访/保存明确感受、栖霞寺沉浸入口/接近提示/存档、刷新恢复、历史及删除。

当前不能声称：独立主动语音、手表独立 GPS、高德转向语音持续播报、AI 照片转贴纸、网页已开放真实模型回忆摘要、实时枫情/活动、多人多设备账号体系。固定报告和固定手账只能按演示模板展示。
