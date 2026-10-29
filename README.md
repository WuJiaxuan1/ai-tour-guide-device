# AI Tour Guide Device

文旅导览设备项目：实体外壳建模、前端界面，以及与团队后端和硬件的集成。

## Directory layout

- `modeling/`：外观意向图、设备参考、v00–v05 工程、模型交付及机器切片。详见 [modeling/README.md](modeling/README.md)。
- `stopwatch-nav/`：StopWatch 设备子系统：Android 配套 App、固件、通信协议、原始交接、发布包和官方参考。
- `backend/`：本地与正式部署可复用的高德安全代理、天气和步行路线服务。
- `frontend/`：手机网页源码、图片与本地字体、问答/导航适配、测试和构建配置。
- `project-files/organizer/`：主办方原始资料；`project-files/team/server/`：队友提供的服务器配置文件。
- `docs/`：项目需求、架构、会议纪要及历史状态与交接。

## Notes

目录按版本编号排列；编号不代表实物制造已验证。G-code 绑定机器及参数，使用前阅读同目录说明。

本地文件不等于全部适合公开。主办方/团队原始资料默认不纳入 Git；大模型的 LFS 与发布附件安排尚未配置，也未创建 Git 仓库或上传。

历史文档保留当时内容及旧路径；目录迁移对照位于 [docs/history/reorganization-20261029/migration-map.json](docs/history/reorganization-20261029/migration-map.json)。历史要求可能已被后续讨论替代。

前端与高德导航接入、Key 类型、跨前后端/手表分工见 [docs/architecture/navigation-integration.md](docs/architecture/navigation-integration.md)。

## Local development

根目录 `.env.local` 保存地图配置，模板为 `.env.example`，不提交 Git。运行 `backend/` 中的 `npm start`（127.0.0.1:8787），再启动 `frontend/` 的开发服务；Vite 同源代理负责连接。构建后，后端也可托管 `frontend/dist/client/`。正式公开仍需团队配置域名、HTTPS、平台使用范围及发布环境。

硬件状态见 [stopwatch-nav/docs/硬件端-当前功能介绍.md](stopwatch-nav/docs/硬件端-当前功能介绍.md)。官方手册和模型见 [stopwatch-nav/reference/](stopwatch-nav/reference/)。当前定位来自 Android 手机，不是手表独立 GPS；网页与 Android/手表尚未共享路线。
