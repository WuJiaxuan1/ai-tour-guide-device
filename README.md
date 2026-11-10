# 枫叶精灵｜随身文旅导览智能体

面向栖霞山游客的软硬件导览项目：手机网页连接知识与行程服务、小智语音和 StopWatch 设备，并配套实体外壳设计与制造资料。

![枫叶精灵项目封面](marketing/枫叶精灵-封面.jpg)

## 查看成果

- [产品说明 v2.0](docs/product/枫叶精灵-产品说明-v2.0.docx) · [开发记录 v2.0](docs/project/枫叶精灵-开发记录-v2.0.docx)
- [路演 PPT](marketing/枫叶精灵-路演-v1.0.pptx) · [实机与建模演示视频](https://github.com/WuJiaxuan1/ai-tour-guide-device/releases/tag/project-deliverables-20261102) · [展示图片](marketing/README.md)
- [建模与打印资料](modeling/README.md) · [设备源码与烧录说明](stopwatch-nav/README.md)
- [部署与使用交接](docs/handoffs/web-watch-cloud02-20261101.md) · [交付版本说明](docs/project/交付版本说明-20261102.md)

## 交付版本

本页对应 `codex/project-organization-20261102` 的项目成果整理。软件源码沿用集成分支 `release/web-watch-cloud02-20261101` 的 `cbf9250`，保留团队的前后端、MCP、设备实现与历史。这次资料发布不另设软件版本号，也不表示重新部署或烧录。

| 对象 | 版本或说明 |
| --- | --- |
| 前后端与 MCP | cloud02-r15 集成系列；本次保留 cbf9250 的运行源码 |
| StopWatch 固件 | 2.2.6-p9-cloud02，含完整源码及配套烧录/回滚包 |
| Android 调试 App | 8.3.26-p8-overview01；网页方案无需安装 |
| 产品说明与开发记录 | v2.0；原始 v1.0 随文档保留 |
| 实体建模 | v00—v05，v05 表示第 5 版 |

2026 年 11 月 2 日，项目负责人确认真机联合验收已完成。此前日期的交接记录保留当时状态；本次收录源码与验收状态的对应说明见[交付版本说明](docs/project/交付版本说明-20261102.md)。

## 项目目录

| 目录 | 内容 |
| --- | --- |
| `frontend/` | 手机网页、素材、测试及各版本交接 |
| `backend/`、`shared/` | 知识、行程、导航、MCP 与公共规则 |
| `stopwatch-nav/` | 固件、Android、设备协议与发布包 |
| `modeling/` | 概念图、各版模型、制造参数与制作脚本 |
| `docs/` | 产品、需求、架构、运维与项目文档 |
| `marketing/` | 路演成稿、封面、介绍图片与视频入口 |
| `deployment/`、`scripts/` | 部署模板与工程检查工具 |

新整理的版本资料随所属模块保存，单版本交接与相应版本放在一起。既有 `archive/workspace-20261101/` 是前次集成提交保存的历史资料，不作为当前运行入口。

## 获取与运行

使用 Node.js 24 LTS、npm、Git；建模及 APK 大文件需要 Git LFS。已有本地修改时先保存，再获取目标分支。

```sh
git clone --branch codex/project-organization-20261102 https://github.com/WuJiaxuan1/ai-tour-guide-device.git
cd ai-tour-guide-device
git lfs pull
npm --prefix backend ci
npm --prefix frontend ci
```

将 `.env.example` 复制为 `.env.local`，填写自己的地图、模型与 MCP 配置，然后执行：

```sh
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
node --env-file=.env.local backend/src/server.mjs
```

本地访问 `http://127.0.0.1:8787/`。开发网页可另开终端执行 `npm --prefix frontend run dev`。部署、HTTPS、固件烧录及回滚按[集成交接](docs/handoffs/web-watch-cloud02-20261101.md)操作。

## 网页、语音与地图

手机网页提供定位与行程，后端生成到下一站的地图和路线，手表地图页下载并显示进度。语音页通过小智云与 MCP 读取同一行程；当前为单智能体、单演示设备方案，手表没有独立 GPS。

项目保留秋日网页、路线编辑与历史报告、寺庙沉浸式体验、表情互动及设备地图。具体功能、使用方式及各阶段记录见产品说明和工程交接。

问卷答卷与路演情景数据为模拟数据，不是真实游客调查结果。使用展示图或 PPT 时应保留相应说明和素材来源。私密配置、用户数据、签名密钥及本机制作过程文件不随成果发布。
