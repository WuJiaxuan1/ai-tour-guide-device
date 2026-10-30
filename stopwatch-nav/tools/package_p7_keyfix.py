"""Package the APK-only P7-test02 key persistence fix; no device operations."""
from pathlib import Path
import json
import re
import shutil
import xml.etree.ElementTree as ET
from package_p1 import ROOT, digest, run

def main():
    out=ROOT/'releases/P7-test02'
    previous=ROOT/'releases/P7-test01'
    apk=ROOT/'android/app/build/outputs/apk/debug/app-debug.apk'
    tool=ROOT.parent/'MotoNav-main/.tools'
    cert=run([tool/'jdk/jdk-21.0.12.1+1/bin/java.exe','-jar',tool/'android-sdk/build-tools/35.0.0/lib/apksigner.jar','verify','--verbose','--print-certs',apk])
    pattern=r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)'
    assert re.search(pattern,cert).group(1)==re.search(pattern,(previous/'apk-signature.txt').read_text('utf-8')).group(1),'Signature changed'
    badging=run([tool/'android-sdk/build-tools/35.0.0/aapt2.exe','dump','badging',apk])
    for expected in ("name='com.qixia.stopwatchnav'","versionCode='134'","versionName='8.3.26-p7-test02'",'com.example.motonav.SurroundingMapActivity'):
        assert expected in badging,expected
    tests=[]
    for name,count in [('LocalLinkClientTest',14),('MapFrameEncoderTest',2),('SurroundingMapTest',4),('AmapKeyStoreTest',4)]:
        path=ROOT/f'android/app/build/test-results/testDebugUnitTest/TEST-com.example.motonav.{name}.xml'
        result=ET.parse(path).getroot().attrib
        assert int(result['tests'])==count and all(int(result[k])==0 for k in ('failures','errors','skipped')),name
        tests.append(path)
    out.mkdir(parents=True,exist_ok=True)
    name='maple-map-P7-test02.apk'
    shutil.copy2(apk,out/name)
    data=(out/name).read_bytes()
    assert data==apk.read_bytes()
    baseline=json.loads((previous/'build-report.json').read_text('utf-8'))
    report={'stage':'P7-test02','scope':'APK-only Key save/apply fix',
        'hardware_function_test':'pending','firmware':'2.2.6-p7-test01 (unchanged)',
        'firmware_package':'../P7-test01','firmware_app_sha256':baseline['app']['sha256'],
        'android_tests':24,'apk':{'filename':name,'bytes':len(data),'sha256':digest(data)},'source_files_sha256':{}}
    files=['app/build.gradle.kts']
    files+=['app/src/main/java/com/example/motonav/'+n for n in ('AmapKeyStore.kt','Keys.kt','SurroundingMapActivity.kt')]
    files+=['app/src/test/java/com/example/motonav/AmapKeyStoreTest.kt']
    for relative in files:
        src=ROOT/'android'/relative;dst=out/'source/android'/relative
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
        report['source_files_sha256'][relative]=digest(src.read_bytes())
    for path in tests:shutil.copy2(path,out/path.name)
    (out/'apk-signature.txt').write_text(cert,encoding='utf-8')
    (out/'apk-info.txt').write_text(badging,encoding='utf-8')
    (out/'build-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report['apk'],indent=2))
    print('PASS: P7-test02 APK, same signature/package, 24 JVM tests; firmware remains P7-test01; phone acceptance pending')

if __name__=='__main__':main()
