# StopWatch Grok 圆屏动画资源 v3

本版是可烧录的实验性资源包，电脑端 8 项离线测试通过，尚未烧录或真机测试。
只写资源分区；没有生成或替换主程序。先测试本版，再继续自定义唤醒词。

## 已做的修改

- 原固件全部 21 个表情槽位均换为 Grok 黑底白色软团角色，不再保留原表情 PNG。
- 466×466 GIF，每个 16 帧、120 ms/帧，1.92 秒循环。网页里的实时物理/指针交互已转换为动画片段。
- 每个表情独立计算整段动作的最大半径并固定缩放，让画面接近铺满圆屏；全部帧保留约 8 px 径向余量。带旋转轨迹的表情会给轨迹留空间。
- `hide_subtitle: true` 请求隐藏对话字幕。
- 清空原文字字体的非压缩 4bpp 字形像素，让使用该字体的中文、英文、数字透明。字体指针、字符表、字距、尺寸和全部 6,658 个字形描述保持原样，并校验全部字形像素为零。
- 原 `srmodels.bin` 逐字节保持，原唤醒词不变；主程序、Wi-Fi 配置、设备绑定和语音协议不作修改。因此仍由原固件连接 xiaozhi.me 和处理语音。

## 还须真机确认的部分

这是“放大形象、无对话字幕、透明普通文字字体”的测试版，不能把它当作已经验证的完全无字全屏固件：

- 厂商参考源码将表情居中，但未证明该源码与已安装二进制逐字节对应；最终大小、位置仍需看设备。
- 顶部状态栏控件没有删除。图标、半透明背景仍可能叠在角色上，也可能使顶部变暗。
- 加载资源之前的开机文字、使用其他内置字体的提示和缺字方框可能保留。普通字体透明也不等于弹窗控件被删除。
- GIF 解码速度、内存、长时间对话稳定性尚未实测。若卡顿、黑屏、重启，应恢复原资源。
- 若要求开机、配网、故障等所有界面完全无文字、无覆盖层，需要修改并编译厂商主程序，本包没有完成这一点。

## 表情逐项对应

全部原槽位各有对应资源文件。仓库语义集合与原固件不同，部分采用同状态的眼形变体，并非两个状态集合的严格双射。

| 原表情槽位 | Grok 状态/动作 | 说明 |
|---|---|---|
| neutral 默认 | idle | 直接 |
| happy 开心 | happy | 直接 |
| laughing 大笑 | laughing | 直接 |
| sad 难过 | sad | 直接 |
| angry 生气 | angry | 直接 |
| confused 困惑 | confused | 直接 |
| thinking 思考 | thinking | 直接；该状态会变成三个点 |
| surprised 惊讶 | surprised | 直接 |
| sleepy 困倦 | drowsy | 近似 |
| confident 自信 | proud | 近似 |
| embarrassed 害羞 | shy | 近似 |
| shocked 震惊 | scared | 近似 |
| funny 搞怪 | playful | 近似 |
| silly 傻笑 | playful，眼形 17 | 近似变体 |
| relaxed 放松 | humming | 近似；保留旋转轨迹 |
| cool 酷 | proud，眼形 8 | 近似变体；没有太阳镜 |
| loving 喜爱 | happy，眼形 19 | 近似变体；没有爱心 |
| kissy 亲吻 | shy，眼形 24 | 近似变体；没有亲吻动作 |
| crying 哭泣 | sad，眼形 22 | 近似变体；没有眼泪 |
| delicious 美味 | excited | 近似；没有进食动作 |
| winking 眨眼 | playful + 单眼闭合 | 使用原角色引擎的 wink 眼形 |

动画总览：打开同目录 `preview.html`。静态对应图：`expression-map-preview.png`。
预览页的文字标签不是 GIF 的内容，不会被画到表情里；预览未模拟设备覆盖层和刷新速度。
此包没有增加固件原本不存在的表情槽位，也没有将“监听中”独立绑定为 Grok listening。

## 当前文件

