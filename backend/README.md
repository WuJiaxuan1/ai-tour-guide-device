# Qixia navigation service

Node.js 22+，无额外 npm 依赖。`npm start` 默认监听127.0.0.1:8787；`npm test` 检查上游失败、坐标解析和路线合并。前端Vite已代理 `/api/` 和 `/_AMapService/`。

根目录 `.env.local` 是唯一推荐的地图配置入口；每次请求读取，改好保存即可。`AMAP_WEB_KEY` 为公开网页Key，`AMAP_SECURITY_JSCODE` 和 `AMAP_SERVER_KEY` 永远不下发浏览器、不写入日志。

- `GET /api/health`：仅返回配置是否存在，不返回密钥。
- `GET /api/config`：仅返回网页公开Key及同源安全代理地址。
- `GET /_AMapService/...`：固定高德上游代理，服务器追加安全密钥。
- `GET /api/weather`：真实栖霞区实况与预报，缓存20分钟，带发布时间。
- `GET /api/navigation/places?ids=a,b`：仅解析已选景点，不一次批量消耗全部地点查询；无明确匹配的地点列入unresolved。
- `POST /api/navigation/routes`：按选定顺序规划2至8站，返回高德真实步行折线、距离与耗时，缓存10分钟。

`data/poi-overrides.json` 供团队写入实地核对的位置，格式 `{ "景点ID": {"verified":true,"location":[经度,纬度],"poiId":"可选"} }`。所有位置为GCJ02；不把手机已经转换的坐标再次偏移。未核对的自动POI响应保留entranceVerified:false。服务重启后重新读取位置覆盖与缓存。

构建前端后，服务也可托管 `frontend/dist/client`，支持音频Range请求。正式环境应由团队配置HTTPS反向代理、公开域名、平台许可与来源限制、访问控制和容量策略。现有内存缓存/节流只用于当前轻量项目阶段；0.4.0已部署到队长服务器，未连接Android/手表会话，也未接入小智MCP。完整设备协议见stopwatch-nav/docs。

## Knowledge integration — 0.4.0

Runtime data: `knowledge/qixia-kb-mvp-v1/`. Original incoming documents remain unchanged. Source references and maintenance checklists are not public API fields.

- `POST /api/knowledge/chat`: `{messages:[{role:"user",content:"给我讲讲明镜湖"}],context:{location:[lng,lat]}}` → `{reply,placeIds,mode:"knowledge",knowledgeVersion}`. Optional location is GCJ02, used only for facility ranking. Deterministic knowledge retrieval; no model credentials needed.
- `GET /api/knowledge/catalog`, `GET /api/knowledge/pois/:id`: public narrative projection. Alias registry resolves canonical IDs. `west-gate` maps to `gate`, but gate has no standalone narrative in this twelve-POI pack.
- `POST /api/recommendations`: interests, availableMinutes, effort, personaId → selected concrete IDs, reason, routeReady:false and partial timing. No official/final preset is implied. Walking/total timing is null until road data is supplied.
- `GET /api/facilities/nearby?location=118.96,32.15&type=厕所`: canonical facility IDs and actual straight-line distances. No location means no nearest claim.
- `POST /api/location/convert`: `{coordinateSystem:"WGS84",location:[lng,lat]}` → `{coordinateSystem:"GCJ02",location:[lng,lat]}` via AMap Web service. Credentials remain server-side.

Build public knowledge with `node backend/scripts/sync-knowledge.mjs` from root; frontend build runs this automatically. Changing raw knowledge requires restarting the backend and rebuilding the frontend projection. Do not publish the raw folder as static assets.

The incoming `docs/architecture/backend/` is a proposed architecture, not an installed/runnable harness. API names there are future team contracts. The implemented endpoints above preserve the existing browser adapter and are documented explicitly. Meeting preset-route strategy overrides the knowledge handoff's older live-optimizer assumptions. Formal preset data is pending.
