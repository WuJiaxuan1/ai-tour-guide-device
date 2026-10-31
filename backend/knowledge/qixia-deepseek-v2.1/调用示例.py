"""Assemble a DeepSeek message request; network transmission is opt-in."""
from pathlib import Path
import argparse, json, os, sys, urllib.request, urllib.error

def build_request(question, model="deepseek-flash"):
    root = Path(__file__).resolve().parent
    system = (root / "03_单文件系统消息.txt").read_text(encoding="utf-8")
    return {"model": model, "messages": [{"role": "system", "content": system}, {"role": "user", "content": question}], "thinking": {"type": "disabled"}, "max_tokens": 2048, "stream": False}

def main():
    parser = argparse.ArgumentParser(description="生成DeepSeek知识库请求；加--send才发送。")
    parser.add_argument("question", nargs="?", default="请介绍一下栖霞山的文化看点。")
    parser.add_argument("--model", default=os.environ.get("DEEPSEEK_MODEL", "deepseek-flash"))
    parser.add_argument("--output", default="request.json")
    parser.add_argument("--send", action="store_true")
    args = parser.parse_args()
    payload = build_request(args.question, args.model)
    if not args.send:
        output = Path(args.output)
        output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("已生成请求：" + str(output.resolve()))
        return
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        parser.error("发送前请设置DEEPSEEK_API_KEY；密钥不会写入请求文件。")
    request = urllib.request.Request("https://api.deepseek.com/chat/completions", data=json.dumps(payload, ensure_ascii=False).encode("utf-8"), headers={"Content-Type": "application/json", "Authorization": "Bearer " + key}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            data = json.load(response)
        message = data["choices"][0]["message"].get("content")
        if not message:
            raise ValueError("API没有返回可显示正文，请检查返回格式或重试。")
        print(message)
        if data["choices"][0].get("finish_reason") == "length":
            print("提示：回答达到输出长度限制。", file=sys.stderr)
    except urllib.error.HTTPError as error:
        print("API请求失败，HTTP状态：" + str(error.code) + "；请检查模型权限、额度和参数。", file=sys.stderr)
        raise SystemExit(1)
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as error:
        print("调用未完成：" + type(error).__name__, file=sys.stderr)
        raise SystemExit(1)

if __name__ == "__main__":
    main()
