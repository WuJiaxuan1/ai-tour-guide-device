"""Package P2 and preserve the user-accepted P1 rollback. No device access."""
from pathlib import Path
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET

from package_p1 import ROOT, WORKSPACE, BUILD, digest, run, validate_assets

OUT = ROOT / "releases/P2-test01"
P1 = ROOT / "releases/P1-test01"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    previous = json.loads((P1 / "build-report.json").read_text("utf-8"))
    config = (ROOT / "firmware/sdkconfig").read_text("utf-8")
    for required in ["CONFIG_BOARD_TYPE_M5STACK_STOPWATCH=y", "CONFIG_USE_AFE_WAKE_WORD=y",
                     "CONFIG_SR_WN_WN9_NIHAOXIAOZHI_TTS=y", "CONFIG_FLASH_DEFAULT_ASSETS=y"]:
        if required not in config.splitlines():
            raise ValueError("Unexpected P2 config: " + required)
    table = (BUILD / "partition_table/partition-table.bin").read_bytes()
    sector_hash = digest(table.ljust(0x1000, b"\xff"))
    if len(table) > 0x1000 or sector_hash != previous["partition_table_sector_sha256"]:
        raise ValueError("P2 must retain P1 partition layout")
    assets = (BUILD / "generated_assets.bin").read_bytes()
    assets_info = validate_assets(assets)
    if digest(assets) != previous["assets"]["sha256"]:
        raise ValueError("P2 unexpectedly changed the accepted P1 assets")
    image = (BUILD / "xiaozhi.bin").read_bytes()
    descriptor = image.find(bytes.fromhex("3254cdab"), 0, 4096)
    if descriptor < 0 or image[descriptor + 16:descriptor + 48].split(b"\0")[0] != b"2.2.6-p2-test01":
        raise ValueError("Incorrect firmware version")
    tools = WORKSPACE / "MotoNav-main/.tools"
    apk = ROOT / "android/app/build/outputs/apk/debug/app-debug.apk"
    cert = run([tools / "jdk/jdk-21.0.12.1+1/bin/java.exe", "-jar",
                tools / "android-sdk/build-tools/35.0.0/lib/apksigner.jar", "verify", "--verbose", "--print-certs", apk])
    cert_pattern = r"Signer #1 certificate SHA-256 digest: ([0-9a-f]+)"
    if re.search(cert_pattern, cert).group(1) != re.search(cert_pattern, (P1 / "apk-signature.txt").read_text("utf-8")).group(1):
        raise ValueError("APK signing identity changed since P1")
    badging = run([tools / "android-sdk/build-tools/35.0.0/aapt2.exe", "dump", "badging", apk])
    for required in ["name='com.qixia.stopwatchnav'", "versionCode='131'", "versionName='8.3.26-p2-test01'", "com.example.motonav.LocalLinkActivity"]:
        if required not in badging:
            raise ValueError("Unexpected APK: " + required)
    xml = ROOT / "android/app/build/test-results/testDebugUnitTest/TEST-com.example.motonav.LocalLinkClientTest.xml"
    tests = ET.parse(xml).getroot()
    if int(tests.attrib["tests"]) != 9 or int(tests.attrib["failures"]) or int(tests.attrib["errors"]):
        raise ValueError("Android local link tests have not passed")
    device_log = (ROOT / "logs/P2-device-protocol-tests.log").read_text("utf-8", errors="replace")
    if "PASS: real firmware handlers" not in device_log:
        raise ValueError("Firmware host tests have not passed")
    report = {
        "stage": "P2-test01", "hardware_function_test": "pending",
        "firmware_version": "2.2.6-p2-test01", "android_package": "com.qixia.stopwatchnav",
        "firmware_base_commit": run(["git", "-C", ROOT / "firmware", "rev-parse", "HEAD"]).strip(),
        "partition_table_sector_sha256": sector_hash, "assets_validation": assets_info,
        "protocol": {"version": 1, "transport": "HTTP", "port": 8765, "max_body_bytes": 384},
        "android_tests": 9, "firmware_host_tests": "valid fragmented echo, 15 rejection cases, lifecycle",
        "rollback": "P1-test01, all five acceptance items passed by user on 2026-10-27",
    }
    for key, source, name, limit in [
        ("app", BUILD / "xiaozhi.bin", "p2-xiaozhi-app.bin", 0x3f0000),
        ("assets", BUILD / "generated_assets.bin", "p2-xiaozhi-assets.bin", 0x800000),
        ("restore_app", P1 / previous["app"]["filename"], "restore-P1-app.bin", 0x3f0000),
        ("restore_assets", P1 / previous["assets"]["filename"], "restore-P1-assets.bin", 0x800000),
        ("apk", apk, "maple-map-P2-test01.apk", 200 * 1024 * 1024),
    ]:
        data = source.read_bytes()
        if not data or len(data) > limit:
            raise ValueError("Invalid image length: " + name)
        if key.startswith("restore_"):
            baseline_key = key.removeprefix("restore_")
            if digest(data) != previous[baseline_key]["sha256"]:
                raise ValueError("P1 rollback file was changed")
        shutil.copy2(source, OUT / name)
        if (OUT / name).read_bytes() != data:
            raise ValueError("Copy mismatch")
        report[key] = {"filename": name, "bytes": len(data), "sha256": digest(data)}
    helper = (P1 / "flash_p1.py").read_text("utf-8")
    helper = helper.replace("Write the P1 baseline program AND matching assets", "Write the P2 program AND matching assets")
    helper = helper.replace("Restore the official main program AND original assets", "Restore the accepted P1 program AND its assets")
    (OUT / "flash_p2.py").write_text(helper, encoding="utf-8")
    (OUT / "apk-signature.txt").write_text(cert, encoding="utf-8")
    (OUT / "apk-info.txt").write_text(badging, encoding="utf-8")
    (OUT / "firmware-image-info.txt").write_text(run([sys.executable, "-m", "esptool", "--chip", "esp32s3", "image_info", BUILD / "xiaozhi.bin"]), encoding="utf-8")
    (OUT / "source.patch").write_text(run(["git", "-C", ROOT / "firmware", "diff", "--no-ext-diff"]), encoding="utf-8")
    files = [ROOT / "firmware" / p for p in ["sdkconfig.stopwatch", "main/boards/m5stack-stopwatch/local_link_server.cc", "main/boards/m5stack-stopwatch/local_link_server.h"]]
    files += [ROOT / "android" / p for p in ["app/build.gradle.kts", "app/src/main/AndroidManifest.xml", "app/src/main/res/values/strings.xml", "app/src/main/java/com/example/motonav/LocalLinkClient.kt", "app/src/main/java/com/example/motonav/LocalLinkActivity.kt"]]
    report["source_files_sha256"] = {}
    for source in files:
        relative = source.relative_to(ROOT)
        destination = OUT / "source" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        report["source_files_sha256"][relative.as_posix()] = digest(source.read_bytes())
    for source, name in [(ROOT / "firmware/sdkconfig", "sdkconfig"), (ROOT / "firmware/dependencies.lock", "dependencies.lock"),
                         (xml, "android-tests.xml"), (ROOT / "logs/P2-device-protocol-tests.log", "firmware-host-tests.txt")]:
        shutil.copy2(source, OUT / name)
    (OUT / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(run([sys.executable, OUT / "flash_p2.py", "--check-files"]).strip())
    print(json.dumps({k: report[k] for k in ["app", "assets", "apk"]}, ensure_ascii=False, indent=2))
    print("PASS: P2 package, unchanged P1 assets/layout, identical Android signer, 9 JVM tests, firmware handler tests. Hardware acceptance pending.")


if __name__ == "__main__":
    main()
