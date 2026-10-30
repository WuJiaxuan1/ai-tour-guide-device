# AI Tour Guide Device：换窗口总交接（0.4.0）

> 日期：2026-10-30，Asia/Hong_Kong。
> 唯一工程目录：`F:\coding_projects\ai-tour-guide-device`。
> 当前线上：**0.4.0**，https://43.160.252.245/ （可加 `?v=040`）。
> 用途：回溯本窗口的产品决定、前端历次变化、真实实现边界、待办、后端/硬件对接、Git上传及慢加载问题。不是逐字聊天记录；“建议”不代表已经实现。
> 本轮只整理交接与诊断，没有代用户提交或推送Git，没有修改线上应用。此前写交接文件曾因自动审批服务额度失败未落盘，本文件为后来实际保存的版本。

## 0. 给新窗口的开场内容

```text
继续 F:\coding_projects\ai-tour-guide-device。
先读 AGENTS.md、docs/handoffs/project-handoff-20261030-v0.4.0.md、
frontend/AGENTS.md、frontend/CHANGELOG.md、第二次会议纪要。
线上已经是0.4.0，但本地0.4修改尚未提交Git，不能reset/clean或覆盖。
优先处理网页慢加载，以及问枫枫只有规则检索、缺少多轮智能体的问题。
正式路线必须按会议采用预设匹配和离线距离矩阵；不要扩大实时最短路。
先提醒我提供最终预设路线、报告固定数值和做好的互动彩蛋；语音也仍待团队选择。
硬件P7-test07依赖Android手机GPS和伴随App；网页与手表未同步。
firmware目录内有独立.git和未提交修改，不能直接当普通文件夹提交外层仓库。
不要代我Git commit/push，我要用Git Bash自己学；不创建整份发布副本。
项目中间文件放F盘.local-work，操作服务器先读取指定SSH日志skill。
```

新窗口先保护工作区，再复现问题，不重新从零设计整站。本文件是对话、当前代码、会议、硬件资料和公网测试的汇总；早期没有保存的中间版本不能伪造恢复。

## 1. 产品与长期约束

项目是栖霞山 **AI文旅智能导览项目／带实体终端的文旅智能体**，不是仅“StopWatch吉祥物”。游客扫码在Android/iOS浏览器打开网页，实物吉祥物内放StopWatch，小智承担语音，表上可看周边地图。

- 网页名称“栖霞漫游”，问答角色“枫枫”；硬件已有唤醒词“枫叶精灵”。两个名称不意味着已共享业务会话。
- 第二次会议主推情侣、闺蜜和朋友，兼容独行者，亲子仅备选；游客文案不强调“双人”或人数，不使用“赶／不赶”等倾向。
- 不主要宣传宗教；默认故事列表中栖霞寺第三，其他宗教相关内容后置。距离排序/真实路线不要为了内容偏好而扭曲地理顺序。
- UI保留白底、中文衬线标题、柔和粉玫瑰色和圆角。OpenUI Trip Planner是视觉方向，Promptrip参考地图＋卡片，TripTrace参考竖向行程组织。没有照搬这些产品全部功能，也不把公开源码视为无条件授权。
- 使用已安装 `frontend-design`、`ui-ux-pro-max` 做后续视觉调整，不每轮换风格。
- 游客界面去掉“演示”“静态导览”“整理自主办方”等开发说明；来源/核对记录留维护资料。高德署名和示意插画标识必须正常保留。
- 不确定的设计先讨论；确定/授权后直接做，避免反复征询。每轮写更新说明、验证和限制，不空着PR描述。
- Git由用户亲自学会，用Git Bash。未经新明确指令不代commit、push、合并PR或认证，不为绿格伪造历史。
- 不为了发布复制整份工程；项目中间输出在F盘 `.local-work/`。不把共享运行时、原始附件、聊天镜像当临时文件删除。ChatGPT镜像 `sources/`只读。

决策优先级：用户最新明确要求 → 第二次会议纪要 → 当前代码/运行证据判断做没做 → 旧文档/团队建议。知识包接入MD仍有实时高德算法的旧设想，不能覆盖会议的预设路线策略。

## 2. 文件夹、版本号和资料位置

```text
ai-tour-guide-device/
  AGENTS.md  README.md  .gitignore  .gitattributes  .env.example
  .env.local                         本机地图配置，不进Git
  modeling/
    concept-images/                  v1.0–v5.0外观意向图集中；不等于工程版本
    v00/ ... v05/                    建模工程、参数、预览、交付及机器切片任务
  frontend/
    src/ public/ tests/ CHANGELOG.md package.json
    node_modules/ dist/              自动生成、Git忽略
  backend/
    src/ data/ tests/ scripts/
    knowledge/qixia-kb-mvp-v1/        队友知识包
  stopwatch-nav/
    android/ firmware/ docs/ tools/ tests/
    reference/                       StopWatch官方PDF和STL，建模共同引用
    releases/ logs/                  发布包/日志，Git忽略
  project-files/
    organizer/                       主办方原始资料与ZIP
    team/server/                     服务器说明、防火墙CSV、SSH skill与私人设置
  docs/
    architecture/backend/            队友03–10号架构MD，尚不是可运行harness
    requirements/ meetings/ operations/ history/ handoffs/
  .local-work/                       私人运维、QA、打包与中间文件，Git忽略
```

