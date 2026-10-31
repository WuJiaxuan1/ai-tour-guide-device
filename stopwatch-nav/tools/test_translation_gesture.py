"""Exercise production translation classification with simulated physical motion."""
from pathlib import Path
import argparse, os, subprocess
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--board',type=Path,default=root/'firmware/main/boards/m5stack-stopwatch')
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
out=root/'tests/build/translation-gesture'
out.mkdir(parents=True,exist_ok=True)
compiler=Path('D:/Apps/mingw64/bin')
env=os.environ.copy();env['PATH']=str(compiler)+os.pathsep+env['PATH']
flags=['-DAVATAR_TRANSLATION_DIAGNOSTICS=1'] if 'rotation_rejects' in (args.board/'avatar_shake.h').read_text('utf-8') else []
subprocess.run([str(x) for x in (compiler/'g++.exe','-std=c++17','-Wall','-Wextra','-Werror',
    '-I',args.board,root/'tests/p5host/avatar_translation_test.cc','-o',out/'translation_gesture.exe')]+flags,env=env,check=True)
subprocess.run([str(out/'translation_gesture.exe')]+(['--check'] if args.check else []),env=env,check=True)
