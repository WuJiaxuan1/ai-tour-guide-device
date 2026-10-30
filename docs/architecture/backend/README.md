# 栖霞山随身文旅智能体：项目设计文档包

本目录包含建议放入项目 `docs/` 的 03–10 号设计文档。

## 文件清单
- `03-overall-architecture.md`：总体技术架构、现成服务/自研边界、端到端实现通路
- `04-functional-modules.md`：功能模块职责、输入输出、流程和验收
- `05-data-model.md`：核心实体、字段、状态与数据管理规则
- `06-api-and-module-contracts.md`：API 清单、示例、模块交互规则
- `07-knowledge-and-trust.md`：知识库导入、来源、核验与行中讲解规范
- `08-security-privacy-errors.md`：权限、定位隐私、模型工具安全和异常降级
- `09-development-testing-acceptance.md`：目录、编码、测试、验收和启动要求
- `10-plan-roles-decisions.md`：任务分工模板、2–3 天计划、决策记录

## 使用前请团队确认
1. 将路线和景点演示数据替换为已核验资料。
2. 确认小智服务端的自定义工具调用能力。
3. 确认身份/会话方案和地图服务配置。
4. 在分工表中填写负责人。
5. 与项目实际目录、API、字段名保持一致；如需变更，更新文档并通知相关模块负责人。

建议将这些文件放在项目仓库的 `docs/` 目录中，并在根目录维护 `AGENTS.md` 和 `README.md`。
