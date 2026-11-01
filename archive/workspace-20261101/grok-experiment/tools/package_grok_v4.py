"""Verify compiled images, baseline/backup compatibility, and prepare manual-flash files."""
from pathlib import Path
import functools,hashlib,json,operator,struct,subprocess
from build_static_assets import FIRMWARE,parse_assets
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'grok-v4'
sha=lambda b:hashlib.sha256(b).hexdigest()

def inspect_app(data):
    if data[0]!=0xe9 or not 1<=data[1]<=16:raise ValueError('Invalid ESP image header')
    if struct.unpack_from('<H',data,12)[0]!=9:raise ValueError('Not ESP32-S3')
    cursor=24;checksum=0xef
    for _ in range(data[1]):
        address,length=struct.unpack_from('<II',data,cursor);cursor+=8
        end=cursor+length
        if end>len(data):raise ValueError('Truncated ESP segment')
        checksum=functools.reduce(operator.xor,data[cursor:end],checksum)
        cursor=end
    checksum_offset=(cursor//16+1)*16-1
    if data[checksum_offset]!=checksum:raise ValueError('ESP segment checksum mismatch')
    end=checksum_offset+1
    if data[23]:
        if data[end:end+32]!=hashlib.sha256(data[:end]).digest():raise ValueError('ESP appended digest mismatch')
        end+=32
    desc=data.find(struct.pack('<I',0xabcd5432),24,512)
    if desc<0:raise ValueError('No app descriptor')
    field=lambda off,n:data[desc+off:desc+off+n].split(b'\0')[0].decode('ascii')
    return end,{'version':field(16,32),'project':field(48,32),'idf':field(112,32)}

def main():
    baseline=FIRMWARE.read_bytes()
    backup=(ROOT/'stopwatch-device-backup.bin').read_bytes()
    if len(backup)!=0x1000000:raise ValueError('Backup size mismatch')
    table=(ROOT/'firmware-source/build/partition_table/partition-table.bin').read_bytes()
    if table!=baseline[0x8000:0x8000+len(table)] or backup[0x8000:0x9000]!=baseline[0x8000:0x9000]:
        raise ValueError('Compiled partition table differs from factory/device backup')
    seq=struct.unpack_from('<I',backup,0xd000)[0]
    state=struct.unpack_from('<I',backup,0xd000+24)[0]
    if seq!=1 or state!=2 or backup[0x410000]!=0xff:
        raise ValueError('Backup is not the expected valid OTA-0 factory installation')
    app=(ROOT/'firmware-source/build/xiaozhi.bin').read_bytes()
    size,info=inspect_app(app)
    if size!=len(app) or info!={'version':'2.2.6-grok-v4','project':'xiaozhi','idf':'v5.5.2'}:
        raise ValueError('Unexpected custom application identity')
    if len(app)>0x3f0000:raise ValueError('Application partition overflow')
    original_size,original_info=inspect_app(baseline[0x20000:0x410000])
    original=baseline[0x20000:0x20000+original_size]
    if backup[0x20000:0x20000+original_size]!=original:raise ValueError('Backup application mismatch')
    assets=(OUT/'grok-v4-vector-assets.bin').read_bytes()
    current={n:b for n,b,w,h in parse_assets(assets)}
    old_assets=(ROOT/'output/original-v2.2.6-assets.bin').read_bytes()
    old={n:b for n,b,w,h in parse_assets(old_assets)}
    if len(assets)>0x800000:raise ValueError('Resource partition overflow')
    for name in ['srmodels.bin','font_puhui_common_30_4.bin']:
        if current[name]!=old[name]:raise ValueError('Voice/font changed')
    if current['grok-vectors.bin']!=(OUT/'grok-vectors.bin').read_bytes():raise ValueError('Vector bank mismatch')
    files={'grok-v4-app.bin':app,'original-v2.2.6-app.bin':original}
    for name,data in files.items():
        (OUT/name).write_bytes(data)
        if (OUT/name).read_bytes()!=data:raise ValueError('Output readback mismatch')
    tracked=['CMakeLists.txt','main/assets.cc','main/display/display.h','main/display/lcd_display.cc',
             'main/boards/m5stack-stopwatch/m5stack_stopwatch.cc',
             'main/boards/m5stack-stopwatch/grok_motion.h','main/boards/m5stack-stopwatch/grok_display.h','sdkconfig.grok','dependencies.lock']
    report=json.loads((OUT/'build-report.json').read_text('utf-8'))
    report.update(status='compiled_host_validated_hardware_test_pending',application=info,
        partition_table_sector_sha256=sha(baseline[0x8000:0x9000]),
        app={'filename':'grok-v4-app.bin','offset':'0x20000','bytes':len(app),'sha256':sha(app)},
        restore_app={'filename':'original-v2.2.6-app.bin','offset':'0x20000','bytes':len(original),'sha256':sha(original),**original_info},
        restore_assets={'filename':'../output/original-v2.2.6-assets.bin','bytes':len(old_assets),'sha256':sha(old_assets)},
        source_files={name:sha((ROOT/'firmware-source'/name).read_bytes()) for name in tracked},
        checks=['ESP32-S3 image checksum and appended SHA256','custom version and ESP-IDF 5.5.2',
                'compiled partition table identical to factory and saved device backup',
                'saved device backup has valid OTA-0 sequence 1, OTA-1 empty',
                'application and assets fit existing partitions','original voice model/font unchanged',
                'desktop C++ animation tests and visual preview passed'],
        firmware_build_log=str(ROOT/'.tools/firmware-build.log'),
        preserve=['bootloader','partition table','NVS/Wi-Fi/binding','OTA selection','original wake model'],
        limitations=['Hardware rendering speed and voice/network stability untested.',
                     '25 fps is a target, not a device measurement.',
                     'Vector motion sampled from upstream, interpolated/morphed on device; not a complete JS-engine port.',
                     'Particle ribbons/confetti and pointer interaction omitted.'])
    (OUT/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
    print(json.dumps({k:report[k] for k in ['status','app','assets','restore_app']},indent=2))
    print('PASS: compiled app, ESP checksums, identical partition table, backup match, both partition bounds, voice model/font')

if __name__=='__main__':main()
