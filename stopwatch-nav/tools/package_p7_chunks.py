"""Offline packaging for P7-test07 chunks. No device access; rollback to test04 firmware/test06 APK."""
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from package_p1 import ROOT, BUILD, digest, run, validate_assets
from test_wake_assets import verify_build


def main():
    out=ROOT/'releases/P7-test07'
    previous=ROOT/'releases/P7-test04'
    old=json.loads((previous/'build-report.json').read_text('utf-8'))
    accepted=json.loads((ROOT/'releases/P6-test01/build-report.json').read_text('utf-8'))
    wake=verify_build()
    table=(BUILD/'partition_table/partition-table.bin').read_bytes()
    sector=digest(table.ljust(0x1000,b'\xff'))
    assert len(table)<=0x1000 and sector==old['partition_table_sector_sha256']
    app=(BUILD/'xiaozhi.bin').read_bytes()
    descriptor=app.find(bytes.fromhex('3254cdab'),0,4096)
    assert descriptor>=0 and app[descriptor+16:descriptor+48].split(b'\0')[0]==b'2.2.6-p7-test07'
    assets=(BUILD/'generated_assets.bin').read_bytes()
    assert digest(assets)==accepted['assets']['sha256']
    description=json.loads((BUILD/'project_description.json').read_text('utf-8'))
    component=ROOT/'firmware/components/78__esp-wifi-connect'
    assert Path(description['build_component_info']['78__esp-wifi-connect']['dir']).resolve()==component.resolve()
    for relative,expected in accepted['source_files_sha256'].items():
        if relative.startswith('components/'):
            assert digest((ROOT/'firmware'/relative).read_bytes())==expected,relative
    logs=['P7-test07-android-build.log','P7-test07-firmware-build.log',
          'P7-test07-device-protocol-tests.log','P7-test07-pages-tests.log']
    assert 'BUILD SUCCESSFUL' in (ROOT/'logs'/logs[0]).read_text('utf-8')
    assert 'Project build complete' in (ROOT/'logs'/logs[1]).read_text('utf-8')
    for name in logs[2:]:
        assert 'PASS: P7-test07' in (ROOT/'logs'/name).read_text('utf-8'),name
    apk=ROOT/'android/app/build/outputs/apk/debug/app-debug.apk'
    tool=ROOT.parent/'MotoNav-main/.tools'
    cert=run([tool/'jdk/jdk-21.0.12.1+1/bin/java.exe','-jar',tool/'android-sdk/build-tools/35.0.0/lib/apksigner.jar',
              'verify','--verbose','--print-certs',apk])
    pattern=r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)'
    assert re.search(pattern,cert).group(1)==re.search(pattern,(ROOT/'releases/P7-test06/apk-signature.txt').read_text('utf-8')).group(1)
    badging=run([tool/'android-sdk/build-tools/35.0.0/aapt2.exe','dump','badging',apk])
    for expected in ("name='com.qixia.stopwatchnav'","versionCode='140'","versionName='8.3.26-p7-test07'",'com.example.motonav.SurroundingMapActivity'):
        assert expected in badging,expected
    counts={'LocalLinkClientTest':14,'MapFrameEncoderTest':2,'SurroundingMapTest':4,'AmapKeyStoreTest':4,
            'MapPreviewPixelsTest':3,'MapZoomTest':3,'MapDetailTest':2,'MapChunkTest':5}
    tests=[]
    for name,count in counts.items():
        path=ROOT/f'android/app/build/test-results/testDebugUnitTest/TEST-com.example.motonav.{name}.xml'
        result=ET.parse(path).getroot().attrib
        assert int(result['tests'])==count and all(int(result[k])==0 for k in ('failures','errors','skipped')),name
        tests.append(path)
    out.mkdir(parents=True,exist_ok=True)
    report={'stage':'P7-test07','hardware_function_test':'pending','firmware_version':'2.2.6-p7-test07',
            'partition_table_sector_sha256':sector,'wake_validation':wake,'assets_validation':validate_assets(assets),
            'boot_volume':85,'android_tests':sum(counts.values()),'chunk_protocol':1,
            'chunk':{'version':3,'kind':3,'size':480,'window':240,'bytes':460800,'header':96,'prefetch_margin_pixels':60},
            'operation':'foreground GPS, north-up moving window, 320ms position interpolation, aligned chunk swap',
            'rollback':'P7-test04 firmware + P7-test06 APK (user selected hidden text and 14.0)',
            'source_files_sha256':{}}
    for key,source,name in [
        ('app',BUILD/'xiaozhi.bin','p7-xiaozhi-app.bin'),
        ('assets',BUILD/'generated_assets.bin','p7-xiaozhi-assets.bin'),
        ('restore_app',previous/old['app']['filename'],'restore-P7-test04-app.bin'),
        ('restore_assets',previous/old['assets']['filename'],'restore-P7-test04-assets.bin'),
        ('apk',apk,'maple-map-P7-test07.apk')]:
        data=source.read_bytes()
        assert data and len(data)<(200*1024*1024 if key=='apk' else 0x800000 if 'assets' in key else 0x3f0000)
        if key.startswith('restore_'):assert digest(data)==old[key.removeprefix('restore_')]['sha256']
        shutil.copy2(source,out/name)
        assert (out/name).read_bytes()==data
        report[key]={'filename':name,'bytes':len(data),'sha256':digest(data)}
    helper=(previous/'flash_p7.py').read_text('utf-8').replace('Restore the accepted P6 program','Restore the P7-test04 program')
    (out/'flash_p7.py').write_text(helper,encoding='utf-8')
    sources=list((ROOT/'firmware/main/boards/m5stack-stopwatch').glob('*'))
    sources += list(component.rglob('*'))
    sources += [ROOT/'firmware'/p for p in ('CMakeLists.txt','sdkconfig.stopwatch','main/audio/voice_gate.h')]
    sources += [ROOT/'android/app/build.gradle.kts']
    sources += [ROOT/'android/app/src/main/java/com/example/motonav'/f'{name}.kt' for name in
        ('SurroundingMapActivity','SurroundingMap','PhoneMapRenderer','MapZoom','MapDetail','MapChunkPolicy','MapPreviewPixels','MapFrameEncoder','LocalLinkClient')]
    sources += [ROOT/'android/app/src/test/java/com/example/motonav'/f'{name}.kt' for name in counts]
    sources += [ROOT/p for p in ('tests/host/local_link_server_test.cc','tests/p5host/pages_test.cc','tools/test_device_protocol.py','tools/test_pages.py','tools/package_p7_chunks.py')]
    for source in sources:
        if not source.is_file():continue
        relative=source.relative_to(ROOT);dest=out/'source'/relative
        dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
        report['source_files_sha256'][relative.as_posix()]=digest(source.read_bytes())
    for file in tests+[ROOT/'logs'/name for name in logs]:shutil.copy2(file,out/file.name)
    (out/'apk-signature.txt').write_text(cert,encoding='utf-8')
    (out/'apk-info.txt').write_text(badging,encoding='utf-8')
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(run([sys.executable,out/'flash_p7.py','--check-files']))
    print(json.dumps({k:report[k] for k in ('app','apk')},indent=2))
    print('PASS: test07 APK+firmware, 37 JVM tests, production HTTP/LVGL tests, unchanged partitions/wake/Wi-Fi and test04 rollback; hardware pending')


if __name__=='__main__':main()
