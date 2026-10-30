"""Build production page helper against real desktop LVGL, no device access."""
from pathlib import Path
import os
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
tool = root.parent / "stopwatch-custom/.tools/espressif/tools"
compiler = Path("D:/Apps/mingw64/bin")
env = os.environ.copy()
env["PATH"] = str(compiler) + os.pathsep + env["PATH"]
cmake = tool / "cmake/3.30.2/bin/cmake.exe"
ninja = tool / "ninja/1.12.1/ninja.exe"
out = root / "tests/build/p5-lvgl"
log = root / "logs/P5-pages-build.log"
with log.open("wb") as stream:
    for args in [
        [cmake, "-S", root / "tests/p5host", "-B", out, "-G", "Ninja", f"-DCMAKE_MAKE_PROGRAM={ninja}",
         f"-DCMAKE_C_COMPILER={compiler / 'gcc.exe'}", f"-DCMAKE_CXX_COMPILER={compiler / 'g++.exe'}"],
        [cmake, "--build", out, "--target", "pages_test", "-j", "8"],
    ]:
        r = subprocess.run([str(x) for x in args], env=env, stdout=stream, stderr=subprocess.STDOUT)
        if r.returncode:
            print("FAIL: desktop LVGL build; see " + str(log))
            sys.exit(r.returncode)
subprocess.run([str(out / "pages_test.exe")], env=env, check=True)
