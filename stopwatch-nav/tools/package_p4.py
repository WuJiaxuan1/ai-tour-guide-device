"""Package the P4 custom wake word firmware with matched models and P3 rollback."""
import json
import shutil
import sys
from package_p1 import ROOT, BUILD, digest, run, validate_assets
from test_wake_assets import verify_build

OUT = ROOT / "releases/P4-test01"
P3 = ROOT / "releases/P3-test01"


def main():
    wake = verify_build()
    previous = json.loads((P3 / "build-report.json").read_text("utf-8"))
    if previous["hardware_function_test"] != "passed_by_user":
        raise ValueError("P3 acceptance is not recorded")
    table = (BUILD / "partition_table/partition-table.bin").read_bytes()
    sector_hash = digest(table.ljust(0x1000, b"\xff"))
    if len(table) > 0x1000 or sector_hash != previous["partition_table_sector_sha256"]:
        raise ValueError("P4 partition layout changed")
    app = (BUILD / "xiaozhi.bin").read_bytes()
    descriptor = app.find(bytes.fromhex("3254cdab"), 0, 4096)
    if descriptor < 0 or app[descriptor + 16:descriptor + 48].split(b"\0")[0] != b"2.2.6-p4-test01":
        raise ValueError("Incorrect P4 app version")
    description = json.loads((BUILD / "project_description.json").read_text("utf-8"))
    from pathlib import Path
    component = ROOT / "firmware/components/78__esp-wifi-connect"
    if Path(description["build_component_info"]["78__esp-wifi-connect"]["dir"]).resolve() != component.resolve():
        raise ValueError("P3 Wi-Fi component override lost")
    for relative, expected in previous["source_files_sha256"].items():
        if relative.startswith("components/") and digest((ROOT / "firmware" / relative).read_bytes()) != expected:
            raise ValueError("Accepted P3 Wi-Fi component changed: " + relative)
    test_log = ROOT / "logs/P4-wake-assets-tests.log"
    if not test_log.read_text("utf-8").startswith("PASS:"):
        raise ValueError("Wake asset validation has not passed")
    apk = ROOT / "releases/P2-test01/maple-map-P2-test01.apk"
    if digest(apk.read_bytes()) != previous["compatible_apk_sha256"]:
        raise ValueError("P2 APK changed")
    OUT.mkdir(parents=True, exist_ok=True)
    report = {
        "stage": "P4-test01", "hardware_function_test": "pending", "firmware_version": "2.2.6-p4-test01",
        "firmware_base_commit": run(["git", "-C", ROOT / "firmware", "rev-parse", "HEAD"]).strip(),
        "partition_table_sector_sha256": sector_hash,
        "assets_validation": validate_assets((BUILD / "generated_assets.bin").read_bytes()),
        "wake_validation": wake, "runtime_memory_and_acoustic_test": "pending hardware",
        "compatible_apk": "../P2-test01/maple-map-P2-test01.apk", "compatible_apk_sha256": previous["compatible_apk_sha256"],
        "rollback": "P3-test01, all five acceptance items passed by user on 2026-10-27",
        "network_behavior": previous["network_behavior"], "wifi_component": previous["wifi_component"],
    }
    for key, source, name, limit in [
        ("app", BUILD / "xiaozhi.bin", "p4-xiaozhi-app.bin", 0x3f0000),
        ("assets", BUILD / "generated_assets.bin", "p4-xiaozhi-assets.bin", 0x800000),
        ("restore_app", P3 / previous["app"]["filename"], "restore-P3-app.bin", 0x3f0000),
        ("restore_assets", P3 / previous["assets"]["filename"], "restore-P3-assets.bin", 0x800000),
    ]:
        data = source.read_bytes()
        if not data or len(data) > limit:
            raise ValueError("Invalid image length: " + name)
        if key.startswith("restore_") and digest(data) != previous[key.removeprefix("restore_")]["sha256"]:
            raise ValueError("P3 rollback file modified")
        shutil.copy2(source, OUT / name)
        if (OUT / name).read_bytes() != data:
            raise ValueError("Copy mismatch")
        report[key] = {"filename": name, "bytes": len(data), "sha256": digest(data)}
    helper = (P3 / "flash_p3.py").read_text("utf-8").replace("Write the P3 program", "Write the P4 program").replace("Restore the accepted P2 program", "Restore the accepted P3 program")
    (OUT / "flash_p4.py").write_text(helper, encoding="utf-8")
    (OUT / "source.patch").write_text(run(["git", "-C", ROOT / "firmware", "diff", "--no-ext-diff"]), encoding="utf-8")
    (OUT / "firmware-image-info.txt").write_text(run([sys.executable, "-m", "esptool", "--chip", "esp32s3", "image_info", BUILD / "xiaozhi.bin"]), encoding="utf-8")
    sources = [ROOT / "firmware/sdkconfig.stopwatch"] + list(component.rglob("*"))
    sources += [ROOT / "firmware/main/boards/m5stack-stopwatch" / n for n in ("local_link_server.cc", "local_link_server.h")]
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
                         (test_log, "wake-assets-tests.txt"), (ROOT / "tools/test_wake_assets.py", "test_wake_assets.py")]:
        shutil.copy2(source, OUT / name)
    (OUT / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(run([sys.executable, OUT / "flash_p4.py", "--check-files"]).strip())
    print(json.dumps({k: report[k] for k in ("app", "assets", "wake_validation")}, ensure_ascii=False, indent=2))
    print("PASS: matched P4 app/models, unchanged partitions and P3 Wi-Fi component, P3 rollback and P2 APK. Hardware acceptance pending.")


if __name__ == "__main__":
    main()
