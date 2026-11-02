> 20261102 状态更新：项目负责人确认真机联合验收已完成。本次发布保留 cbf9250 源码；以下记录中的待验收事项属于此前状态，具体来源见[交付版本说明](../project/交付版本说明-20261102.md)。

> 2026-11-01后续更新：已按用户授权部署前后端与MCP，见 [cloud02-r15部署记录](../operations/deployment-20261101-cloud02-r15.md)。下面关于“未部署”的叙述保留交接当时状态；手表烧录与真机验收仍未进行。

# 最新网页＋服务器＋StopWatch：交接、部署、测试

交接分支：`release/web-watch-cloud02-20261101`。日期：2026-11-01。

这份交接解决的是“队友克隆同一分支就能拿到配套源码和烧录文件”。本次没有改动公网服务，没有代替用户烧录，也没有把桌面自动测试写成实机验收。

## 1. 三部分分别放在哪里

| 部分 | 放在哪里运行 | 负责人需要准备什么 |
| --- | --- | --- |
| 前端 | 手机浏览器；构建文件由后端托管 | 高德 JS Key、JS 安全码与允许域名 |
| 后端与地图生成 | 服务器上的一个 Node.js 进程＋Chromium | Node 24、依赖、高德 Web 服务 Key、可信 HTTPS、持久化目录 |
| 小智 MCP 桥接 | 同服务器另一个 Node.js 进程 | 测试智能体的 WSS 接入点、与后端一致的桥接密钥 |
| 手表固件 | StopWatch | 刷入 `2.2.6-p9-cloud02`、Wi-Fi/手机热点、小智账号绑定 |
| Android App | 可选，开发排错时使用 | 本分支保留 overview01 源码，正式网页方案无需安装 |

流程：网页上传手机定位和行程 → 后端生成“到下一站”的地图/路线 → 手表地图页主动下载。语音页通过小智云和 MCP 读取同一行程。手表无 GPS，服务器也不能替手机定位。

当前采用单演示设备/单智能体全局绑定。若多人同时使用同一智能体，会覆盖当前绑定，不能当作多游客系统上线。

## 2. 队友获取同一版本

安装 Git、Node.js 24 LTS、npm。Git LFS 仅用于建模大文件；不需要建模时可在克隆前设置 `GIT_LFS_SKIP_SMUDGE=1`（PowerShell：`$env:GIT_LFS_SKIP_SMUDGE='1'`，Bash：`export GIT_LFS_SKIP_SMUDGE=1`）。

```sh
git clone --branch release/web-watch-cloud02-20261101 https://github.com/WuJiaxuan1/ai-tour-guide-device.git
cd ai-tour-guide-device
git rev-parse HEAD
npm --prefix backend ci
npm --prefix frontend ci
```

记下提交号，前后端和设备负责人使用同一交接提交。已有修改的旧目录不要直接 pull 覆盖；先保存自己改动或重新克隆。后续开发从本分支建立自己的 feature 分支，PR 回这个集成分支，验收后再决定是否合并 main。

## 3. 先在电脑验收网页和接口

将 `.env.example` 复制为 `.env.local`（Windows `Copy-Item .env.example .env.local`；Linux `cp .env.example .env.local`）。这些值私下配置，不发公共群截图、不提交仓库：

| 变量 | 来源/作用 |
| --- | --- |
| `AMAP_WEB_KEY` | 高德应用中的 Web端(JS API) Key，用于网页和服务器地图渲染 |
| `AMAP_SECURITY_JSCODE` | 同一个 JS Key 的安全密钥，留在后端代理/渲染器 |
| `AMAP_SERVER_KEY` | 高德 Web服务 Key，用于坐标转换、道路路线、天气等 |
| `TEXT_PROVIDER` 与对应模型 Key/名称 | 网页问答与旅行知识模型；按团队已有模型账号配置 |
| `QIXIA_MCP_SECRET` | 自己生成的随机桥接密钥；后端与 MCP 使用同一个值 |
| `MCP_ENDPOINT` | 小智测试智能体提供的完整私密 wss 链接 |
| `QIXIA_API_BASE` | MCP 访问后端的地址，默认 `http://127.0.0.1:8787` |
| `HOST` / `PORT` | 默认 `127.0.0.1` / `8787`，由 `node --env-file` 加载 |
| `WATCH_CHROMIUM_PATH` | 地图渲染用 Chrome/Chromium 可执行文件；可自动查找常用路径 |
| `WATCH_RENDER_ORIGIN` | 可选的地图渲染页面来源域名，高德 JS Key 需允许该来源 |

