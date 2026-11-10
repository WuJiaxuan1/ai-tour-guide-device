# P8-avatar-test09：左键主动开始语音

版本：`2.2.6-p8-avatar09`。基于用户已全部验收的test08，手机App无需更新。本版待真机验收，未自动烧录。

## 使用效果

- 在小智表情页待机时，短按正面左键：开始连接并进入聆听，无需说“枫叶精灵”。进入聆听时沿用短震反馈，之后直接说问题；说完自动交给小智回答，不用一直按住。
- 从地图页按左键：只返回小智页。再按一次才能主动开始语音。
- 正在连接、聆听或回答时，左键不额外动作，避免重复按键结束对话。
- 配网、激活、升级期间左键不会启动语音或进入音频测试。
- 右键进入地图、左右滑动、唤醒词、震动、点按表情、倾斜和连续摇晃保持原有行为。全屏表情不添加文字。

## 安装

用USB连接手表，关闭占用串口的软件，把`COM实际端口`替换为当前端口：

```powershell
Set-Location 'D:\Study\yiqifen\stopwatch-nav\releases\P8-avatar-test09'
& 'D:\Study\yiqifen\stopwatch-custom\.tools\espressif\python_env\idf5.5_py3.12_env\Scripts\python.exe' .\flash_p8.py --check-files
& 'D:\Study\yiqifen\stopwatch-custom\.tools\espressif\python_env\idf5.5_py3.12_env\Scripts\python.exe' .\flash_p8.py --flash --port COM实际端口
```

安装后版本为`2.2.6-p8-avatar09`。脚本核对分区、应用槽及文件哈希，写入应用和资源并回读校验，不整片擦除。原绑定、每次配网和音量85保留。

## 五项验收

1. **按键唤醒**：配网完成、出现待机眼睛后，不说唤醒词，短按左键；进入聆听并短震，然后说“介绍一下栖霞山”，能正常收到回答，松手不影响收音。
2. **重复操作**：回到待机后重复几轮；连接、聆听和回答时再按左键，不意外结束对话或重复震动。
3. **地图切换**：右键到地图，左键返回后不自动开麦；再次按左键可开始对话；左右滑动正常，地图、路线和已走变色正常。
4. **启动保护**：重启后在配网页按左键，不跳出配网页；配好网络后才能开始语音。唤醒词“枫叶精灵”仍可正常使用。
5. **表情回归**：单击惊讶/双击开心及短震正常，倾斜、反复摇晃眩晕正常，语音无新增卡顿。

按键触发与真实云端对话需本轮真机验证；编译和电脑回归通过不等于上述已通过。

## 回退到已验收test08

```powershell
& 'D:\Study\yiqifen\stopwatch-custom\.tools\espressif\python_env\idf5.5_py3.12_env\Scripts\python.exe' .\flash_p8.py --restore --port COM实际端口
```

## 代码修改

仅在StopWatch板级左键回调中，按主线程里的页面和设备状态分流：地图返回、待机调用小智原有`ToggleChatState()`自动聆听入口、其余忽略。没有使用需要手动停止录音的`StartListening()`模式。音频、云端协议、导航和表情/马达驱动沿用已验收代码。

“跟着说话节奏动”仍在后续计划，本包先交付新增的左键功能。
