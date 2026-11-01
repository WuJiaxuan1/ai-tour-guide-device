# 开机音量100：P8-overview-test02

固件版本：`2.2.6-p8-overview02`。2026-11-01在最近全程地图总览版overview01上，将StopWatch每次开机音量由85改为100。

启动时先读取原来的音量设置，再在开始播放声音前设置为100。当次运行仍可通过现有功能调节音量；下次开机重新设为100。手机继续使用已安装的overview01 App，无需更新。

## 安装

连接手表USB，关闭占用串口的软件，将 `COM实际端口` 替换成手表端口：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-nav\releases\P8-overview-test02'
& 'D:\Study\yiqifen\stopwatch-custom\.tools\espressif\python_env\idf5.5_py3.12_env\Scripts\python.exe' .\flash_p8.py --check-files
& 'D:\Study\yiqifen\stopwatch-custom\.tools\espressif\python_env\idf5.5_py3.12_env\Scripts\python.exe' .\flash_p8.py --flash --port COM实际端口
```

使用包内脚本检查分区、应用及资源并回读校验；无需整片擦除。编译交付不代表已经烧录到手表。

## 验收

1. 开机后版本为 `2.2.6-p8-overview02`，音量为100，配网提示和对话可正常播放。
2. 将音量调低，再关机开机，应恢复为100。
3. 简单确认唤醒、表情与地图切页正常。

现有语音测试已调整为验证100；发布时逐项核对overview01固件源文件，运行逻辑的改动仅为启动音量，另更新版本号。资源、分区及配套App与前版一致。真机验收待你确认。

## 回退至overview01（音量85）

在同一目录执行：

```powershell
& 'D:\Study\yiqifen\stopwatch-custom\.tools\espressif\python_env\idf5.5_py3.12_env\Scripts\python.exe' .\flash_p8.py --restore --port COM实际端口
```
