# StopWatch 当前交接：P9-cloud02

固件：**2.2.6-p9-cloud02**；Android 可选测试 App：**8.3.26-p8-overview01**。源码已更新到本分支最新快照。cloud02 已通过构建与本地自动/联网检查，真机联合验收待完成。

- 语音页：小智对话、枫叶精灵唤醒、全屏表情/触摸/IMU/震动，左键主动语音；开机重新配网、音量100。
- 地图页：暂停语音，向服务器查询到下一站的地图/路线/位置，显示全段路线、起终点、当前位置和已走颜色。
- 原生 MCP 配对工具：8位码在网页输入一次，同时关联语音与地图，保持联网后恢复未过期绑定。
- 最新 App 源码保留用于独立地图调试；网页＋服务器主方案不依赖它。

## 从这里开始

- [完整团队部署与分工验收](../docs/handoffs/web-watch-cloud02-20261101.md)
- [可直接烧录包、校验与回滚](distributions/P9-cloud02/README-验收.md)
- [cloud02 接口与验收](docs/P9-cloud02-验收.md)
- [总览协议](docs/P8-全程总览协议.md)、[路线协议](docs/P8-路线与配色协议.md)

`firmware/` 包含完整源码而非嵌套 Git 链接。`firmware/components/78__esp-wifi-connect` 是必须保留的本地改版。`tools/build_firmware.py` 是新电脑入口，需先激活 ESP-IDF5.5.2；不自动烧录。历史 tools/build.ps1 和 package_*.py 仍保留原机器路径和发布历史依赖。

`distributions/P9-cloud02/` 仅保留当前升级/overview02回滚包，约17MB；默认服务器 origin 是 https://43.160.252.245，测试域名由维护人员用 configure_cloud.py 设置。有效可信 HTTPS、配套后端与 MCP 是必需的。发布代码不等于已经更新了线上服务或实际手表。

历史阶段文档保留当时状态，不以其中“当前版本”为本分支最新状态。回滚文件、许可证、修改说明随包保留；私钥、签名、个人数据、managed_components和构建缓存不入库。
