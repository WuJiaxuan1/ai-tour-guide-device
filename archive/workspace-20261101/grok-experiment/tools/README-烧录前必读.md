# StopWatch 静态形象第一版：资源包说明

## 本次生成了什么

- `output/maple-static-v1-assets.bin`：只替换默认表情 neutral.png，160×160 静态图。
- `output/original-v2.2.6-assets.bin`：从本地 M5Burner 缓存原固件提取的原始资源，可用于资源回退。
- `output/validation-report.json`：原固件与输出的 SHA-256、分区、保留条目和校验结果。

这不是完整程序固件，不可写到 0x0。没有制作自定义“枫叶精灵”唤醒模型，没有动画。
原始唤醒模型、字体、index.json 和其他 20 个表情保持原样，所以说话中切换情绪时仍可能出现原表情。
原图白底保留，未自动抠图。未做真机显示、唤醒、联网或语音测试。

## 适配基线和限制

本地缓存：`M5Burner-v3-beta-win-x64/packages/firmware/05a2cf9f8c71e46dbd0dca65137ad0c1.bin`。
读取到程序 xiaozhi 2.2.6，2026-05-19 09:05:36 构建，ESP-IDF v5.5.2。
该文件的 assets 分区起点 0x800000、容量 0x800000（8MB）。

这些信息来自电脑上的固件，不是从你的手表读回。生成成功不等于所有标记 2.2.6 的固件都兼容。
本次没有访问串口、没有刷写或擦除任何设备。

原始回退资源不是你手表的完整备份，不能恢复 Wi-Fi、绑定配置或其他个人设置。

## 验证结果

构建器先校验原资源长度、文件边界、ZZ 标记、索引及 16 位求和校验。
对原资源解包后重打包，要求逐字节完全一致，然后才允许替换 neutral.png。
对输出重新解包，要求只有 neutral.png 改变，其余文件逐字节相同。
检查图片可解码、资源不超过分区、文件写入后读回一致、原固件 SHA-256 未改变。
测试另覆盖校验损坏、截断、伪造偏移和输出哈希。

## 烧录前必须做的事

1. 保留 M5Burner 中已经验证可用的官方固件，保存官方恢复教程。
2. 按 StopWatch 官方步骤进入下载模式，不猜测哪个侧键是 BOOT。
3. 关闭占用串口的 M5Burner 烧录窗口、串口监视器。
4. 先做完整 16MB Flash 备份，并核对设备实际分区和原资源是否与此基线一致。
5. 不执行整片 erase-flash，不使用 --force，不修改 eFuse、安全启动或加密。

下面是 esptool 5.x 的 PowerShell 命令模板。先进入本说明所在目录，把 COM实际端口替换为真实端口。
若电脑没有 esptool，应在单独的 Python 虚拟环境安装，不要修改项目现有环境。
命令仅供人工确认后使用，本文不会自动执行它们。

```powershell
# 先检查工具版本及命令帮助。
python -m esptool version
python -m esptool read-flash --help

# 完整设备备份：保存到自己的电脑，不公开上传。
# 备份文件应为 16,777,216 字节；重复操作前不要覆盖已有备份。
python -m esptool --chip esp32s3 --port COM实际端口 read-flash 0 0x1000000 stopwatch-device-backup.bin

# 读回当前资源有效长度，用于与原始资源比较。
python -m esptool --chip esp32s3 --port COM实际端口 read-flash 0x800000 2851677 device-original-assets.bin
(Get-FileHash .\device-original-assets.bin -Algorithm SHA256).Hash
(Get-FileHash .\output\original-v2.2.6-assets.bin -Algorithm SHA256).Hash
```

两者哈希不一致、设备已 OTA 升级、分区布局不一致或备份失败时，先停止，不执行下面写入。
两个资源哈希相同仍需确认固件和分区匹配；这里只提供资源层面的比对，不是全固件同一性证明。

## 写入第一版（满足以上前提后）

```powershell
python -m esptool --chip esp32s3 --port COM实际端口 --baud 460800 write-flash 0x800000 .\output\maple-static-v1-assets.bin

# 读回核对，文件应为 2,874,835 字节。
python -m esptool --chip esp32s3 --port COM实际端口 read-flash 0x800000 2874835 device-custom-assets.bin
(Get-FileHash .\device-custom-assets.bin -Algorithm SHA256).Hash
(Get-FileHash .\output\maple-static-v1-assets.bin -Algorithm SHA256).Hash
```

若原生 USB 需要重新进入下载模式才能读回，请按官方说明操作；串口号可能变化。
资源包写入只针对已核对的 assets 分区，不修改应用程序、分区表或 NVS。
不要把这个资源包当作完整合并固件导入“从 0x0 烧录”的流程。

## 重启验收

- 默认表情出现枫叶精灵静态图片；白底、显示大小和字幕位置需人工看真机。
- “你好小智”仍能唤醒，按键对话仍正常。
- 能连接原热点、接通云端并播放回答。
- 连续对话时不崩溃、不反复重启。
- 其他情绪仍显示原表情是此版本预期，不是生成失败。

全部通过后，再制作自定义唤醒词版本。不要一次改图、改模型和改程序。

## 资源回退

若设备实际原资源与本回退包已确认一致，可在下载模式写回：

```powershell
python -m esptool --chip esp32s3 --port COM实际端口 --baud 460800 write-flash 0x800000 .\output\original-v2.2.6-assets.bin
```

若不能正常启动，按 M5Stack 官方恢复教程进入下载模式，再用原官方固件恢复。
https://docs.m5stack.com/zh_CN/guide/stopwatch/restore_factory

## 复现构建

在安装 Pillow 的 Python 中运行 `build_static_assets.py`，再运行 `test_static_assets.py`。
构建脚本只读输入、写 output，不打开串口。
资源格式参考 v2.2.6：
https://github.com/78/xiaozhi-esp32/blob/v2.2.6/scripts/spiffs_assets/spiffs_assets_gen.py
https://github.com/78/xiaozhi-esp32/blob/v2.2.6/main/assets.cc