收到的硬件当前功能MD放 `stopwatch-nav/docs/硬件端-当前功能介绍.md`。官方手册/设备参考统一 `stopwatch-nav/reference/`，别放team，也不要为建模重复维护一份。

单一模型版本的ZIP、交接说明随版本；跨项目状态/迁移记录在docs/history。原ZIP与展开文件有些重复，须哈希核对后再决定删除，不能仅凭印象删。尽量保留已有文件命名，路径主目录英文，收到的中文MD不必擅自改名。

建模 `v00–v05` 是顺序工程版本；AI意向图 `v1.0–v5.0` 是另一组图号。可编辑.blend/脚本/参数与exports导出网格用途不同，delivery为交付整理，gcode为具体机器任务。

前端始终在一个frontend目录开发，版本通过Git提交/分支/标签及CHANGELOG记录，没有每次复制v01/v02。软件0.1–0.4不等于每句话都提交过。旧工作文件在 `docs/history/frontend-workfiles-20261029/`，存在qixia-frontend、full-guide、ui-polish等快照，但不能保证全部独立可运行。

## 3. 前端从开始到0.4.0改了什么

### 初始选型与手机化

找过TripStar，用户认为界面不好看，选OpenUI视觉方向，并参考Promptrip布局。先完成探索、问枫枫、我的路线及接口适配层，等团队接口。手机使用真实响应式网页，不能只套一个手机外框；preview.html曾是预览工具，不是正式游客入口。

早期校园网/热点切换导致10.192.*和172.20.*地址变化，同Wi-Fi还可能设备隔离。网页是否在电脑标签里打开不是决定因素，服务进程和网络才是。后续公网HTTPS解决固定访问问题。

### 0.1.0：内容、字体、音频和地图网关

- 早期38条景点/主题；整理主办方图片，相册支持滑动、多图、大图。ZIP统计45张文件、41张不同内容，原件保留。
- 吉祥物从灰背景意向渲染图改成透明PNG，不直接贴整张效果图。
- 打包Noto Serif SC、Noto Sans SC，减少电脑/手机默认字体差异。
- 最初系统speechSynthesis导致不同手机音色不同；改为38条预生成WAV，播放器依媒体事件切状态，按钮固定宽度，不因“听一听/停止朗读”推挤。
- 接高德地图、安全代理、Web服务步行路线和栖霞区天气；天气显示发布时间，不冒充景区实测。
- 宗教内容默认后置，来源说明移出游客正文。

### 0.2.0：景点/设施与路线布局

- 探索分“景点故事／便民设施”；tag可横滑但隐藏滚动条。
- 匹配高德具体POI，单节点最多5张高德图；主办方多图保留。
- 缺图使用能看出非实拍的栖霞插画，不以缺图为由自动删除真实地点。
- 欢迎/路线按视口约束，路线局部滚动。
- 曾实现高德真实道路最短顺序；这是旧路线方案，后来会议已改变策略。

### 0.3.0：具体节点、竖向行程和上线

- 删除无具体导航位置、泛称和不能独立到访的条目，不用异地同名点替代。
- 曾成功访问官方小程序可见地图导览，转录停车、游客中心、餐饮、厕所名称地址并匹配；有JSON审计。不是景区所有设施已穷尽，也不是营业信息实时。
- 无可靠无障碍/饮水/医疗/母婴点则隐藏分类，不显示“暂无收录”。
- 地图缩略图、放大浏览、地点点击、初版手机距离排序。
- 参考TripTrace竖版图文时间轴，没照搬多日档案、票根/同行账户等整套功能。
- 游览开始/结束、手动到访、本机历史、照片保存/删除、文字记录下载；聊天含可打开地图与地点卡。
- 曾有春雨桥观察手记，不是队友最终剧情彩蛋；不能写成彩蛋已交付。
- 部署队长腾讯云服务器，云防火墙后来补IPv4 TCP443，公开网址固定。
- 旧版定位SDK转换后来复现失败，因此0.4作了真正修复；不能用旧文档“测过”否认用户反馈。

### 0.4.0：刚上线的最新版

- 手机顶栏56px单行：小吉祥物、三页签、更多菜单。新对话/历史收进菜单；桌面保留完整品牌。
- 探索和问枫枫“南京·栖霞山”顶部间距统一；标签瘦身，保留触摸面积。
- 故事页去掉服务tag；出入口归设施和行程首尾。
- 探索小地图默认无编号圆点、邻近点聚合，不移动真实坐标；上部内容滑走后地图吸顶，可折叠。主要可见卡片对应地点变突出定位标，设施同样处理。
- 进入探索/路线请求手机定位，WGS84由同源后端调用高德转GCJ02。卡片显示直线距离，用稳定定位锚点排序，避免每次GPS更新卡片乱跳。
- 路线页去掉探索悬浮入口和重复定位，保留一个定位按钮；高德版权/审图署名保留。
- 景点/详情/聊天/设施再次点击可取消，设施显示已选状态。
- 行程进入/离开门分别选，允许同门；普通途经点独立排序。停留改为快捷/自定义弹层。
- 去掉“最多选8点”的产品选择上限，11个途经点可保存；但旧算路端点仍最多8个不同节点（含门），完整预设引擎未接入。
- 新独立游览报告，在我的路线/更多菜单打开，保存图文PNG；旧到访记录与本机照片入口保留。
- 报告固定3.2km、180分钟、5地点，待用户给正式值替换，不是GPS实测。
- 12条景点知识、别名/偏好/部分FAQ接入规则查询，新增钟鼓楼。
- 线上0.4已完成；33项自动检查与公网手机尺寸、地图、模拟定位、报告导出通过。用户后续报告加载慢，性能问题仍未优化，见第12节。