可用 `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` 在自己的终端生成桥接密钥并仅保存至配置。模型不同平台的 Key 不能混用。Android 高德 Key 不能代替 JS/Web服务 Key。

在仓库根目录执行：

```sh
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend test
npm --prefix frontend run test:sites
node --env-file=.env.local backend/src/server.mjs
```

打开 `http://127.0.0.1:8787/`。另一个终端执行：

```sh
node scripts/check-deployment.mjs http://127.0.0.1:8787
```

验收：页面是最新秋色主题；路线有时间线；进出口选择正确、允许同门返回；历史报告对应实际行程；只有一个“连接我的枫叶精灵”卡片，没有下载配置和独立同步分区。此时缺少 Key 的地图/问答会不可用，不应误判为全功能已通过。

改页面时可另开终端 `npm --prefix frontend run dev`。默认代理后端8787，按 Vite 打印的地址打开；开发预览端口与后端端口是两回事。不要把作者本机5174/8790的临时设置当作部署必需条件。

## 4. 再搭独立测试服务器

推荐有足够内存的 Linux 测试环境，按本分支相同提交部署完整 checkout。独立域名/端口、独立数据库、独立小智测试智能体，避免影响正在演示的正式用户。

1. 安装 Node 24、npm、Git 和浏览器。Debian 12 可用 `sudo apt-get install chromium`；其他系统按发行版安装 Chrome/Chromium，并设置实际 `WATCH_CHROMIUM_PATH`。**用普通服务用户运行浏览器，保留沙箱**，不要用 `--no-sandbox` 掩盖安装问题。
2. 在目标 Linux 上重新 `npm ci`，不能复制 Windows 的 node_modules。构建前端；保留 `frontend/src/content`、`backend/data`、`backend/knowledge`、`shared` 等后端运行依赖，所以只上传 dist 不够。
3. 配置 `.env.local`、高德允许域名与服务权限。前端与 API 同源，Nginx 将整个站点代理给 Node。手机定位需要有效 HTTPS；手表也校验证书，不能靠浏览器忽略证书警告来验收。
4. 启动 HTTP 服务，先做上一节的接口/网页检查，再启动 MCP。同一个 MCP 接入点只运行一个桥接进程。

建议目录结构（是新环境示例，不表示现有 VPS 一定如此）：

```text
/srv/qixia/releases/<提交号>/    完整代码和各自的依赖、构建
/srv/qixia/current              指向当前发布目录
/srv/qixia/shared/.env.local    私密配置
/srv/qixia/shared/runtime/      SQLite、行程媒体等
```

新发布目录中的 `.env.local` 链接到 shared 配置，`.local-work` 链接到 shared/runtime。首次空环境在创建任何行程前建立链接；已有环境必须先停写、备份并迁移原数据，不能把空目录盖在原数据上。

`deployment/qixia-web.service.example` 和 `qixia-mcp.service.example` 提供 systemd 模板。先按实际 Node 路径、服务用户和目录修改，再由服务器管理员安装为服务。服务用户需要读取代码/配置、写入 runtime 和运行带沙箱 Chromium的权限。**不要直接覆盖现有生产服务文件**。

`deployment/nginx-location.conf.example` 是已有可信证书的 HTTPS server 块里的代理片段，不是完整证书配置。只公开必要的 HTTPS 入口；8787 和 MCP 桥接留在本机，不能把私密配置或 SQLite 作为静态目录公开。

