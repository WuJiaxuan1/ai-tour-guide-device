# Navigation integration

更新：2026-10-29。已选择高德地图。手机网页采用地图与底部景点卡片布局，参考 Promptrip。下列 API 已在本地实现；团队公网部署、鉴权及跨端会话仍待整合。

## Responsibilities and keys

| 部分 | 责任 |
| --- | --- |
| 前端 | 地图、编号景点、卡片、路线选点和排序、加载/失败状态、绘制后端返回的折线 |
| 高德服务 | 地图底图与道路数据、实际步行路线计算 |
| 团队后端 | 核验景点坐标、鉴权与设备绑定、调用高德步行 API、保存路线版本、GPS 坐标转换、为手表提供地图资源 |
| 手表固件 | GPS 采集、收图/显示/确认、导航界面切换；具体传输待源码确认 |
| 小智/MCP | 经团队实现的工具查询/创建路线；不会自动替代地图或设备接口 |

游客扫二维码打开的是 HTTPS 网站，安卓和 iOS 浏览器共用 **Web端（JS API）Key**。后端另用 **Web服务 Key** 调用步行等 HTTP 服务。原生 App 才使用对应的 Android/iOS SDK Key，队友现有 Android 调试 Key 不直接复用于本网页。

在 [高德开放平台](https://lbs.amap.com/) 创建项目应用，新增 Web端（JS API）Key。配套的 `securityJsCode` 留在服务器，由 `/_AMapService/` 安全代理附加；Web服务 Key 也只放后端。核对使用权限、配额及使用条款；不要把密钥发进聊天或提交 Git。

## Frontend configuration

复制 `.env.example` 为 `.env.local`，填写后重启或重新构建：

```dotenv
VITE_AMAP_KEY=网页JSAPI_Key
VITE_AMAP_SERVICE_HOST=/_AMapService
VITE_NAVIGATION_PLACES_URL=/api/navigation/places
VITE_ROUTE_PLAN_URL=/api/navigation/routes
VITE_AGENT_CHAT_URL=/api/chat
```

Vite 已将 /api 和 /_AMapService 同源代理到本机127.0.0.1:8787。建议由同源反向代理提供这些地址；若使用跨域地址，后端需配置允许的来源。当前请求不携带 Cookie，鉴权收到后单独适配。所有 VITE_* 都会出现在浏览器，禁止放 securityJsCode、Web服务 Key 或模型密钥。

代理按高德官方文档配置 `/_AMapService/` 固定前缀，转发到高德并追加 jscode。限制需要的服务路径、来源和频率，避免成为任意公共转发服务。本次未修改团队服务器 Nginx、防火墙或密钥。

## Place catalog

`GET /api/navigation/places` 返回：

```json
{"coordinateSystem":"GCJ02","coordinateOrder":"lng,lat","places":[]}
```

每条位置格式：`{id, location: [经度, 纬度]}`，ID 对应 `src/data.js`。团队需核对景点名称、实际可到达入口及道路吸附位置。主办方资料未提供可直接使用的 GPS 点位，当前不猜测坐标或放假标记。地图初始相机中心仅为栖霞山区域概览，不是路线端点。

## Walking route contract

`POST /api/navigation/routes` 请求：

```json
{"schemaVersion":"1.0","travelMode":"walking","stopIds":["temple","pagoda"],"coordinateSystem":"GCJ02","coordinateOrder":"lng,lat"}
```

返回 `{ "route": ... }`，route 的字段：

| 字段 | 格式 |
| --- | --- |
| `schemaVersion` | `"1.0"` |
| `routeId`、`revision` | 非空路线 ID、从 1 开始的整数版本 |
| `travelMode` | `"walking"` |
| `coordinateSystem`、`coordinateOrder` | `"GCJ02"`、`"lng,lat"` |
| `source` | `{provider: "amap", generatedAt: ISO时间}` |
| `stops` | 按请求顺序的 `{id, name, location: [lng, lat]}` |
| `geometry` | `{type: "LineString", coordinates: [[lng, lat], ...]}`，2–20000 点 |
| `distanceMeters` | 高德实际步行距离，非负数 |
| `walkingSeconds` | 高德步行耗时，非负数，不含停留 |
| `steps`（可选） | `{instruction, location, distanceMeters, walkingSeconds}` 数组 |

多个景点可由后端逐段调用高德后合并，保留途经点和转向。未提供路线时返回明确错误，禁止以直线或大模型编造折线代替道路。园内小路、入口和通行限制需现场核验。

前端取消过期请求、清除旧路线，检查坐标系、经纬度顺序、点位顺序、几何形状及非负距离/时间。WGS84 数据不能直接叠在 GCJ02 地图上。现有测试只使用合成坐标校验协议，不作为真实路线示例。

## Hardware integration pending

目前照片证明测试图发送、显示与序号确认，不能证明定位或真实高德地图已接通。请硬件同学提供当前发图测试页、手表收图与 GPS 相关代码，核对地图区域宽高、图片编码/字节序、单包限制、请求方式、确认/重试格式和 GPS 样例。

以新交接工程为准：当前位置来自 Android 手机 GPS，Android 已将 WGS84 转为 GCJ02；服务端和网页不得再次偏移。下一阶段按实际固件定义地图帧和设备会话，使网页和手表使用相同 routeId/revision。当前前端未向手表发送位置或图片。

## Project folders

```text
ai-tour-guide-device/
  modeling/                    意向图、参考、各版本工程及对应交付
  frontend/                    网页源码、资源、测试、依赖配置
    src/components/            地图等界面组件
    src/features/navigation/   路线页面及样式
    src/services/              高德加载、景点和路线接口适配
    public/assets/             网页图片
    public/licenses/           随站点资源的第三方许可
  project-files/
    organizer/                 组委会原始资料
    team/server/               队友提供的服务器说明和配置资料
  docs/
    architecture/              跨前端、后端、硬件的架构和接口约定
    requirements/              产品需求
    meetings/                  会议记录
    history/                   历史状态与迁移记录
```

`dist/` 是自动构建产物，`node_modules/` 是可重装依赖，均不手工编号或提交为源代码。前端不采用建模式 v01/v02 复制，后续以 Git 提交和发布标签管理。收到后端可维护源工程后新增根目录 `backend/`；收到固件源工程后可新增 `firmware/`。原始交接包可留 `project-files/team/`。本次未移动已有模型、压缩包或组委会资料。

## Before public use

完成配置后验证底图、实际入口、步行道路折线、服务返回的距离/时间；在安卓和 iOS 真机验证字体和卡片交互。最终域名需 HTTPS 且校外可访问，二维码指向公开地址；10.x 局域网地址只用于联调。

官方依据：[JS API 准备](https://lbs.amap.com/api/javascript-api-v2/prerequisites)、[安全代理](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)、[Web服务步行路径](https://lbs.amap.com/api/webservice/guide/api/newroute)。


## 2026-10-29 implemented local gateway

本地后端已实现 `/api/config`（只返回公开网页 Key）、`/_AMapService/`（服务器追加安全密钥）、`/api/weather`、`/api/navigation/places?ids=...`、`/api/navigation/routes`。根目录 `.env.local` 是配置入口，不是前端 VITE 配置。天气缓存20分钟，路线缓存10分钟；景点依名称和栖霞山区域查询，多个同名结果会拒绝自动选择。优先完整名称/名称后缀匹配，不使用停车点、售票处替代主体。地图 API 返回位置不等于实地入口已核验，响应保留 `entranceVerified:false`。

路线按用户指定的2至8站逐段查询高德步行 API，保留实际折线、距离和耗时。未找到可确认位置或道路时返回明确错误，不生成直线假路线。上述接口是本项目实现，仍需与团队后端鉴权、存储和部署方式合并。

当前硬件 P7-test07：Android 输出480×480 RGB565LE、QMAP v3/type3，总460896字节；手表显示240源像素窗口并铺满466圆屏。HTTP端口8765，状态/图像/位置分别为 `/api/v1/status`、`/api/v1/image`、`/api/v1/position`。地图和位置已是GCJ02，按会话、帧号和序号绑定。浏览器不能假定可直接从HTTPS访问手表HTTP私网接口；下一步应由现有Android伴随App接收服务器路线并沿用已验证的图像链路。此次没有修改、构建或烧录固件，没有宣称网页路线已经同步至手表。

## Content and audio

现有38条覆盖速查表21组点位及正文、相册中的补充点；历史行宫建筑名称保留在相关故事中，不将已消失房间伪装成可到访独立建筑。ZIP共45张、41张不同内容，网页使用41张优化图；原包不改。音频为本机已安装中文声音预生成的38个16kHz单声道WAV，合计约17.8分钟，随站点提供。动态自由问答/TTS仍需真实团队服务，不能把固定讲解等同于已接通大模型。

## 2026-10-29 update

Selected POIs now live in backend/data/navigation-nodes.json, with separate frontend facility catalog. Routes support optimize and returnToStart booleans; the first stop remains fixed and optimized responses include optimization metadata. Order optimization uses a directed AMap walking-distance matrix and Held–Karp, at most eight stops. Static narration is unchanged. Full node inventory: ../requirements/navigation-nodes-20261029.md.
