# 栖霞漫游前后端双窗口总交接 — 2026-10-31

> 这是前端窗口和后端窗口共同使用的总入口。它只描述当前事实、工作边界、验收条件和下一步，不替代历史记录。
>
> 当前工程：`F:\coding_projects\ai-tour-guide-device`\
> 当前分支：`release/frontend-0.5.1`\
> 当前本地 HEAD：`b9ff2ac`（`Release frontend 0.5.1: route wizard and personal routes`）\
> 当前公网部署：`0.5.0-20261031-r2`\
> 本文状态：草案，后续每次接口或验收变化都要更新日期、负责人和证据。

## 1. 新电脑先读什么

两个窗口都先读：

1. `AGENTS.md`
2. 本文
3. `backend/v0.5.1/mcp-handoff-20261031.md`
4. `frontend/v0.5.0/project-handoff-20261030-v0.5.0.md`
5. `docs/project/第二次筹备会纪要-20261029.md`
6. `frontend/README.md`、`frontend/AGENTS.md`、`frontend/CHANGELOG.md`
7. `backend/README.md`

后端窗口继续读：

- `backend/integrations/xiaozhi/README.md`
- `docs/architecture/backend/model-integration-plan-20261031.md`
- `docs/architecture/backend/03-overall-architecture.md`
- `docs/architecture/backend/04-functional-modules.md`
- `docs/architecture/backend/06-api-and-module-contracts.md`
- `docs/architecture/backend/07-knowledge-and-trust.md`
- `docs/architecture/backend/08-security-privacy-errors.md`
- `docs/operations/xiaozhi-mcp-server-deployment.md`

前端窗口继续读：

- `frontend/src/features/navigation/RoutePage.jsx`
- `frontend/src/features/navigation/PresetRoutePanel.jsx`
- `frontend/src/features/navigation/JournalPage.jsx`
- `frontend/src/services/navigation.js`
- `frontend/src/agent.js`
- `docs/operations/deployment-20261031.md`
- `docs/requirements/visitor-update-20261030-v0.4.0.md`

硬件联调需要再读：

- `stopwatch-nav/docs/硬件端-当前功能介绍.md`
- `stopwatch-nav/docs/P7-地图与位置协议.md`
- `stopwatch-nav/docs/P7-test07-地图块与窗口.md`

这些文件是设计提案、历史资料或供应商参考，不能直接当成已经上线的代码合同：

- `docs/architecture/backend/` 中尚未落地的 Python/FastAPI、数据库和未来 API 方案。
- `backend/knowledge/qixia-kb-mvp-v1/10_route_time_presets.json`、`11_后端接入说明.md` 中与会议策略冲突的旧路线假设。
- `docs/history/`、`modeling/` 和固件官方 README。

## 2. 当前事实基线

| 项目 | 当前事实 | 证据或限制 |
|---|---|---|
| 本地源代码 | HEAD 为 `b9ff2ac`，工作区另有未提交修改和未跟踪文件 | 先看 `git status --short --branch`，不得 reset/clean |
| 前端 | 0.5.1 路线向导、专属路线、地图缩略图、接驳车、暖色样式、本地手账已在本地代码中 | 本地代码不等于公网已部署 |
| 公网网页 | 仍是 `0.5.0-20261031-r2` | 2026-10-31 部署记录；不能把本地 0.5.1 当成线上版本 |
| 后端 API | Node 服务已有高德代理、天气、知识、设施、坐标转换、预设路线和自选道路接口 | 见 `backend/README.md` 和 `backend/src/` |
| 知识库 | 已实现有边界的本地检索和有限多轮规则问答 | 不是自由生成智能体；来源、核验状态和未知结果必须保留 |
| 小智 MCP | 本机代码已创建，用户截图证明已在线并发现五个工具 | 没有 StopWatch 语音、真实业务回包或服务器常驻验收 |
| MCP 代码状态 | `backend/integrations/xiaozhi/`、测试、文档和配置模板尚未全部进入 Git 基线 | 只克隆仓库可能缺本轮增量 |
| 服务器 MCP | 尚未部署 | 本机关闭后小智项目工具会离线，公网网页和已有 API 继续运行 |
| StopWatch | 不在当前操作者手里 | Android/手表路线 ACK、真实语音和断线恢复未验收 |
| GPS | 前端使用浏览器手机 GPS；历史公网验收使用模拟位置 | 模拟 GPS 不是真机验收；网页/Android/手表尚未共享权威行程 |
| 手账 | 本地固定图片上下对比体验，照片不上传 | 不调用 imagegen 或贴纸生成服务 |
| 景点互动彩蛋 | 等待团队完成页面和接入说明 | 小智只提示网页入口，不另造剧情 |
| Git 发布 | 本轮不提交、不推送 | 用户要亲自学习 GitHub 上传流程 |