## 4. 知识库接了为什么还“用不了”

必须区分：文件已放好、接口已读到资料、真正多轮智能体可用。这三项当前只完成前两项。

真实链路：网页agent.js → `/api/knowledge/chat` → Node server.mjs → knowledge.mjs关键词/别名/规则 → reply与placeIds → 文字、地图、卡片。

- 没有网页LLM，没有服务端会话记忆，没有接通小智网页文字通道。收到messages却只用最后一句；sessionId没有形成状态，routeIds也没有完整工具上下文。
- 当前12条知识覆盖：明镜湖、钟鼓楼、明征君碑、栖霞寺、舍利塔、千佛岩、乾隆行宫遗址、桃花湖、红叶谷、陆羽茶庄、太虚亭、栖霞老街与古镇。故事页25个点不等于知识问答全部覆盖。
- 部分FAQ需要近似原句精确匹配；中文时间、追问、代词和复合偏好没有完整理解。
- 现有推荐只给候选点，不代表正式路线能生成。

交接前公网复核：

| 用例 | 实际结果 |
| --- | --- |
| GET /api/knowledge/catalog | HTTP200，12条，版本qixia-kb-mvp-v1 |
| 给我讲讲彩虹明镜的故事 | HTTP200，返回明镜湖资料与mirror-lake卡片 |
| 明镜湖有什么特点 | 重复同一段讲解，没有按问题细分 |
| 它还有什么历史故事 | 返回历史文化景点推荐，不能承接上一景点 |
| 给我规划两小时的路线 | 返回若干点与追问，不是路线规划结果 |
| 附近厕所，不传位置 | 返回具体厕所，不声称最近 |

因此已确认的是**理解与业务闭环未完成**，不是整个知识接口宕机。用户具体失败输入、旧缓存或客户端报错仍须采样，不应统一推给缓存。

下一步：先复现问题/看Network状态和reply；明确网页文字模型由队长提供还是后端独立调用；加入会话、当前景点、结构化偏好及白名单工具；先检索证据再组织语言，未知事实明确未知。小规模结构化检索可以先用，不强制上向量数据库，但不能把关键词匹配当完整智能体。

保留 `{reply,placeIds}` 约定或提供适配；模型密钥只放后端。VITE_AGENT_CHAT_URL是构建时覆盖，改完要build；根.env.local现有三项地图变量不是模型凭据。真实鉴权接入时调整当前credentials:'omit'，服务失败不能悄悄用固定话术冒充在线模型。

## 5. 当前代码、知识文件和真实接口

| 入口 | 用途 |
| --- | --- |
| frontend/src/Qixia.jsx | 导航、问答、详情、收藏、选点、菜单 |
| frontend/src/data.js | 合并地点、设施与公开知识，统一byId |
| content/places.json、facilities.json | 位于frontend/src；26条原始景点含西门，34条设施；UI故事25/设施含西门35 |
| frontend/src/content/knowledge.json | 构建生成12条公开投影，别长期手改另一套 |
| frontend/src/agent.js | 问答适配与默认端点 |
| components/ExplorePanel.jsx、NavigationMap.jsx、MapPreview.jsx | 位于frontend/src；探索、聚合标点、吸顶/放大地图 |
| services/useVisitorLocation.js | 位于frontend/src；GPS/换算/错误生命周期 |
| features/navigation/RoutePage.jsx | 位于frontend/src；首尾门、时间轴、旧路线兼容、游览状态 |
| components/StayPicker.jsx | 位于frontend/src；停留弹层 |
| features/navigation/ReportPage.jsx、content/report-template.json | 位于frontend/src；固定报告与PNG，正式值替换位置 |
| features/navigation/JourneyReport.jsx、services/trip-photos.js | 位于frontend/src；旧游览/本机IndexedDB照片，不是云上传 |
| frontend/src/services/integrations.js | 上传/手表同步适配，尚无真实服务调用闭环 |
| backend/src/server.mjs、knowledge.mjs | 实际Node服务与规则检索 |
| backend/data/navigation-nodes.json | GCJ02具体导航节点 |
| backend/scripts/sync-knowledge.mjs | build前生成公开知识投影 |

知识目录 `backend/knowledge/qixia-kb-mvp-v1/`：01为12景点JSONL，03偏好，04规则，07统一ID，09时间规则；02/08为来源设施，05/06为维护核对，10是未启用候选路线，11为队友接入建议。未匹配设施不能凭近似坐标补进地图。原始来源路径/维护清单不放游客正文。

west-gate映射现有gate。钟鼓楼导航到钟楼：B001912JBJ，GCJ02 `[118.957481,32.151692]`；鼓楼是相邻独立建筑，不要混成新厕所或GPS源。

当前可用接口：

- GET `/api/health`、`/api/config`、`/api/weather`。
- GET `/_AMapService/...`，后端加securityJsCode。
- GET `/api/navigation/places?ids=...`。
- POST `/api/navigation/routes`：旧高德实时兼容，2–8个不同节点。
- POST `/api/location/convert`：WGS84→GCJ02。
- GET `/api/knowledge/catalog`、`/api/knowledge/pois/:id`。
- POST `/api/knowledge/chat`、`/api/recommendations`。
- GET `/api/facilities/nearby`：有效GCJ02位置才有直线距离排序。

