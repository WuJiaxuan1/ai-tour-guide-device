# 06 API 与模块交互规范

> 2026-10-31 实现校正：本地已在现有 Node/React 项目接入五模块基础链路。实际接口、字段、模型供应商、验证结果与未完事项以 [11-implementation-20261031.md](11-implementation-20261031.md) 为准；本文件其余未落地条目保留为目标设计，不代表已部署。

## 1. 通用约定

- API 前缀：`/api`
- 数据格式：JSON，编码 UTF-8。
- 时间：ISO 8601，带时区。
- 路径参数使用稳定 ID；不要依赖展示名称作为唯一标识。
- 成功返回业务数据；失败使用统一错误格式。
- 生产环境应通过 HTTPS。
- 每个接口都要校验用户/会话权限。
- 前端只调用后端 API，不直接访问数据库或携带模型供应商密钥。

## 2. 统一错误响应

```json
{
  "error": {
    "code": "ROUTE_NOT_FOUND",
    "message": "没有找到符合条件的路线。",
    "details": {}
  }
}
```

建议错误码：
- `VALIDATION_ERROR`：参数错误。
- `NOT_FOUND`：资源不存在。
- `FORBIDDEN`：无权限。
- `CONFLICT`：状态冲突。
- `NO_ELIGIBLE_ROUTE`：没有符合条件的已核验路线。
- `EVIDENCE_INSUFFICIENT`：知识证据不足。
- `UPSTREAM_UNAVAILABLE`：地图、模型或语音服务不可用。
- `INTERNAL_ERROR`：未预期服务错误。

## 3. API 清单（MVP）

### 3.1 健康检查
`GET /api/health`

响应：
```json
{"status":"ok"}
```

### 3.2 景点查询
- `GET /api/attractions?keyword=明镜湖`
- `GET /api/attractions/{attraction_id}`
- `POST /api/knowledge/answer`

`POST /api/knowledge/answer` 请求：
```json
{
  "question": "明镜湖有什么特点？",
  "attraction_id": "optional-id",
  "channel": "web"
}
```

响应：
```json
{
  "answer": "基于已检索资料生成的回答。",
  "source_refs": ["kb-file-or-record-id"],
  "verification_status": "verified",
  "evidence_sufficient": true,
  "related_attractions": []
}
```

### 3.3 路线推荐
`POST /api/planner/recommend`

请求：
```json
{
  "entrance": "west",
  "duration": "half_day",
  "intensity": "easy",
  "has_elderly": true,
  "has_children": false,
  "must_visit": ["attraction-id-1"]
}
```

响应：
```json
{
  "routes": [
    {
      "id": "route-id",
      "name": "已核验路线名称",
      "duration_hours": 3.0,
      "stop_ids": ["attraction-id-1", "attraction-id-2"],
      "highlights": ["路线特点"],
      "reasons": ["匹配用户偏好"],
      "verification_status": "verified",
      "source_refs": ["route-source-id"]
    }
  ],
  "count": 1
}
```

接口可以返回 0–3 条路线；若无符合条件的路线，返回空数组和 `NO_ELIGIBLE_ROUTE` 或约定的可解释响应。团队应选择一种响应形式并保持一致。

### 3.4 旅行管理
- `POST /api/trips`：创建旅行。
- `GET /api/trips/{trip_id}`：查询旅行。
- `POST /api/trips/{trip_id}/start`：开始。
- `POST /api/trips/{trip_id}/pause`：暂停。
- `POST /api/trips/{trip_id}/resume`：恢复。
- `POST /api/trips/{trip_id}/complete`：结束。
- `PUT /api/trips/{trip_id}/route`：保存用户选择的路线/路线快照。
- `GET /api/trips/{trip_id}/next-stop`：获取下一站。

### 3.5 定位与到访
- `POST /api/trips/{trip_id}/location`：更新当前有效位置。
- `POST /api/trips/{trip_id}/visits`：确认到访。
- `POST /api/trips/{trip_id}/stops/{stop_id}/skip`：跳过站点。
- `GET /api/trips/{trip_id}/visits`：查询到访记录。

定位请求示例：
```json
{
  "latitude": 32.0,
  "longitude": 118.0,
  "accuracy_m": 25,
  "captured_at": "2026-10-30T10:20:00+08:00"
}
```
以上坐标仅为格式示例，不代表景区真实位置。

### 3.6 语音笔记与记忆
- `POST /api/trips/{trip_id}/notes`：创建笔记。
- `GET /api/trips/{trip_id}/notes`：查看笔记。
- `PATCH /api/notes/{note_id}`：编辑笔记。
- `DELETE /api/notes/{note_id}`：删除笔记。
- `POST /api/trips/{trip_id}/memory/generate`：生成摘要草稿。
- `GET /api/trips/{trip_id}/memory`：查看摘要。
- `PUT /api/trips/{trip_id}/memory/confirm`：确认摘要。
- `DELETE /api/trips/{trip_id}/memory`：删除摘要。

### 3.7 小智工具映射
首版建议：
- `get_next_stop` → `GET /api/trips/{trip_id}/next-stop`
- `get_attraction_guide` → `POST /api/knowledge/answer`
- `save_voice_note` → `POST /api/trips/{trip_id}/notes`

`trip_id` 应从已验证的用户会话或后端上下文解析，不能仅信任模型参数。

## 4. 模块间调用规则

- 路线规划模块返回候选路线，不直接创建旅行。
- 旅行管理模块保存用户最终选择并维护状态。
- 到访模块写入实际到访事件；旅行状态模块据此计算下一站。
- 记忆模块只读取已保存的旅行、到访、笔记等记录，不把模型临时上下文当作事实。
- 景点讲解模块统一服务网页沉浸式讲解和小智语音讲解。
- 模型只能调用白名单工具；每个工具必须有参数 schema 和权限校验。

## 5. 版本与兼容性

- MVP 阶段可暂不启用版本号，但接口变更必须同步更新本文件与前端类型。
- 不要在同一字段中混用不同含义。
- 若变更请求/响应结构，先通知依赖模块负责人，并更新 Mock 数据与测试。
- 前后端共享 API 类型时，建议由 Pydantic schema 生成 OpenAPI，再按项目工具生成 TypeScript 类型（如时间允许）。
