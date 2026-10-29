# Modeling

- `concept-images/`：v1.0–v5.0 AI 外观意向图；图像编号独立于工程版本。
- 官方硬件手册和参考 STL 集中于 [`../stopwatch-nav/reference/`](../stopwatch-nav/reference/)，供建模与设备开发共同引用。
- `v00/`：接手前已有的 Tripo、Blender 模型及早期建模交接。
- `v01/`、`v02/`：原 round1、round2，尺寸/空腔与前圈预形阶段。
- `v03/`：早期螺丝固定打印方案。
- `v04/`：封闭背部与隐藏卡扣方案。
- `v05/`：前圈曲面修复后的工程。

每版保留可编辑工程、脚本、参数、报告和预览。`print-delivery-vXX/` 是整理的模型交付副本；`print-gcode-vXX/` 是具体机器的打印任务。已有 ZIP 留在对应版本/任务，部分与展开目录完全重复，仅作原交付快照保留。

v05 切片任务：`01-first-clip-tests` 卡扣小样；`02-body-fine-008` 主体 0.08 mm；`03-body-about-16h` 主体 0.22 mm；`04-ring-fine-010` 前圈 0.10 mm。任务编号不是模型版本。每次打印阅读对应说明。

本轮整理未改变 Blender、STL、3MF 或 G-code 内容，也未执行重新建模/切片。脚本路径和运行所需 JSON 路径已调整；历史文档、原 ZIP 保留旧内容。迁移检查记录在项目 `docs/history/reorganization-20261029/`。
