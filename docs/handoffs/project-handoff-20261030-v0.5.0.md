# 栖霞漫游 0.5.0 交接：性能、规则多轮、官方路线与硬件边界

> 后续状态（2026-10-31）：四步向导、专属路线、本地手账及道路服务已部署为 `0.5.0-20261031-r2`。最新验收见 [部署记录](../operations/deployment-20261031.md)。下文“全部路线不可导航”等表述是此前快照；目前 R02 已有保存道路，专属路线可请求真实道路，缺坐标/出口仍明确拒绝。Git HEAD 仍为用户的 `91317a5`，后续本地修改未提交。

日期：2026-10-30。唯一工程：`F:\coding_projects\ai-tour-guide-device`。
本文件覆盖旧 0.4.0 交接中的现状描述，不改写历史记录。部署验收状态见文末。

## 已实施

### 1. 性能

- `frontend/scripts/optimize-images.mjs` 用锁定的 sharp 0.35.5 生成内容哈希 WebP（160/640/1280/最多1500px）。175 张图片的原件不动；衍生图约 47.9 MB，**不表示首屏下载47.9 MB**。
- 小推荐卡实际请求160px图；详情使用srcset，打开大图时才加载相应图片。缺图插画640px版41,418字节，原件约2.9MB。失败后有回退，图库可重试。
- 网站图标从原241KB吉祥物换成约3.7KB WebP；报告导出也使用优化图片。
- 中文字体保持 Noto Sans/Serif SC。首屏字形裁成变体小字库，其他文字仍按原Fontsource完整分片回退，避免只支持固定文案。生成代码、首屏文字清单、字库和许可证均保留。
- Node静态服务实现gzip、带内容哈希资产一年immutable缓存、其他文件no-cache重验证、ETag/304、HEAD、音频Range/206。HTML不长期缓存。
- `predev` 和 `build` 自动生成图片。图片衍生目录/favicon已Git忽略，避免几百个可复现文件混入发布选择。源图片和音频没有删除。
- `subset-fonts.py` 仅在首屏文字/字库更新时手动运行，依赖 `fonttools[woff]==4.68.0`；普通npm构建不要求Python。生成字体已经随源代码保留。

### 2. 知识与对话

- `/api/knowledge/chat` 消费最多30条输入中的最后20条记录；校验角色/长度/空请求，接口请求体上限128KiB。
- 景点指代承接、显式新话题优先于旧上下文、多景点指代追问澄清；时间、体力、兴趣和官方路线筛选条件可逐轮补充，返回 `context/sourceIds/unknown/knowledgeVersion`。
- 规则结果可跳转“我的路线”筛选；查询无法确认的当日运营、票价、红叶等仍提示现场核实。
- **不是LLM多轮智能体**。用户决定复用小智，但网页文字通道未打通；未选另一供应商，未加假模型回包。
- 会话状态使用浏览器提供的有界消息/上下文，不使用未经认证的共享服务端sessionId存储。没有跨设备会话或账号记忆承诺。
- 知识包12个点之外可引用既有景点资料作有限故事回退；来源标为catalog，不假称知识包新增。

### 3. 路线与接驳

按功能归档的原始资料：

- `docs/requirements/official-routes/official-shuttle-and-routes-v1.0.md`，12130字节，SHA256 `095FF175F7382A28C1C1E83593CF1B6F30F273E7522B348314DDE511E96D02B5`。
- `docs/requirements/official-routes/official-route-filter-matrix-v1.0.csv`，1104字节，SHA256 `21D2FA463687538600431D901346B8AEAE9000FBCEFF90EC7375A80DB139F515`。

移动后哈希一致，根目录旧文件按用户许可移除；内容可从上述新位置完整找回。

`npm --prefix frontend run sync:routes` 将资料生成到：

- `backend/data/routes/preset-routes.v1.json`：8条路线。
- `backend/data/routes/route-filter-matrix.v1.json`：11条实际观察到的筛选规则。
- `backend/data/routes/route-node-mapping.v1.json`：映射/未映射点位审计。
- `backend/data/transport/shuttle-lines.v1.json`：景区内6条、外部2条单程线。

普通build不自动重跑路线导入，避免覆盖团队后续补充的审核数据。重新导入前检查差异。

“我的路线”分官方推荐、自选地点、接驳车；沿用白底、中文衬线与玫瑰色。筛选匹配、已知无结果、未验证三者明确分开。所有官方路线可浏览/收藏，不把相似条件擅自视为已验证。

重复路过保留独立 `stopId`；地图编号保留原始序号，不能按过滤后的坐标列表重新编号。旧到访记录仍用placeId兼容，新路线按stopId记录，到访/照片/文字导出独立。

自选路线不再请求实时高德最短路，使用固定出入口、封闭已映射点池与预存有向矩阵。排序是稳定的最近邻，并非全局最短；验证距离/耗时/几何/GCJ02/端点一致性。缺数据保留用户选择，并可参考覆盖最多的官方路线；多余点不承诺“顺路可达”。新界面没有8点选择限制。旧实时端点为兼容保留，未扩大能力。

**当前全部路线 `navigationReady:false`，不能开始导航。** 尚有48个未解析实体（包括景点、附属设施、接驳站，不是48个缺失景点）；道路矩阵为空。不可通过改布尔值解除限制。

- R05：源文标7个景点，所列序列去重实际6个，保留冲突。
- R06：资料在太虚亭结束，返程/出口未交付。
- “青锋涧”不自动等同“青锋剑石”，“乾隆御花园”不自动等同“行宫”；接驳站也不以附近景点坐标冒充精确站点。
- 官方约时、各站停留和未来道路ETA分开。固定报告维持既有3.2km/180分钟/5点配置，不是这些新路线的实测值。

