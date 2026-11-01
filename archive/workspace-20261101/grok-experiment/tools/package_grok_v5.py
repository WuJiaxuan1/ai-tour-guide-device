"""Package performance firmware. Offline only; reuses the validated v4 vector bank."""
import hashlib,json,shutil
from pathlib import Path
from package_grok_v4 import inspect_app
from build_static_assets import FIRMWARE,parse_assets
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'grok-v5'
sha=lambda b:hashlib.sha256(b).hexdigest()

def main():
    v4=json.loads((ROOT/'grok-v4/build-report.json').read_text('utf-8'))
    source=ROOT/'firmware-source'
    app=(source/'build/xiaozhi.bin').read_bytes()
    length,identity=inspect_app(app)
    if length!=len(app) or identity!={'version':'2.2.6-grok-v5','project':'xiaozhi','idf':'v5.5.2'}:
        raise ValueError('Unexpected app image')
    if len(app)>0x3f0000:raise ValueError('App partition overflow')
    firmware=FIRMWARE.read_bytes()
    table=(source/'build/partition_table/partition-table.bin').read_bytes()
    if table!=firmware[0x8000:0x8000+len(table)]:raise ValueError('Partition mismatch')
    assets=(ROOT/'grok-v4'/v4['assets']['filename']).read_bytes()
    if sha(assets)!=v4['assets']['sha256'] or len(assets)>0x800000:raise ValueError('Vector resource mismatch')
    current={n:b for n,b,w,h in parse_assets(assets)}
    original={n:b for n,b,w,h in parse_assets((ROOT/'output/original-v2.2.6-assets.bin').read_bytes())}
    for name in ['srmodels.bin','font_puhui_common_30_4.bin']:
        if current[name]!=original[name]:raise ValueError('Model/font modified')
    (OUT/'grok-v5-app.bin').write_bytes(app)
    (OUT/'grok-v5-vector-assets.bin').write_bytes(assets)
    shutil.copy2(ROOT/'grok-v4/original-v2.2.6-app.bin',OUT/'original-v2.2.6-app.bin')
    shutil.copy2(ROOT/'grok-v4/flash_grok_v4.py',OUT/'flash_grok_v5.py')
    report={**v4,'application':identity,'status':'compiled_host_validated_hardware_performance_pending',
      'app':{'filename':'grok-v5-app.bin','offset':'detected_active_ota_slot','bytes':len(app),'sha256':sha(app)},
      'assets':{'filename':'grok-v5-vector-assets.bin','bytes':len(assets),'sha256':sha(assets)},
      'firmware_build_log':str(ROOT/'.tools/firmware-v5-build.log'),
      'hardware_tested':False,
      'performance_changes':['Active-edge scanlines and integer coverage/blending; retains four AA subscans',
        'Only changed pixels written into the RGB565 frame buffer',
        '32px dirty tiles merged into at most 24 invalidation rectangles',
        'Single draw-and-refresh cadence; maximum target 1000/17 fps',
        'Wall-clock animation timing and actual submission-rate diagnostic log every 5s',
        '32-row DMA double buffers; renderer-specific O3 optimization',
        'CPU remains 240MHz, QSPI remains vendor 40MHz; audio tasks retain higher priority'],
      'desktop_results':{'tested_frames':1760,'dirty_region_percent':29.699,'changed_pixels_percent':1.93203,
        'mean_gray_difference_from_v4_out_of_255':0.00819659,'maximum_gray_difference_out_of_255':5,
        'timing_note':'Desktop render benchmark is not device performance. See renderer-test-results.txt.'},
      'limitations':['Actual device FPS and voice stability not yet measured.',
        '17ms interval is an upper scheduling target (~59fps), not a guarantee of 59fps.',
        'GrokPerf submissions is frame submission rate, not a physical screen scanout measurement.',
        'Animations and resource library retain all v4 scope limits (sampled vectors, no particle ribbons).']}
    report['source_files']={name:sha((source/name).read_bytes()) for name in v4['source_files']}
    report['checks']=[c for c in v4['checks'] if c!='custom version and ESP-IDF 5.5.2']+[
      'custom v5 image, ESP-IDF v5.5.2, ESP checksums and SHA256',
      'all 22 animation poses exactly match v4',
      'all changed pixels covered by <=24 dirty rectangles; identical frames have no invalidation',
      '1760-frame antialiasing regression, mean error <0.01/255',
      'original v4 rollback files preserved']
    (OUT/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
    for label in ['app','assets','restore_app']:
        spec=report[label];data=(OUT/spec['filename']).read_bytes()
        if len(data)!=spec['bytes'] or sha(data)!=spec['sha256']:raise ValueError('Output mismatch')
    print(json.dumps({k:report[k] for k in ['application','app','assets']},indent=2))
    print('PASS: v5 image, partition bounds/layout, matching vector resources, model/font, output hashes')

if __name__=='__main__':main()
