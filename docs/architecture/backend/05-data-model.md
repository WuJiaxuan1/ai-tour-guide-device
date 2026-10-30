# 05 数据模型与数据管理规范

## 1. 基本原则

1. 数据库是旅行状态的权威来源。
2. 计划、实际发生的事件、用户原话和 AI 生成内容分开存储。
3. 关键事实保留来源、核验状态和时间戳。
4. 用户数据按用户/会话隔离。
5. 数据库结构变更使用 Alembic 迁移，不手工修改生产表结构。
6. 不将高频定位轨迹作为默认数据。

## 2. 核心实体

### 2.1 users
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | UUID/字符串 | 主键 |
| created_at | timestamptz | 创建时间 |
| display_name | nullable string | 可选展示名 |

如原型阶段尚无登录系统，可用受控的匿名会话 ID，但必须将身份方案记录为临时决策，不允许直接把任意前端用户 ID 当作授权依据。

### 2.2 attractions
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | string/UUID | 稳定景点 ID |
| name | string | 标准名称 |
| aliases | JSON/string array | 别名 |
| category | string | 景点类别 |
| latitude/longitude | nullable numeric | 坐标 |
| location_source | nullable string | 坐标来源 |
| guide_content | text/nullable | 已整理讲解或引用 |
| verification_status | enum | verified/unverified/outdated |
| source_refs | JSON array | 来源标识 |
| last_verified_at | nullable timestamptz | 最后核验时间 |
| updated_at | timestamptz | 更新时间 |

### 2.3 candidate_routes
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | string/UUID | 路线 ID |
| name | string | 路线名称 |
| entrance/exit | string | 入口/出口 |
| duration_min/max | nullable integer | 预计时长范围 |
| distance_m | nullable numeric | 仅有证据时填写 |
| intensity | enum | easy/normal/unlimited |
| stop_ids | JSON array 或关联表 | 有序景点 ID |
| suitable_for_elderly/children | nullable boolean | 未知应为 null，不可默认为 true |
| route_status | enum | active/closed/unknown |
| verification_status | enum | verified/unverified/outdated |
| source_refs | JSON array | 来源 |
| last_verified_at | nullable timestamptz | 核验时间 |

若需查询每个站点的顺序，推荐使用 `route_stops(route_id, attraction_id, sequence_no, planned_duration_min)` 关联表，而不是长期把顺序只存为 JSON。

### 2.4 trips
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| user_id | UUID/string | 所属用户/会话 |
| status | enum | draft/planned/active/paused/completed/cancelled |
| entrance | string | 选定入口 |
| duration_preference | enum | half_day/full_day |
| intensity_preference | enum | easy/normal/unlimited |
| has_elderly | boolean | 老人同行 |
| has_children | boolean | 儿童同行 |
| started_at/ended_at | nullable timestamptz | 实际开始/结束时间 |
| created_at/updated_at | timestamptz | 时间戳 |

### 2.5 trip_stops
保存某次旅行的路线快照和计划顺序。

| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| trip_id | UUID | 所属旅行 |
| attraction_id | string/UUID | 景点 |
| sequence_no | integer | 计划顺序 |
| status | enum | pending/visited/skipped |
| planned_duration_min | nullable integer | 计划停留时间 |
| route_snapshot | nullable JSON | 可选的名称/说明快照 |
| updated_at | timestamptz | 更新时间 |

### 2.6 visit_events
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| trip_id | UUID | 所属旅行 |
| attraction_id | string/UUID | 景点 |
| event_type | enum | user_confirmed/other（首版只用 user_confirmed） |
| occurred_at | timestamptz | 用户确认/记录时间 |
| latitude/longitude | nullable numeric | 可选位置 |
| location_accuracy_m | nullable numeric | 定位精度 |
| source | string | web/voice/manual |
| idempotency_key | nullable string | 请求幂等标识 |
| note | nullable text | 可选说明 |

### 2.7 travel_notes
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| trip_id | UUID | 所属旅行 |
| attraction_id | nullable UUID/string | 可选关联景点 |
| content_original | text | 原始转写/用户输入 |
| source | enum | voice_asr/web_text |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### 2.8 travel_memories
| 字段 | 类型建议 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| trip_id | UUID | 所属旅行 |
| summary_draft | nullable text | AI 草稿 |
| summary_confirmed | nullable text | 用户确认版本 |
| status | enum | draft/confirmed |
| generated_at | nullable timestamptz | 生成时间 |
| confirmed_at | nullable timestamptz | 确认时间 |
| source_record_ids | JSON array | 摘要依据的记录 ID |

### 2.9 knowledge_documents / knowledge_chunks（按实现需要）
记录知识文件、条目、切片及来源，至少应能追溯到原始文件路径/条目标识、导入时间、核验状态。首版若使用结构化 JSON/Markdown 关键词检索，可以暂不建向量切片表。

## 3. 状态与一致性规则

- `trips.status` 是旅行整体状态。
- `trip_stops.status` 是计划站点状态。
- `visit_events` 是实际到访事件记录。
- 路线被选中不意味着景点已到访。
- 结束旅行不应自动把剩余站点标为已到访。
- 删除旅行时，按产品约定级联删除或匿名化其笔记、到访和记忆；实现前需明确并测试。
- `suitable_for_elderly/children = null` 表示未知，不等于适合。
- 所有时间在数据库统一使用带时区时间戳；展示时按用户/景区当地时区格式化。
- 关键创建接口支持幂等键或数据库唯一约束，防止重试产生重复记录。

## 4. 事实来源与核验状态

统一核验状态：
- `verified`：有可信来源且已核验。
- `unverified`：尚未核验或证据不足。
- `outdated`：信息可能过期。
- `unknown`：来源或状态未知。

路线、景点、坐标、动态运营信息应分别记录来源。不能因为一段讲解文本存在就默认其所有细节已核验。

## 5. 数据访问与迁移

- 所有业务查询都必须带上当前用户/会话授权范围。
- 通过 SQLAlchemy 数据访问层访问数据库。
- 使用 Alembic 生成并提交迁移脚本。
- 测试使用独立数据库或可重置的测试数据库。
- 不在日志中记录 API 密钥、完整敏感定位轨迹或不必要的个人信息。
