# cloud02-r15 正式部署记录

日期：2026-11-01。当前网站：https://43.160.252.245/?v=cloud02-r15 。

发布目录：`/home/jxwu/apps/ai-tour-guide-device/releases/0.5.2-20261101-cloud02-r15`。
基础源码提交 `6cd67f3`，另含本次 MCP 符号链接启动修复；最终提交号见 Git 历史及服务器 release-info.json。分支仍为 `release/web-watch-cloud02-20261101`，没有合并 main。

## 已部署

- 最新秋色主题、路线时间线、进出口与景点坐标修订、历史报告、单一枫叶精灵配对入口。
- 配套行程/定位/问答后端，统一配对码与手表地图接口、真实高德底图渲染和下一站步行路线。
- MCP 桥接使用本次后端代码，云端发现 4 个工具：上下文、问答、笔记、确认到达。旧云端 qixia_pairing_code 不再提供，8位码由 cloud02 手表原生 self.qixia.get_pairing_code 提供。
- 安装发行版 npm 与 Google 官方 Chrome，地图生成保留浏览器沙箱，服务用 jxwu 运行。原 HTTP 监听18787，Nginx公开HTTPS不变。
- 手表固件并没有在这次服务器部署中被远程升级；用户已确认使用的 overview02 需自行刷 cloud02 才能体验统一配对与云端地图。

## 发布与保护

旧正式版本为 kb-r14。先生成1197个运行文件的SHA256清单，复用摘要一致的旧资源，仅传增量；前端使用在本机测试构建的 dist/client，后端运行必需的 src/content、knowledge、data、shared 等一并校验。服务器不包含全部前端设计原图，重新构建应从 GitHub 完整检出；这与运行所需资源齐备是两件事。

旧版本保留，运行数据继续使用 `shared/travel-data`。切换前对 SQLite 做在线一致性备份：

- `shared/backups/before-cloud02-r15.sqlite`
- `shared/backups/cutover-cloud02-r15.sqlite`

已有16条行程、19条问答、5个任务及全局绑定摘要，在切换前后及测试清理后保持一致。测试创建独立临时行程，清理仅针对测试行程，未替用户重新配对。

新增 systemd drop-in：

- `qixia-guide.service.d/90-cloud02.conf` 指定 Chrome 与渲染 origin。
- `qixia-mcp.service.d/90-cloud02.conf` 切换桥接到 current 对应源码。

未覆盖原私密配置、原桥接WSS和密钥；原服务配置备份位于服务器私有 `deploy-cloud02/`。

## 发现并修复

Node.js 将 import.meta.url 解析为真实发布目录，但 process.argv[1] 仍可能是 current 符号链接。旧主程序判断因此未执行桥接入口，进程退出并被 systemd 重启。改用 realpathSync 规范化启动路径，补充实际子进程经目录链接启动的回归测试。修复后 WSS 连接建立、initialize 与 tools_list(count=4) 已观察到，服务稳定运行、重启计数归零。未把“未观察到 heartbeat ACK 日志”写成新心跳验收通过。

## 验证结果

- 修复后本地80项、Linux80项后端测试通过；前端44项、Sites4项及生产构建沿用本次已通过结果。
- 预发布12项、正式HTTPS12项检查通过，含新版资源、真实模型回答、路线建立、配对状态、等待GPS、暂停/恢复。
- 在相同 systemd 沙箱限制下，隔离内存数据库的真实高德联调通过：一次码绑定两种上下文、底图460896字节、路线912字节、ACK、重配撤销；Chrome峰值约641MB，仅为本次测量。
- 正式HTTPS地图下载检查通过：模拟公开景区GPS、高德转换和步行路由、底图460896字节、路线720字节、ACK与暂停失效；未伪称真实手机GPS。
- 实际 MCP 到后端的只读鉴权查询成功；旧绑定仍指向已结束行程。
- 浏览器确认新版秋色首页/路线页、高德地图和出入口选项正常显示。
- 待用户验收：烧录cloud02、实物原生工具发现、8位码语音播报、真实手机GPS、手表TLS与画面、切页/唤醒/表情回归。

## 用户测试

1. 打开带版本参数的正式链接，看到最新秋色界面，检查景点、路线和历史。
2. 测试问枫枫的景点问答，开始游览并允许手机定位。
3. 刷 cloud02 后手表联网，问“请给我网页行程的配对码”，网页输入8位码。
4. 保持手机网页前台及手表联网，切手表地图页，核对到下一站路线、定位和已走颜色；到达/跳过后核对下一站更新。
5. 暂停/恢复、重载网页、语音与地图来回切换。原生配对工具未发现时先重连手表的小智会话，不能让模型编造码。

升级/回滚烧录脚本在 `stopwatch-nav/distributions/P9-cloud02/`；详见团队交接文档。

## 服务器回滚

已准备并保留：`/home/jxwu/apps/ai-tour-guide-device/deploy-cloud02/rollback.sh`。
该脚本将 current 原子切回 kb-r14，移除本轮两个90-cloud02 drop-in，重载 systemd并重启HTTP/MCP；继续使用共享数据，**不以备份数据库覆盖新数据**。回滚后旧云端配对流程恢复，cloud02原生配对接口将不可用，应与手表版本一起判断。

代码发布/部署已授权，真机烧录未在本次执行。运行审计与详细测试日志留在私有工作目录，不上传凭据或游客数据。
