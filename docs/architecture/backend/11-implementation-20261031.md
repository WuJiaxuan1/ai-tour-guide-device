# 五模块本地实现与联调契约（2026-10-31）

**当前更新（17:49）**：网站/后端已发布 immersive-r6，小智工具保持 mcp-r2。下面的初始实现状态是历史记录；以末尾增量章节和各次发布记录为准。用户已验证配对、下一站同步、到访同步、讲解、语音笔记进入回忆及location-r3定位测试。团队栖霞寺体验已取代行宫样例，设备主动开口尚未接通。

此文记录本次代码的真实实现，优先于本目录 03–10 中尚未落地的框架和接口建议。状态：本地实现与验证，未部署、未提交、未推送。生产现状仍以 `docs/operations/deployment-20261031.md` 和工作区服务器审计报告为准。

后续更新：北京时间2026-10-31 14:54:13，已部署网页和新MCP工具；新增 `POST /trips/:id/pair-device`（网页身份＋8位code）与私密桥接 `/bridge/tools`，配对码通过 `qixia_pairing_code` 获取。单台演示设备配对12小时有效。以下“尚未部署”描述为初次实现记录，最新验收与限制以 [trip-r1发布记录](../../operations/deployment-20261031-trip-r1.md) 为准；实物语音、真实图片生成仍未验收。

## 1. 技术选择与模块状态

保留现有 React/JavaScript/Vite 与 Node HTTP 后端，不迁移 FastAPI 或 TypeScript。新业务位于 `backend/src/travel/`，通过 `/api/v1/` 与旧接口隔离；原有地图、天气、知识库和预设道路数据继续复用。

| 模块 | 本次实现 | 限制与待验收 |
|---|---|---|
| 路线推荐 | 入口、出口、半天/全天、三档体力、老人/儿童独立布尔值；服务端筛选预设并返回最多 3 条；路线流程与特点、选择后固化快照 | 不足 2 条不补造。老人/儿童同时选择取已验证规则交集。当前仅 R02 道路资料满足导航条件，其余按资料完整度禁用开始 |
| 行程与导航 | SQLite 保存状态；位置上报、下一站、道路时间、手动到访/跳过、暂停/结束；SSE 与断线补拉；高德地图继续绘制预设路线 | 定位来自浏览器/手机，不是手表。后台或锁屏可能停止更新。不是高德完整逐向语音导航 SDK，未把高德语音转播至小智 |
| 双端问答 | 网页与设备工具共用知识、旅行状态与日志；DeepSeek 官方接口已真实验证；当前位置/下一站/时间/距离由确定性字段回答 | 小智官方云上的模型选型、工具选择成功率、ASR/TTS 和实物表情未验收；无法承诺全部语音转录已采集 |
| 回忆与照片 | 实际景点去重计数、总用时/暂停时间、用户明确表达的兴趣；结束行程提交摘要任务；照片上传、持久化任务和两份 PNG 下载接口 | 文本摘要已实调。图像接口未配置，真实照片转贴纸未验收；未接入外部仓库 skill，也未复制其授权受限内容；无编辑/删除后台 |
| 沉浸式讲解 | 行宫人物视角的原创可替换样例、合法分支校验、选择持久化；接近时建立待提醒记录，网页打开后标记 | 保留原 StoryWalk 文件，待团队成品接入此注册表。人物口吻是情景演绎，不是历史原话。待提醒不等于小智已经主动播放 |

动态红叶与活动使用 `backend/data/dynamic-info.v1.json` 的已核验、有效期内条目；初始为空，因此显示未知。不得把空数据说成“没有活动”，也不得把季节常识当作今日叶况。

## 2. 权威状态、身份与持久化

```text
网页偏好 → /planner/recommend → 选中预设 → /trips
网页 GPS/到访 → 服务端行程状态 → SSE → 网页刷新
小智云端选择 MCP 工具 → 绑定旅行的适配器 → 同一 /api/v1
问答/笔记/到访/沉浸选择 → SQLite → 文本摘要任务 → 网页
网页照片 → 服务器文件 → 独立图像供应商 → 记忆卡 PNG + 透明贴纸 PNG
```

`POST /sessions` 建立匿名网页身份，Bearer token 在数据库只存哈希。网页在 localStorage 保存 7 天有效凭证，可在同一浏览器重新打开；这不是账号登录。清除网站数据或凭证过期后暂不支持找回旧旅行，跨设备账号迁移未实现。不要将当前方案称为正式会员系统。

