# 工作区历史资料归档（2026-11-01）

此目录用于删除旧工作区后的追溯，**不属于线上运行入口，不应整体覆盖当前源码**。当前进度先读 `docs/handoffs/PROJECT-STATE-20261101.md`。原文中的“当前”“下一步”“已验收”只代表当时状态；不构成新的操作授权。

| 目录/文件 | 用途与恢复边界 |
| --- | --- |
| `legacy-web-demo/` | 旧工作树未提交的单用户网页/MCP演示；基于其中 base-commit.txt 的提交。tracked-changes.patch 保存已跟踪文件修改，new-files 保存新增文件。只在单独 checkout 中 git apply 并复制 new-files，不能应用到最新生产版本。 |
| `mcp-local-demo/` | 早期 Python MCP 教学与演示，使用旧知识库和旧路径；.env未归档。最新可用本地工具在 backend/integrations/xiaozhi/knowledge-*.mjs。 |
| `grok-experiment/` | 用户已放弃的早期表情实验：M5Stack上游提交、修改补丁、新增源码、构建脚本及素材。不得替换当前Avatar方案。tools下脚本保留原路径，需在独立恢复目录调整。 |
| `hardware-releases/` | P1至P9各阶段的选择性源码快照、构建校验、烧录脚本和历史验收记录。source是当时打包器选择的文件，不是每版完整仓库；不可只解压一个source就声称可独立构建。 |
| `historical-binaries.json` | 原工作区历史bin/APK名称、大小、SHA256。旧二进制本体未全量上传，避免大量重复发布物；当前cloud02及overview02回退bin、最新App安装包已在stopwatch-nav/distributions。 |
| `autumn-preview-v2/` | 用户指定的秋日视觉参考，含静态HTML/CSS/JS及截图；是设计稿，不是运行中的网站。 |
| `original-documents/` | 原始项目梳理、硬件计划、旧交接材料。以最新总交接为准。 |
| `knowledge-v1-original/` | 收到的旧知识库原始资料，用于溯源；当前运行使用qixia-deepseek-v2.1。 |
| `avatar-reference/` | 表情移植辅助脚本；上游 https://github.com/Trentct/m5stack-stopwatch-avatar ，参考提交204963257cb4dc2f3d7501eff900897bac55ef82。当前固件已包含实际移植代码及许可。 |
| `motonav-reference/` | 上游导出版本说明和许可；所需Android实现已经在stopwatch-nav/android。未再次复制无关iOS/其他开发板工程和SDK缓存。 |
| `server-verification/` | 从当前服务器只读取回的历史验证脚本；部分脚本会创建/删除测试行程，**只作参考，不能直接对生产运行**。 |
| `local-debug-helpers/` | 本机临时验收/启动脚本的历史副本；含原环境路径，使用前审阅。 |
| `AGENTS-history.md` | 归档前累计工作记录，仅供追溯；当前仓库根AGENTS.md是有效接手指引。 |
| `source-inventory.json` | 从旧工作区复制的文件清单与原始SHA256；Git对文本的CRLF/LF转换可能改变字节校验，二进制校验不受影响。 |

私钥、WSS令牌、API Key、签名库、SQLite、个人照片、完整设备Flash读取、IDE/SDK/依赖/浏览器缓存没有公开。删除工作区前请按私密备份清单处理。保留了历史代码不意味着所有旧发布物、历史日志或废弃生成结果都已上传。
