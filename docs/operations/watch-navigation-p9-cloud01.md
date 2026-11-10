# 网页 → 服务器 → StopWatch：P9-cloud01 本地交付

2026-11-01，基于当前前后端及用户确认的 `2.2.6-p8-overview02`，新固件 `2.2.6-p9-cloud01`。本次为本地实现、构建和联调；未推送、未部署 VPS、未烧录手表。原有未提交的页面修改保留。

## 数据链路

1. 手机网页通过现有浏览器 GPS 上传原始 WGS84 坐标；后端仅转换一次为 GCJ02。
2. 网页“开始游览”建立活动行程，下一站为服务端首个 pending 停靠（包括入口）。按当前真实定位查询到下一站的高德步行道路。不能以两点直线或原整条路线冒充。
3. 后端用官方高德 JS SDK 在独立 Chromium 中渲染480×480底图，隐藏文字、保留来源标识。默认14级，必要时缩小，使路线全部点和目的地落入圆屏内。
4. 后端复用 Android 的 QRTE、QMAP v4、颜色及单调路线前缀匹配规则。地图和路线分开，定位小包更新；同一下一站不随每次GPS更新重新下载底图。
5. 手表主动通过HTTPS访问服务器，每约2.5秒查询一次，绕过手机热点的入站限制；无需服务器访问手表局域网IP。切到语音页停止新下载；回地图页恢复。
6. 确认到达/跳过后，下次同步生成到新下一站的路线。暂停、结束、配置变更、会话失效不继续显示旧的活动路线。当前底图可保留作背景。

这是“下一站全览”，不是自动转向导航。第一版不自动确认到访、不自动重规划、不让小智主动播报。网页须保持前台才能持续提供GPS；长时间锁屏不保证定位。

## 代码与接口

- `backend/src/watch/wire.mjs`：二进制编码、1～8米RDP简化、最大2048点、GCJ02坐标、CRC、进度匹配。
- `backend/src/watch/map-renderer.mjs`：独立官方SDK地图渲染；有界等待、空底图检测、串行任务队列、不使用用户浏览器资料。
- `backend/src/watch/navigation.mjs`：按行程/下一站缓存，定位时效、切站失效、设备确认。
- `frontend/src/features/navigation/WatchNavigationCard.jsx`：导航状态、导出本次行程的连接配置。
- 最新硬件源代码位于工作区 `D:/Study/yiqifen/stopwatch-nav/firmware`，本仓库旧硬件副本未覆盖。新文件为 `cloud_navigation.h/.cc`，局域网服务增加配置入口。

所有下列项目后端接口均使用 `Authorization: Bearer <token>`，不在URL中放凭据；现有会话会检查用户、行程、有效期。

| 接口 | 作用 |
| --- | --- |
| POST `/api/v1/trips/:id/device-binding` | 网页已有接口，生成12小时本行程设备凭据 |
| GET `/api/v1/trips/:id/watch/navigation` | 网页/设备读取准备、定位等待、暂停、ready等状态；ready含资源路径及位置包 |
| GET `/api/v1/trips/:id/watch/assets/:session/map` | QMAP v4，460896字节 |
| GET `/api/v1/trips/:id/watch/assets/:session/route` | QRTE，80＋16×点数字节 |
| POST `/api/v1/trips/:id/watch/ack` | 仅设备会话可确认当前会话、frame_id、route_revision |

确认表示图像源安装、路线接收，不是物理屏幕刷新截图。资源在切站、暂停、结束后返回409，跨用户或跨行程不可读取。缓存为内存，服务器重启后重新生成；不会把旧坐标伪装为新GPS。

手表局域网配置：POST `http://手表IP:8765/api/v1/cloud`，JSON为 `server_url`（origin）、`trip_id`、`token`。不通过小智MCP传输图像；语音8位码绑定与地图配置互相独立。公网必须HTTPS且证书有效；HTTP仅允许RFC1918局域网地址。配置保存在独立NVS命名空间，不清除小智绑定。

## 运行条件

- Node >=22，按 lockfile 安装 backend/frontend 依赖。后端新增 `playwright-core`；它不会自动下载 Chromium。
- 服务主机安装受支持的 Chromium/Chrome，并以可使用浏览器沙箱的普通用户运行，不能通过关闭证书或沙箱检查掩盖部署问题。
- `WATCH_CHROMIUM_PATH` 可指定浏览器可执行文件；不指定时探测常见Windows/Linux路径。
- `WATCH_RENDER_ORIGIN` 可指定高德JS Key允许的网页源；默认 `http://127.0.0.1`。渲染页由进程内拦截提供，不新增公开的密钥页面。
- 沿用根 `.env.local` 的 `AMAP_WEB_KEY`、`AMAP_SECURITY_JSCODE`、`AMAP_SERVER_KEY`，不得把后两者发到前端。
- 生产需要HTTPS网站、可用的定位权限和证书链。高德SDK加载域名/道路服务需要网络出口。首次渲染比位置更新慢。
- `HOST` 默认为127.0.0.1；局域网真机联调可显式指定主机LAN地址。此次没有开放端口/防火墙。手机访问普通LAN HTTP时无法使用浏览器GPS；需可信HTTPS或在测试时用明确标注的模拟定位。

## 交付与验收

固件目录：`D:/Study/yiqifen/stopwatch-nav/releases/P9-cloud01`，含应用、资源、overview02回退包、分区/哈希/回读校验脚本、源快照和中文验收说明。用其中 `flash_p9.py`，不要直接擦除整片Flash。

第一次：网页开始行程 → “同步到手表地图”下载配置 → 电脑与手表同LAN，通过 `configure_cloud.py` 写入 → 手表地图页同步。下载的JSON含短期凭据，不要提交到Git。新行程或12小时到期后重新配置。

测试记录：

- 后端76项测试通过，含无GPS等待、路线缓存、越权拒绝、ACK权限、暂停/切站失效和不回退进度。
- 真实本地HTTP流程通过：创建行程、开始、公开景区坐标模拟GPS、高德算路与SDK底图、设备凭据下载、ACK、暂停后旧资源409。测试行程已单独清理；没有把模拟GPS当作真机定位。
- 服务端真实二进制交给固件生产C++解析器，CRC/会话/几何、圆屏范围、邮箱与切页失效检查通过。
- 固件编译，原地图协议、真实桌面LVGL、语音恢复与开机音量100检查通过；56个未改动固件文件对照overview02哈希一致。
- 真机耗时、TLS内存、Wi-Fi恢复、触摸/语音竞争及现场GPS对齐仍待烧录验收。服务器生产部署需另行进行。