前台排错命令（不能与同接入点的正式桥接并行运行）：

```sh
node --env-file=.env.local backend/src/server.mjs
# 另一个终端
node --env-file=.env.local backend/integrations/xiaozhi/mcp_pipe.mjs -- node backend/integrations/xiaozhi/trip-stdio.mjs
```

## 5. 手表烧录：优先用现成包

完整文件都在 `stopwatch-nav/distributions/P9-cloud02/`。四个 bin 合计约17MB，已附在此分支，队友不必下载全部历史发布包或重新编译。包中的 build-report 是原构建校验记录，source_files_sha256 路径相对 stopwatch-nav；源码正常的 Git 换行转换不应被当作固件二进制校验失败。

安装 Python 3.11+，在独立虚拟环境安装 `esptool==4.11.0`。以下命令从仓库根目录执行，`COM3` 必须替换为本机实际手表串口；Linux 常为 `/dev/ttyACM0`。

```sh
python -m venv .venv-flash
# Windows: .venv-flash/Scripts/activate；Linux: source .venv-flash/bin/activate
python -m pip install esptool==4.11.0
python stopwatch-nav/distributions/P9-cloud02/flash_p9.py --check-files
python stopwatch-nav/distributions/P9-cloud02/flash_p9.py --port COM3 --flash
```

脚本先读分区和 OTA 槽、核对校验，再写应用和资源并回读验证。它不写 NVS/分区表/引导程序；原小智绑定通常得以保留。若提示分区不匹配，停止并找硬件负责人检查，**不要改成整片擦除或加 force**。

回滚手表：

```sh
python stopwatch-nav/distributions/P9-cloud02/flash_p9.py --port COM3 --restore
```

回滚目标是 overview02，原 App 测试通路可使用；它不具备 cloud02 的统一配对功能。

固件默认连接 `https://43.160.252.245`。测试用不同域名时，维护人员在手表与电脑同一局域网后设置一次服务器地址：

```sh
python stopwatch-nav/tools/configure_cloud.py --watch-ip 192.168.1.23 --server-url https://你的测试域名
```

也可使用电脑私网 HTTP 地址排查接口，但真手机网页 GPS 仍通常需要 HTTPS。该操作会清除手表当前地图配对；之后向枫叶精灵重新要码。**游客不需要运行命令、下载 JSON 或输入服务器地址。**

证书必须由手表信任、地址匹配且未过期。IP 证书和域名证书不是同一回事；若现有 IP 网站仅能忽略证书错误打开，请先修好证书或改用可信域名。

## 6. 小智工具必须一起更新

部署本分支 MCP 代码并重启桥接，手表刷 cloud02、联网并连回测试智能体。确认工具列表：

- 原生手表工具 `self.qixia.get_pairing_code` 已出现。
- 旧云端 `qixia_pairing_code` 不再出现；若旧提示词点名它，一并改为新工具。
- 云端行程问答、上下文、到达确认、笔记工具仍存在。

向枫叶精灵说“请给我网页行程的配对码”，它应逐位读出8位码。刚联网/服务慢时可能返回准备中，需要稍后再询问，不应编造数字。网页输入后，服务器同时关联语音与地图，5分钟内可用的码只能使用一次，绑定有效12小时。

不能只刷表而继续运行旧后端；也不能只上线网页就认为旧 overview02 会自动支持新配对。

## 7. 分工验收表

