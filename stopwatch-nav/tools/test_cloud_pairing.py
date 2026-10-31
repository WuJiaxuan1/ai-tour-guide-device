"""Run actual cloud-navigation C++ against scripted HTTP/NVS/RTOS adapters."""
from pathlib import Path
import os,subprocess,shutil
r=Path(__file__).resolve().parents[1];out=r/'tests/build';out.mkdir(exist_ok=True)
env=os.environ.copy();cxx=shutil.which(os.environ.get('CXX','g++'));cc=shutil.which(os.environ.get('CC','gcc'))
if not cxx or not cc:raise SystemExit('Put GCC/G++ on PATH, or set CC and CXX')
idf=os.environ.get('IDF_PATH')
if not idf:raise SystemExit('Set IDF_PATH to ESP-IDF 5.5.2')
json=Path(idf)/'components/json/cJSON';board=r/'firmware/main/boards/m5stack-stopwatch'
subprocess.run([cc,'-c',str(json/'cJSON.c'),'-o',str(out/'cloud-cJSON.o')],env=env,check=True)
args=[cxx,'-std=c++17','-Wall','-Wextra','-Werror','-DESP_PLATFORM','-I',r/'tests/cloudhost','-I',json,'-I',board,board/'cloud_navigation.cc',r/'tests/cloudhost/pairing_test.cc',out/'cloud-cJSON.o','-o',out/'cloud-pairing.exe']
subprocess.run(list(map(str,args)),env=env,check=True);subprocess.run([str(out/'cloud-pairing.exe')],env=env,check=True)
