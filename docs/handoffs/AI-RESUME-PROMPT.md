> 20261102 状态更新：项目负责人确认真机联合验收已完成。本次发布保留 cbf9250 源码；以下记录中的待验收事项属于此前状态，具体来源见[交付版本说明](../project/交付版本说明-20261102.md)。

# 给新AI的接手提示词

将下面整段复制到空对话。工作区为空时先克隆指定分支，无需旧聊天记录。

```text
你要接手“栖霞山枫叶精灵”：手机网页＋Node服务器＋小智MCP＋M5Stack StopWatch语音/地图设备。

仓库：https://github.com/WuJiaxuan1/ai-tour-guide-device
唯一完整交接分支：release/web-watch-cloud02-20261101。不要从main推断最新功能，不要合并/推送实现到main。

空工作区先克隆此分支，安装Git LFS并拉取真实模型/APK。依次读AGENTS.md、docs/handoffs/PROJECT-STATE-20261101.md、docs/handoffs/PRIVATE-BACKUP-CHECKLIST.md、docs/handoffs/ARCHIVE-VERIFICATION-20261101.md。旧文档有过时状态，以最终归档和实际代码为准。不要运行archive中的历史脚本或覆盖生产代码。

截至2026-11-01，https://43.160.252.245/运行0.5.2-20261101-cloud02-r15，部署提交f7e59eeef719163414a95860cbdce200b84d1b5f；后续归档提交未部署。服务器qixia-guide.service、qixia-mcp.service已恢复，本机知识MCP停止。同一WSS接入点只能启动一个桥接。代码和桌面测试通过不等于硬件实测通过。

网页保留最新秋色主题、官方/专属路线、进出口（允许同门）、左侧色条时间线、GPS、统一连接卡、历史/报告/原手账、寺庙沉浸体验。不得重新启用用户已拒绝的照片生成/布局。后端保存真实行程，处理高德道路/坐标/地图。知识包qixia-deepseek-v2.1有213条、29景点、53设施；实时票价/枫情/开放未核实就明确说明。

固件2.2.6-p9-cloud02，可回退2.2.6-p8-overview02；App8.3.26-p8-overview01保留源码和APK。全屏Avatar、语音/地图切页、唤醒“枫叶精灵”、启动音量100；无独立GPS。不要切回Grok或avatar12实验，说话节奏动画未确认完成。网页方案不依赖App。

未闭环：旧取码由服务器MCP qixia_pairing_code完成，cloud02移除了它，改为手表原生self.qixia.get_pairing_code访问项目服务器拿8位码及私有claim_token，以一次绑定语音和地图。用户反馈一直“准备中”；已发现固件失败不返回具体错误、失败后不自动重试，真机网络/TLS根因未知，尚未修复。已有cloud02烧录校验记录，但不是取码成功证明。单独恢复MCP或回刷P8均不会自动恢复旧服务器工具。用户结束当前阶段不代表此问题有新验收；仅在要求继续时修复。

目前单智能体、单演示设备全局绑定12小时，不是多用户隔离。手机网页提供GPS；手表主动下载地图，公网不能直推热点内手表。底图与路线分传；不承诺主动语音、转向播报、自动到达或偏航重算。

新机用Node24：npm --prefix backend ci；npm --prefix frontend ci；复制.env.example为.env.local。需要时询问用户私密配置文件位置，不让用户把密钥贴聊天；缺配置先运行可用页面/接口。先frontend build，再前端test/test:sites（它们依赖产物），并运行backend test；node --env-file=.env.local backend/src/server.mjs，默认本地8787，Vite端口以实际输出为准。本地数据不能覆盖生产。

SSH为jxwu@43.160.252.245:22；RSA主机指纹SHA256:5OF28RSeYDMCf99Y1o7D0ItPOcn1s1xp2SR3A89D44g。私钥、DPAPI口令、API/WSS配置、签名库、照片、运行数据不在Git，用户自行备份。不要绕过指纹或擅自更换身份。应用根/home/jxwu/apps/ai-tour-guide-device，保护current/shared；部署不得覆盖已有行程数据。DPAPI密文依赖原Windows账户，跨机未必能解密。

先检查分支和文件，简洁说明你理解的已完成内容、未闭环事项。当前阶段已结束，等我给新目标，不要擅自部署、刷机、开启实验或删除文件。后续保留队友修改、适当测试，只在有实际证据时说验收通过。
```