`POST /trips/:id/device-binding` 仅网页身份可调用，生成 12 小时有效、仅限该旅行的设备 token。适配器只从服务配置读取 token/trip ID，模型参数不得提供任意 owner/trip。设备不能创建旅行、上传位置或图片、下载图片，也不能查看其他旅行或其对话。

数据库默认 `.local-work/travel.sqlite`，媒体 `.local-work/travel-media/`，均被 Git 忽略。表为 sessions、trips、events、receipts、locations、chats、jobs。运行要求 Node >=22.13（建议已验证的 Node 24），使用内置 `node:sqlite`。

当前是单 Node 进程、单任务消费者。启动时将处理中任务放回队列，处理中的聊天标记失败。**不要多实例共享此 SQLite**。发布版本切换前需把数据库/媒体安置在持久目录并备份，否则相对发布目录会造成历史不连续；本次未执行生产迁移。

状态命令带 `client_event_id` 和 `expected_version`；成功重试返回原结果，不重复生成到访/摘要。状态版本冲突返回 409，客户端刷新后由用户再操作。位置只保存最新样本，事件不保存精确经纬度轨迹。历史问答保留原文；模型上下文采用最近窗口，不把历史全部无界发送给模型。

## 3. API 与字段

除创建会话外，都需 `Authorization: Bearer <token>`，token 不放 URL。错误结构为 `{ "error": { "code": "...", "message": "..." } }`。路径以下省略 `/api/v1`。

| 方法与路径 | 输入/结果 |
|---|---|
| POST /sessions | 无输入；token、session_id、expires_at |
| GET /capabilities | 文本/图像配置标志；主动语音、完整录音捕获仍 false |
| POST /planner/recommend | 见下方偏好 JSON；routes、count、status、warnings |
| POST /trips | client_event_id、preferences、route_id、revision；返回快照 |
| GET /trips、GET /trips/:id | 所有者最近旅行列表/单次完整快照 |
| POST /trips/:id/commands | client_event_id、expected_version、action，可选 stop_id；action: start/pause/resume/complete/confirm_visit/skip_stop |
| POST /trips/:id/location | client_seq、captured_at、coordinate_system=WGS84、location=[lng,lat]、accuracy_m |
| GET /trips/:id/navigation-context | 见下方状态说明 |
| GET /trips/:id/events?after=N | 单页最多 200 条，有序 server_seq；继续以最后序号补拉 |
| GET /trips/:id/events/stream?after=N | Bearer fetch SSE；1.5 秒 heartbeat，重连携带最后序号 |
| POST /chat | client_event_id、conversation_id、question，可选 trip_id/place_id；reply/placeIds/sourceIds/mode/unknown |
| POST /trips/:id/notes | client_event_id、text，可选 attraction_id/expected_version |
| GET /trips/:id/interactions | 最近 200 条已持久化问答及 web/device 渠道 |
| GET /conditions/maple、GET /activities | 带有效期及来源的动态数据，暂无有效数据时 unknown |
| GET /experiences、GET /experiences/:id | 注册表与场景/选择内容 |
| POST /trips/:id/immersive | client_event_id、expected_version、experience_id，可选 choice_id |
| GET /trips/:id/memory | facts 与最近 30 个 jobs |
| POST /trips/:id/jobs | client_event_id、kind=memory_summary 或 sticker，后者需 media_id；202 queued |
| GET /trips/:id/jobs/:jobId | queued/running/succeeded/failed；result 或 error |
| POST /trips/:id/media | 原始 PNG/JPEG 二进制、正确 Content-Type；单张 <=8 MB、每旅行最多20张，可选 attraction_id 查询参数 |
| GET /trips/:id/assets/:assetId | 受鉴权的二进制下载，不生成公开永久照片 URL |

```json
{"entrance_id":"west","exit_id":"west","duration":"half_day","intensity":"easy","has_elderly":true,"has_children":true,"limit":3}
```

`navigation-context` 包含 `trip_id/state_version/status/route/location/current_place/next_stop/estimate/off_route/progress/reminders/server_time`。经纬度为 GCJ02；原始手机 WGS84 在服务器转换。新鲜度阈值 90 秒，精度超过60米标记 low_accuracy。接近景点需要连续在45米内至少10秒；仅代表候选位置，**不自动写成确认到访**。当前地点在路线各停靠中查最近者，重复停靠优先待进行的那一次。当前位置距下一站采用高德真实步行结果；全程剩余时间包括后续固定路段与计划停留；缺失道路、过期定位或跳过造成路径缺口时返回 null。

