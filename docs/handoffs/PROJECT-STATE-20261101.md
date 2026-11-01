# 项目最终归档与接手说明

日期：2026-11-01（北京时间）。用户结束当前阶段、归档并将自行删除旧工作区。本轮只整理、验证、上传GitHub分支，不改线上服务、不刷机、不删除原文件。

## 唯一接手入口

- 仓库：https://github.com/WuJiaxuan1/ai-tour-guide-device
- 分支：`release/web-watch-cloud02-20261101`，**不是main**。
- 空对话提示词：[AI-RESUME-PROMPT.md](AI-RESUME-PROMPT.md)。克隆后先读根AGENTS.md和本文。
- 服务器：https://43.160.252.245/ ，实际发布 `0.5.2-20261101-cloud02-r15`，部署源码提交 `f7e59eeef719163414a95860cbdce200b84d1b5f`。
- 归档提交补资料、备用工具和历史代码，不代表再次部署。只读核对：108个本地对应业务/测试/脚本文件与线上一致（文本换行归一化后）；13个服务器独有历史验收脚本已另存。

## 产品与各部分合作

栖霞山“枫叶精灵”由手机网页、项目服务器、StopWatch语音/地图设备组成。网页让游客选景点、进出口和路线，上传手机GPS；服务器保存行程、转换高德坐标、规划道路并渲染地图；手表主动查询自己的地图与路线。公网服务器不能直接访问手机热点内的手表，手表没有GPS。

语音经手表麦克风传给小智云，云端负责识别、模型和语音合成；本项目服务器MCP提供行程、知识、笔记和到访工具。网页模型与小智云模型是两套入口，网页DeepSeek Key不是小智接入点。

| 模块 | 当前实现 | 边界 |
| --- | --- | --- |
| `frontend/` | React/Vite，秋日主题，探索/游客服务、官方/专属路线、进出口、左侧时间线、地图、统一设备连接、历史/报告/原手账、寺庙沉浸体验 | 同门进出允许；保留原路线编辑和报告，不恢复用户已拒绝的照片布局。手机GPS依赖HTTPS、权限及前台运行。 |
| `backend/`、`shared/` | Node/SQLite，行程、真实道路、坐标/地址/进度、历史、记忆、问答及高德地图渲染 | 保留运行数据，不能用空库覆盖；不编造动态运营信息。 |
| 知识库 | `backend/knowledge/qixia-deepseek-v2.1/`，213条、29景点、53设施 | 原v1只作历史；日期快照、经验、候选路线、待核实信息均保留限定。 |
| 生产MCP | `mcp_pipe.mjs`＋`trip-stdio.mjs`，4工具context/ask/note/confirm_visit | 读取绑定行程；单智能体/单演示手表全局绑定，12小时，不是多人独立系统。 |
| 备用本机MCP | `backend/integrations/xiaozhi/knowledge-*.mjs`，无配对知识问答与景点目录 | 已停止，未部署。曾观察到WSS、工具发现和实际调用；未另签收播报质量。同接入点只能运行一个桥接。 |
| 固件 | `stopwatch-nav/firmware/`，ESP-IDF5.5.2，小智2.2.6衍生cloud02，全屏Avatar、按键/触摸切页、语音/地图 | 唤醒“枫叶精灵”、开机重新配网、音量100；地图页暂停语音。表情按用户指定avatar11，不采用avatar12/Grok。说话节奏动画未确认完成。 |
| 手机App | `stopwatch-nav/android/`，com.qixia.stopwatchnav，8.3.26-p8-overview01；APK在distributions/Android-overview01 | P8巡航/路线/调色/总览测试通路；网页方案不依赖App，签名须私下备份。 |
| 建模 | `modeling/`已有v00～v05外壳资料 | Git LFS保存，须下载真实对象；本轮未重做机械验收。 |

地图沿用手机默认：高德、zoom14、隐藏地图文字、480×480底图与240窗口；云端按到下一站路线必要时缩小容纳全线。QMAP v4底图与QRTE路线分传，叠加定位和已走颜色。不承诺转向播报、自动到达、偏航重算或主动语音推送。

## 配对改动与未闭环问题

旧流程由小智云调用服务器MCP `qixia_pairing_code`，服务器取码，网页绑定语音行程。cloud02改为手表原生 `self.qixia.get_pairing_code`：手表POST `/api/v1/watch/pairings`，拿8位码和只留在设备的claim_token；网页输码后一次绑定语音及地图。旧云端工具已移除。改变取码方是实现选择，并非MCP要求。

用户反馈一直“准备中”。固件已确认两个不足：失败状态未从PairingCode返回给语音，失败后未自动安排重试。真实设备网络/TLS/HTTP根因暂无日志定论；电脑接口成功不能替代设备验收。尚未完成新的固件修复。

原工作区`device-preflight/last-result.json`有P9-cloud02烧录/回读成功记录（设备读取含隐私，不上传）。旧文档“尚未烧录”已过时；**烧录成功不等于配对与地图真机通过**。稳定回退包2.2.6-p8-overview02不具备新统一配对，单独回刷它也不会让服务器恢复旧取码工具。