- 文件：`grok-round-v3-assets.bin`
- 长度：**7,050,682 字节**
- SHA256：`ab8d5a816f749de4a8be25899ca2d936f84358e29500e3c935ba24e9631173e9`
- 写入地址：**0x800000**，分区容量 8,388,608 字节。

## 第一步：用户手动烧录

关闭 M5Burner、串口监视器。沿用已成功备份时的连接方式，端口当前为 COM3。
在 PowerShell 执行：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-custom'
.\.venv-flash\Scripts\python.exe -m esptool --chip esp32s3 --port COM3 --baud 460800 write-flash 0x800000 .\grok-round-v3\grok-round-v3-assets.bin
```

资源包不能写到 `0x0`。不要执行 `erase-flash`，不要加 `--force`。
若连接失败、端口变化或出现错误，停止并把完整输出发给助手，先诊断再继续。
进入下载模式遵循 StopWatch 官方说明，不猜测侧键操作。

## 第二步：烧录输出确认后再做

启动设备，逐项确认：

1. 默认形象变为黑底白色 Grok 角色，尺寸、居中、圆边和动画正常。
2. 原“你好小智”可以唤醒，按键对话、联网、扬声器正常。
3. 对话字幕与普通状态文字不可见，语音回答正常。记录是否仍有顶部图标、暗条或特殊提示。
4. 多次对话和情绪切换时无黑屏、明显卡顿或重启。

电脑校验通过、烧录完成、真机显示/语音通过，是三个不同结论。

## 第三步：需要时读回核对

```powershell
.\.venv-flash\Scripts\python.exe -m esptool --chip esp32s3 --port COM3 read-flash 0x800000 7050682 .\device-grok-v3-assets.bin
(Get-FileHash .\device-grok-v3-assets.bin -Algorithm SHA256).Hash
(Get-FileHash .\grok-round-v3\grok-round-v3-assets.bin -Algorithm SHA256).Hash
```

两个哈希应与上面 SHA256 相同。

## 恢复原形象和字体

```powershell
.\.venv-flash\Scripts\python.exe -m esptool --chip esp32s3 --port COM3 --baud 460800 write-flash 0x800000 .\output\original-v2.2.6-assets.bin
```

完整设备备份仍保存在上级目录 `stopwatch-device-backup.bin`，含私人配置，不要公开上传。

## 复现和检查

- 构建：`build_grok_round_v3.py`，使用本地已经渲染的 `grok-artwork` 21 组帧。
- 测试：`test_grok_round_v3.py`，8 项离线测试通过。涵盖全部表情替换、圆形范围、GIF 循环与动作、字体结构和透明像素、语音模型、备份基线、资源格式与分区边界、哈希和损坏拒绝。
- Grok 本地 11 个来源文件与 GitHub 固定提交的 Git blob SHA1 全部一致，见 `source-verification.json`。
- 已视觉审阅表情对应总览及抽样帧；这不是实际设备界面审阅。
- 此次构建和检查不访问串口，没有烧录设备。

来源：[grok-icon-study](https://github.com/blessonism/grok-icon-study)，提交 `b7e6cd48db4eeba13271c653c38e1ad0f48037b4`。该仓库声明仅供学习参考，请勿商用或再分发；当前产物供本地学习测试。

厂商显示参考：[M5Stack StopWatch 源码](https://github.com/m5stack/xiaozhi-esp32/tree/356541a94d6ea73f291388eb028a670e6c75f2f3/main/boards/m5stack-stopwatch)，该提交于 2026-05-19 添加 StopWatch 支持，工程版本为 2.2.6，但尚未证明与已安装固件二进制完全对应。

字体加载参考：[xiaozhi-fonts CBin loader](https://github.com/78/xiaozhi-fonts/blob/d45dbc64052d57048f20ab1770074172ce9eb53b/src/cbin_font.c)、[LVGL 字体描述结构](https://github.com/lvgl/lvgl/blob/v9.3.0/src/font/lv_font_fmt_txt.h)。字体修改仅接受原字体的固定 SHA256 和已验证结构，不对未知格式直接清零。
