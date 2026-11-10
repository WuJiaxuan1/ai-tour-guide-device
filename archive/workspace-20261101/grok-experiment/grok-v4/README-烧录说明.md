# StopWatch 连续矢量动画 v4

版本：**2.2.6-grok-v4**。主程序已用 **ESP-IDF v5.5.2** 编译成功；电脑端验证通过，**尚未烧录或真机测试**。

上一版 v3 已在用户照片中显示出角色，但顶部仍有灰带。灰带与厂商源码的半透明顶部状态栏相符。v4 在主程序中隐藏整个顶部状态栏、状态文字区和字幕区，以覆盖完整圆屏的动画画面替代原显示层。

## 本版动画

- 从用户指定的 Grok 项目原引擎提取身体轮廓、眼形、眨眼、视线及动作姿态；在设备上插值绘制矢量轮廓。
- 全部原 21 个表情均有对应；另加 listening，用于实际监听时的姿态。
- 每个状态是 12 秒矢量动作周期，周期末尾用 Hermite 曲线连接开头，匹配位置与速度，避免短 GIF 突然倒回。
- 表情变化时从当前画面做约 550 ms 的过渡；过渡中再来新表情也从当前姿态继续。
- 同一表情重复到达时不重新开播。
- 466×466 圆屏画布；目标 **25 帧/秒**，启用 StopWatch 显示双缓冲。实际帧率、耗电和语音并行稳定性待真机确认。
- 不显示普通状态栏、字幕和对话文字；低电量语音提示仍保留。

这不是网页完整交互引擎的移植：保留核心角色动作和思考三点，未移植粒子轨迹、彩纸与鼠标交互；原项目随机动作被转换为可循环的姿态数据。电脑预览使用与固件相同的 C++ 插值和光栅绘制代码，但不能证明设备刷新速度。

预览文件：`continuous-animation-preview.gif`，依次展示默认、开心、思考、生气、眨眼、默认及其过渡。GIF 只是展示用，设备运行时不解码这个 GIF。

## 语音与配置

基于 M5Stack StopWatch 的 2.2.6 源码提交 `356541a94d6ea73f291388eb028a670e6c75f2f3` 修改显示部分。联网、唤醒、音频及对话程序沿用该源码逻辑；原 `srmodels.bin` 和字体逐字节保留。

烧录脚本只写当前启动的应用分区与 assets 分区，不写引导程序、分区表、OTA 选择或 NVS，目的是保留 Wi-Fi、设备绑定和配置。编译依赖已锁定，但不能把这次构建称为厂商出厂二进制的逐字节复现。连接 xiaozhi.me、原唤醒词、按键与扬声器必须再次真机验证。本版未加入“枫叶精灵”自定义唤醒词。

资源包中保留原 PNG 作为回退数据，但本版显示代码使用矢量库，不播放那些 PNG。**不能只把本版资源包刷进旧固件**，旧固件不会读取矢量库。

## 用户手动烧录：只需执行这一步

关闭 M5Burner、串口监视器，沿用之前已成功烧录的连接方式。在 PowerShell 执行：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-custom'
.\.venv-flash\Scripts\python.exe .\grok-v4\flash_grok_v4.py --flash --port COM3
```

这个命令会按顺序：

1. 检查本地两个文件的长度、SHA256 和分区大小。
2. 从设备只读回分区表和 OTA 选择数据，不读取 NVS。
3. 确认分区表与已核实的原版一致，验证 OTA 选择记录的 CRC，确定实际启动的应用槽位。若状态异常、待确认或不匹配，停止，不写入。
4. 将主程序写入实际启动的应用槽位，将配套矢量资源写到 `0x800000`。
5. 使用 esptool 对两个区域执行 `verify-flash`，成功后重启设备。

原备份显示启动槽位为 OTA-0（`0x20000`），但脚本会重新检查当前设备；如果已切换到 OTA-1，则用 `0x410000`。不通过改写 OTA 选择来强制切槽。

请保持 USB 连接，执行后把完整输出发给助手。若端口改变、连接失败或出现 STOP，先诊断再继续，不加 `--force`，不执行 `erase-flash`。

**不要运行编译日志里的 `idf.py flash` 或默认整包命令**：本次交付仅更新应用与资源，使用上面的专用脚本即可。

## 烧录完成后再检查

1. 顶部灰带消失；角色居中、圆边完整，无文字覆盖。
2. 默认形象有连续小动作；唤醒后的监听姿态、回答时的表情切换自然，不从第一帧反复重播。
3. 原“你好小智”、按键对话、联网和扬声器正常。
4. 连续对话几分钟，观察是否卡顿、黑屏、重启或明显发热。

请区分：电脑端编译/校验通过、设备烧录/读回通过、实际动画/语音功能通过。本版目前只完成第一项。

若动画仍慢，需结合真机现象或串口里的 `GrokDisplay` 绘制耗时继续优化；25 fps 是目标值，不是已经测得的结果。

## 恢复原固件形象与显示程序

需要恢复时执行：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-custom'
.\.venv-flash\Scripts\python.exe .\grok-v4\flash_grok_v4.py --restore --port COM3
```

