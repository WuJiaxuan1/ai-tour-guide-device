"""Exercise real provisioning logic using desktop HTTP/NVS shims, no hardware."""
from pathlib import Path
import os
import subprocess

root = Path(__file__).resolve().parents[1]
out = root / "tests/build/p3"
out.mkdir(parents=True, exist_ok=True)
component = root / "firmware/components/78__esp-wifi-connect"
board = root / "firmware/main/boards/m5stack-stopwatch/m5stack_stopwatch.cc"

def braces(text, start):
    opening = text.index("{", start)
    depth = 0
    for i in range(opening, len(text)):
        if text[i] == "{": depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0: return i + 1
    raise ValueError("Unbalanced source block")

text = board.read_text("utf-8")
start = text.index("void StartNetwork() override {")
(out / "boot_network.inc").write_text(text[start:braces(text, start)], encoding="utf-8")
text = (component / "wifi_configuration_ap.cc").read_text("utf-8")
start = text.index(".handler =", text.index("httpd_uri_t form_submit")) + len(".handler =")
(out / "submit_handler.inc").write_text("static auto SubmitHandler = " + text[start:braces(text,start)] + ";\n", encoding="utf-8")
compiler = Path(r"D:\Apps\mingw64\bin")
json_src = root.parent / "stopwatch-custom/esp-idf-v5.5.2/components/json/cJSON"
env = os.environ.copy()
env["PATH"] = str(compiler) + os.pathsep + env["PATH"]
def run(args): subprocess.run([str(x) for x in args], check=True, env=env)
run([compiler / "gcc.exe", "-c", json_src / "cJSON.c", "-o", out / "cJSON.o"])
run([compiler / "g++.exe", "-std=c++17", "-Wall", "-Wextra", "-Werror", "-Wno-sign-compare", "-finput-charset=UTF-8",
     "-I", root / "tests/p3host", "-I", root / "tests/host", "-I", component / "include", "-I", json_src, "-I", out,
     component / "ssid_manager.cc", root / "tests/p3host/provisioning_test.cc", out / "cJSON.o", "-o", out / "provisioning_test.exe"])
run([out / "provisioning_test.exe"])