| 顺序 | 谁来检查 | 操作 | 应该看到什么 |
| --- | --- | --- | --- |
| A | 前端同学 | 打开最新网页，选择路线、两个门，查看历史 | 新主题/时间线正确；起终点不丢失；报告对应所选历史 |
| B | 后端同学 | 配置高德/模型；启动服务与 smoke 脚本 | 页面/接口可用，地图与问答正常；密钥不出现在浏览器响应 |
| C | 硬件＋后端 | 刷表、更新 MCP，语音要码并在网页输入 | 同一配对成功；问下一站与网页一致；刷新仍显示绑定 |
| D | 三方一起 | 手机允许定位，开始游览，手表切地图页 | 显示真实下一站地图/路线/定位点；服务器收到确认后网页才显示已接收 |
| E | 硬件同学 | 步行、切回语音、再回地图 | 定位和已走颜色更新；表情、左键、唤醒词仍正常 |
| F | 前后端同学 | 到达/跳过/暂停/恢复/换行程重配 | 地图对应新的下一站；暂停不继续有效导航；旧凭据不能继续访问 |
| G | 三方一起 | 重启手表并重新配网；重载网页；错码/重复码 | 未过期绑定能恢复；错误码有真实错误；不把未收到地图说成已显示 |

在 docs/testing 中记录：提交号、网页地址、固件版本、手机型号、通过项、失败步骤、脱敏截图/日志。位置可只描述测试地点，不公开游客轨迹或配对凭据。桌面自动测试不等于景区实测。

## 8. 更新与回滚

每次修改建新分支/提交号，重新安装依赖（lock有变化时）、测试、构建，然后在测试环境验收。验收前不要把 main 作为已稳定版本替换。

生产升级先做 SQLite 一致性备份（SQLite backup API/CLI，或停写后备份），并保存配置、媒体、旧发布目录和旧 systemd/Nginx 设置。不要对运行中的 SQLite 只复制主 .sqlite 文件。切换代码时继续使用原 shared/runtime；不要同时启动两个后台处理进程操作同一业务库。

回滚时前后端与 MCP 回到同一旧提交，保留用户数据；若同时回滚手表 overview02，配对工具和原有 Android 测试方式也要按旧版本处理。旧代码未识别的新表不要盲目删除；先确认数据库兼容性和备份再动数据。

## 9. 需要改固件或 App 的同学

固件源码完整保留上游和本地 Wi-Fi 组件、表情许可。安装 ESP-IDF **5.5.2**、ESP32-S3 工具链，打开已激活 IDF 环境的终端，从仓库根目录运行：

```sh
python stopwatch-nav/tools/build_firmware.py
```

首次需要联网下载组件及语音模型。脚本只编译，不烧录；会把本地组件锁路径替换为本机绝对路径，提交前不要把该本机路径提交。输出在 `stopwatch-nav/firmware/build/`。新修改产生的 bin 不能直接覆盖已发布包中的文件，否则哈希/版本不匹配，应建立新的完整发布包并验证。

后端配对的实际 C++ 桌面测试：安装 GCC/G++并加入 PATH，设置 `IDF_PATH`，运行 `python stopwatch-nav/tools/test_cloud_pairing.py`。其他历史 tools/build.ps1、package_*.py 和部分桌面测试仍依赖原开发机工具目录及历史发布包，仅用于复查原开发记录，不是新电脑部署前提。

Android Studio 打开 `stopwatch-nav/android/`，使用 JDK21、SDK35：`./gradlew :app:assembleDebug :app:testDebugUnitTest`（Windows用 gradlew.bat）。新的调试签名需要配置自己的高德 Android Key/签名SHA-1，原签名不在 Git。App 仅为可选排错工具；本次浏览器导航无需它。

## 本次交接的验证记录

- 后端79项、前端44项、Sites4项测试通过，最新前端构建通过。
- 本次仓库中的配对固件 C++ 桌面测试通过；应用/资源及 overview02 回滚镜像的大小、SHA256、分区边界校验通过。
- 导入的固件发布快照62个源码文件中，61个与原发布包逐字节一致；dependencies.lock 仅将原机器组件路径改成可交接路径。
- 本地8790服务的只读 smoke 检查通过：API、构建网页、JS资源和公开配置格式。
- 上一轮 cloud02 隔离真实高德联调已验证地图/路线下载、ACK及重配撤销；本次没有重复调用正式 MCP 或改动服务器绑定。
- 未完成：本分支在队友新电脑/Linux服务器的实际安装、正式TLS、手表烧录与真实手机GPS联合验收。按上表逐项补记，不直接标成全链路真机通过。
