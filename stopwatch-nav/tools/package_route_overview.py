"""Offline overview APK + firmware package, pinned to user-selected avatar11."""
import json, re, shutil, sys
import xml.etree.ElementTree as ET
from pathlib import Path
from package_p1 import ROOT, BUILD, digest, run, validate_assets
from test_wake_assets import verify_build

STAGE='P8-overview-test01'
VERSION='2.2.6-p8-overview01'

def main():
    out=ROOT/'releases'/STAGE
    previous=ROOT/'releases/P8-avatar-test11'
    phone_previous=ROOT/'releases/P8-test02'
    old=json.loads((previous/'build-report.json').read_text('utf-8'))
    assert not (out/'acceptance.json').exists(), 'Accepted release is immutable'
    # Verify frozen baselines before reading their rollback artifacts.
    for release in (previous,phone_previous):
        baseline=json.loads((release/'build-report.json').read_text('utf-8'))
        for key in ('app','assets')+ (('apk',) if release==phone_previous else ()):
            assert digest((release/baseline[key]['filename']).read_bytes())==baseline[key]['sha256']
        for relative,expected in baseline['source_files_sha256'].items():
            assert digest((release/'source'/relative).read_bytes())==expected,relative
    table=(BUILD/'partition_table/partition-table.bin').read_bytes()
    sector=digest(table.ljust(0x1000,b'\xff'))
    assert len(table)<=0x1000 and sector==old['partition_table_sector_sha256']
    app=(BUILD/'xiaozhi.bin').read_bytes()
    descriptor=app.find(bytes.fromhex('3254cdab'),0,4096)
    assert descriptor>=0 and app[descriptor+16:descriptor+48].split(b'\0')[0]==VERSION.encode()
    assets=(BUILD/'generated_assets.bin').read_bytes()
    assert digest(assets)==old['assets']['sha256']
    board=ROOT/'firmware/main/boards/m5stack-stopwatch'
    fixed=('avatar_engine.cc','avatar_engine.h','avatar_display.cc','avatar_display.h','avatar_surface.h',
           'avatar_shake.h','avatar_input.h','avatar_haptic.h','stopwatch_imu.cc','stopwatch_imu.h',
           'stopwatch_haptics.cc','stopwatch_haptics.h','m5stack_stopwatch.cc','swipe_tracker.h','config.h','config.json')
    for name in fixed:
        assert (board/name).read_bytes()==(previous/'source/firmware/main/boards/m5stack-stopwatch'/name).read_bytes(),name
    for relative,expected in old['source_files_sha256'].items():
        if relative.startswith('firmware/main/audio/') or relative in ('firmware/main/application.cc','firmware/main/application.h','firmware/sdkconfig.stopwatch'):
            assert digest((ROOT/relative).read_bytes())==expected,relative
    accepted=json.loads((ROOT/'releases/P6-test01/build-report.json').read_text('utf-8'))
    for relative,expected in accepted['source_files_sha256'].items():
        if relative.startswith('components/'):
            assert digest((ROOT/'firmware'/relative).read_bytes())==expected,relative
    assert 'codec->SetOutputVolume(85);' in (ROOT/'firmware/main/application.cc').read_text('utf-8')
    logs={f'{STAGE}-firmware-build.log':'Project build complete',
          f'{STAGE}-android-build.log':'BUILD SUCCESSFUL',
          f'{STAGE}-host-tests.log':'PASS: overview actual LVGL',
          f'{STAGE}-protocol-tests.log':'PASS: overview Kotlin/firmware',
          f'{STAGE}-wake-tests.log':'PASS: built config',
          f'{STAGE}-wake-recovery-tests.log':'PASS: avatar10 production wake recovery',
          f'{STAGE}-voice-tests.log':'PASS: production application pause/resume'}
    guard_log=ROOT/'logs'/f'{STAGE}-release-guards.log'
    if guard_log.exists():logs[guard_log.name]='Ran 7 tests'
    for name,marker in logs.items():
        assert marker in (ROOT/'logs'/name).read_text('utf-8'),name
    host=(ROOT/'logs'/f'{STAGE}-host-tests.log').read_text('utf-8')
    for marker in ('PASS: avatar clipping','PASS: avatar11 shake feedback','PASS: avatar11 actual LVGL five diagonal','PASS: avatar04 fixed vertical reference'):
        assert marker in host,marker
    tests=list((ROOT/'android/app/build/test-results/testDebugUnitTest').glob('TEST-*.xml'))
    count=0
    assert any('RouteOverviewTest' in p.name for p in tests)
    for path in tests:
        result=ET.parse(path).getroot().attrib
        assert all(int(result[k])==0 for k in ('failures','errors','skipped')),path
        count+=int(result['tests'])
    assert count>=56,count
    apk=ROOT/'android/app/build/outputs/apk/debug/app-debug.apk'
    tool=ROOT.parent/'MotoNav-main/.tools'
    cert=run([tool/'jdk/jdk-21.0.12.1+1/bin/java.exe','-jar',tool/'android-sdk/build-tools/35.0.0/lib/apksigner.jar','verify','--verbose','--print-certs',apk])
    pattern=r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)'
    assert re.search(pattern,cert).group(1)==re.search(pattern,(phone_previous/'apk-signature.txt').read_text('utf-8')).group(1)
    badging=run([tool/'android-sdk/build-tools/35.0.0/aapt2.exe','dump','badging',apk])
    for expected in ("name='com.qixia.stopwatchnav'","versionCode='143'","versionName='8.3.26-p8-overview01'",'com.example.motonav.SurroundingMapActivity'):
        assert expected in badging,expected
    out.mkdir(parents=True,exist_ok=True)
    report={'stage':STAGE,'firmware_version':VERSION,'hardware_function_test':'pending',
        'baseline':'user-selected 2.2.6-p8-avatar11 + P8-test02 APK; avatar12 gesture excluded',
        'rollback':'P8-avatar-test11 firmware; new APK can switch to follow mode',
        'partition_table_sector_sha256':sector,'wake_validation':verify_build(),'assets_validation':validate_assets(assets),
        'boot_volume':85,'android_tests':count,'overview_protocol':1,
        'overview':{'raster_size':480,'display_size':466,'safe_radius':198,'auto_zoom':[3,18],
            'labels':False,'fixed_basemap':True,'route_geometry_crc':True,'default':True},
        'avatar11_source_guards':list(fixed),'source_files_sha256':{},
        'validation':{'firmware_build':'passed','android_build':'passed','android_jvm_tests':count,
            'production_http_and_lvgl':'passed','avatar11_voice_wake_regression':'passed',
            'release_guards':'7 passed' if guard_log.exists() and '\nOK\n' in guard_log.read_text('utf-8') else 'pending',
            'device_install':'not performed','hardware_acceptance':'pending'}}
    for key,source,name in (
        ('app',BUILD/'xiaozhi.bin','p8-overview-xiaozhi-app.bin'),
        ('assets',BUILD/'generated_assets.bin','p8-overview-xiaozhi-assets.bin'),
        ('restore_app',previous/old['app']['filename'],'restore-P8-avatar-test11-app.bin'),
        ('restore_assets',previous/old['assets']['filename'],'restore-P8-avatar-test11-assets.bin'),
        ('apk',apk,'maple-map-P8-overview-test01.apk')):
        data=source.read_bytes();assert 0<len(data)<(200*1024*1024 if key=='apk' else 0x800000 if 'assets' in key else 0x3f0000)
        shutil.copy2(source,out/name)
        report[key]={'filename':name,'bytes':len(data),'sha256':digest(data)}
    helper=(previous/'flash_p8.py').read_text('utf-8').replace('P8-avatar11 program','P8-overview01 program').replace('P8-avatar-test10 program','P8-avatar-test11 program')
    (out/'flash_p8.py').write_text(helper,encoding='utf-8')
    # Modified-source snapshot plus the pinned avatar/audio/Wi-Fi baseline. No keys/config secrets.
    sources=[ROOT/relative for relative in old['source_files_sha256'] if (ROOT/relative).is_file()]
    sources+=list((ROOT/'firmware/components/78__esp-wifi-connect').rglob('*'))
    sources+=list((ROOT/'android/app/src/main/java/com/example/motonav').glob('*.kt'))
    sources+=list((ROOT/'android/app/src/test/java/com/example/motonav').glob('*.kt'))
    sources+=[ROOT/p for p in ('README.md','android/app/build.gradle.kts','android/MODIFICATIONS.md',
        'tools/build.ps1','tools/package_route_overview.py','tools/test_device_protocol.py','tools/test_pages.py',
        'tools/test_release_guards.py','tests/host/local_link_server_test.cc','tests/p5host/pages_test.cc',
        'docs/P8-overview-test01-验收.md','docs/P8-全程总览协议.md')]
    for source in sources:
        if not source.is_file():continue
        relative=source.relative_to(ROOT);target=out/'source'/relative
        target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        report['source_files_sha256'][relative.as_posix()]=digest(source.read_bytes())
    shutil.copytree(previous/'third-party',out/'third-party',dirs_exist_ok=True)
    for path in tests+[ROOT/'logs'/name for name in logs]:shutil.copy2(path,out/path.name)
    shutil.copy2(ROOT/'docs/P8-overview-test01-验收.md',out/'README-验收.md')
    shutil.copy2(ROOT/'tests/build/overview-lvgl.png',out/'overview-lvgl-synthetic.png')
    (out/'apk-signature.txt').write_text(cert,encoding='utf-8')
    (out/'apk-info.txt').write_text(badging,encoding='utf-8')
    report['package_support_sha256']={p.name:digest(p.read_bytes()) for p in out.iterdir() if p.is_file() and p.suffix in ('.png','.log','.py','.md','.txt','.xml')}
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(run([sys.executable,out/'flash_p8.py','--check-files']))
    print(json.dumps({k:report[k] for k in ('stage','firmware_version','android_tests','app','apk','hardware_function_test')},indent=2))

if __name__=='__main__':main()