脚本会将官方缓存提取且与设备备份一致的原主程序及原资源一起恢复，并核对两处写入。本版修改了主程序，因此不能仅恢复原资源。

完整设备备份仍在 `stopwatch-device-backup.bin`，包含私人配置，不要公开上传。此次开发未访问串口或烧录设备。

## 文件与地址

| 文件 | 长度 | 写入位置 |
|---|---:|---|
| grok-v4-app.bin | 2,961,056 字节 | 当前启动应用槽位；由脚本检查 |
| grok-v4-vector-assets.bin | 7,297,480 字节 | 0x800000 |
| original-v2.2.6-app.bin | 2,949,424 字节 | 恢复当前启动应用槽位 |
| ../output/original-v2.2.6-assets.bin | 2,851,677 字节 | 恢复 0x800000 |

完整哈希及源文件指纹见 `build-report.json`。主程序和资源分别小于现有约 4 MB、8 MB 分区；新编译分区表与官方缓存及原设备备份逐字节一致。

仅校验文件、不接触设备：

```powershell
.\.venv-flash\Scripts\python.exe .\grok-v4\flash_grok_v4.py --check-files
```

## 表情对应

| 原表情 | 本版 Grok 动作 | 对应性质 |
|---|---|---|
| neutral 默认 | idle | 直接 |
| happy 开心 | happy | 直接 |
| laughing 大笑 | laughing | 直接 |
| sad 难过 | sad | 直接 |
| angry 生气 | angry | 直接 |
| confused 困惑 | confused | 直接 |
| thinking 思考 | thinking，三点 | 直接 |
| surprised 惊讶 | surprised | 直接 |
| sleepy 困倦 | drowsy | 近似 |
| confident 自信 | proud | 近似 |
| embarrassed 害羞 | shy | 近似 |
| shocked 震惊 | scared | 近似 |
| funny 搞怪 | playful | 近似 |
| silly 傻笑 | playful，眼形 17 | 近似变体 |
| relaxed 放松 | humming 身体动作 | 近似；未移植轨迹粒子 |
| cool 酷 | proud，眼形 8 | 近似变体，无太阳镜 |
| loving 喜爱 | happy，眼形 19 | 近似变体，无爱心 |
| kissy 亲吻 | shy，眼形 24 | 近似变体，无亲吻动作 |
| crying 哭泣 | sad，眼形 22 | 近似变体，无眼泪 |
| delicious 美味 | excited 身体动作 | 近似，无进食动作 |
| winking 眨眼 | playful + wink | 单眼闭合动作 |
| 实际监听状态 | listening | 新增状态映射 |

## 开发验证与复现

- `sample_grok_vectors.mjs`：使用固定版本原项目 JS，通过轻量 SVG 属性适配层计算姿态，不操作浏览器；输出 22×240 帧矢量数据。
- `firmware-source/main/boards/m5stack-stopwatch/grok_motion.h`：共用的 C++ 插值、可打断过渡和抗锯齿光栅绘制核心。
- `grok_display.h`：LVGL 定时绘制、隐藏覆盖层、资源卸载前停止引用旧映射。
- `build_grok_firmware.ps1`：在本地独立工具环境编译 ESP-IDF 5.5.2 工程，仅 build，不访问设备。
- `build_grok_v4_assets.py` 与 `package_grok_v4.py`：资源打包、程序镜像校验和及摘要、分区、备份、语音模型和输出校验。
- `test_grok_motion.cpp`：22 状态有效画面、数值、圆形边界、同状态连续性、打断过渡、循环接缝和损坏格式拒绝均通过。电脑性能不代表真机性能。
- `test_grok_flash_preflight.py`：6 项 OTA 槽位选择检查通过，包含 CRC 损坏、待确认更新、截断、空记录和两种活动槽位。
- 桌面预览和过渡抽帧已视觉检查；尚无 v4 真机结果。

来源：[Grok 角色项目](https://github.com/blessonism/grok-icon-study)，提交 `b7e6cd48db4eeba13271c653c38e1ad0f48037b4`；[M5Stack StopWatch 源码](https://github.com/m5stack/xiaozhi-esp32/tree/356541a94d6ea73f291388eb028a670e6c75f2f3/main/boards/m5stack-stopwatch)。角色项目声明仅供学习参考，请勿商用或再分发，当前产物用于本地学习测试。
