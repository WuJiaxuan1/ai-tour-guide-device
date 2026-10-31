# 栖霞小智 MCP 接入

> 2026-10-31：服务器已部署 `qixia-mcp.service`，五个工具已被小智发现；上线证据与设备验收边界见 [部署记录](../../../docs/operations/mcp-deployment-20261031.md)。本机调试不要与服务器同时占用同一接入点。

小智提供的是带 token 的 WSS MCP 接入点。它不是网页聊天接口，也不是把整个知识包直接上传给小智。这里的本地 MCP 服务只暴露项目后端已经能验证的只读查询；路线、导航状态和记忆写入仍由项目后端负责。

## 当前工具

- `qixia.explain_current_place`：按显式 placeId 读取项目景点资料，不自动知道当前位置，也不把来源标签等同于完整审核认证。
- `qixia.search_knowledge`：读取有来源的知识检索结果。
- `qixia.recommend_routes`：筛选正式路线，保留 `matched`、`no_match`、`unverified`；目前只应用入口门、时长、强度和同行人条件，出口门和指定景点会在结果中明确列为未应用条件。
- `qixia.get_route_catalog`：查看路线版本和 `navigationReady`。
- `qixia.get_facilities_nearby`：查询设施；无位置时不声称“最近”。

当前没有暴露 GPS 写入、到访确认、行程记忆写入或自由路线生成工具。正式路线、导航状态和记忆合同完成后再增加。

## 本机启动

先启动项目后端：

```powershell
npm --prefix backend start
```

把真实接入点写入项目根目录 `.env.local`（该文件已被 Git 忽略），不要发到聊天：

```dotenv
MCP_ENDPOINT=wss://api.xiaozhi.me/mcp/?token=你的真实token
QIXIA_API_BASE_URL=http://127.0.0.1:8787
```

然后启动 stdio 到 WSS 的管道：

```powershell
node backend/integrations/xiaozhi/mcp_pipe.mjs -- node backend/integrations/xiaozhi/mcp-stdio-server.mjs
```

管道不会打印完整接入点，也不会把 token 写入日志。每次生成新接入点都可以替换 `.env.local`；旧接入点仍有效时，不要同时启动多个连接，以免超过连接上限。

## 验证顺序

1. 先在本机确认后端 `/api/health` 正常。
2. 再启动管道，观察小智控制台是否列出工具。
3. 先调用 `qixia.explain_current_place`，参数使用 `mirror-lake`。
4. 再测试一个无资料问题，确认工具返回“不确定”，而不是模型自由编造。

真实 token、正式路线数据、MCP 连接日志和设备信息不要提交 Git。

## 结果和运维合同

所有工具支持 `page`（从0开始），返回 `nextPage`；为 null 时结束。下一页必须保持原查询条件。路线目录不会只返回前三条；景点文字按 Unicode 字符分页，设施按后端返回候选分页。业务 `tools/call` 完整 JSON-RPC 回复采用本项目保守的 1024 UTF-8 字节预算，只返回 text content；此数值是本项目约束，不代表已确认的平台统一限制。`tools/list` 工具声明不采用业务回复预算。

`entryGate` 映射为后端 `gate`；结果包含实际强度等 `appliedFilters`，未支持的 `exitGate` 与 `preferredPlaceIds` 明确列在 `unsupportedFilters`。不因 matched 就宣称全部条件均满足。

运行环境变量优先于根 `.env.local`；API 地址传给 stdio 子进程，MCP token 仅留在桥进程。严格验证输入，超时或上游异常返回脱敏错误。stderr 仅记录协议阶段、工具名、成功/失败、错误类别和耗时，不保存游客问题或位置。

WSS 断开后进程退出，由 systemd `Restart=always` 恢复；本机直接运行没有自动重连。关闭 stdin 不再强制退出未完成的工具查询。

```powershell
npm --prefix backend test
```

集成测试会启动临时 API；也可用 `QIXIA_TEST_API_BASE` 指向实际服务器回环 API，在服务器运行两份 `xiaozhi-*.test.mjs`。语音听感须由持有设备者确认。