`/api/recommendations`返回routeReady=false，walking/total为null，不能写成完整路线。西门不在12条专门讲解里，查询专门讲解404不等于ID映射失效。

## 6. 后端怎么继续搭建

项目已经包含Node22后端：密钥保护、天气、坐标转换、路线兼容、知识查询；不是仅纯前端。当前React19/Vite6主要JS/JSX。队友架构MD建议React+TypeScript、FastAPI/Pydantic/SQLAlchemy、SQLite/PostgreSQL，但这一批只是设计，没有安装/运行完整harness或数据库。

建议保留现有Node网关/静态托管，再接队友可运行模块。若统一FastAPI，先迁移兼容接口、回归测试再切Nginx，不能直接删除Node。不要无必要迁移整站或另起一套前端。

最小业务模块：知识/会话与模型工具；正式预设路线与矩阵；trip计划和手动到访；设备配对/Android路由分发；报告/记忆；独立照片贴纸。后端是跨网页/小智业务状态的权威来源，模型不得任意修改用户/设备/行程。

搭建顺序：

1. 要可运行源代码、依赖锁、env.example、启动命令、OpenAPI/样例、一正一反测试，不是仅MD。
2. 统一POI ID，补当前知识问答多轮与覆盖缺口。
3. 接正式路线/矩阵和RoutePlan，保留现有UI换适配器。
4. 建立tripId/deviceId/routeId/revision、认证与状态层。
5. Android先接一个目标点，再接完整路线与回执。
6. 再接笔记、记忆、贴纸及云端存储；不要拿本地照片适配器冒充完成。

队友文档的 `/api/knowledge/answer`、`/api/planner/recommend`、`/api/trips/...`、notes/memory等目前不是已经上线的真实接口。要做映射或统一契约。source_refs/verification_status:verified样例也不是全库已实地核验的证明。

网页问答当前请求形状：

```json
{"sessionId":"opaque-id","messages":[{"role":"user","content":"介绍明镜湖"}],"context":{"parkId":"qixia-mountain","routeIds":["mirror-lake"]}}
```

正式后端应使用历史消息/受控会话，返回证据ID、关联POI与未知标志；游客正文不打印维护路径。收到鉴权方案后调整前端凭据，不把模型Key放VITE变量。

## 7. 正式路线：仍在等团队数据

以第二次会议为准：2–3条可靠预设，门/时长/体力/兴趣条件匹配；封闭池自选点查预计算有向距离/时间矩阵，确定性串联；高匹配预设兜底的行为需团队确认。沿途考虑厕所/餐饮，不能让LLM编造折线、台阶、坡度或通行。

当前旧在线端点与实时最短排序代码仍保留，但不是最终方案。0.4允许选超过8点，旧端点还是最多8个不同节点含门，较大选点会提示无法生成连接并保留选择。不要把选择上限解除写成算路容量无限。

需要路线同学交付：最终routeId/版本/有序POI IDs/入口出口；真实道路折线与分段legs；有向距离/时间矩阵和不可通行边；停留/用餐/休息/机动/离园预留；难度依据；报告公里/耗时/文字固定值；可复现正常/失败输入。

总时长应是步行＋停留＋用餐＋休息＋机动，另留离园余量；现在没有完整正式数据，不用直线估步行。报告现固定3,200m/180分钟/5点，不跟用户真实走动累计。

现有路线契约包含schemaVersion、routeId/revision、GCJ02/lng,lat、有序stops、geometry、legs、distanceMeters/walkingSeconds；前端校验目前要求source.provider=amap。正式改preset来源要同步适配/测试，不只改后端字符串。

## 8. 硬件与StopWatch如何交接

### 当前真实链路

```text
语音：StopWatch → 网络 → 小智云 → 手表播报
地图：Android手机GPS → GCJ02 → 高德Android SDK出图
      → 热点/局域网HTTP → StopWatch
网页：游客浏览器 → 自建HTTPS → 当前地图/知识服务
```

以 `stopwatch-nav/docs/硬件端-当前功能介绍.md` 和P7-test07为准：**手表没有独立GPS，定位来自Android手机**。早期聊天“外接GPS”已经被后来的工程资料纠正；如硬件后来更换，需要最新源码/协议再确认。

P7-test07本轮真机验收通过不等于长时间/多机型全部通过。目前只是周边地图巡航，没有整条路线绘制、转向、偏航重算。Android需前台，后台/锁屏停止，恢复需重新开始。网页选点不会自动到表，小智不自动共享网页会话。

### 已有协议不能另起炉灶

- 手表HTTP8765，GET `/api/v1/status`，POST `/api/v1/image`、`/api/v1/position`。
- 最新chunk_protocol1、480块；QMAP v3/type3，96头＋480×480 RGB565LE的460800字节，共460896；像素CRC32。
- 手表显示240源像素窗口，铺466圆屏；预取/换块已有实现，别用旧240帧文档覆盖v3。
- north/west/south/east对应真实出图范围，GCJ02、北朝上、Web Mercator。
- position绑定session/frame_id/seq，GCJ02不能再转；有效年龄≤15秒、精度>0且≤50m，失效隐藏点。
- HTTP图像成功只表示收完/校验/排队；boot_id/image_session/image_displayed_id用于显示源安装确认，不等于物理屏幕刷新证明。

### 建议的下一步（尚未实现）