随后按用户要求临时切本机知识MCP，再恢复服务器。现在本机进程已停止，HTTP/MCP均active，恢复时WSS建立；最近恢复没有重新证明所有语音工具端到端成功。此前cloud02部署曾发现4工具。用户本轮确认任务结束，不自动等同于取码问题已修复。

## 新电脑启动

准备Git、Git LFS、Node24 LTS/npm。不开发硬件时无需装固件编译工具链。

```sh
git clone --branch release/web-watch-cloud02-20261101 https://github.com/WuJiaxuan1/ai-tour-guide-device.git
cd ai-tour-guide-device
git lfs install
git lfs pull
npm --prefix backend ci
npm --prefix frontend ci
```

复制`.env.example`为`.env.local`，从用户私密备份/负责人取得高德JS Key、安全码、Web服务Key、网页模型配置、QIXIA_MCP_SECRET、MCP_ENDPOINT。没有配置可先看页面和不依赖外部服务的接口，不编造配置或提交密钥。默认HOST127.0.0.1、PORT8787。

```sh
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:sites
node --env-file=.env.local backend/src/server.mjs
```

打开 http://127.0.0.1:8787/ 。开发可另开`npm --prefix frontend run dev`，使用Vite实际地址；作者5174/8790只是旧临时设置。后端需要完整checkout，不能只复制frontend/dist。

**本地网页启动不需要启动生产MCP。** 仅用户明确要求且已停止同接入点另一实例时，以下二选一：

```sh
# 行程模式，需要后端与桥接共享配置
node --env-file=.env.local backend/integrations/xiaozhi/mcp_pipe.mjs -- node backend/integrations/xiaozhi/trip-stdio.mjs
# 备用纯知识模式，无需网页绑定
node --env-file=.env.local backend/integrations/xiaozhi/knowledge-cloud.mjs
```

硬件包在`stopwatch-nav/distributions/P9-cloud02`。先运行`flash_p9.py --check-files`；实际刷机需用户授权/连接真实串口，用`--flash`，`--restore`恢复overview02。保留原NVS身份，不整片擦除。Python3.11+、esptool4.11.0为包文档环境，本机曾用4.12.0。分区不匹配时停止。

重编译：安装并激活ESP-IDF5.5.2，在`stopwatch-nav/firmware`执行：

```sh
idf.py "-DSDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.stopwatch" -DBOARD_NAME=m5stack-stopwatch build
```

保留本地Wi-Fi组件覆盖及dependencies.lock，其余由官方组件管理器下载。旧tools/build.ps1和package脚本依赖作者缓存/历史发布目录，不是新机一键入口。重打包要根据新产物/资源/分区生成校验，不能用旧报告冒充新固件。

Android：Android Studio、JDK17或21、SDK35；打开`stopwatch-nav/android`配置自己的SDK路径，再`gradlew.bat :app:assembleDebug`（Linux用`./gradlew`）。保留原签名才能覆盖旧APK和沿用高德SHA1登记；否则重签并改配置。默认arm64。

## 服务器维护

- SSH：`jxwu@43.160.252.245:22`；RSA主机指纹 **SHA256:5OF28RSeYDMCf99Y1o7D0ItPOcn1s1xp2SR3A89D44g**，连接前核对，不跳过验证。
- 现机加密Codex Ed25519客户端公钥指纹 **SHA256:tKcdG3cituyIAH0gt7YFQVkryBjx4RpcR9cBXm6s65A**。私钥不在Git；口令DPAPI依赖原Windows账户，单复制密文不保证跨机解密。
- 根`/home/jxwu/apps/ai-tour-guide-device`；current指向cloud02-r15。
- `qixia-guide.service`、`qixia-mcp.service`；HTTP监听127.0.0.1:18787，Nginx公开HTTPS。
- `shared/`内.env.local、运行/MCP env、travel-data；另有systemd环境文件/drop-in。全部保留，不用默认配置覆盖。
- 回滚入口`deploy-cloud02/rollback.sh`回kb-r14并保留数据；执行前重新审阅现场。本轮未回滚。
- 细节见[cloud02-r15部署记录](../operations/deployment-20261101-cloud02-r15.md)。证书有效期/运行状态在下一次维护时实时检查，不能永久相信日期快照。

## 补档与删除边界

本轮补充：本机知识MCP及测试、最后App安装包、旧网页演示补丁、Python教学MCP、Grok已放弃实验、P1～P9源码快照/构建记录、秋日设计稿、旧知识资料、服务器历史验收脚本。[历史归档索引](../../archive/workspace-20261101/README.md)说明恢复边界，不合并旧实验进运行入口。

不上传秘密、签名库、SQLite/照片/设备读取、SDK/缓存及全部旧bin/APK。旧二进制摘要不是二进制备份；需要旧完整安装包须自行保留releases目录。用户自行私密备份，见[删除前清单](PRIVATE-BACKUP-CHECKLIST.md)。本轮不删除工作区，不声称Git可恢复明确排除的数据。

以后先确认新目标，再在此分支基础上开发。若继续配对，先处理明确错误、有限重试和真机TLS/HTTP验证；若恢复旧取码入口，明确仅语音绑定不等于地图绑定。生产发布需另获授权并保护shared，不从历史计划擅自开启新功能。
