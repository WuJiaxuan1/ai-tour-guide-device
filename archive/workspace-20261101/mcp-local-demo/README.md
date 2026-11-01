# 枫叶精灵：VS Code 本机 MCP 练习

2026-10-30：已新增景点知识查询工具，读取项目现有12景点资料。请先阅读 [知识库接入与验收.md](知识库接入与验收.md) 完成角色配置和真机测试。下面保留原连接练习说明，其中旧版测试记录不代表新增知识工具已完成云端验收。

尚未接入真实路线、GPS 或游览记录。云端连接使用本机有效接入点，程序不会使用聊天记录中的令牌。

## 已准备的环境

- 电脑现有 Python：`C:\Users\华硕\AppData\Local\Programs\Python\Python313\python.exe`，版本 3.13.15。
- 项目独立环境：`.venv\Scripts\python.exe`。
- VS Code 已有微软 Python、Python Debugger 扩展。
- 官方桥接源码来自 https://github.com/78/mcp-calculator 。未使用其计算器 eval 示例。
- 下载时版本：`c537f71d61fd73b47d6c8955b5df6d3721acf4e4`。
- 已实际通过本机 MCP 握手、工具发现、传参调用检查；已验证空接入点不会发起云端连接。VS Code 断点操作留给你按下文体验，小智云端尚未实测。
- 2026-10-22 更正：在正常 Windows 用户环境中，`python`、`py -0p`、`python -m pip` 均正常。此前“命令不可用”的判断来自受限执行环境的访问限制，不是电脑 PATH 或 Python 注册损坏；无需重装或修改系统 PATH。
- 项目虚拟环境已验证：Python 与 pip 都指向本项目 `.venv`，MCP 1.30.0，`pip check` 无损坏依赖。

## 1. 用 VS Code 打开正确的文件夹

选择“文件 → 打开文件夹”，打开 `D:\Study\yiqifen\mcp-local-demo`，不是上一级文件夹。仅在文件来源为你信任的本机项目时选择信任工作区。

按 Ctrl+Shift+P，选择“Python: Select Interpreter / Python: 选择解释器”。如果没自动选中，输入解释器路径：`D:\Study\yiqifen\mcp-local-demo\.venv\Scripts\python.exe`。

项目已开启 Python 扩展的终端环境自动激活。选好解释器后，关闭旧终端并新建终端；不要只在旧终端里继续操作。验证 `python -c "import sys; print(sys.executable)"` 应指向本项目 `.venv\Scripts\python.exe`。

如终端未自动激活，在项目目录的 PowerShell 中执行 `.\.venv\Scripts\Activate.ps1`。本机当前执行策略为 RemoteSigned，无需为此修改策略。F5 调试配置始终明确指定 `.venv`，不依赖终端是否激活。

## 2. 先做离线调试

1. 打开 `qixia_tools.py`，在 `result = {` 左侧空白处点击，出现红点即设置断点。
2. 按 Ctrl+Shift+D 打开“运行和调试”。
3. 顶部下拉选择“1. 本机 MCP 测试（无需令牌和硬件）”。
4. 按 F5。
5. 暂停后，鼠标放在 `remaining_minutes` 上，应看到 40；F10 单步，F5 继续。
6. 终端应显示工具列表、测试结果和“通过”提示。

此过程启动真正的本地 MCP 客户端和工具服务，验证握手、工具列表和调用；不连接小智、不读取 .env。

## 3. 再连接小智

1. 先处理之前已贴到聊天里的令牌，按平台能力重置或撤销，确认旧凭据失效。
2. 打开本机 `.env`，在 `MCP_ENDPOINT=` 后粘贴新的完整地址：格式是 `wss://api.xiaozhi.me/mcp/?token=...`，不要输入 `wss\://`，不要加 Markdown 反引号。
3. 保存，切换到“2. 连接小智 MCP（先填写本机 .env）”，按 F5。
4. 观察是否出现 `Successfully connected to WebSocket server`、`ListToolsRequest`。后者可能需要平台进一步初始化才出现。
5. 如平台提供可调用工具的测试对话，要求它“调用 get_demo_status，查询剩余40分钟的连接测试状态”；否则等设备到货后语音触发。
6. 真正调用时会出现 `CallToolRequest`，并进入你在工具函数中设置的断点。断点会拖延回复，验证后移除再测试正常速度。
7. 停止按钮或 Ctrl+C 结束程序。电脑休眠、断网或程序停止会让工具离线。

连接成功、工具被发现、工具真正被调用，是三个不同检查点。仅出现连接成功不代表云端模型已经调用工具。

## 常见问题

- 如果你自己的新终端真的找不到 `python`：先检查 `Get-Command python -All` 和 `py -0p`，必要时完全重启 VS Code 后再检查；本次已验证正常用户环境中两个命令均可用。Codex 受限环境的访问错误不代表本机安装损坏。
- PowerShell 不允许 Activate.ps1：本项目不需要激活环境，也不需要放宽执行策略。
- `ModuleNotFoundError`：检查是否选中了本项目 `.venv`。
- 终端没有输出、单独运行 qixia_tools.py 一直等待：它是等待 MCP 消息的服务，请使用两个已配置的入口。
- 找不到调试配置：确认打开的是 `mcp-local-demo` 文件夹。
- 云端格式错误：原样从控制台复制地址，删除误加的反斜杠；不要把地址贴进角色提示词。
- 401/403 或握手失败：检查有效凭据、网络和平台状态；不要在截图中暴露令牌。
- 断点没触发：先用离线模式检查；云端模式还需真正发生工具调用，连接本身不会执行工具函数。
- 本项目忽略 `.env`、虚拟环境和下载源码。忽略规则不等于加密，分享项目时仍需排除 `.env`。

## 手动运行（可选）

在本文件夹的 PowerShell 终端里，无需激活环境：

```powershell
.\.venv\Scripts\python.exe .\local_check.py
.\.venv\Scripts\python.exe .\run_cloud.py
```

如果将来重建环境：

```powershell
& 'C:\Users\华硕\AppData\Local\Programs\Python\Python313\python.exe' -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

如果缺少官方源码，在此目录运行：

```powershell
git clone --depth 1 https://github.com/78/mcp-calculator.git vendor/mcp-calculator
```

下一步由系统同学将测试工具替换为真实后端调用，并在服务端绑定游览记录；保持测试结果与真实业务结果的区分。

## 以后写 Python 的固定习惯

每个新项目各自创建 `.venv`，不要与其他项目共用。创建环境前进入对应项目目录：

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -c "import sys; print(sys.executable)"
python -m pip --version
```

选择这个项目的 `.venv` 作为 VS Code 解释器。安装依赖时始终使用 `python -m pip install ...`，确保给当前 Python 安装。环境激活后运行 `python your_script.py`；`py -3.13` 主要用于明确选择基础版本来创建环境，不要把它当作已激活项目解释器的替代。`.venv` 不提交到版本控制，由依赖文件在其他电脑上重建。

当前 MCP 项目验证命令（激活后）：

```powershell
python -c "import sys; print(sys.executable); print(sys.prefix != sys.base_prefix)"
python -m pip check
python local_check.py
```

预期分别为：项目 `.venv` 中的 Python 路径且显示 `True`、依赖无损坏、本机 MCP 测试通过。
