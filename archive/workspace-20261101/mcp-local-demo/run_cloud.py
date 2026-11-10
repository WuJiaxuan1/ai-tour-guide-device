"""从本机 .env 读取接入点，启动官方桥接程序；日志隐藏令牌。"""

import logging
import os
from pathlib import Path
import re
import runpy
import sys
from urllib.parse import parse_qs, urlsplit

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        rendered = super().format(record)
        return re.sub(r"(?i)(token=)[^\s\"'<>]+", r"\1[REDACTED]", rendered)


def main() -> None:
    # 以本项目 .env 为准，避免误用其他终端遗留的接入点。
    load_dotenv(ROOT / ".env", override=True)
    endpoint = os.environ.get("MCP_ENDPOINT", "").strip()
    if not endpoint:
        raise SystemExit("请先在本机 .env 的 MCP_ENDPOINT= 后填写新的完整接入点地址。")
    parts = urlsplit(endpoint)
    if parts.scheme != "wss" or parts.hostname != "api.xiaozhi.me" or parts.path != "/mcp/":
        raise SystemExit("接入点格式不正确；请从小智控制台复制完整的 wss:// 地址，不要包含反斜杠。")
    if not parse_qs(parts.query).get("token"):
        raise SystemExit("接入点缺少 token，请在本机重新复制完整地址。")
    os.environ["MCP_ENDPOINT"] = endpoint
    os.environ["PYTHONIOENCODING"] = "utf-8"
    bridge = ROOT / "vendor" / "mcp-calculator" / "mcp_pipe.py"
    if not bridge.is_file():
        raise SystemExit("缺少官方桥接程序，请先按 README 下载官方示例。")
    handler = logging.StreamHandler()
    handler.setFormatter(RedactingFormatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
    logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
    os.chdir(ROOT)
    sys.argv = [str(bridge), str(ROOT / "qixia_tools.py")]
    print("启动小智云端连接。接入地址不显示；停止运行请用停止按钮或 Ctrl+C。", flush=True)
    runpy.run_path(str(bridge), run_name="__main__")


if __name__ == "__main__":
    main()
