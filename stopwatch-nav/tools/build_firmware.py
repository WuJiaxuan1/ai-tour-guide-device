"""Portable source build. Run inside the ESP-IDF 5.5.2 Python environment. Never flashes."""
import argparse,os,re,subprocess,sys
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--build-dir',default='build')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'firmware'
idf=Path(os.environ.get('IDF_PATH',''))/'tools/idf.py'
if not os.environ.get('IDF_PATH') or not idf.is_file():parser.error('Activate ESP-IDF 5.5.2 first (IDF_PATH is required)')
lock=root/'dependencies.lock'
text=lock.read_text('utf-8')
component=(root/'components/78__esp-wifi-connect').as_posix().replace("'","''")
text=re.sub(r'(?m)^      path: .*78__esp-wifi-connect.*$',lambda _:"      path: '"+component+"'",text)
lock.write_text(text,encoding='utf-8')
command=[sys.executable,str(idf.resolve()),'-B',args.build_dir,'-DIDF_TARGET=esp32s3','-DSDKCONFIG_DEFAULTS=sdkconfig.defaults;sdkconfig.defaults.esp32s3;sdkconfig.stopwatch','-DBOARD_NAME=m5stack-stopwatch','build']
raise SystemExit(subprocess.call(command,cwd=root))