网页确认点/路线 → 后端保存trip/device/routeId/revision → Android用HTTPS拉取/订阅 → Android绘制同一条GCJ02路线 → 现有QMAP通道到表 → Android/固件回报 → 后端统一状态 → 网页展示真实ACK。

先一个固定目标点，再一条固定路线，然后下一站/到访/结束；最后重连、重复/旧消息、App后台、切语音页、图块失败等验收。当前syncRoute适配函数没有真实服务与绑定入口，queued不能当成received/displayed/navigating。

不要假定HTTPS网页可以直接请求HTTP私网手表，混合内容、CORS、本地网络权限和可达性都会有问题。**iOS网页可用不代表iPhone能直接驱动目前Android伴随地图链路**；需要团队决定专用Android桥接端或新的固件云地图方案。

向硬件同学要：最新APK/固件与完整源码；Android云端路线接收是否已有；设备绑定/鉴权/ACK和版本协议；GPS来源与坐标系；路线由Android烧图还是固件画矢量；小智MCP注册方法、schema与真实调用证据；前台限制和iOS取舍。

主要源码：Android的SurroundingMapActivity.kt、PhoneMapRenderer.kt、MapChunkPolicy.kt、LocalLinkClient.kt；固件板级local_link_server.cc、map_frame.h、stopwatch_pages.h。构建工具链/许可证/分区/资源都要保留，不只拷这几个文件。

## 9. mark事项与完成边界

| 项目 | 状态/后续 |
| --- | --- |
| 正式预设路线/距离时间矩阵 | 未完成；下次提醒用户提供，不擅自启用知识包10号候选 |
| 正式报告数值 | 报告UI/PNG完成；3.2km/180min/5点待替换 |
| 景点互动剧情彩蛋 | 队友正在做，未接入；下次提醒提供页面/资源/入口返回方式 |
| 自然统一语音 | 未接；百炼曾是优先候选，音色/账号预算待确认，没有开通付费TTS |
| 网页多轮知识智能体 | 未完成；目前规则查询，缺模型/上下文/完整工具调用 |
| 全景点知识覆盖 | 12条不是25条全覆盖，需补内容/别名/问法/证据测试 |
| 小智知识工具/共享会话 | 未完成；MCP不会自动注册本项目HTTP接口 |
| 网页→Android→手表路线 | 未完成；缺配对、分发、绘图、ACK/版本与进度 |
| 手表转向/偏航与后台 | 未完成或受现状限制，见第8节 |
| iOS游客实物导航 | 架构待定，现有伴随端是Android |
| 独立照片转手账贴纸 | 未完成；必须与路线/里程解耦，上传→风格化→下载 |
| 云照片/跨设备分享 | 未完成；当前IndexedDB不是云上传 |
| 服务端trip/笔记/记忆 | 架构有建议，缺实际持久化与API |
| 景区设施穷尽/实时营业 | 部分完成；可靠具体点继续核对，缺数据不造空类别 |
| 真机GPS/微信浏览器 | 公网模拟GPS软件链路通过，真实权限/精度仍待验收 |
| 顶栏/间距/吸顶地图/重复定位 | 0.4已改；机型问题仍可按具体复现修 |
| 取消选点/设施已选/首尾门/停留 | 0.4已实现 |
| 超过8点选择 | 已解除；旧路由端点容量未解除 |
| 公网上线/IPv4 443/高德Key | 已解决，不再依赖校园网地址 |
| SSH身份与日志 | 原wujiaxuan钥匙已部署成功，临时agent已关闭 |
| 0.4版本Git保存 | 本地未提交；用户按第13节自己上传 |
| 硬件Git完整性 | 新发现内嵌.git与未提交修改，不能直接git add硬件了事 |
| 首屏慢、图片慢 | 已测出重资源/压缩缓存问题；本轮诊断未优化 |
| TLS续期 | 已有配置但未来成功未实证；当前证书11月5日到期，需复查 |

## 10. 服务器、地图配置与安全操作

腾讯云轻量：43.160.252.245:22，用户jxwu。工作路径 `/home/jxwu/apps/ai-tour-guide-device`。current指向 `releases/0.4.0-20261030T082053Z`，旧0.3.0-20261030保留回滚。

Node22服务 `qixia-guide.service`，仅监听127.0.0.1:18787；Nginx443，2500兼容旧链接；已有开机启动。域名暂无，使用有效IP HTTPS证书。配置 `/etc/nginx/sites-available/qixia-guide`。

高德服务端env在 `shared/.env.local`，权限600，各release链接它；本机根.env.local供本机。三个变量AMAP_WEB_KEY、AMAP_SECURITY_JSCODE、AMAP_SERVER_KEY。只有公开Web JS Key下发；securityJsCode/Web服务Key不进网页/Git/日志。

游客安卓/iOS网页统一Web JS Key；后端Web服务Key；原生Android Key还要求包名/签名SHA-1。已GCJ02不能再转，卡片直线距离不等于步行距离，栖霞区天气不等于景区传感器。

SSH必须先读 `project-files/team/server/ssh-operation-logging/SKILL.md`。用原身份 `C:/Users/Macaroon/.ssh/ai-tour-guide_ed25519`（wujiaxuan）；另一个Codex钥匙已按用户要求删除，不能重新生成。主机RSA SHA256为 `5OF28RSeYDMCf99Y1o7D0ItPOcn1s1xp2SR3A89D44g`，严格验证，不能自动接受变化。

