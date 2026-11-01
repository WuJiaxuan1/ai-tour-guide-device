"""Compile production handlers against desktop IDF transport shims; no device IO."""
from pathlib import Path
import os
import subprocess

root = Path(__file__).resolve().parents[1]
out = root / "tests/build"
out.mkdir(parents=True, exist_ok=True)
compiler = Path(r"D:\Apps\mingw64\bin")
json_src = root.parent / "stopwatch-custom/esp-idf-v5.5.2/components/json/cJSON"
board = root / "firmware/main/boards/m5stack-stopwatch"
env = os.environ.copy()
env["PATH"] = str(compiler) + os.pathsep + env["PATH"]
def run(args):
    subprocess.run([str(x) for x in args], check=True, env=env)
run([compiler / "gcc.exe", "-c", json_src / "cJSON.c", "-o", out / "cJSON.o"])
run([compiler / "g++.exe", "-std=c++17", "-Wall", "-Wextra", "-Werror", "-Wno-unused-variable",
     "-I", root / "tests/host", "-I", json_src, "-I", board,
     board / "local_link_server.cc", root / "tests/host/local_link_server_test.cc", out / "cJSON.o",
     "-o", out / "local_link_server_test.exe"])
fixture = out / "p6/phone-frame.bin"
geo_fixture = out / "p6/phone-geo-frame.bin"
chunk_fixture=out / "p6/phone-chunk-frame.bin"
route_fixture=out / "p6/phone-route-frame.bin"
clear_fixture=out / "p6/phone-route-clear.bin"
fixtures=[fixture,geo_fixture,chunk_fixture,route_fixture,clear_fixture]
assert all(p.exists() for p in fixtures), "Run Android JVM tests first to generate all wire fixtures"
run([out / "local_link_server_test.exe"] + fixtures)