问题映射：我在哪→位置新鲜度/当前景点；下一站→next_stop；多远→to_next_distance_m；多久→to_next_walk_seconds；逛完多久→remaining_total_seconds；走偏了吗→off_route；附近厕所→知识库设施与新鲜位置；这里的故事→current_place 与景点知识；这里有互动吗→reminders/experiences；记住这段感受→notes；我去了几处→去重后的 confirmed_attraction_count。状态不足时追问，不让模型猜。

## 4. 模型及小智接入

`.env.local` 是服务端私密配置，示例字段见项目根 `.env.example`。禁止将私密字段加 `VITE_` 前缀。当前真实供应商是 DeepSeek 官方平台，模型使用账号 `/models` 返回且已实调的 `deepseek-flash`，基址 `https://api.deepseek.com`。JD Cloud 另有独立配置，官方 DeepSeek Key 不能混用于 JD Cloud。Tracking ID 不是 API Key；每个请求单独生成 Trace-Id，凭证不写日志。

网页使用资料约束下的文本生成与确定性状态问答，**没有实现一个通用自主工具循环**。小智的意图/工具选择在其云端模型侧，ESP32/M5Stack 本体不运行此大模型。既有 MCP 连通并不意味着自动拥有我们的旅行身份、当前位置、记忆和主动语音推送。

新增 `backend/integrations/xiaozhi/trip-stdio.mjs`，支持 JSON-line initialize/ping/tools/list/tools/call。四个工具为 qixia_trip_context、qixia_trip_ask、qixia_trip_note、qixia_trip_confirm_visit。使用现有 MCP pipe 启动此 stdio 程序，并私下提供 `QIXIA_API_BASE`、`QIXIA_TRIP_ID`、`QIXIA_DEVICE_TOKEN`。API 地址只允许 HTTPS 或本机 HTTP；服务端本机示例为 `http://127.0.0.1:18787`（实际端口按部署配置）。不把设备 token 发给大模型。

目前只测试适配器到业务 API。线上旧 MCP 的五项工具未替换，也没有重启其服务。仍需验证 pipe 与新 stdio 的协议兼容、断线恢复、真实语音调用及设备播报。仅被旅行工具接收的语音原文/返回值会进入业务日志，小智普通闲聊无法凭 MCP 自动全量捕获。主动提示需要可验证的下行通道与播放确认，待提醒事件不能冒充已播报。

## 5. 图像供应商契约

`travel-memory-card-duo` 是交互式 Codex skill，不是后端 API。原仓库许可限制复制/重新分发/商业托管，本项目未复制其提示词或技能文件。此处只提供独立、通用的图片服务适配接口。

配置 `QIXIA_IMAGE_ENDPOINT`（HTTPS）和可选 `QIXIA_IMAGE_API_KEY`。请求含 `task:travel_memory_duo`、`source:{image_base64,mime_type}`、`outputs:[memory_card,transparent_stickers]` 以及保留照片特征/配套/透明底要求。响应要求：

```json
{"memory_card":{"mime_type":"image/png","image_base64":"..."},"transparent_stickers":{"mime_type":"image/png","image_base64":"..."}}
```

贴纸必须非交错 8-bit RGBA、<=4M 像素；校验 PNG chunk CRC、实际 alpha、四角透明与非空主体，不接受把棋盘格画进不透明图片。照片与输出的视觉对应、主体数量、风格质量仍需真实供应商及人工图片验收。未配置时返回503，不生成固定示例成功结果。

## 6. 页面改动与验证边界

`Qixia.jsx` 切换到新 ServerRoutePage、askTravel、ServerMemoryPage、ServerImmersivePage；新增 `travel-api.js/useServerTrip.js`。保留原页面源文件、媒体和整体样式供 UI 同学对比；当前产品入口不再提供任意增删重排的个人路线。景点卡按钮改为“查看推荐路线”，历史列表说明本地删除不等于服务器删除。报告根据实际记录，手账未配置图像服务时关闭提交并说明未开放。前端同学合并时不要恢复旧 askAgent/local-trip 逻辑覆盖服务端权威状态。

基础回归：原后端23、前端26项；新增路线/状态/HTTP/导航/问答/回忆/图片任务/沉浸/MCP测试13项；生产构建通过。真实服务验收使用合成旅行，高德转换和步行接口、DeepSeek景点讲解和摘要、模拟设备工具共享状态通过。未将模拟设备当作实机验收；未将人工合成 PNG 的服务适配测试当作真实图像生成。