密码只在本机Unlock wujiaxuan SSH key遮罩窗口输入；不发聊天、不保存。最近一次已解锁并发布0.4，随后临时agent关闭；旧deployment-agent.json不是仍可用的证明。私人工具/日志在.local-work/operations，操作前记录，结束检查双流/退出码/哈希，不公开发布。

收据 `.local-work/operations/verification-v04.json`，公网QA `.local-work/qa-public-v04.json`。发布包/激活脚本仅用于对应版本；后续不能盲目重跑旧脚本。

证书目录 `/etc/nginx/ssl/qixia/`；已有root ACME计划、webroot与reload hook。本交接公网再次核对：证书有效至 **2026-11-05 03:26:04 UTC**。配置了续期不代表未来续期成功已验证，临近须复查。

## 11. 建模/打印的前情与边界

当前主要做前端与联调，不应本轮重做建模。modeling/v00为早期Tripo/Blender，v01/v02为round1/2，v03早期螺丝，v04闭背隐藏卡扣，v05前圈曲面修复；意向图编号独立。

用户固定实物：腔内502固定磁铁和碎布填充，再用磁吸＋双面胶固定StopWatch，随时取出，不在屏幕上粘胶。不因切片粗糙/塌陷就擅改吉祥物主题主体。

v05任务：卡扣小样、主体0.08mm高精、约16h主体0.22mm、前圈0.10mm；任务编号不是模型版本。前圈04-ring-fine-010的README预计2h03m04s、PLA8.55g/2.866m，含支撑/附着，不为凑10–11h强行减速。实际机器耗时未保证。

2019年老机长时间打印安全须核对实机，不作无人值守安全承诺。本交接不改G-code，详见modeling/README和对应任务说明。官方硬件参考在stopwatch-nav/reference。

## 12. 网页慢与图片加载：实测诊断

原始报告 `.local-work/performance-v04.json`，390×844冷加载，真实公网，等待首页12秒后再打开探索等待12秒。本轮只诊断，没有修改线上资源/缓存，因此这些问题仍在。

| 本次测量 | 结果 |
| --- | --- |
| HTML首字节 | 约1.27秒 |
| DOM可用 | 约4.34秒；不代表所有图片已下载 |
| 首页资源 | 约30个资源、已记录传输约3.43MB |
| 最慢首页图片 | WebP约440KB、10.73秒；另有233KB、8.78秒 |
| 字体样例 | 约70–80KB一个分片，部分4.5–6.5秒，分片有多份 |
| 吉祥物 | 约241KB，样例约5.96秒 |
| JS/CSS响应 | 约336KB/268KB，未见Content-Encoding压缩 |
| 静态资源响应 | 未见明确Cache-Control；现有Node静态服务也没有ETag/Last-Modified协商实现 |
| 图片HTTP错误 | 此次未观察到同源资源404/5xx或requestfailed；不能替用户排除其他网络/时段的故障 |

已经确认的原因：

1. **小图仍请求大图。** 50px建议缩略图和手机卡片复用1500px原图，没有分尺寸缩略图/srcset。大图和照片数量保留没问题，但不能在所有场景用同一个大文件。
2. **缺图占位PNG约2.9MB。** 新钟鼓楼等缺实拍时会加载它；这个“兜底”比多张正常WebP还重。景区导览PNG另约2.1MB。
3. **中文双字体增加首访下载和并发。** 为跨端一致打包衬线/无衬线是用户明确要求，不建议直接换回系统默认；应做字集、加载优先级与缓存优化。
4. **静态资源没有明确长期缓存/协商配置，JS/CSS没有压缩传输。** 应核对并改善Nginx静态托管、gzip/Brotli和文件名带hash资源的缓存，而不是每轮简单重启Node。
5. **公网单资源本次耗时明显偏大。** 能确认传输等待慢；仅浏览器测量还不能判断是云服务器带宽上限、用户网络到节点链路、并发竞争还是其他原因。没有读取云控制台带宽套餐，不能断言已查明具体服务器带宽数值。

“图片没出来”还要区分：懒加载未触发、正在下载、请求失败、图已解码但框架未刷新。探索下方离屏图片部分complete=false是正常懒加载，不能当作全部加载失败。当前主卡片出错会换占位图，但占位图本身很重；相册没有统一失败重试/兜底，这也是需要补的体验。

下一轮优化优先级：

- P0：占位插画转轻量WebP/AVIF，吉祥物提供小尺寸；原图保留，不删主办方资料。
- P0：建议卡/列表缩略图约160/640px，详情按需取1200–1500px；使用srcset/sizes、明确宽高和异步解码。首屏关键图片优先，离屏lazy。
- P0：Nginx静态资源直接托管，带hash JS/CSS/字体长期缓存；HTML短缓存/需校验；图片变更带版本hash；API不套长缓存。
- P1：启用文本压缩，观察传输前后大小；字体字集/按需加载保留风格，必要时再讨论自托管CDN。
- P1：相册失败占位/重试、加载状态和低速网络验收，避免无限空白。
- P1：核对服务器带宽/传输速率和用户网络；若上CDN须与现有IP HTTPS/域名方案协调。

景点照片已保存在本站/assets/places或/assets/amap，不是每次到高德App临时抓取；地图SDK/底图则有外部请求。本次未捕获请求失败。

79MB静态assets目录含音频/照片/地图，但**不是每次打开网站都会下载79MB**。音频由播放器按需请求，本次首页测得约3.43MB；不要把整个目录体积当首屏传输。

