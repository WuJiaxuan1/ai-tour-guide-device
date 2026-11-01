"""User-run flashing helper: verify files, read current partitions/OTA, write active app + assets.

No device access unless --flash or --restore is explicitly supplied.
Never writes the bootloader, partition table, OTA data or NVS.
"""
import argparse,binascii,hashlib,json,struct,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()

def select_app_slot(ota):
    if len(ota)!=0x2000:raise ValueError('OTA readback must be exactly 8192 bytes')
    entries=[]
    for offset in [0,0x1000]:
        seq=struct.unpack_from('<I',ota,offset)[0]
        state,crc=struct.unpack_from('<II',ota,offset+24)
        if seq==0xffffffff:continue
        if binascii.crc32(ota[offset:offset+4],0xffffffff)&0xffffffff!=crc:continue
        if state in [3,4]:continue # Invalid/aborted slots are not boot candidates.
        entries.append((seq,state))
    if not entries:raise ValueError('No valid OTA selection; stop and inspect the device')
    seq,state=max(entries)
    if not 0<seq<0x7ffffff0 or state!=2:
        raise ValueError('OTA is pending, undefined or unexpected; boot the device normally before proceeding')
    return [0x20000,0x410000][(seq-1)%2],seq

def check_files(report,restore=False):
    specifications=[report['restore_app'],report['restore_assets']] if restore else [report['app'],report['assets']]
    paths=[]
    for spec in specifications:
        path=(ROOT/spec['filename']).resolve()
        data=path.read_bytes()
        if len(data)!=spec['bytes'] or sha(data)!=spec['sha256']:
            raise ValueError('File size/SHA256 mismatch: '+path.name)
        paths.append(path)
    if specifications[0]['bytes']>0x3f0000 or specifications[1]['bytes']>0x800000:
        raise ValueError('Image exceeds its partition')
    return paths

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group()
    group.add_argument('--flash',action='store_true',help='Write the P8-overview01 program AND matching assets')
    group.add_argument('--restore',action='store_true',help='Restore the P8-avatar-test11 program AND its assets')
    group.add_argument('--check-files',action='store_true',help='Offline validation only (default)')
    parser.add_argument('--port')
    args=parser.parse_args()
    if (args.flash or args.restore) and not args.port:
        parser.error('--port is required for device operations')
    report=json.loads((ROOT/'build-report.json').read_text('utf-8'))
    app,assets=check_files(report,args.restore)
    print('PASS: image sizes, SHA256 and partition bounds',flush=True)
    if not (args.flash or args.restore):
        check_files(report,True)
        print('PASS: rollback images also verified. Offline check only; no device access.',flush=True)
        return
    base=[sys.executable,'-m','esptool','--chip','esp32s3','--port',args.port,'--baud','460800']
    preflight=ROOT/'device-preflight';preflight.mkdir(exist_ok=True)
    table=preflight/'partition-table.bin';ota=preflight/'ota-data.bin'
    def run(arguments):subprocess.run(base+arguments,check=True)
    print('Step 1: read current partition table and OTA selection (no NVS read).',flush=True)
    run(['--after','no_reset','read_flash','0x8000','0x1000',str(table)])
    run(['--after','no_reset','read_flash','0xd000','0x2000',str(ota)])
    if sha(table.read_bytes())!=report['partition_table_sector_sha256']:
        raise ValueError('Current partition table differs from the verified baseline. Nothing written.')
    offset,seq=select_app_slot(ota.read_bytes())
    print(f'PASS: current partition table, validated OTA sequence {seq}; active application at {offset:#x}.',flush=True)
    print('Step 2: write application and matching resources. Keep USB connected.',flush=True)
    run(['--after','no_reset','write_flash',hex(offset),str(app),'0x800000',str(assets)])
    print('Step 3: verify BOTH regions, then restart the device.',flush=True)
    run(['--after','hard_reset','verify_flash',hex(offset),str(app),'0x800000',str(assets)])
    result={'mode':'restore' if args.restore else 'flash','port':args.port,'app_offset':hex(offset),
            'app':app.name,'assets':assets.name,'verification':'esptool verify_flash passed',
            'hardware_function_test':'pending'}
    (preflight/'last-result.json').write_text(json.dumps(result,indent=2)+'\n','utf-8')
    print('PASS: flash and device verification complete. Now check animation, wake word, network and voice.',flush=True)

if __name__=='__main__':
    try:main()
    except (ValueError,OSError,subprocess.CalledProcessError) as error:
        print('STOP: '+str(error),file=sys.stderr)
        print('Keep the full output for diagnosis. Do not erase flash or use --force.',file=sys.stderr)
        sys.exit(1)
