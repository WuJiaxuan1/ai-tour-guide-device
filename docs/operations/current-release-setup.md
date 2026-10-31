# 当前完整版本的安装与部署

2026-11-01 更新：当前线上为 ui-r13，已恢复原版路线编辑与固定报告，保留服务端同步和小智。最新状态见 [ui-r13 发布记录](deployment-20261101-ui-r13.md)；以下 photo-r12 环境安装方法仍适用，验收中的模型回忆/TXT 页面已被原版 PNG 报告替代。

对应应用 `0.5.2-20261031-photo-r12`。本次 GitHub 发布整合当前源码，不重新部署线上服务。此前发布文档中的补丁包、旧机器绝对路径与 SSH 助手不是新环境安装的前提。

## 安装与配置

安装 Node.js 22.22+ 或 24（需内置 SQLite、WebSocket）、npm 和 Git。按根 README 克隆并安装两个 package-lock 锁定的依赖。Sharp 带平台相关二进制，必须在目标系统安装，不能把 Windows node_modules 复制到 Linux。

复制 `.env.example` 为 `.env.local` 并限制为服务账户可读。高德 JS Key、JS 安全密钥、Web 服务 Key 类型不同，需配置相应使用范围。文本服务二选一：DeepSeek 官方 Key 配合 `TEXT_PROVIDER=deepseek`；京东云 Key 配合 `TEXT_PROVIDER=jdcloud`，模型名以各自可用列表为准，不能交叉使用 Key。

小智桥接需要控制台提供的私密 WSS MCP 接入点 `MCP_ENDPOINT`、自行生成的高强度 `QIXIA_MCP_SECRET`（后端与桥接一致）和 `QIXIA_API_BASE=http://127.0.0.1:8787`。不要把接入点 token 写进公开文档、命令日志或 Git。

## 构建及运行

从仓库根目录执行：

```sh
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix backend start
```

`frontend/dist/client/` 为网站产物。后端还读取 `frontend/src/content/`、`backend/knowledge/`、`backend/data/`、`shared/`，保留完整 checkout 最简单。响应式图片在构建时自动生成，栖霞寺已集成的移动素材随源码提供。需要重做体验移动素材时，在 `frontend/` 执行 `node scripts/optimize-immersive-images.mjs`。

另启动一个 MCP 进程（仓库根目录）：

```sh
node --env-file=.env.local backend/integrations/xiaozhi/mcp_pipe.mjs -- node backend/integrations/xiaozhi/trip-stdio.mjs
```

用 systemd 或其他进程管理器分别托管 HTTP 和 MCP，设置明确工作目录、非 root 服务用户和失败重启；MCP 重启留重连间隔。HTTP 默认只监听 `127.0.0.1:8787`，由反向代理暴露 HTTPS。同一生产 MCP 接入点不要并行运行测试桥接，避免抢占连接。

## HTTPS 与事件流

代理整个站点到后端，静态资源、`/api/` 和 `/_AMapService/` 保持同源。以下为放在已配置证书的 Nginx `server` 中的示例：

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 3600s;
    client_max_body_size 128k;
}
```

关闭缓冲与较长读取超时用于 SSE。当前新照片创作 POST 已关闭，无需为该停用功能放宽上传限制。若未来启用其他上传功能，应逐个核对 API 大小限制。现有服务按连接源地址限流，反代环境需通过真实负载确认容量，不能视为多用户生产扩展已完成。手机定位需要有效 HTTPS 和用户授权，localhost 的开发例外不适用于手机访问电脑 IP。

## 持久化与升级

根目录 `.local-work/` 含 `travel.sqlite`、SQLite 辅助文件、`travel-media/`、`photo-creations/` 和缓存。切换发布目录时，将运行数据接到同一受保护的持久目录，先备份再升级。运行中的 SQLite 应使用 SQLite 备份机制，或停止写入后完整备份，不能只复制主数据库。新空库不能恢复原行程与配对。

当前使用单个 HTTP 服务进程；不要未经迁移设计让多个发布实例同时处理同一库和任务。回滚代码须保留用户数据并确认数据库兼容。配置文件、数据库、用户照片和令牌均不进入 Git。

## 验证与边界

1. `/api/health` 正常，新页面资源加载，地图可用。
2. 按偏好推荐预设；选择可导航路线并开始，位置/到访/下一站同步。
3. 网页配对小智，测试“我在哪”“下一站去哪”、景点讲解和旅行笔记。
4. 栖霞寺标签、接近弹窗、沉浸选择与问位置时的语音提示。
5. 结束后回忆统计/摘要、TXT 下载、历史查看与删除。
6. 专属手账仍为原固定卡演示；照片新建接口返回 `410 PHOTO_CREATION_DISABLED`。

既有验证：本地后端 62 项、前端 36 项和构建通过；photo-r12 的 Linux 后端 62 项、预发布与公网各 8 项通过。用户确认配对/状态同步、讲解、笔记、位置和沉浸体验实测；回忆增强验收按后续反馈记录。独立主动播报、真实 AI 照片转贴纸、动态红叶活动数据未完成。

原有 `stopwatch-nav/` 的 Android/设备通信方案单独维护，小智 MCP 配对验证不代表该通路验收。小智云端账号、模型、ASR/TTS 与设备固件设置需在目标环境配置，不能仅靠克隆仓库复制。
