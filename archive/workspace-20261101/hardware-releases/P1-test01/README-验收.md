# P1-test01：基线验收包

这是从干净源码构建的小智 v2.2.6 和 MotoNav Android 开发版本。当前没有新增双页面、Wi-Fi 地图或“枫叶精灵”唤醒；原版唤醒词仍为“你好小智”。

## 当前状态

验收补记（2026-10-27）：用户确认以下五项全部正常，P1 已通过。下面“尚未”项是原交付时的记录；当前开发进入 P2。

- 固件和 APK 编译成功。
- 固件的板型、默认语音模型、资源包校验和分区容量检查通过。
- 构建分区表与已核对的原版缓存一致；设备当前分区仍需读回核对。
- APK 签名和安装包名检查通过。
- 尚未向 StopWatch 烧录，尚未安装到手机，真机验收未完成。

## 包内文件

- `p1-xiaozhi-app.bin`：主程序，不能当作从 0x0 写入的完整合并固件。
- `p1-xiaozhi-assets.bin`：配套默认表情、字体和原唤醒模型资源。
- `maple-map-P1-test01.apk`：手机安装包，显示名“枫叶地图 P1（基于 MotoNav）”。
- `restore-v2.2.6-app.bin`、`restore-v2.2.6-assets.bin`：已核对的原版回退文件。
- `flash_p1.py`：沿用已审阅的分区与 OTA 检查流程，要求明确提供真实串口。
- `build-report.json`：文件长度、SHA256、源码版本、资源列表。
- `apk-signature.txt`：APK 验证结果与公开的开发证书指纹，可供以后注册高德应用使用；不含签名私钥。
- `sdkconfig`、`dependencies.lock`：本次固件配置和依赖锁定结果。

## 先做设备确认

让手表正常开机，用数据线连接电脑，确认真实 COM 端口；关闭占用端口的 M5Burner 或串口监视器。

首次写入前，由助手核对当前分区、OTA 状态与备份需求。历史备份不自动等于当前状态。读取分区和烧录可能令设备重启或进入下载模式，需保持 USB 稳定连接。

不要复制编译日志中的通用 `idf.py flash` 命令执行，也不要将单独的 app/assets 文件在 M5Burner 中从 0x0 烧录。本阶段采用下述应用槽位和资源写入助手。

## 本地校验（不接触设备）

在 PowerShell 中执行：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-nav\releases\P1-test01'
& 'D:\Study\yiqifen\stopwatch-custom\.venv-flash\Scripts\python.exe' .\flash_p1.py --check-files
```

## 烧录与回退

以下是设备准备和备份检查完成后使用的命令模板。`COM实际端口` 必须替换为实际设备端口，不能直接照抄。

```powershell
# 烧录 P1；先读回分区表和 OTA 状态，通过后才写入。
& 'D:\Study\yiqifen\stopwatch-custom\.venv-flash\Scripts\python.exe' .\flash_p1.py --flash --port COM实际端口

# 如需回退，在核对当前设备布局仍兼容后执行这一条，而不是两条连续执行。
& 'D:\Study\yiqifen\stopwatch-custom\.venv-flash\Scripts\python.exe' .\flash_p1.py --restore --port COM实际端口
```

助手仅写当前已确认的应用槽位和 assets，不写 bootloader、分区表、OTA 选择和 NVS。文件校验、设备布局或 OTA 状态不匹配时会停止；不要绕过检查。写后执行 esptool 校验，重启后仍需检查实际功能。

## 手机安装

可将 APK 传到手机后点击安装，并按系统提示允许此次安装。包名 `com.qixia.stopwatchnav`，可以与原 MotoNav 并存；它使用新的本地开发签名，后续测试 APK 应保留此签名。

如果使用 USB 安装，需手机开启 USB 调试、确认电脑授权，并且 ADB 能列出该手机。届时由助手使用明确的设备目标安装。

P1 只检查打开 App。不需要现在尝试蓝牙连接小智固件，也不要求地图服务成功；高德 Key 尚未为此新包名和签名配置。基线 App 仍有 MotoNav 原有功能入口，后续阶段再精简；本次无需启用音乐、通讯录、通知读取或无障碍功能。

## 请反馈这五项

1. 手表启动正常，屏幕与原版基本一致，没有 Grok 动画。
2. Wi-Fi 正常连接，云端仍是原设备和预期智能体，无需重新绑定；若出现激活码，记录现象，不算此项通过。
3. “你好小智”可唤醒，连续三轮语音录制、回答播放正常。
4. 重启一次后仍能正常运行；本阶段沿用原版 Wi-Fi 记忆，尚未要求每次开机配网。
5. 手机可安装并打开“枫叶地图 P1（基于 MotoNav）”，原 MotoNav 不受覆盖。

异常请提供：测试项编号、设备/应用版本、操作前状态、实际现象、是否可重复，以及报错或照片。无需先自己分析原因。

## 版本识别与限制

小智程序显示版本仍为 2.2.6，发布包阶段名为 P1-test01；具体构建以本包的 SHA256、`firmware-image-info.txt` 为准。源码保持原版自动升级逻辑：如开机出现升级提示或自动下载，不要把升级后的运行结果算作本构建通过，记录并反馈。后续定制阶段需要单独处理升级策略，保留身份认证与云端地址获取。

编译成功、签名校验通过均不代表真机功能通过。此版本没有手机热点地图通信；该功能从 P2 开始加入。