## 3. 前端窗口的范围

### 已完成

- 四步官方推荐向导：入口、时长、体力、同行；每步可跳过。
- 老人和儿童同行组合，按节省体力筛选。
- 官方路线可加入“专属路线”；增删景点后重新请求真实步行道路。
- 固定入口/出口、地图缩略图、吸顶分类栏、折叠接驳车。
- 景点卡片分组、定位排序、暖色主题、微软雅黑优先回退。
- 本地固定纪念卡和下载；照片只在浏览器预览。
- 未核验点位显示明确失败，不生成假坐标、直线假路径或虚构导航。

### 主要文件

- `frontend/src/features/navigation/RoutePage.jsx`
- `frontend/src/features/navigation/PresetRoutePanel.jsx`
- `frontend/src/features/navigation/JournalPage.jsx`
- `frontend/src/features/navigation/ShuttlePanel.jsx`
- `frontend/src/services/navigation.js`
- `frontend/src/agent.js`
- `frontend/src/warm-theme.css`
- `backend/src/road-planner.mjs`

### 前端仍未完成

- 真实小智网页文字通道未接入。
- 前端没有服务端权威 trip、到访事件、跨设备记忆或手表 ACK。
- 最终正式路线、完整入口/出口、道路几何和有向距离时间矩阵仍待团队交付。
- 六个官方名称仍缺确认坐标：西门入口广场、桃花扇亭、九龙坡、南门游客中心、青锋涧、有凌云观景平台。
- R05 数量差异、R06 返程/出口缺失继续明确展示，不能靠前端隐藏。

### 前端窗口交付物

每次工作结束在本文“进度记录”追加：

1. 改了哪些文件以及用户可见行为。
2. 依赖了哪些后端接口和请求/响应字段。
3. 本地构建、测试和浏览器验证结果。
4. 未验证的真机、线上或硬件范围。
5. 是否需要后端窗口修改合同。

前端窗口不得自行改写路线规则、伪造导航状态、把固定报告数值说成真实统计，或把本地手账说成在线生成服务。

## 4. 后端窗口的范围

### 已完成

- Node 22+ 后端和高德安全代理。
- 知识检索、知识目录、设施查询、偏好推荐、坐标转换。
- 八条已导入路线、十一组观察到的筛选组合、三态结果：`matched`、`no_match`、`unverified`。
- R02 已保存真实道路；专属路线可请求真实步行道路。
- 本地 stdio MCP 服务和 WSS 管道，首批五个只读工具：
  - `qixia.explain_current_place`
  - `qixia.search_knowledge`
  - `qixia.recommend_routes`
  - `qixia.get_route_catalog`
  - `qixia.get_facilities_nearby`

### MCP 上线前的阻塞项

这些问题必须先修复并补测试，不能因为“小智已发现工具”就宣布完成：

1. `entryGate` 与服务读取的 `gate` 不一致；`exitGate`、`preferredPlaceIds` 尚未完整参与匹配。
2. 结果大小控制没有覆盖嵌套 `place`、`facilities` 和目录分页；不能直接截断 JSON 或中文。
3. 同时返回 `content` 与 `structuredContent`，需按真实平台合同核算完整 UTF-8 报文预算。
4. `.env.local` 中的 `QIXIA_API_BASE_URL` 尚未可靠传给子进程；本地默认端口正常不能掩盖该问题。
5. 输入校验、超时、断线/重连、关闭行为、错误脱敏和异步 stdio 测试不完整。
6. 工具描述必须真实：显式 `placeId` 不等于知道游客当前位置；位置输入不等于可信 GPS；“已审核”不能替代完整审核证据；当前没有用户/行程绑定。

### 后端窗口交付物

每次工作结束在本文“进度记录”追加：

1. API、工具 schema 或数据字段的变化。
2. 变更对应的前端调用点和兼容策略。
3. 单元、API、MCP 模拟和真实服务验证结果。
4. 哪些结果仍未经过小智设备、服务器或真机验收。
5. 是否需要新的路线资料、硬件协议或用户决策。

后端窗口不得把模型当数据库、让小智自由生成正式路线、接受模型传来的任意 `tripId` 作为授权，或开放尚未实现的 GPS/记忆写入工具。

## 5. 两个窗口共用同一目录时的工作规则

两个窗口指向同一工作区时，默认会看到同一套未提交修改。为避免互相覆盖，按下面的文件所有权工作：

