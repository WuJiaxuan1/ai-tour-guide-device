"""Package APK-only adjustable map zoom; verify signer, version and JVM results."""
import json
import re
import shutil
import xml.etree.ElementTree as ET
from package_p1 import ROOT, digest, run


def main():
    out = ROOT / 'releases/P7-test05'
    previous = ROOT / 'releases/P7-test04'
    apk = ROOT / 'android/app/build/outputs/apk/debug/app-debug.apk'
    tool = ROOT.parent / 'MotoNav-main/.tools'
    cert = run([tool / 'jdk/jdk-21.0.12.1+1/bin/java.exe', '-jar',
                tool / 'android-sdk/build-tools/35.0.0/lib/apksigner.jar',
                'verify', '--verbose', '--print-certs', apk])
    pattern = r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)'
    assert re.search(pattern, cert).group(1) == re.search(
        pattern, (previous / 'apk-signature.txt').read_text('utf-8')).group(1), 'Signature changed'
    badging = run([tool / 'android-sdk/build-tools/35.0.0/aapt2.exe', 'dump', 'badging', apk])
    for expected in ("name='com.qixia.stopwatchnav'", "versionCode='137'",
                     "versionName='8.3.26-p7-test05'", 'com.example.motonav.SurroundingMapActivity'):
        assert expected in badging, expected
    tests = []
    counts = {'LocalLinkClientTest': 14, 'MapFrameEncoderTest': 2, 'SurroundingMapTest': 4,
              'AmapKeyStoreTest': 4, 'MapPreviewPixelsTest': 3, 'MapZoomTest': 3}
    for name, count in counts.items():
        path = ROOT / f'android/app/build/test-results/testDebugUnitTest/TEST-com.example.motonav.{name}.xml'
        result = ET.parse(path).getroot().attrib
        assert int(result['tests']) == count and all(int(result[k]) == 0 for k in ('failures', 'errors', 'skipped')), name
        tests.append(path)
    out.mkdir(parents=True, exist_ok=True)
    filename = 'maple-map-P7-test05.apk'
    shutil.copy2(apk, out / filename)
    data = (out / filename).read_bytes()
    assert data == apk.read_bytes()
    baseline = json.loads((previous / 'build-report.json').read_text('utf-8'))
    report = {'stage': 'P7-test05', 'scope': 'APK-only adjustable zoom, 13.0-18.0 in half steps',
              'hardware_function_test': 'pending', 'firmware': '2.2.6-p7-test04 (unchanged)',
              'firmware_package': '../P7-test04', 'firmware_app_sha256': baseline['app']['sha256'],
              'android_tests': sum(counts.values()),
              'apk': {'filename': filename, 'bytes': len(data), 'sha256': digest(data)},
              'source_files_sha256': {}}
    files = ['app/build.gradle.kts']
    files += ['app/src/main/java/com/example/motonav/' + n + '.kt' for n in
              ('MapZoom', 'PhoneMapRenderer', 'SurroundingMapActivity', 'SurroundingMap',
               'MapPreviewPixels', 'MapFrameEncoder', 'LocalLinkClient')]
    files += ['app/src/test/java/com/example/motonav/' + n + '.kt' for n in counts]
    for relative in files:
        src = ROOT / 'android' / relative
        dst = out / 'source/android' / relative
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        report['source_files_sha256'][relative] = digest(src.read_bytes())
    for path in tests:
        shutil.copy2(path, out / path.name)
    shutil.copy2(ROOT / 'logs/P7-test05-android-build.log', out / 'android-build.log')
    (out / 'apk-signature.txt').write_text(cert, encoding='utf-8')
    (out / 'apk-info.txt').write_text(badging, encoding='utf-8')
    (out / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['apk'], indent=2))
    print('PASS: same signer/package; 30 JVM tests; firmware unchanged; hardware acceptance pending')


if __name__ == '__main__':
    main()