地图故障排查：本次本地预览原先缺少三项高德配置，而线上 `/api/health` 两个配置标志均为 true。已只读获取现有配置并存入被忽略且限权的本地 `.env.local`；本地标志已恢复，真实转换通过，未更改线上服务。地图底图不依赖 GPS 授权，GPS 只决定用户位置。当前还需要刷新浏览器核对实际底图、手机现场定位及路中提醒。

上线前仍需明确匿名数据保留/删除、备份与持久卷、单进程部署、公开服务成本配额和会话恢复；本次未把这些写成已实现功能。

## 7. 历史记录与单次删除（已上线）

新增ServerHistoryPage；回忆接口返回notes和最近20条interactions。DELETE /api/v1/trips/:id仅允许拥有者网页删除planned/completed行程，要求expected_version；删除对应在线记录和文件、撤销该行程设备绑定，保留其他行程。忙碌生成时拒绝；失败文件清理持久化重试。备份和本机聊天不随在线删除清除，匿名身份恢复仍待实现。部署及验收见 [history-r2记录](../../operations/deployment-20261031-history-r2.md)。

## 8. 路线外位置（已上线，用户已确认实物验收）

新增服务端高德逆地理编码，navigation-context的location.address提供查询状态与地址。网页、小智共享同一位置快照；新鲜定位优先判断路线景点接近，否则提供大致地址。低精度、过期和供应商故障不以旧地址代替实时位置；具体缓存与阈值见 [location-r3记录](../../operations/deployment-20261031-location-r3.md)。路线页新增“当前位置参考”。

## 9. 导航回答与状态（已上线）

新增navigation-replies统一生成guidance；距离/时间优先于下一站关键词；全程估算区分步行和停留。导航上下文增加remaining_distance_m和停靠状态计数，结束后next_stop=null。暂停不提供实时估算，恢复后等待本轮新位置；生命周期比较采用服务端received_at，captured_at负责新鲜度。偏离需连续3次且20秒，距离阈值max(70米,2倍误差)，不是自动重规划。契约和实物验证见 [navigation-r5记录](../../operations/deployment-20261031-navigation-r5.md)。

## 10. 团队栖霞寺沉浸式体验（已上线）

启用 temple-ming-life，停用行宫样例。网页栖霞寺卡和包含栖霞寺的路线卡有可点击胶囊，团队页面通过同源iframe集成；三次选择、长按托付和结尾节点共五步由服务器校验并持久化。回忆facts包含选择/完成记录，与实地visits分开。自由浏览不写行程。

活跃路线含栖霞寺、有效定位持续接近45米内至少10秒后生成一次提醒；前端只在同一活跃行程、当前位置栖霞寺且定位新鲜时显示询问弹窗。新增immersive-reminder接口确认进入/暂不体验，后者本行程不再自动弹出；已提前体验也不再弹出。历史行宫提醒不展示。

小智旅行查询能获取体验入口和待提醒，但 voice_delivery 仍为 not_connected。设备主动推送需另行确认固件及有播放确认的下行通道，不能靠MCP工具声明代替。详见 [上线与测试记录](../../operations/deployment-20261031-immersive-r6.md) 和 [设备接入条件](12-immersive-device-delivery.md)。

## 11. 手机体验性能与问答提示（immersive-r7已上线）

手机端使用轻量背景图及较少全屏效果；选择提交成功立即推进，导航刷新在后台完成，版本冲突补拉一次。新增navigation-context.immersive_hint，位置/下一站guidance和问答回复共用。提示与网页pending提醒分离：暂不体验后问答仍能提示，完成体验/离开/过期/暂停后不附加。无需设备主动播放接口。具体条件与验收见 [r7发布记录](../../operations/deployment-20261031-immersive-r7.md)。

## 12. 旅行回忆核对与下载（memory-r9已上线）

第3项沉浸体验已获用户实测确认；第4项现在新增语音笔记喜好证据、暂停与双端统计、展开沉浸式选择、摘要事实快照和过期标记、并发生成复用、完整文字下载及旧版兼容。92项本地检查与真实DeepSeek回忆验收通过，手机实际验收待用户完成。详见 [回忆契约](13-memory-records.md) 和 [发布记录](../../operations/deployment-20261031-memory-r8.md)。
