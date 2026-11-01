# StopWatch Grok 动画性能版 v5

版本：**2.2.6-grok-v5**，ESP-IDF **v5.5.2**。编译及电脑端验证通过，**尚未烧录或测得手表实际帧率**。

针对 v4 所有动画均卡顿的反馈，本版优化持续绘制和屏幕传输。调度间隔从 40 ms 改为 17 ms，上限约 **59 帧/秒**；这只是调度目标，实际表现取决于设备绘制、屏幕传输和语音并行负载，不能保证达到 60 帧或完全无卡顿。

## 改动与验证

- 用活动边扫描线和整数覆盖率/混色降低绘制计算量，保留四次抗锯齿子采样。
- 只写变化像素，按 32×32 小块合并为最多 24 个刷新矩形；完全相同的画面不触发刷新。
- 统一动画绘制与 LVGL 刷新节奏，使用实际经过时间推进动作。
- 使用 32 行 DMA 双缓冲，增加显示任务栈，对绘制核心单独启用 O3 优化。
- CPU 仍为厂商配置 240 MHz，屏幕 QSPI 仍为 40 MHz；音频任务优先级仍高于显示任务。
- 每 5 秒输出 `GrokPerf`：实际提交帧率、绘制耗时、刷新调用耗时、刷新区域占比和最差提交间隔。提交帧率不等于屏幕物理扫描帧率。

电脑端对比了 22 个状态、共 1,760 帧：姿态与 v4 完全一致，所有变化像素均被刷新区域覆盖，相同帧无刷新。刷新矩形总面积平均为整屏的 **29.699%**；平均灰度差 **0.0082/255**。该次桌面绘制计时由 0.764 秒降至 0.418 秒，约为原来的 **55%**，**不能换算成手表帧率**。详见 `renderer-test-results.txt`。

原动画连续性、打断过渡、循环接缝、损坏数据拒绝及 6 项 OTA 选择检查均已通过；主程序和资源的长度、SHA256、分区边界及官方回退文件已离线核对。

## 画面与语音

沿用 v4 的全部 21 个表情和额外监听状态、12 秒动作循环及约 550 ms 可打断过渡；资源包与 v4 逐字节一致。完整对应表见 `../grok-v4/README-烧录说明.md`。

继续使用 466×466 圆屏画布，隐藏顶部灰条、状态文字和字幕，仅显示角色动画。语音程序、原唤醒模型及字体沿用 v4；本版未加入“枫叶精灵”唤醒词。

这是对原 Grok 项目核心身体、眼睛、眨眼、视线和思考三点动作的采样与设备端插值，未移植网页粒子轨迹、彩纸及鼠标交互。

## 现在烧录

关闭 M5Burner 和串口监视器，保持已成功使用的 USB 连接方式。在 PowerShell 执行：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-custom'
.\.venv-flash\Scripts\python.exe .\grok-v5\flash_grok_v5.py --flash --port COM3
```

脚本会先验证本地文件，再只读回当前分区表和 OTA 记录，核对分区表哈希、OTA CRC 及已确认的启动状态。检查通过后，把主程序写入当前启动应用槽位，把资源写入 `0x800000`，最后对两处执行 `verify-flash`，成功后重启。

应用槽位由脚本检测：OTA-0 为 `0x20000`，OTA-1 为 `0x410000`。脚本不写引导程序、分区表、OTA 选择和 NVS，以保留 Wi-Fi、绑定及配置。不能只把资源包写入原官方固件，也不要使用默认 `idf.py flash` 整包烧录命令。

保持 USB 连接，完成后保存完整输出。遇到 `STOP` 或连接错误先排查，不执行 `erase-flash`，不使用 `--force`。若端口改变，将命令里的 `COM3` 改为实际端口。

## 真机检查

1. 先观察待机动画 20 秒，再触发几个不同表情，比较 v4 的流畅度。
2. 确认顶部灰条、文字没有出现，过渡连续，无闪烁或残影。
3. 测试原“你好小智”、按键、联网、语音播放，连续对话几分钟。
4. 观察黑屏、重启、明显发热及语音中断。

烧录校验通过只说明文件已正确写入；动画与语音是否正常需要上述真机检查。

仍卡顿时，关闭其他串口程序，在设备正常运行时执行以下只读日志采集：

```powershell
.\.venv-flash\Scripts\python.exe .\grok-v5\read_grok_perf.py --port COM3 --seconds 18
```

它不会发送设备命令；保存到 `grok-v5/device-performance.log`，终端会显示 `GrokPerf` 和错误行。优先提供这些性能行，完整日志可能包含联网信息。

## 回退

恢复官方 2.2.6 主程序与原资源：

```powershell
.\.venv-flash\Scripts\python.exe .\grok-v5\flash_grok_v5.py --restore --port COM3
```

回到之前的 v4 动画版本：

```powershell
.\.venv-flash\Scripts\python.exe .\grok-v4\flash_grok_v4.py --flash --port COM3
```

完整设备备份仍为 `../stopwatch-device-backup.bin`，含私人配置，请勿公开上传。此次 v5 开发未访问设备串口或烧录设备。

## 文件校验与来源

| 文件 | 字节数 | SHA256 |
|---|---:|---|
| grok-v5-app.bin | 2,965,712 | cd60c1ba095843785b76169db95c46ea11a2b61dc2f4100f4709db45e2480165 |
| grok-v5-vector-assets.bin | 7,297,480 | 2f2f4d055fe0aebc9d1a00336fad4f665f20a9001e0436ff356a2041c1f90628 |
| original-v2.2.6-app.bin | 2,949,424 | d85c66cff7f4901cb9d9d32b95d53d4944f4e9cc96a42426712968d783e6c377 |
| ../output/original-v2.2.6-assets.bin | 2,851,677 | 457fe977e9344e4a233fa5314abc10e13b0c4e673bad377385d119e728de1b6d |

仅离线校验文件、不访问设备：

```powershell
.\.venv-flash\Scripts\python.exe .\grok-v5\flash_grok_v5.py --check-files
```

构建：`../build_grok_firmware.ps1 build`；打包：`../package_grok_v5.py`。完整版本、源文件指纹、限制与哈希记录在 `build-report.json`；v4 二进制及原性能代码已保留。

基础源码：[M5Stack StopWatch](https://github.com/m5stack/xiaozhi-esp32/tree/356541a94d6ea73f291388eb028a670e6c75f2f3/main/boards/m5stack-stopwatch)，提交 `356541a94d6ea73f291388eb028a670e6c75f2f3`；角色来源：[grok-icon-study](https://github.com/blessonism/grok-icon-study)，提交 `b7e6cd48db4eeba13271c653c38e1ad0f48037b4`。原角色项目的学习使用及分发限制沿用 v4 说明。
