# P1 基线来源与修改

2026-10-30 P8-test02（versionCode142）：在 P8-test01 的 RouteWire 独立路线层上增加 RouteProgressTracker；手机把有效 GPS 匹配到路线并通过 `/position` 发送单调不回退的 route_progress，固件按路线段分界绘制 traveled/route 两种颜色。低精度、偏离、跳变和旧 revision 被冻结或拒绝；地图移动、换块和配色变化保留进度。新增 Android、C++ HTTP、LVGL 进度测试；P8-test02用户于2026-10-30确认全部验收通过。详见 `../docs/P8-路线与配色协议.md`。

最新 P7-test07（versionCode140）：参考MotoNav MapFeeder已确认覆盖与提前偏移的策略，独立实现MapChunkPolicy；720 SDK视图中央导出480地图块，原缩放下显示240移动窗口。HTTP能力协商、编码新增v3块，保留v1/v2；默认14.0和隐藏地图文字。手机预览同步裁切已确认块。37项JVM测试及两端离线集成检查通过，需test07固件和真机复测。详见 `../docs/P7-test07-地图块与窗口.md`。

最新 P7-test06（versionCode 139）：新增高德地图文字标注“标准/隐藏地图文字”对比，记录已截取和显示的图层模式；延续 P7-test05 缩放控制和用户确认的 14.0。仅更新 APK，沿用 P7-test04 固件；32 项 JVM 测试通过，真机效果待验收。详见 `../docs/P7-test06-地图文字显示记录.md`。

复制自本地 `MotoNav-main/android/standard`，源工程版本 8.3.26。保留原始代码中的来源声明及 `MOTONAV-LICENSE.md`。

P1 只调整安装标识：包名 `com.qixia.stopwatchnav`、显示名和版本后缀，以便与原 MotoNav 并存。使用本工程新生成的开发签名。没有复制原工程的个人配置或签名私钥。

当前仍是 MotoNav 基线功能，通信仍为原 BLE 逻辑；Wi-Fi 通道将在 P2 增加。本阶段只验收编译、安装和启动，不宣称支持小智地图、巡航定位或新的高德 Key 已配置。

## P2-test01 修改

新增 `LocalLinkActivity` 和 `LocalLinkClient`，启动页改为局域网连接测试；使用 HTTP 查询设备状态与发送小消息，加入匹配确认、限长、超时、取消和前台重试。允许本地 HTTP 明文通信。包名和开发签名保持不变，versionCode 提升到 131，显示名及版本后缀更新为 P2。

保留原 MotoNav 源码供后续地图复用，P2 启动页不进入原蓝牙导航、音乐、天气或 Key 设置流程。当前仍不包含地图传输、定位或路线功能。新增 9 项 JVM 通信测试，许可证和原来源声明保留。

## P6 / P7 修改（2026-10-28）

P6 增加 RGB565LE 测试图编码、HTTP 上传和显示确认，已由用户验收。

P7 启动页改为 SurroundingMapActivity，使用 Android GPS 的真实 WGS-84 定位，经原 MotoNav MapGeo 转换为 GCJ-02；PhoneMapRenderer 参考 AmapCaptureHost 的完整截图确认、相机检查与取消方式，保留高德标识和地图文字，使用独立 240×240 TextureMapView。复用 Keys 的手机本地 Key 配置和签名读取；不继承 MotoNav BLE、导航路线、音乐、电话、天气工作流。

新增地理范围图像头及独立位置上传，手表仅对已显示地图接受位置。接口 SurroundingMapSource 将地图来源和设备传输隔开，后续可以增加服务器实现，当前没有请求自建服务器。启动流程不再自动初始化旧音乐和导航服务，也不再自动同意高德隐私政策；首次启用地图由使用者确认。初版仅前台运行，切到后台或锁屏停止同步。

包名和签名不变，P7 versionCode 133，versionName 8.3.26-p7-test01。源码与第三方服务许可继续保留；真实地图与定位的用户验收尚未完成。

P7-test02（versionCode 134）修复 Key 异步保存后立即退出可能丢失：新增 AmapKeyStore 以 commit() 等待落盘并读取校验，在工作线程执行；设置页改为“保存并应用”，销毁旧地图后应用新 Key，启动地图前再次应用。新增 4 项存储回归测试，沿用既有包名、签名及 P7-test01 固件。

P7-test03（versionCode 135）修复首次发图后向不可修改 Bitmap 创建 Canvas 的异常：MapPreviewPixels 在独立像素数组画点，移除可能仍被渲染器持有的位图的手动回收。地图确认后立即排队发送有效位置；增加上次闪退记录入口并记录实际版本。PhoneMapRenderer 改为 480×480 SDK 视图，中央裁切 240×240 并按裁切角点获取地理范围，手表导出区域避开 SDK 底部标识；手机原始 SDK 视图保留默认标识。新增 3 项像素与裁切回归测试，总 27 项 JVM 测试通过。配套固件把真实地图放大至全屏并同步变换定位坐标；尚待真机复测。