## 13. 用户用Git Bash上传0.4.0

仓库：https://github.com/WuJiaxuan1/ai-tour-guide-device ，用户名WuJiaxuan1。

当前本地分支release/frontend-0.3.0，HEAD 28dc0f4，tag frontend-v0.3.0；父提交2e01586为0.2，4d3431d为建模，eda82ef为介绍。本地0.4仍未提交，线上部署不等于Git保存。

本轮只读ls-remote查到远端main为fa6e9611f561b04fef7d157f250b667019a863dc，而本地origin/main仍旧，说明本地引用过期。没有执行fetch/pull，不能根据本地旧引用判断GitHub缺前端。读取GitHub raw文件时遇到网络ECONNRESET，没有据此判断文件不存在。

frontend-history(3941654)和master(86157b1)保留另一条早期历史；本地提交/分支不是另一套完整工作副本。GitHub“Compare & pull request”是提示，0变更说明main已有提交；different histories不能强行乱合。用户希望真实多版本，保留已有提交与标签，不伪造未保存版本。

### 第一步：在Git Bash检查并建发布分支

```bash
cd /f/coding_projects/ai-tour-guide-device
git status --short
git switch -c release/frontend-0.4.0
```

若提示分支已存在，先看 `git branch --show-current`，不要加-f覆盖；确认是自己这次分支后用 `git switch release/frontend-0.4.0`。如果git status出现冲突/合并未完成，停止并看清状态，不执行reset。

### 第二步：定向暂存本次代码/资料，不提交硬件内层仓库

```bash
git add frontend/src frontend/tests frontend/package.json frontend/package-lock.json frontend/README.md frontend/CHANGELOG.md frontend/AGENTS.md
git add backend/src backend/data backend/scripts backend/tests backend/knowledge backend/package.json backend/README.md
git add docs/handoffs docs/requirements/visitor-update-0.4.0-20261030.md docs/architecture/backend docs/operations/deployment-20261030.md AGENTS.md
git diff --cached --stat
git diff --cached --check
git diff --cached --name-only -- .env.local .local-work project-files stopwatch-nav
```

最后一条应无输出；若出现私人/硬件文件，先用 `git restore --staged -- 路径` 取消暂存（不删除本地文件）。查看清单后再下一步，不用git add .。

这些命令包括运行知识接口所需原始JSON/JSONL及脚本；不是只上传frontend导致clone后build找不到backend知识文件。原资料中的内部来源路径/审阅记录需在公开发布前自行核对许可和分享范围，不能把资料原始路径暴露在游客正文。

不要上传根.env.local、SSH/签名、project-files、dist、node_modules、.local-work、机器G-code、构建缓存/安装包。根目录奇怪的 `e visitor guide 0.3.0 and deployment...` 未跟踪文件与失败截图不是正式源文件，此次不暂存，不擅自删除。

### 第三步：真实提交并推送新分支

```bash
git commit -m "Release frontend 0.4.0: knowledge integration and mobile refinements" -m "Add knowledge-backed replies, sticky maps, GPS conversion, route selection controls and a fixed photo report. Document pending presets, voice and watch integration."
git push -u origin release/frontend-0.4.0
```

认证窗口由用户自己完成；不在聊天发密码/验证码/Token。如果commit说nothing to commit先看status/log，不重复制造空提交。若用户未配置身份，才检查git config；之前成功提交过，不必为每次上传重新要邮箱。

### 第四步：在GitHub合并，保留历史

1. 仓库选release/frontend-0.4.0，点Compare & pull request。
2. base选main，compare选release/frontend-0.4.0；确认文件列表无.env/私人资料。
3. 标题可用“Release frontend 0.4.0: knowledge integration and mobile refinements”。描述粘贴：

```markdown
本次将前端升级为0.4.0，并接入团队知识库的景点讲解与规则查询。

- 单行手机顶栏、统一标题间距、吸顶/折叠小地图及卡片标点联动。
- 修复GPS坐标转换，统一设施/景点取消选择、首尾出入口和停留设置。
- 新增固定数值的图文游览报告和PNG保存，保留本地游览记录。
- 补齐交接、部署及知识接口说明。

验证：生产构建、33项自动检查及公网手机尺寸/知识问答/模拟GPS/报告导出通过。

待办：正式预设路线、自然多轮模型、语音替换、手表同步、图片/字体加载性能。
```

4. Create pull request → 无冲突后Merge pull request → Confirm merge。希望保留既有提交时选择Create a merge commit，不随意squash/重写历史。
5. 回main核对frontend/package.json为0.4.0，以及本交接文件。

可选发布标签，在刚提交0.4的分支执行：

```bash
git tag frontend-v0.4.0
git push origin frontend-v0.4.0
```

如果标签已存在先核对，不用-f覆盖。若只是上传文档/源代码，标签是辅助而非必须。

合并后更新本地：

```bash
git fetch origin
git switch main
git pull --ff-only origin main
```

如快进失败，先看分叉，不能强推。上述全部由用户执行，本轮没有代做Git修改。

## 14. 队友从GitHub下载、运行及连接硬件

### A. 先说明一个当前确实存在的硬件Git问题

`stopwatch-nav/firmware/.git`是真实内层仓库；HEAD为上游356541a，application/audio/board等有修改，local_link_server/map_frame/stopwatch_pages等新文件仍未在内层提交。外层git ls-files不会列出这套完整工作区；直接git add stopwatch-nav/firmware可能生成160000类型gitlink，队友clone不会拿到这些改动。没有正确.gitmodules与可访问子仓库也不能靠submodule update自动修好。

