> 当前状态：用户于2026-10-31要求照片模块恢复最初演示版并停止改进。photo-r12恢复JournalPage本地选图/固定纪念卡；服务器新上传和制作返回410。以下实现说明仅为历史记录。已有作品数据保留，读取/删除接口保留，不得自动恢复或继续开发该模块。

# 独立照片创作（photo-r10）

用户决定：无需选择路线，照片可独立创作并保存。入口为桌面顶部“照片创作”、手机更多菜单“照片创作”，以及“我的路线 → 照片创作”。不需要行程或小智配对。

## 实现边界

使用服务器 Sharp/libvips 处理真实上传照片，自动纠正 EXIF 方向，保留完整画面，输出 1200×1600 旅行记忆卡和 1000×1000 透明底照片贴纸。贴纸保留照片原背景，外加圆角白边，边框外有真实 Alpha 透明通道。输出不携带 EXIF；原始上传文件仍保存至用户删除。

这是照片排版，不是 AI 重绘、主体抠图，也没有调用图像供应商。`travel-memory-card-duo` 是交互式创作指令，不能直接当作 VPS 的常驻图像服务。未来如接图像模型，应另行实现供应商适配、任务状态与明确的上传用途说明。现有 `sticker_generation_configured` 仍表示外部图像供应商，不能用它判断本模块可用性。

## 数据流与接口

网页沿用匿名 web 会话 Bearer token；照片归属 `owner_id`，不引用 `trip_id`，设备 token 不可操作。令牌不放入图片 URL，预览和下载通过带 Authorization 的 fetch 获取 Blob。照片不公开挂载成静态资源。

| 方法 | 路径（前缀 `/api/v1`） | 内容 |
|---|---|---|
| POST | `/photos` | JPEG/PNG 原始字节；`Content-Type` 与 `X-Client-Event-Id` 必填；同一标识相同图片返回既有作品，不同图片409 |
| GET | `/photos` | 当前身份未删除作品，最多20条 |
| GET | `/photos/:id` | 状态、版本、标题、配文、输出描述；不返回物理文件名 |
| POST | `/photos/:id/generate` | JSON `{title,caption}`；标题1–18字，配文1–60字；返回202，前端轮询 |
| GET | `/photos/:id/assets/:kind` | kind为original、memory_card、transparent_stickers；private/no-store |
| DELETE | `/photos/:id` | JSON `{expected_version}`；并发制作中禁止删除；清理原片与两张作品 |

`GET /capabilities` 新增 `photo_craft_available:true`、`photo_craft_independent:true`、`photo_craft_mode:'photo_layout'`。

状态：`uploaded → queued → running → succeeded / failed`。失败可以重新制作；同文案重复提交复用当前任务；成功后若要改文案，重新选图创作。进程重启时 running 重新排队。每个身份最多20张未删除照片、同时最多2个待制作任务；工作队列串行运行，避免同时渲染多张大图。

## 存储和限制

- 同一 SQLite 增加 `photo_creations` 和 `photo_purge`。二进制位于 `.local-work/photo-creations/`；线上该目录属于 `shared/travel-data`。
- JPEG/PNG 最大8 MB、6000万像素；先实际解码再接受上传，校验扩展名之外的真实格式。其他格式须先转换。
- 标题/配文转义后进入 Pango 排版，不能作为 SVG/HTML 指令执行。
- 文件使用随机 UUID，目录0700/文件0600；下载需同一网页身份。删除保留最小请求回执，防止旧请求重新生成被删除作品；文件删除失败由持久清理队列重试。
- 匿名浏览器凭证有效期7天，清除网站数据、更换浏览器或凭证过期后暂不能恢复身份；提醒用户及时下载。当前没有跨设备账号及自动到期删除机制。
- Nginx仅精确路径 `/api/v1/photos` 放宽为8m；其他接口仍128k。

## 构建与部署

后端新增精确依赖 `sharp@0.35.5`，须连同 package-lock.json 合并。部署到Linux时使用匹配目标系统/架构的依赖，不复制Windows的node_modules。服务器使用Node22.22.1；本次打包Linux x64 glibc预编译依赖，未安装系统软件。中文字体为NotoSansSC.ttf，附OFL许可；`backend/assets/fonts` 必须随服务端发布，不放到浏览器首屏资源。

前端独立组件 `PhotoStudioPage.jsx` 与 `photo-studio.css`，通过 `travel-api.js` 的 uploadPhoto/fetchPhotoAsset 和 travelRequest 访问服务端。现有 ServerMemoryPage 的旧行程照片代码保留为历史实现，新照片入口不再使用它。调整UI时保留授权上传勾选、错误/重试、队列状态、历史、删除确认及两种下载。

测试覆盖：不同照片不同输出、透明度、中文/转义、方向修正、元数据、损坏与格式/像素限制、身份隔离、设备禁止、幂等、失败重试、重启恢复、删除与清理重试。发布记录详见 `docs/operations/deployment-20261031-photo-r10.md`。

photo-r11：相机大图上限提高到60MP，先读头部返回准确尺寸错误再有界解码。用户44.76MP原图本机验证成功；前端补充已选文件名与自动缩小说明。