### 4. 手表与能力诊断

- `/api/devices/capabilities` 明示 `requiresAndroid:true, routeSync:false, acknowledgement:null`。
- `/api/capabilities` 返回脱敏知识模式/条数、小智连接状态、路线数量/道路边数/可导航ID、手表边界。无环境变量/密钥/私有来源路径。
- 手表页面和聊天不再暗示网页直连硬件。仅有服务器queued任务不能说手表已收到；配对、Android任务接收、表端received/displayed ACK仍待实现和实机联调。
- 未修改 `stopwatch-nav/firmware` 内层Git或固件，未烧录。原Android依赖没有被网页代码消除。

## 等待团队交付

1. 每条最终路线的版本、点ID、入口/出口、GCJ02道路LineString、有向距离米/步行秒、审核状态和固定报告数值；先解决R05/R06。
2. `walking-matrix.v1.json` 的真实有向edge，每边包含 `fromId/toId/verified/walkable/distanceMeters/walkingSeconds/geometry`；两端与点位坐标误差不得超过0.0002度。现在不联网猜路。
3. 小智网页文字接入方式、后端鉴权/会话约定、超时/错误和流式响应格式、工具调用/来源约束。密钥只留服务端，不能发聊天。
4. 设备配对鉴权、deviceId、routeId/revision、下发任务与Android/手表ACK、旧版本拒绝、重连/重试/下一站契约及实机。
5. 团队制作完成的互动彩蛋页面与接入约定。没有另造一个替换它；语音供应商替换、独立照片贴纸仍未接通。

## 验证与复现

```powershell
npm --prefix frontend ci
npm --prefix frontend run build
node --test frontend/tests/*.test.mjs backend/tests/*.test.mjs
node backend/src/server.mjs
```

- 自动测试：43项通过；包括来源、规则多轮/指代、筛选状态、封闭点池、重复停靠、确定性有向矩阵、gzip/cache/range和既有功能。
- 浏览器：Edge手机390×844、375×667、横屏844×390、桌面1440×900；8路线详情、R05/R06提示、接驳6/2条、11个自选、停留时间、PNG导出、聊天到筛选；无JS错误/横向溢出。
- 故障注入：路线、接驳资料503可重试；图片失败后图库可重试；减少动画模式无JS错误。
- 本地生产资源首屏约424KB/19资源；未拦截请求的独立测试，热缓存资源传输约300字节。**本机时间不能等同公网手机速度**。历史线上0.4记录为3.43MB/约30资源，服务器带宽瓶颈并未定位。
- 私人测试代码、报告、截图在 `.local-work/qa-v05*`、`.local-work/performance-v05.json`。功能测试拦截地图/天气只验证网页状态，不能当真实高德成功证据。

## Git与下一轮

- 当前分支 `release/frontend-0.4.0`；HEAD `91317a5` 已是用户的0.4提交。旧交接写“0.4未提交”已过时。
- 先前216项主要是未跟踪硬件/文档等，不是216个报错；不要为清数字去git clean/reset。此轮修改仍未commit/push，交付部署也不等于Git发布。
- 上传选择应包含 `shared/`、新增后端src/data/tests、前端src/scripts及字库/许可、package/lock、两份正式资料、说明与测试。仅上传frontend会缺少后端知识/路线依赖。
- 不要 `git add .`，不要暂存 `.env*`、project-files、.local-work、node_modules、dist、生成图片、stopwatch-nav/firmware内层Git或无关历史。仍由用户自己选择文件、提交及推送。

## 部署状态

0.5.0 已于2026-10-30上线原公网地址；活动版本为 `0.5.0-20261030-r1`，原 `0.4.0-20261030T082053Z` 保留。

- 使用原wujiaxuan密钥。最初批处理认证失败；随后用户在本机解锁原密钥，临时代理一小时失效，未新建身份或记录口令。
- 上传包130,060,481字节，SHA256 `6122c7ec1b45cf96b270e33f82e76e7124ae4cf0647e20f2f39d36841ab0be64`；远端先核对包哈希，在18788备用端口验收再切换18787正式服务。
- Nginx本站从16KiB请求体调为128KiB，启用HTTP/2和文本/JSON gzip。Node压缩响应不会再次压缩。原配置保存于新release的`nginx.before.conf`，修改后`nginx -t`通过。
- 公网浏览器实测：首屏资源 **422,034字节/19项（约0.40MiB）**；热缓存300字节。HTML另971字节。HTTP/2，页面load事件约1.21秒、TTFB约0.43秒。单次桌面Edge手机尺寸测试，不是实机普遍时延或服务器带宽结论。
- 公网真实高德地图/署名和模拟GPS点成功；R01地图编号2/4/6/8，正确保留未映射停靠的编号空位，未画假路线。
- 公网知识指代追问、逐轮路线筛选、超过旧16KiB的聊天历史、非法null请求400、接驳6/2条通过。无JS错误。切换地图时捕获部分高德瓦片`ERR_ABORTED`取消请求，不是景点照片404；离屏未触发的懒加载图不视作加载失败。
- 真实手机GPS授权/网络仍需要用户手机复核；小智、路线道路、硬件ACK没有因部署自动完成。
- 日志：`.local-work/operations/logs/20261030T130758Z-4340e5d9/operation.json`（上传）、`20261030T131254Z-0d3e47f9/operation.json`（切换）；均exit0、capture complete。公网验收`.local-work/qa-public-v05.json`及截图，HTTP检查见`.local-work/verify-http-v05.json`。
