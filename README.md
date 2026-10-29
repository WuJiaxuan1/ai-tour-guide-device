# Qixia Travel Companion

手机优先的栖霞山情侣导览网页。安卓和 iOS 游客扫码后均在浏览器使用同一套网站，无需安装 App。

## Development

Node.js 22+；`npm ci` 后运行 `npm run dev -- --host 127.0.0.1 --port 4173 --strictPort`。

`npm run build` 输出静态网站 `dist/client/` 和模板附带的 Sites 适配文件。`npm test` 检查问答接口、导航数据约定和托管适配器。正式提供给游客时，由团队服务器托管构建结果、配置域名与 HTTPS，二维码指向公开网页地址。

## Implemented

- 探索、景点详情、收藏、浏览器朗读、对话历史，以及可添加、移除、排序的路线景点。
- 吉祥物使用透明 PNG；原始外观意向图保留在建模目录。
- 随网站提供 Noto Serif SC Variable 与 Noto Sans SC Variable 字体，避免依赖手机/电脑的默认中文字体。字体分片由浏览器按需加载，不依赖 Google Fonts 在线服务。
- 情侣主题建议、轻量入场和点击动效；尊重系统减少动态效果设置。
- “我的路线”为地图与底部景点卡片布局；支持高德 JS API 2.0、编号标记、真实路线折线、选点聚焦、缩放和全览。
- 问答与路线适配层分别位于 `src/agent.js`、`src/services/navigation.js`。

## Configuration and actual integration status

复制 `.env.example` 为 `.env.local`，填写后重启开发服务或重新构建。

| 配置项 | 用途 |
| --- | --- |
| `VITE_AGENT_CHAT_URL` | 团队问答接口，可使用同源 `/api/chat` |
| `VITE_AMAP_KEY` | 高德 **Web端（JS API）** Key；安卓/iOS 浏览器共用 |
| `VITE_AMAP_SERVICE_HOST` | 安全代理，例如同源 `/_AMapService`；服务器附加 `securityJsCode` |
| `VITE_NAVIGATION_PLACES_URL` | 团队已核验景点位置接口 |
| `VITE_ROUTE_PLAN_URL` | 团队步行路线计算接口 |

当前未提供高德网页 Key、安全代理或团队后端；已完成接入代码，不代表外部服务已经开通或联调通过。未配置时，不请求地图 SDK，不绘制虚构的地图/坐标/路线，页面明确提示连接状态，并保留景区导览图入口。景点卡片的数量不等于已完成路线计算。

问答未配置时，仅提供主办方资料整理的本地景点内容，“关于”说明自由问答尚未连接。配置真实接口后，失败显示错误，不替换成假 AI 回复。已有历史对话保留在浏览器本地。

路线数据必须来自后端：GCJ02、经度在前、已核验点位、高德实际步行折线、实际距离与步行耗时。改变景点顺序或移除景点会取消旧请求并清除旧路线。错误数据不会降级成直线导航。手表外接 GPS 的 WGS84 数据需在服务器统一转换；前端不假装已接通硬件。

完整接入步骤和前后端分工见项目根目录 `docs/architecture/navigation-integration.md`。

## Source structure

```text
src/
  Qixia.jsx                   页面容器，探索、对话、详情和导航切换
  data.js                     主办方资料整理的景点内容
  agent.js                    问答接口适配
  components/NavigationMap.jsx 高德地图显示与清理
  features/navigation/        路线页面及其样式
  services/amap.js            SDK 加载与安全代理配置
  services/navigation.js      位置/路线接口及返回值校验
public/assets/                直接使用的图片等静态资源
public/licenses/              随站点资源的第三方许可
tests/                        接口与关键数据校验
```

## Agent contract (proposed)

POST：`{"sessionId":"uuid","messages":[{"role":"user","content":"一起看红叶"}],"context":{"parkId":"qixia-mountain","routeIds":["autumn"]}}`

返回：`{"reply":"后端实际回复","placeIds":["autumn","tea"]}`。

有效 ID：`autumn`、`temple`、`pagoda`、`buddha`、`tea`。支持非流式 JSON、45 秒超时与取消。与队友实际接口核对后再调整。VITE_* 均会进入浏览器，禁止放 Web服务 Key、securityJsCode、模型密钥、私钥；真实鉴权收到后单独接入。

## Sources

视觉方向参考 OpenUI Trip Planner；本项目为独立实现，未复用其未获授权的应用源码。导航布局参考 [Promptrip](https://github.com/sergfv/promptrip)，按现有网站的字体和配色实现。

照片和景区导览图来自 `project-files/organizer/`。文字依据主办方两份参赛资料；`tea` 的照片为“白乳泉试茶亭”摩崖题刻，不是亭台建筑或白鹿泉遗址。Noto 字体采用 OFL-1.1，Lucide 图标采用 ISC，随依赖保留许可。
