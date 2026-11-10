"""Production avatar renderer and page integration against desktop LVGL."""
from pathlib import Path
import os, subprocess, argparse

parser=argparse.ArgumentParser()
parser.add_argument('--stage',choices=['P8-avatar-test01','P8-avatar-test02'],default='P8-avatar-test02')
stage=parser.parse_args().stage

root=Path(__file__).resolve().parents[1]
tools=root.parent/'stopwatch-custom/.tools/espressif/tools'
compiler=Path('D:/Apps/mingw64/bin')
env=os.environ.copy();env['PATH']=str(compiler)+os.pathsep+env['PATH']
cmake=tools/'cmake/3.30.2/bin/cmake.exe'
ninja=tools/'ninja/1.12.1/ninja.exe'
out=root/'tests/build/p5-lvgl'
log=root/'logs'/f'{stage}-host-build.log'
with log.open('wb') as stream:
    for args in [
        [cmake,'-S',root/'tests/p5host','-B',out,'-G','Ninja',f'-DCMAKE_MAKE_PROGRAM={ninja}',
         f'-DCMAKE_C_COMPILER={compiler / "gcc.exe"}',f'-DCMAKE_CXX_COMPILER={compiler / "g++.exe"}'],
        [cmake,'--build',out,'--target','avatar_input_test','avatar_test','pages_test','-j','8']]:
        subprocess.run([str(x) for x in args],env=env,stdout=stream,stderr=subprocess.STDOUT,check=True)
for executable in ('avatar_input_test.exe','avatar_test.exe','pages_test.exe'):
    subprocess.run([str(out/executable)],cwd=out,env=env,check=True)
