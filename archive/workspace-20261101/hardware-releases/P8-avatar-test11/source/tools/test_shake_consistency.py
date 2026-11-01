"""Replay a deterministic gesture sweep against a selected production board header."""
from pathlib import Path
import argparse, os, subprocess
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--board',type=Path,default=root/'firmware/main/boards/m5stack-stopwatch')
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
out=root/'tests/build/shake-consistency'
out.mkdir(parents=True,exist_ok=True)
compiler=Path('D:/Apps/mingw64/bin')
env=os.environ.copy();env['PATH']=str(compiler)+os.pathsep+env['PATH']
subprocess.run([str(x) for x in (compiler/'g++.exe','-std=c++17','-Wall','-Wextra','-Werror',
    '-I',args.board,root/'tests/p5host/avatar_shake_consistency_test.cc','-o',out/'shake_consistency.exe')],env=env,check=True)
subprocess.run([str(out/'shake_consistency.exe')]+(['--check'] if args.check else []),env=env,check=True)
