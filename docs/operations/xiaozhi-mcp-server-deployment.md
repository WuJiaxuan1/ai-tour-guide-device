# 小智 MCP 服务器部署方案

> 已实施更新：见 [2026-10-31部署记录](mcp-deployment-20261031.md)。实际采用独立固定MCP release路径，公网站点current未切换。下文为部署前方案，服务示例不可当作实际运行配置。

更新：2026-10-31。

> 最新交接：[后端/MCP下班交接](../handoffs/backend-mcp-handoff-20261031.md)。当前仅证实本机在线及工具发现，未完成业务调用或设备验收。部署前先修复该文第4节问题。备用验收必须使用新release的绝对目录，不能在current仍指向旧版本时使用下方正式unit来测试新文件。本文件为方案，未在服务器执行。

当前小智 MCP 已在开发电脑上验证在线。公网网站和路线后端已经部署为 `0.5.0-20261031-r2`，但本次新增的 MCP 工具和 WSS 管道尚未部署到服务器。下一次部署应沿用现有 release + systemd + Nginx 结构，不把 token 放进代码或发布包。

## 小智如何调用

小智控制台显示工具列表后，模型会根据工具描述决定调用。测试时可以直接说：

- “请调用景点讲解工具，查询 `mirror-lake`，介绍明镜湖。”
- “请按西门、半日、轻松游筛选官方路线，不要自行生成路线。”
- “请读取当前官方路线目录，只告诉我哪些路线 `navigationReady`。”

也可以明确说出工具名，例如“调用 `qixia.explain_current_place`，参数 `placeId=mirror-lake`”。如果模型直接回答而没有调用工具，应在小智控制台检查工具调用记录；不能把普通模型回答当成知识库调用成功。

## 服务器进程关系

```text
小智云端
   │ 出站 WSS，连接地址含 token
   ▼
qixia-mcp.service
  mcp_pipe.mjs → mcp-stdio-server.mjs
   │ HTTP 127.0.0.1
   ▼
qixia-guide.service
  Route / Knowledge / Navigation 当前模块
   │
   ├── Nginx HTTPS → 网页和公开 API
   ├── 高德服务端 Key（仅服务端）
   └── 后续接入 Navigation State / Memory / Media 模块
```

MCP 不需要新增公网入站端口。服务器只需要能够向 `api.xiaozhi.me` 发起出站 WSS/443。MCP 进程只调用 `127.0.0.1` 的项目 API，不能绕过 Route、Knowledge 或导航校验直接读写数据。

## 发布包内容

在确认本地测试通过后，发布包必须包含：

- `backend/integrations/xiaozhi/`
- `backend/src/`、`backend/data/`、`backend/knowledge/`
- `frontend/` 构建所需源文件及构建产物
- `shared/`、`package.json`、锁文件和必要文档

不要上传：根目录 `.env.local`、MCP token、`node_modules/`、`.local-work/`、SSH 私钥、`stopwatch-nav/firmware` 内层 Git、无关历史文件。Git 上传和服务器部署是两件事。

## 服务器私有配置

服务器已有高德私有配置，继续由现有 `qixia-guide.service` 使用。MCP 单独建立一个权限为 600 的环境文件，例如：

```dotenv
MCP_ENDPOINT=wss://api.xiaozhi.me/mcp/?token=服务器私有token
QIXIA_API_BASE_URL=http://127.0.0.1:18787
```

该文件放在 release 目录之外，例如 `/etc/qixia-guide/mcp.env`。不要把 MCP 地址写入 Nginx、前端 `VITE_*` 变量、Git 或普通日志。若后端在备用端口验收，临时将 `QIXIA_API_BASE_URL` 指向备用端口，验收结束后再切回正式端口。

## systemd 服务示例

实际部署前先在服务器确认 Node 路径、运行用户和 `current` 目录。服务示例：

```ini
[Unit]
Description=Qixia Xiaozhi MCP bridge
After=network-online.target qixia-guide.service
Wants=network-online.target

[Service]
Type=simple
User=jxwu
WorkingDirectory=/home/jxwu/apps/ai-tour-guide-device/current
EnvironmentFile=/etc/qixia-guide/mcp.env
ExecStart=/usr/bin/node backend/integrations/xiaozhi/mcp_pipe.mjs -- /usr/bin/node backend/integrations/xiaozhi/mcp-stdio-server.mjs
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

启用后检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now qixia-mcp.service
sudo systemctl status qixia-mcp.service --no-pager
sudo journalctl -u qixia-mcp.service -n 80 --no-pager
```

日志中只能出现“WSS 连接已建立/关闭”等非敏感状态，不能出现完整 URL 或 token。一个进程连接一个 MCP 接入点，不要在多台电脑和服务器上同时使用同一个接入点做演示。

## 上线顺序

1. 在新 release 目录上传源代码并安装 Node 依赖。
2. 先在备用端口启动项目后端，检查 `/api/health`、知识查询和路线接口。
3. 让 `qixia-mcp.service` 临时指向备用端口，检查小智控制台工具列表和一次景点查询。
4. 验收通过后切换 `current`，重启 `qixia-guide.service`。
5. 更新 `QIXIA_API_BASE_URL` 到正式端口，重启 `qixia-mcp.service`。
6. 验证网页、`qixia.explain_current_place`、`qixia.recommend_routes` 和无资料问题的拒答。
7. 保留上一 release，失败时按现有部署记录回滚；不要直接覆盖当前目录。

每次 SSH、SCP、服务重启和回滚都要先阅读并遵循 [SSH 操作日志技能](../../project-files/team/server/ssh-operation-logging/SKILL.md)，保留退出码、完整输出和验收证据。当前正式路线仍有未核验点位、R05/R06 差异；MCP 上线不等于导航、手表 ACK、记忆服务已经完成。工具调用记录界面是否存在尚未确认，应取得真实请求/返回证据，不以模型直接回答作验收。
