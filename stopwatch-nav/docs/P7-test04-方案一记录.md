# P7-test04 方案一记录

2026-10-28。基于已通过的 P7-test03，实施“扩大范围、提前刷新、平滑换图”的第一版优化。协议仍是 240×240 RGB565LE＋地理范围，未引入地图块协议。

## 方案一实现

`PhoneMapRenderer` 的高德相机缩放级别从 16.5 调整为 15.5。缩放级别降低一档后，中央 240×240 裁切区域的地理范围约扩大到原来的两倍宽、两倍高，接近手机上方 480×480 预览的范围；仍使用中央裁切以避开 SDK 底部标识。

`GeoBounds.needsRefresh()` 的安全区域从像素 48～192 收紧为 60～180。定位点进入地图中央约 50% 以外时，手机开始准备下一张底图，旧图保持显示，直到新图上传并被手表确认。

手表 `StopwatchPages` 增加旧地图图层和新地图图层。连续真实地图替换时，新图以 360 毫秒淡入，旧图在动画结束后释放；首次显示、测试图或跨类型切换仍直接显示。地图协议、缓存尺寸、按键和触摸逻辑不变。

## P7-test03 基础能力保留

## 闪退与定位修复

`SurroundingMapActivity.renderPreview()` 原先调用 Bitmap.createBitmap(IntArray,...)，该重载产生不可修改位图；当首次地图确认且 fix 有效时调用 Canvas(bitmap)，会因 immutable bitmap 抛异常。此方法由主线程回调执行，外层网络线程的 try/catch 不会捕获主线程异常。这是代码中确定存在的缺陷，但未取得用户当次崩溃堆栈，因此没有宣称它已覆盖所有可能的闪退原因。

新增 MapPreviewPixels，在克隆后的 IntArray 上绘制定位点，再生成只读 Bitmap 交 ImageView。移除手动 recycle：ImageView/RenderThread 或高德 SDK 可能仍持有对象。成功安装地图后立即排队发送当前有效位置，不再等下一轮状态查询。新增入口查看已存在的 CrashLog，记录改用实际 APK 版本名。

## 画面与坐标

PhoneMapRenderer 使用 480×480 原始 SDK 视图，裁切 [120,360)×[120,360) 为传输图像，避开 SDK 底部标识。经纬度范围通过同一裁切角点调用 SDK projection 获取，不沿用整幅视图范围。手机原始 SDK 视图保留其默认标识，手表预览是实际导出区域。没有调用 SDK 的非公开 Logo 开关。

协议仍为既有 240×240 RGB565LE＋地理范围，手表 LVGL 使用 STRETCH 铺满 466×466。屏幕定位坐标为原图像素坐标乘以屏幕/原图尺寸，24px 蓝点带 3px 白边。标题只保留 N，GPS 精简为顶端提示；隐藏地图页调试信息和底部返回文字，按键/触摸逻辑不变。P6 测试图仍使用原小图布局，离线检查覆盖真实地图→测试图切换。

## 交付与验证

- 固件 `2.2.6-p7-test04`，APK `8.3.26-p7-test04`（versionCode 136），同包名同签名。
- 固件应用：2980144 字节，SHA256 `c848c9285aea3bb34211f0e2a845f2d1303756a77d3617d88a8dec50e33c7739`。
- 资源与 P6 相同：SHA256 `c7712fc7f5f52f1d54fdeb3f9c15e3481d00ddd90a6b4f834ad51123bfdfb64f`。
- APK：55195307 字节，SHA256 `2e6219cec9969d54c4ce7893dca84b318b3e1091d6e3032a94447707436ff9ef`。
- `logs/P7-test04-android-build.log`：构建与 28 项 JVM 测试通过。
- `logs/P7-test04-firmware-build.log`：固件构建通过。
- `logs/P7-test04-pages-tests.log`：实际 LVGL 全屏、位置点、过期隐藏、测试图恢复、页面往返和滑动检查通过。
- `logs/P7-test03-device-protocol-tests.log`：Kotlin→C++ 图像、坐标、消息身份、CRC、异常与重连检查通过。
- `logs/P7-test04-release-guards.log`：七项发布保护检查通过。

打包入口 `tools/package_p7_test04.py`，发布目录 `releases/P7-test04`；回退基线为已通过 P6，也可刷回 P7-test03。没有自动烧录或安装。

当前没有连接到 ADB 手机，SDK 截图裁切、标识边界、实际文字清晰度与崩溃修复均需手机/手表复测。已确认的是构建与离线检查，不是 P7 整体验收通过。
