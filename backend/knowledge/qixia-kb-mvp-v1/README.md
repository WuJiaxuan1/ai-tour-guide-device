# 栖霞山智能体知识库 MVP v1

本包围绕西门默认入口与12个候选景点整理。12个点是推荐池，不要求每条路线全部经过。

## 使用顺序

1. 上传 `01_pois_12.jsonl` 作为景点讲解库。
2. 上传 `04_faq_rules.jsonl` 作为智能体决策规则库。
3. `02_facilities_food.json` 先给后端使用；缺少坐标的设施不得回答“最近”。
4. `03_persona_preferences.json` 用于情侣、闺蜜、独行等偏好叠加。
5. `05_verification_backlog.md` 仅供团队维护，不上传游客问答库。

## 后端接入

- `07_id_registry.json`：统一景点、入口与设施ID。
- `08_backend_facilities.json`：后端可导入的设施与餐饮目录。
- `09_time_budget_rules.json`：总时间计算与按时长选点规则。
- `10_route_time_presets.json`：使用高德步行时间计算的兜底路线。
- `11_后端接入说明.md`：后端同学的具体接入步骤。

## 与路线数据的边界

高德路线结果位于 `../amap-routing/`。知识库解释“为什么推荐”，路线服务负责“怎么走、多少米、多久”。
