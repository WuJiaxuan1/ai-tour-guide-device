"""Run actual cloud-navigation C++ against scripted HTTP/NVS/RTOS adapters."""
from pathlib import Path
import os,subprocess
r=Path(__file__).resolve().parents[1];out=r/'tests/build';out.mkdir(exist_ok=True)
cc=Path('D:/Apps/mingw64/bin');env=os.environ.copy();env['PATH']=str(cc)+os.pathsep+env['PATH']
json=r.parent/'stopwatch-custom/esp-idf-v5.5.2/components/json/cJSON';board=r/'firmware/main/boards/m5stack-stopwatch'
subprocess.run([str(cc/'gcc.exe'),'-c',str(json/'cJSON.c'),'-o',str(out/'cloud-cJSON.o')],env=env,check=True)
args=[cc/'g++.exe','-std=c++17','-Wall','-Wextra','-Werror','-DESP_PLATFORM','-I',r/'tests/cloudhost','-I',json,'-I',board,board/'cloud_navigation.cc',r/'tests/cloudhost/pairing_test.cc',out/'cloud-cJSON.o','-o',out/'cloud-pairing.exe']
subprocess.run(list(map(str,args)),env=env,check=True);subprocess.run([str(out/'cloud-pairing.exe')],env=env,check=True)
