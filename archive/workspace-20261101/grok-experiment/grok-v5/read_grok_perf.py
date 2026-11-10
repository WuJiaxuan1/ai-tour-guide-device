"""User-run, read-only serial log capture. Never sends device commands."""
import argparse,time
from pathlib import Path
import serial

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',default='COM3')
    parser.add_argument('--seconds',type=int,default=18)
    args=parser.parse_args()
    log=Path(__file__).resolve().parent/'device-performance.log'
    port=serial.Serial(port=None,baudrate=115200,timeout=0.25)
    port.dtr=False;port.rts=False;port.port=args.port
    found=0
    print('Read-only log capture; keep other serial programs closed. No commands are sent.',flush=True)
    with port,log.open('w',encoding='utf-8') as output:
        end=time.monotonic()+max(6,min(60,args.seconds))
        while time.monotonic()<end:
            line=port.readline().decode('utf-8',errors='replace').rstrip()
            if not line:continue
            output.write(line+'\n')
            if 'GrokPerf' in line or 'ERROR' in line or 'Guru Meditation' in line:
                print(line,flush=True)
                found+=int('GrokPerf' in line)
    print('Saved:',log)
    if not found:print('No GrokPerf line captured. Check the port and that v5 is running.')

if __name__=='__main__':main()