外层目前未跟踪的Android/说明等可上传文件仅约162个/21.8MB，其中官方PDF约19.85MB；这不表示1GB固件已全部可被外层Git上传。大量build/缓存应忽略，内层Git工作区则须单独处理。

**本次前端发布不要顺手git add stopwatch-nav。** 用户总体希望一个仓库，可下一轮在保存内层Git全部历史/未提交改动的前提下，把固件转为外层普通目录（优先建议），或明确采用有远端的正式submodule。不要删除.git丢历史，也不要只发上游commit的archive漏掉当前定制改动。本轮仅诊断，没有移动/删除内层.git。

在硬件源码正确发布前：队友可以从GitHub拿最新版前端/后端，再用硬件同学已给的完整P7工程；不能承诺单靠当前GitHub已经能取到完整硬件。需要全GitHub交付，先完成上述仓库整理并另做硬件提交。

### B. 下载前端和后端

推荐Git clone，不建议反复下载ZIP覆盖目录。队友装Git、Git LFS、Node22+（本机工具Node24也可跑，但服务器22为验证基线）。仓库有模型LFS，临时跳过模型大文件以免下载不需要的建模资产：

```bash
GIT_LFS_SKIP_SMUDGE=1 git -c core.longpaths=true clone https://github.com/WuJiaxuan1/ai-tour-guide-device.git
cd ai-tour-guide-device
git branch -a
```

如果0.4已经合并，默认main即可；若尚未合并：

```bash
git switch --track origin/release/frontend-0.4.0
```

如果已在该分支，直接git switch即可。需要模型/STL时再按LFS规则拉；前端图片/JSON不因跳过模型LFS而自动补齐硬件。

### C. 配置并启动网页

```bash
npm --prefix frontend ci
cp .env.example .env.local
```

队友在自己编辑器填自己的/团队授权高德配置，不在群聊粘密钥、不上传.env。缺Key时可先测知识HTTP，地图/天气需正确配置。

终端1（项目根）：

```bash
node backend/src/server.mjs
```

终端2（同一根目录）：

```bash
npm --prefix frontend run dev -- --host 0.0.0.0 --port 4175 --strictPort
```

电脑打开http://127.0.0.1:4175/；知识测试问“给我讲讲彩虹明镜的故事”。手机GPS要HTTPS安全上下文，普通局域网HTTP不能当正式手机定位验收。团队只想看成果直接用公网HTTPS，不必每人开发环境。

```bash
npm --prefix frontend run build
node --test frontend/tests/*.test.mjs backend/tests/*.test.mjs
```

构建会读取backend/knowledge并生成公开投影，所以必须克隆本次完整代码目录，不能只复制frontend文件夹。Sites模板产物需保留，但当前托管仍是队长服务器。

### D. 运行Android与固件

- Android：完整android工程，用Android Studio/SDK35、JDK21等与现有构建说明一致的环境；minSdk26，目前仅arm64配置。打开工程、配置自己的SDK路径，生成本地debug签名。
- 新签名SHA-1/包名com.qixia.stopwatchnav对应高德Android Key，不能拿Web JS Key直接代替。缺私下发布签名不阻止本地debug构建，但不能保证覆盖安装旧签名APK。
- 固件：需要ESP-IDF5.5.2、esp32s3、m5stack-stopwatch板级配置、分区/唤醒资源等。按P7-test07说明构建/安装/回退，不自动烧录。
- `stopwatch-nav/tools/build.ps1`当前还引用同级stopwatch-custom和MotoNav-main/.tools旧机器路径，不是clone完立即通用；队友需安装工具链并改成本机路径，不能把缓存当源码上传。
- 演示可用硬件同学给的成对APK/固件发布包，二者版本要匹配；releases被忽略，Git clone默认不会下载它们。

### E. 连起来的实际验收顺序

1. 独立跑网页与知识/地图后端。
2. 独立跑Android→表的P7周边地图，确认status、图块、位置和切页。
3. 后端新增设备配对与路线任务接口，Android接收一个网页选择的目标点。
4. 让Android显示目标点并通过原QMAP送到表。
5. 再送正式固定路线；前后端/Android/表用相同routeId/revision与GCJ02。
6. 实现/验证ACK、旧版本拒绝、重连、手动到访/下一站；再注册小智MCP工具复用同一个后端。

这是接下来的开发/联调清单，不是clone后已经自动联通的功能。队友需要Android路线接收代码和后端接口，不能只修改一个URL完成全部同步。

## 15. 资料入口与未知内容

先读frontend/CHANGELOG，docs/requirements/visitor-update-0.4.0-20261030.md，第二次会议纪要，知识包README/11号说明，docs/architecture/backend/03/06/07号，stopwatch-nav/docs/硬件端-当前功能介绍.md与P7-test07/P7协议，docs/operations/deployment-20261030.md。

旧navigation-integration.md仍有“手表GPS”“未公网部署”等旧段落，以本交接和新工程为准，不按旧段落回退。

曾提供飞书 https://feishu.doubao.com/docx/WFrBdPrYWoUwpCxQrJfcCsJSnT9 ，交接时工具读取不可达；不能保证本文包含未落本地/对话的飞书内容。需可读导出后补，不编造。

