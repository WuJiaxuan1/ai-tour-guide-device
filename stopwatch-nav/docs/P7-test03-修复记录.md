# P7-test03 修复与交付记录

2026-10-28。用户反馈 P7-test02 已能发真实周边地图，但发完后闪退，并要求地图铺满圆屏、去掉导出画面高德标识、显示当前位置。

## 闪退与定位修复

`SurroundingMapActivity.renderPreview()` 原先调用 Bitmap.createBitmap(IntArray,...)，该重载产生不可修改位图；当首次地图确认且 fix 有效时调用 Canvas(bitmap)，会因 immutable bitmap 抛异常。此方法由主线程回调执行，外层网络线程的 try/catch 不会捕获主线程异常。这是代码中确定存在的缺陷，但未取得用户当次崩溃堆栈，因此没有宣称它已覆盖所有可能的闪退原因。

新增 MapPreviewPixels，在克隆后的 IntArray 上绘制定位点，再生成只读 Bitmap 交 ImageView。移除手动 recycle：ImageView/RenderThread 或高德 SDK 可能仍持有对象。成功安装地图后立即排队发送当前有效位置，不再等下一轮状态查询。新增入口查看已存在的 CrashLog，记录改用实际 APK 版本名。

## 画面与坐标

PhoneMapRenderer 使用 480×480 原始 SDK 视图，裁切 [120,360)×[120,360) 为传输图像，避开 SDK 底部标识。经纬度范围通过同一裁切角点调用 SDK projection 获取，不沿用整幅视图范围。手机原始 SDK 视图保留其默认标识，手表预览是实际导出区域。没有调用 SDK 的非公开 Logo 开关。

协议仍为既有 240×240 RGB565LE＋地理范围，手表 LVGL 使用 STRETCH 铺满 466×466。屏幕定位坐标为原图像素坐标乘以屏幕/原图尺寸，24px 蓝点带 3px 白边。标题只保留 N，GPS 精简为顶端提示；隐藏地图页调试信息和底部返回文字，按键/触摸逻辑不变。P6 测试图仍使用原小图布局，离线检查覆盖真实地图→测试图切换。

## 交付与验证

- 固件 `2.2.6-p7-test03`，APK `8.3.26-p7-test03`（versionCode 135），同包名同签名。
- 固件应用：2979712 字节，SHA256 `6a98a72bf06659c177530f02958c4bc04de7193b1fa26085d867183e0251eb06`。
- 资源与 P6 相同：SHA256 `c7712fc7f5f52f1d54fdeb3f9c15e3481d00ddd90a6b4f834ad51123bfdfb64f`。
- APK：55195147 字节，SHA256 `10564d4a833df539590ab8eeca7e2b88b86eb695945b9055b6b87a1cd44fa41b`。
- `logs/P7-test03-android-build.log`：构建与 27 项 JVM 测试通过。
- `logs/P7-test03-firmware-build.log`：固件构建通过。
- `logs/P7-test03-pages-tests.log`：实际 LVGL 全屏、放大后位置点、过期隐藏、测试图恢复、100 次切页及滑动检查通过。
- `logs/P7-test03-device-protocol-tests.log`：Kotlin→C++ 图像、坐标、消息身份、CRC、异常与重连检查通过。
- `logs/P7-test03-release-guards.log`：七项发布保护检查通过。

打包入口 `tools/package_p7_test03.py`，发布目录 `releases/P7-test03`；回退基线为已通过 P6，另可用原 P7-test01 包恢复小图布局。没有自动烧录或安装。

当前没有连接到 ADB 手机，SDK 截图裁切、标识边界、实际文字清晰度与崩溃修复均需手机/手表复测。已确认的是构建与离线检查，不是 P7 整体验收通过。
