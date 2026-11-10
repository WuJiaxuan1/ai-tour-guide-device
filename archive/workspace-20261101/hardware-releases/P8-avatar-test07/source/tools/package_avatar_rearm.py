"""Package the verified avatar app with accepted avatar04 rollback; no device IO."""
import json, shutil, sys
from pathlib import Path
from package_p1 import ROOT, BUILD, digest, run, validate_assets
from test_wake_assets import verify_build

def main():
    stage='P8-avatar-test07'
    out=ROOT/'releases'/stage
    previous=ROOT/'releases/P8-avatar-test04'
    old=json.loads((previous/'build-report.json').read_text('utf-8'))
    table=(BUILD/'partition_table/partition-table.bin').read_bytes()
    assert len(table)<=0x1000
    sector=digest(table.ljust(0x1000,b'\xff'))
    assert sector==old['partition_table_sector_sha256']
    app=(BUILD/'xiaozhi.bin').read_bytes()
    descriptor=app.find(bytes.fromhex('3254cdab'),0,4096)
    version='2.2.6-p8-avatar07'
    assert descriptor>=0 and app[descriptor+16:descriptor+48].split(b'\0')[0]==version.encode()
    assets=(BUILD/'generated_assets.bin').read_bytes()
    assert digest(assets)==old['assets']['sha256']
    acceptance_path=out/'acceptance.json'
    acceptance=json.loads(acceptance_path.read_text('utf-8')) if acceptance_path.exists() else None
    if acceptance:
        # An accepted release is immutable. New firmware needs a new stage.
        assert acceptance['app_sha256']==digest(app), 'Accepted app differs; create a new release stage'
        assert acceptance['assets_sha256']==digest(assets), 'Accepted assets differ; create a new release stage'
    board=ROOT/'firmware/main/boards/m5stack-stopwatch'
    for name in ('local_link_server.cc','local_link_server.h','map_frame.h','route_frame.h','swipe_tracker.h','config.h','config.json'):
        assert (board/name).read_bytes()==(previous/'source/firmware/main/boards/m5stack-stopwatch'/name).read_bytes(), name
    recent=previous/'source/firmware/main/boards/m5stack-stopwatch'
    for name in ('avatar_engine.cc','avatar_engine.h','avatar_surface.h','stopwatch_pages.h','m5stack_stopwatch.cc','avatar_input.h','stopwatch_imu.cc','stopwatch_imu.h'):
        assert (board/name).read_bytes()==(recent/name).read_bytes(), name
    for relative,expected in old['source_files_sha256'].items():
        if relative.startswith('firmware/components/'):
            assert digest((ROOT/relative).read_bytes())==expected,relative
    assert 'codec->SetOutputVolume(85);' in (ROOT/'firmware/main/application.cc').read_text('utf-8')
    logs={f'{stage}-firmware-build.log':'Project build complete',
          f'{stage}-host-tests.log':'PASS: avatar clipping',
          f'{stage}-wake-tests.log':'PASS: built config',
          f'{stage}-protocol-tests.log':'PASS: P8-test02',
          f'{stage}-before-rearm.log':'after second shake without page switch or quiet hold: events=1',
          f'{stage}-after-rearm.log':'after second shake without page switch or quiet hold: events=2'}
    for name,marker in logs.items():
        assert marker in (ROOT/'logs'/name).read_text('utf-8'),name
    assert 'PASS: avatar04 single/double' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar02 actual LVGL' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar04 fixed vertical reference' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar05 repeated horizontal shake' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar05 actual LVGL' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert json.loads((previous/'acceptance.json').read_text('utf-8'))['app_sha256']==old['app']['sha256']
    assert 'PASS: avatar06 intermittent not-ready tolerance' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar06 actual LVGL' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar07 bounded rearm' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    assert 'PASS: avatar07 actual LVGL five rearm rounds' in (ROOT/'logs'/f'{stage}-host-tests.log').read_text('utf-8')
    out.mkdir(parents=True,exist_ok=True)
    shutil.copy2(ROOT/'tools/capture_avatar_shake.py',out/'capture_avatar_shake.py')
    report={'stage':stage,'firmware_version':version,'hardware_function_test':'pending',
        'partition_table_sector_sha256':sector,'wake_validation':verify_build(),
        'assets_validation':validate_assets(assets),'boot_volume':85,
        'baseline':'P8-avatar-test04 (user accepted)','android':'unchanged; use installed P8-test02 APK',
        'avatar':{'schedule_ms':40,'imu_sample_target_ms':20,'short_stall_neutral_ms':500,'smoothing_reset_ms':2000,'reference':'fixed vertical; no calibration','dead_zone_degrees':1.5,'full_travel_degrees':25,'smoothing_tau_ms':80,'gyro_lead':False,'shake_threshold_g':.32,'shake_axis_ratio':1.15,'shake_gap_tolerance_ms':250,'diagnostic_interval_ms':2000,'shake_rearm':'fresh gesture after animation completes; no quiet hold','single_tap':'surprised','double_tap':'happy','measured_device_fps':None,'psram_canvas_bytes':466*466*2,
                  'renderer':'procedural RGB565 in LVGL, paused on map page',
                  'interaction':'fixed vertical gravity inclination, no learned neutral or gyro lead; idle single surprised / double happy; idle repeated horizontal shake -> one-shot dizzy; no haptics',
                  'source':'https://github.com/Trentct/m5stack-stopwatch-avatar','license':'AGPL-3.0-or-later'},
        'source_files_sha256':{}}
    for key,source,name in [
        ('app',BUILD/'xiaozhi.bin','p8-avatar-xiaozhi-app.bin'),
        ('assets',BUILD/'generated_assets.bin','p8-avatar-xiaozhi-assets.bin'),
        ('restore_app',previous/old['app']['filename'],'restore-P8-avatar-test04-app.bin'),
        ('restore_assets',previous/old['assets']['filename'],'restore-P8-avatar-test04-assets.bin')]:
        data=source.read_bytes()
        assert 0<len(data)<(0x800000 if 'assets' in key else 0x3f0000)
        if key.startswith('restore_'): assert digest(data)==old[key.removeprefix('restore_')]['sha256']
        shutil.copy2(source,out/name)
        report[key]={'filename':name,'bytes':len(data),'sha256':digest(data)}
    helper=(previous/'flash_p8.py').read_text('utf-8').replace('P8-avatar04 program','P8-avatar07 program').replace('P8-avatar-test01','P8-avatar-test04')
    # This workstation's verified ESP-IDF environment supplies esptool 4.12.
    for token in ('read-flash','write-flash','verify-flash','no-reset','hard-reset'):
        helper=helper.replace(token,token.replace('-','_'))
    (out/'flash_p8.py').write_text(helper,encoding='utf-8')
    sources=list(board.glob('*'))
    sources += [ROOT/p for p in ('firmware/CMakeLists.txt','firmware/main/CMakeLists.txt',
        'firmware/main/application.cc','firmware/sdkconfig.stopwatch','tools/package_avatar_rearm.py',
        'tools/test_avatar.py','tools/capture_avatar_shake.py','tools/test_release_guards.py','tests/p5host/avatar_test.cc','tests/p5host/avatar_input_test.cc','tests/p5host/avatar_shake_test.cc','tests/p5host/avatar_shake_probe.cc','tests/p5host/avatar_rearm_probe.cc',
        'firmware/dependencies.lock','firmware/main/idf_component.yml',
        'tests/p5host/CMakeLists.txt','tests/p5host/lv_conf.h','docs/P8-avatar-test07-验收.md')]
    for source in sources:
        if not source.is_file(): continue
        relative=source.relative_to(ROOT);target=out/'source'/relative
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        report['source_files_sha256'][relative.as_posix()]=digest(source.read_bytes())
    third_party=out/'third-party/bmi270_sensor'
    third_party.mkdir(parents=True,exist_ok=True)
    component=ROOT/'firmware/managed_components/espressif__bmi270_sensor'
    for name in ('license.txt','BSD_LICENSE','idf_component.yml','README.md'):
        if (component/name).exists(): shutil.copy2(component/name,third_party/name)
    # Bosch's embedded sensor configuration carries its own BSD-3-Clause notice.
    header=(component/'firmware/bmi270_image.h').read_text('utf-8')
    (third_party/'Bosch-BSD-3-Clause.txt').write_text(header[:header.index('const uint8_t')],encoding='utf-8')
    for name in logs: shutil.copy2(ROOT/'logs'/name,out/name)
    shutil.copy2(ROOT/'docs/P8-avatar-test07-验收.md',out/'README-验收.md')
    if acceptance:
        old_report=json.loads((out/'build-report.json').read_text('utf-8'))
        report['hardware_function_test']='passed: user confirmed all listed acceptance items on '+acceptance['date']
        report['acceptance']=acceptance
        report['validation']=old_report.get('validation',{})
        report['validation']['device_flash']='user-installed; no new agent flash performed'
        report['validation']['device_acceptance']='passed: user-reported, not independently measured by agent'
    report['package_support_sha256']={p.name:digest(p.read_bytes()) for p in out.iterdir()
        if p.is_file() and (p.suffix in ('.png','.log','.py','.md') or p.name=='acceptance.json')}
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(run([sys.executable,out/'flash_p8.py','--check-files']))
    print(json.dumps({k:report[k] for k in ('stage','firmware_version','app','hardware_function_test')},indent=2))

if __name__=='__main__': main()
