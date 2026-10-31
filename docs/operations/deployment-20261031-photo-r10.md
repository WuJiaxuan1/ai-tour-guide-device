# 照片创作 photo-r10 发布记录

- 上线：2026-10-31 19:04 CST；上传代理限制补查修复并复验：19:18 CST。
- 版本：`0.5.2-20261031-photo-r10`；回滚版本：`0.5.2-20261031-memory-r9`。
- 入口：`https://43.160.252.245/?v=photo-r10`。
- JS：`index-CwO6m-Tm.js`；CSS：`index-HTnVccQA.css`。
- 源码仍为本地解压目录，未提交/推送GitHub，不得用旧main覆盖本次部署。

## 上线内容

独立照片上传、中文标题/配文、异步排版、旅行记忆卡与真实透明底照片贴纸、作品重开、下载、删除、失败重试。网页桌面顶部/手机更多菜单/我的路线新增“照片创作”。不依赖路线，不改变小智配对；没有新增小智工具或固件要求。保留照片背景，不宣称AI重绘或抠图。

后端引入Sharp 0.35.5和OFL中文字体。发布包附带Linux x64 glibc依赖，未复制本机Windows依赖、未安装系统软件。字体仅在后端使用，不影响前端首屏下载。

## 验证证据

- 本地后端61项、前端36项全部通过，生产构建通过。
- Linux预发布后端61项全部通过，隔离测试库14项API验收通过。
- 正式HTTPS地址14项API验收通过：入口资源、健康、能力、空列表、损坏文件拒绝、两张不同照片与上传幂等、所有权隔离、异步完成、输出随输入变化、真实Alpha与无EXIF、重开、无需行程、删除、删除后不可访问。
- 补查Nginx发现旧128k上限；仅照片上传精确路径放宽至8m。公网补充3项通过：1,948,771字节JPEG上传成功、测试图片删除、超过8 MB返回413。
- 取回并查看Linux生成的项目栖霞寺测试照片卡片，中文与照片正常。
- 浏览器自动页面操作未完成：自动审批拒绝激活现有Chrome窗口，理由为可能读取与本次任务无关的私人页面。没有绕过。手机页面上传/滚动/下载交给用户实际验证；不将API验收写成实物验收。
- 旅行回忆memory-r9用户验收仍待反馈；沉浸式体验已获用户确认通过。

## 数据与运维

发布前校验线上memory-r9基线文件，隔离副本运行测试；备份 `shared/backups/before-photo-r10.sqlite` 后原子切换current并只重启qixia-guide.service。`.local-work`仍指向shared/travel-data；MCP保持mcp-r2。照片表为增量新表，不迁移/删除现有行程。

Nginx备份 `shared/backups/qixia-guide-before-photo-r10.conf`，`nginx -t` 成功后平滑重载。仅新增 `location = /api/v1/photos`，8m上限，代理到127.0.0.1:18787，其余接口仍128k。

后续发布需检查photo_creations是否有queued/running工作，避免中断渲染；重启恢复仍会重新排队。回滚应用到memory-r9可保留新照片表/文件，不删除shared；需要回滚Nginx时，按备份恢复、nginx -t后reload。数据库备份不等于恢复用户已删除照片的授权。

工作区scripts中保存package/deploy/verify-photo-r10及configure-photo-upload.py、verify-photo-upload.mjs。部署回执位于服务器shared/photo-r10-deployment-receipt.json；验收结果位于shared/travel-data/photo-acceptance.json及photo-upload-acceptance.json。测试会话的照片已删除。

## 用户测试

1. 不选路线，从“更多 → 照片创作”（或“我的路线 → 照片创作”）上传一张JPEG/PNG，填写标题/配文，勾选保存用途并制作。
2. 分别下载记忆卡、透明贴纸。换另一张照片重新制作，应显示新的照片；预览棋盘格不应被烘焙进PNG。
3. 同一浏览器刷新、重开入口，作品仍在，能够再次下载。
4. 删除一张作品，刷新后该作品消失，其他作品与行程正常。

GitHub合并使用累计trip-r1-source.patch、immersive-r7-assets.zip和新增photo-r10-assets.zip。照片包包含后端字体与许可证，不包含用户照片、密钥或node_modules。