| 文件范围 | 默认负责人 | 规则 |
|---|---|---|
| `frontend/**` | 前端窗口 | 后端窗口只读，除非先在进度记录中说明原因 |
| `backend/src/**`、`backend/integrations/**`、`backend/tests/**` | 后端窗口 | 前端窗口通过接口提需求，不直接修业务实现 |
| `backend/data/**`、`backend/knowledge/**` | 后端窗口维护，前端窗口消费 | 修改点位或路线前必须写证据、版本和影响 |
| `shared/**`、接口适配器、`backend/package.json`、`.env.example` | 集成变更 | 两个窗口先在本文登记，再修改和测试 |
| `docs/**` | 修改对应模块的窗口 | 只更新事实和证据，不把提案写成已实现 |
| `.env.local`、SSH 私钥、服务器私有配置 | 不进入交接包 | 只在本机/服务器私下配置，绝不贴聊天或提交 Git |
| `stopwatch-nav/firmware/**` | 硬件负责人 | 内层 Git 未完成整合，不要当外层仓库 gitlink 提交 |

每个窗口开始先执行：

```powershell
Set-Location 'F:\coding_projects\ai-tour-guide-device'
git status --short --branch
git log -1 --oneline
```

禁止在两个窗口中执行 `git reset`、`git clean`、覆盖式解压、批量删除或 `git add .`。不要为了清理未提交数量删除硬件、历史资料或本轮 MCP 文件。

同一时间只允许一个窗口修改共享契约。另一个窗口可以继续做本目录专属工作，但不得重写共享文件。构建产物、缓存、响应日志和截图放到 `.local-work/`，不要放到 `C:` 聊天工作区。

## 6. 前后端共同接口规则

- 景点和设施使用稳定 ID，展示名称不能作为唯一键。
- 坐标统一记录坐标系和采集时间；浏览器 WGS84 转 GCJ02 后，服务端不能再次偏移。
- 路线结果必须带 `routeId`、`revision`、入口、出口、站点顺序、来源、核验状态和 `navigationReady`。
- 路线匹配不足时返回实际结果；`no_match` 和 `unverified` 不能补成“推荐成功”。
- 高德道路结果和业务路线计划分开保存；地图有折线不代表路线资料完整，也不代表手表已收到。
- 计划站点、真实到访事件、用户原话和模型摘要分开保存。
- 前端显示的事实、距离、时间、到访和当前站点以服务端结果为准；在行程服务尚未实现前，前端只能明确标注本地演示状态。
- 小智首版只读工具不写 GPS、到访、记忆或路线；工具调用必须经过后端校验。
- 固定手账与行程报告解耦；固定演示指标不能冒充真实用户统计。

当前已存在的核心 API 见 `backend/README.md` 和 `backend/v0.5.1/mcp-handoff-20261031.md`。架构文档中的未来 API（例如 trip、next-stop、memory）在代码落地并测试前都只能标为“规划中”。

## 7. 固定实施顺序

不要并行跳过顺序，也不要为了演示扩展实时路线优化器：

1. **统一业务合同和知识证据**：先修 MCP 字段、来源、结果预算和配置传递。
2. **打通知识问答入口**：本地模拟错误，再做一次真实工具调用；小智发现工具不等于业务验收。
3. **建立行程与绑定**：匿名会话、trip、路线版本快照、权限和基础事件。
4. **导航状态与硬件联调**：GPS 精度/时间/序号、下一站、到达/偏航、防抖、routeId/revision ACK。
5. **事件记忆与报告**：事实统计、固定演示指标、摘要生成和删除策略分开。
6. **演示与整体验收**：固定贴纸对比、团队互动彩蛋、弱网、模型失败、设备和真机。

## 8. 交接前必须补齐的外部输入

这两项是项目当前最重要的阻塞输入，不能由窗口自行猜测：

1. 最终预设路线：点位 ID、入口/出口、道路几何、有向距离时间矩阵、路线版本和固定报告指标。
2. 已完成的景点互动彩蛋页面：入口 URL/组件、资源文件、触发方式、前端接入说明；小智只提示入口。

还需要团队确认：位置保存期限和删除方案、行程绑定方式、手表 ACK 字段、真实小智工具调用证据，以及是否需要独立网页文字模型。京东云文档是供应商参考，当前没有运行适配代码，不得自行宣布已接入。

## 9. 验收门槛

