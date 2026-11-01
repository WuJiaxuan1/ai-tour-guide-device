"""离线验证真实 MCP 握手、工具发现和调用；不读取令牌、不联网。"""

import asyncio
import json
import os
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

ROOT = Path(__file__).resolve().parent


async def main() -> None:
    child_env = dict(os.environ)
    child_env.pop("MCP_ENDPOINT", None)
    child_env["PYTHONIOENCODING"] = "utf-8"
    # This protocol test deliberately uses an unavailable local API, not the live demo.
    child_env['QIXIA_DEMO_API'] = 'http://127.0.0.1:1/api/demo-trip/current'
    child_env['QIXIA_DEMO_READ_TOKEN'] = 'offline-test-credential-not-valid-' * 2
    server = StdioServerParameters(
        command=sys.executable,
        args=[str(ROOT / "qixia_tools.py")],
        env=child_env,
    )
    async with stdio_client(server) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            tools = await session.list_tools()
            print("MCP 工具列表：", ", ".join(tool.name for tool in tools.tools))
            names = {tool.name for tool in tools.tools}
            expected_tools = {"get_demo_status", "list_qixia_attractions",
                              "get_attraction_guide", "get_current_qixia_demo_trip"}
            if not expected_tools.issubset(names):
                raise RuntimeError("没有发现预期的 MCP 工具")
            response = await session.call_tool(
                "get_demo_status", {"remaining_minutes": 40}
            )
            if response.isError:
                raise RuntimeError("MCP 工具调用失败")
            payload = response.structuredContent
            if payload is None:
                payload = json.loads(response.content[0].text)
            if payload.get("mode") != "connection_test" or payload.get("remaining_minutes") != 40:
                raise RuntimeError("工具返回了非预期数据")
            print(json.dumps(payload, ensure_ascii=False, indent=2))
            for tool_name, arguments, expected in [
                ("get_current_qixia_demo_trip", {}, lambda p: p["status"] == "demo_backend_unavailable"),
                ("list_qixia_attractions", {}, lambda p: p["count"] == 12),
                ("get_attraction_guide", {"place_name": "彩虹明镜"},
                 lambda p: p["success"] and p["place"]["id"] == "mirror-lake"),
                ("get_attraction_guide", {"place_name": "千佛崖"},
                 lambda p: p["success"] and p["place"]["id"] == "buddha"),
                ("get_attraction_guide", {"place_name": "不存在的景点"},
                 lambda p: not p["success"] and p["status"] == "not_found"),
            ]:
                response = await session.call_tool(tool_name, arguments)
                data = response.structuredContent
                if data is None:
                    data = json.loads(response.content[0].text)
                if response.isError or not expected(data):
                    raise RuntimeError(f"知识库MCP调用未通过：{tool_name} {arguments}")
                print(f"通过：{tool_name} {arguments}")
            print("通过：本机 MCP 握手、工具发现和调用成功。尚未连接小智云端。")


if __name__ == "__main__":
    asyncio.run(main())
