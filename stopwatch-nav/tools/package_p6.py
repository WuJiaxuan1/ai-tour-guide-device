"""Package the P6 image transfer and touch swipe firmware/APK and P5 rollback."""
import json
import shutil
import sys
import re
import xml.etree.ElementTree as ET
from package_p1 import ROOT, BUILD, digest, run, validate_assets
from test_wake_assets import verify_build

OUT = ROOT / "releases/P6-test01"
P5 = ROOT / "releases/P5-test01"


def main():
    wake = verify_build()
    previous = json.loads((P5 / "build-report.json").read_text("utf-8"))
    if previous["hardware_function_test"] != "passed_by_user":
        raise ValueError("P5 acceptance is not recorded")
    table = (BUILD / "partition_table/partition-table.bin").read_bytes()
    sector_hash = digest(table.ljust(0x1000, b"\xff"))
    if len(table) > 0x1000 or sector_hash != previous["partition_table_sector_sha256"]:
        raise ValueError("P6 partition layout changed")
    app = (BUILD / "xiaozhi.bin").read_bytes()
    descriptor = app.find(bytes.fromhex("3254cdab"), 0, 4096)
    if descriptor < 0 or app[descriptor + 16:descriptor + 48].split(b"\0")[0] != b"2.2.6-p6-test01":
        raise ValueError("Incorrect P6 app version")
    description = json.loads((BUILD / "project_description.json").read_text("utf-8"))
    from pathlib import Path
    component = ROOT / "firmware/components/78__esp-wifi-connect"
    if Path(description["build_component_info"]["78__esp-wifi-connect"]["dir"]).resolve() != component.resolve():
        raise ValueError("P5 Wi-Fi component override lost")
    for relative, expected in previous["source_files_sha256"].items():
        if relative.startswith("components/") and digest((ROOT / "firmware" / relative).read_bytes()) != expected:
            raise ValueError("Accepted P5 Wi-Fi component changed: " + relative)
    test_log = ROOT / "logs/P6-device-protocol-tests.log"
    if "PASS: actual Kotlin encoder binary accepted" not in test_log.read_text("utf-8"):
        raise ValueError("Cross-language image tests have not passed")
    if digest((BUILD / "generated_assets.bin").read_bytes()) != previous["assets"]["sha256"]:
        raise ValueError("P6 unexpectedly changed accepted P5 wake resources")
    if not (ROOT / "logs/P6-pages-tests.log").read_text("utf-8").startswith("PASS:"):
        raise ValueError("LVGL page checks have not passed")
    apk = ROOT / "android/app/build/outputs/apk/debug/app-debug.apk"
    tool = ROOT.parent / "MotoNav-main/.tools"
    cert = run([tool / "jdk/jdk-21.0.12.1+1/bin/java.exe", "-jar",
        tool / "android-sdk/build-tools/35.0.0/lib/apksigner.jar", "verify", "--verbose", "--print-certs", apk])
    pattern = r"Signer #1 certificate SHA-256 digest: ([0-9a-f]+)"
    old_cert = (ROOT / "releases/P2-test01/apk-signature.txt").read_text("utf-8")
    if re.search(pattern,cert).group(1) != re.search(pattern,old_cert).group(1):
        raise ValueError("APK signing identity changed")
    badging = run([tool / "android-sdk/build-tools/35.0.0/aapt2.exe", "dump", "badging", apk])
    for expected in ["name='com.qixia.stopwatchnav'", "versionCode='132'", "versionName='8.3.26-p6-test01'", "com.example.motonav.LocalLinkActivity"]:
        if expected not in badging: raise ValueError("Incorrect APK identity: " + expected)
    test_xml = []
    for name, expected in [("LocalLinkClientTest",12),("MapFrameEncoderTest",2)]:
        path = ROOT / f"android/app/build/test-results/testDebugUnitTest/TEST-com.example.motonav.{name}.xml"
        result = ET.parse(path).getroot().attrib
        if int(result["tests"]) != expected or any(int(result[k]) for k in ("failures","errors","skipped")):
            raise ValueError("Android tests did not pass: " + name)
        test_xml.append(path)
    OUT.mkdir(parents=True, exist_ok=True)
    report = {
        "stage": "P6-test01", "hardware_function_test": "pending", "firmware_version": "2.2.6-p6-test01",
        "firmware_base_commit": run(["git", "-C", ROOT / "firmware", "rev-parse", "HEAD"]).strip(),
        "partition_table_sector_sha256": sector_hash,
        "assets_validation": validate_assets((BUILD / "generated_assets.bin").read_bytes()),
        "wake_validation": wake, "page_and_audio_hardware_test": "pending", "boot_volume": 85,
        "page_controls": "left GPIO2/right swipe: voice; right GPIO1/left swipe: test image page",
        "compatible_apk": "maple-map-P6-test01.apk", "compatible_apk_sha256": digest(apk.read_bytes()),
        "android_tests": 14,
        "image_protocol": {"version":1,"kind":"synthetic test image","format":"RGB565LE","width":240,"height":240,"header_bytes":48,"payload_bytes":115200,"integrity":"CRC32 IEEE"},
        "touch": "CST820B polling, IOE pin4 reset, address0x15, coordinate register0x02, no-sleep register0xFE",
        "rollback": "P5-test01, all five acceptance items passed by user on 2026-10-27",
        "network_behavior": previous["network_behavior"], "wifi_component": previous["wifi_component"],
    }
    for key, source, name, limit in [
        ("app", BUILD / "xiaozhi.bin", "p6-xiaozhi-app.bin", 0x3f0000),
        ("assets", BUILD / "generated_assets.bin", "p6-xiaozhi-assets.bin", 0x800000),
        ("restore_app", P5 / previous["app"]["filename"], "restore-P5-app.bin", 0x3f0000),
        ("restore_assets", P5 / previous["assets"]["filename"], "restore-P5-assets.bin", 0x800000),
        ("apk", apk, "maple-map-P6-test01.apk", 200*1024*1024),
    ]:
        data = source.read_bytes()
        if not data or len(data) > limit:
            raise ValueError("Invalid image length: " + name)
        if key.startswith("restore_") and digest(data) != previous[key.removeprefix("restore_")]["sha256"]:
            raise ValueError("P5 rollback file modified")
        shutil.copy2(source, OUT / name)
        if (OUT / name).read_bytes() != data:
            raise ValueError("Copy mismatch")
        report[key] = {"filename": name, "bytes": len(data), "sha256": digest(data)}
    helper = (P5 / "flash_p5.py").read_text("utf-8").replace("Write the P5 program", "Write the P6 program").replace("Restore the accepted P4 program", "Restore the accepted P5 program")
    (OUT / "flash_p6.py").write_text(helper, encoding="utf-8")
    (OUT / "source.patch").write_text(run(["git", "-C", ROOT / "firmware", "diff", "--no-ext-diff"]), encoding="utf-8")
    (OUT / "firmware-image-info.txt").write_text(run([sys.executable, "-m", "esptool", "--chip", "esp32s3", "image_info", BUILD / "xiaozhi.bin"]), encoding="utf-8")
    sources = [ROOT / "firmware/sdkconfig.stopwatch"] + list(component.rglob("*"))
    sources += [ROOT / "firmware/main/boards/m5stack-stopwatch" / n for n in ("local_link_server.cc", "local_link_server.h")]
    sources += [ROOT / "firmware/main/audio/voice_gate.h", ROOT / "firmware/main/boards/m5stack-stopwatch/stopwatch_pages.h"]
    sources += [ROOT / "firmware/main/boards/m5stack-stopwatch" / name for name in ("map_frame.h","swipe_tracker.h")]
    report["source_files_sha256"] = {}
    for source in sources:
        if not source.is_file():
            continue
        relative = source.relative_to(ROOT / "firmware")
        destination = OUT / "source" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        report["source_files_sha256"][relative.as_posix()] = digest(source.read_bytes())
    for source, name in [(ROOT / "firmware/sdkconfig", "sdkconfig"), (ROOT / "firmware/dependencies.lock", "dependencies.lock"),
                         (test_log, "image-protocol-tests.txt"), (ROOT / "logs/P6-pages-tests.log", "pages-tests.txt")]:
        shutil.copy2(source, OUT / name)
    android_files = ["app/build.gradle.kts"]
    android_files += ["app/src/main/java/com/example/motonav/" + name for name in ("LocalLinkActivity.kt","LocalLinkClient.kt","MapFrameEncoder.kt")]
    android_files += ["app/src/test/java/com/example/motonav/" + name for name in ("LocalLinkClientTest.kt","MapFrameEncoderTest.kt")]
    for relative in android_files:
        source = ROOT / "android" / relative
        destination = OUT / "source/android" / relative
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,destination)
        report["source_files_sha256"]["android/"+relative] = digest(source.read_bytes())
    for xml in test_xml: shutil.copy2(xml, OUT / xml.name)
    (OUT / "apk-signature.txt").write_text(cert,encoding="utf-8")
    (OUT / "apk-info.txt").write_text(badging,encoding="utf-8")
    (OUT / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(run([sys.executable, OUT / "flash_p6.py", "--check-files"]).strip())
    print(json.dumps({k: report[k] for k in ("app", "assets", "apk")}, ensure_ascii=False, indent=2))
    print("PASS: P6 firmware and signed APK, unchanged partitions/wake models/Wi-Fi component, 14 JVM tests, cross-language image validation, LVGL/swipe checks and P5 rollback. Hardware acceptance pending.")


if __name__ == "__main__":
    main()