| 门槛 | 通过证据 | 当前状态 |
|---|---|---|
| 前端本地 | build、前端测试、关键移动/桌面流程 | 0.5.1 代码已有上一轮证据；新改动需重跑 |
| 后端本地 | API health、知识、路线、设施、错误路径 | 已有基础；MCP 修改后需重跑 |
| MCP 工具 | initialize、tools/list、每个 tools/call 的真实回包 | 工具发现已证实，业务回包未证实 |
| 服务器 MCP | systemd 常驻、断线恢复、服务器回环 API、脱离 SSH 后仍在线 | 未部署 |
| 真机 GPS | 授权、低精度、拒绝、切后台行为 | 未完成，现有证据为模拟 GPS |
| StopWatch | 语音触发、工具回包、显示、routeId/revision ACK | 未完成 |
| 报告与手账 | 固定指标和固定图片上下对比，不混写行程事实 | 本地手账已完成，真实记忆未完成 |
| Git/发布 | 用户自己选择文件、提交和推送 | 本轮不执行 |

## 10. 两个窗口的可直接开场提示

### 前端窗口

```text
你是栖霞漫游项目的前端窗口。先读取 AGENTS.md、
docs/project/frontend-backend-handoff-20261031.md、
frontend/v0.5.0/project-handoff-20261030-v0.5.0.md、
frontend/AGENTS.md、frontend/CHANGELOG.md 和第二次会议纪要。

当前本地 HEAD 是 b9ff2ac，公网仍是 0.5.0-20261031-r2。
先检查 git status，不要 reset、clean、git add .、提交或推送。
只负责 frontend/** 及前端适配；不要把未来后端 API 当成已实现。
如果需要修改共享接口，先在总交接文档登记字段、理由和验收方式。
完成后报告改动文件、构建/测试证据、未验证范围和后端窗口需要的合同。
```

### 后端窗口

```text
你是栖霞漫游项目的后端窗口。先读取 AGENTS.md、
docs/project/frontend-backend-handoff-20261031.md、
backend/v0.5.1/mcp-handoff-20261031.md、backend/README.md、
backend/integrations/xiaozhi/README.md、
docs/architecture/backend/model-integration-plan-20261031.md 和第二次会议纪要。

当前本地 HEAD 是 b9ff2ac，MCP 增量仍有未提交文件；公网网页是 0.5.0-20261031-r2。
先检查 git status，不要 reset、clean、git add .、提交或推送。
优先修复 MCP 交接中列出的字段映射、结果预算、子进程配置、校验/恢复和真实性问题，
再做本地 API/MCP 测试。不要自行新增路线、自由规划、GPS写入或记忆写入工具。
完成后报告 API/schema 变化、测试证据、真实调用边界和需要前端/团队补交的资料。
```

## 11. 进度记录模板

每个窗口只追加自己的条目，不删除历史：

```markdown
### YYYY-MM-DD HH:mm（前端 / 后端）
- 工作范围：
- 修改文件：
- 用户可见或接口行为：
- 测试与证据：
- 未验证/阻塞：
- 需要另一个窗口确认：
- 是否改变共享合同：否 / 是（附字段和兼容方案）
```

## 12. 已查看的对话窗口索引

本次可以读取到的项目 Codex 窗口包括：

- **前端**：记录 0.5.1 路线向导、专属路线、手账和部署疑问。
- **后端搭建**：确认路线、导航、知识、记忆、媒体和小智应分层；强调小智不能越权决定路线或写入事实。
- **分析知识库连接与未提交文件**：记录知识库接入边界、工作区未提交状态和本轮最新 MCP 接入。
- **澄清小智知识库接入边界**：确认知识包分层、工具只读边界，以及需要团队提供正式路线和彩蛋资料。
- **中转站问题排查**：主要是 Codex 中转服务的 Responses/压缩兼容性问题，不是项目业务状态，不作为前后端验收依据。
- **添加队友 SSH 登录权限**：确认队友服务器公钥已经追加；服务器操作仍要遵守 SSH 日志技能，不把密钥放进交接文档。

当前账户没有可读取的 ChatGPT 对话源，只能把项目内可读取的 Codex 窗口纳入索引。任何没有写入文件或本文的聊天决定，都必须由队友重新确认，不能靠记忆补全。

## 13. 安全和发布边界

- `.env.local`、MCP token、模型/API key、SSH 私钥和服务器私有配置永不进入 Git、交接包或聊天。
- 服务器 SSH/SCP/systemd 操作前，先按 `tools/skills/ssh-operation-logging/SKILL.md` 执行并留下脱敏记录。
- 继续使用原项目 SSH 身份；不要生成或选择新的 Codex 私钥。
- 本文和相关增量可以交给队友审阅，但 GitHub 上传、提交、推送和正式发布仍由用户另行决定并亲自执行。
- 任何“在线”“已发现工具”“构建成功”“公网页面可访问”都必须与“真实业务回包”“真机”“手表 ACK”“服务器常驻”分开记录。
