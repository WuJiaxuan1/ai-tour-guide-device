"""Package P3 firmware only, retaining the accepted P2 rollback and APK."""
import json
import shutil
import sys
from pathlib import Path
from package_p1 import ROOT, BUILD, digest, run, validate_assets

OUT = ROOT / "releases/P3-test01"
P2 = ROOT / "releases/P2-test01"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    previous = json.loads((P2 / "build-report.json").read_text("utf-8"))
    table = (BUILD / "partition_table/partition-table.bin").read_bytes()
    sector_hash = digest(table.ljust(0x1000, b"\xff"))
    if len(table) > 0x1000 or sector_hash != previous["partition_table_sector_sha256"]:
        raise ValueError("P3 partition layout changed")
    assets = (BUILD / "generated_assets.bin").read_bytes()
    assets_info = validate_assets(assets)
    if digest(assets) != previous["assets"]["sha256"]:
        raise ValueError("P3 unexpectedly changed voice/display assets")
    image = (BUILD / "xiaozhi.bin").read_bytes()
    descriptor = image.find(bytes.fromhex("3254cdab"), 0, 4096)
    if descriptor < 0 or image[descriptor + 16:descriptor + 48].split(b"\0")[0] != b"2.2.6-p3-test01":
        raise ValueError("Incorrect P3 firmware version")
    description = json.loads((BUILD / "project_description.json").read_text("utf-8"))
    component_dir = Path(description["build_component_info"]["78__esp-wifi-connect"]["dir"]).resolve()
    if component_dir != (ROOT / "firmware/components/78__esp-wifi-connect").resolve():
        raise ValueError("Build did not use the local provisioning component")
    for name in ("P3-provisioning-tests.log", "P3-page-tests.log"):
        if not (ROOT / "logs" / name).read_text("utf-8", errors="replace").startswith("PASS:"):
            raise ValueError("Required test has not passed: " + name)
    report = {
        "stage": "P3-test01", "hardware_function_test": "pending",
        "firmware_version": "2.2.6-p3-test01", "partition_table_sector_sha256": sector_hash,
        "assets_validation": assets_info, "compatible_apk": "../P2-test01/maple-map-P2-test01.apk",
        "compatible_apk_sha256": previous["apk"]["sha256"],
        "firmware_base_commit": run(["git", "-C", ROOT / "firmware", "rev-parse", "HEAD"]).strip(),
        "wifi_component": "project-local 78/esp-wifi-connect 3.1.5 override",
        "rollback": "P2-test01, all five acceptance items passed by user on 2026-10-27",
        "network_behavior": "clear SSID/password list once per boot; deferred save; explicit non-reboot exit; 120-second initial connection window",
    }
    for key, source, name, limit in [
        ("app", BUILD / "xiaozhi.bin", "p3-xiaozhi-app.bin", 0x3f0000),
        ("assets", BUILD / "generated_assets.bin", "p3-xiaozhi-assets.bin", 0x800000),
        ("restore_app", P2 / previous["app"]["filename"], "restore-P2-app.bin", 0x3f0000),
        ("restore_assets", P2 / previous["assets"]["filename"], "restore-P2-assets.bin", 0x800000),
    ]:
        data = source.read_bytes()
        if not data or len(data) > limit: raise ValueError("Invalid image length: " + name)
        if key.startswith("restore_") and digest(data) != previous[key.removeprefix("restore_")]["sha256"]:
            raise ValueError("Accepted rollback file was modified")
        shutil.copy2(source, OUT / name)
        if (OUT / name).read_bytes() != data: raise ValueError("Copy mismatch")
        report[key] = {"filename": name, "bytes": len(data), "sha256": digest(data)}
    if digest((P2 / previous["apk"]["filename"]).read_bytes()) != previous["apk"]["sha256"]:
        raise ValueError("Compatible P2 APK was modified")
    helper = (P2 / "flash_p2.py").read_text("utf-8")
    helper = helper.replace("Write the P2 program", "Write the P3 program").replace("Restore the accepted P1 program", "Restore the accepted P2 program")
    (OUT / "flash_p3.py").write_text(helper, encoding="utf-8")
    (OUT / "source.patch").write_text(run(["git", "-C", ROOT / "firmware", "diff", "--no-ext-diff"]), encoding="utf-8")
    (OUT / "firmware-image-info.txt").write_text(run([sys.executable, "-m", "esptool", "--chip", "esp32s3", "image_info", BUILD / "xiaozhi.bin"]), encoding="utf-8")
    snapshot = [ROOT / "firmware/sdkconfig.stopwatch"]
    snapshot += list(component_dir.rglob("*"))
    snapshot += [ROOT / "firmware/main/boards/m5stack-stopwatch" / n for n in ("local_link_server.cc", "local_link_server.h")]
    report["source_files_sha256"] = {}
    for source in snapshot:
        if not source.is_file(): continue
        relative = source.relative_to(ROOT / "firmware")
        destination = OUT / "source" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        report["source_files_sha256"][relative.as_posix()] = digest(source.read_bytes())
    for source, name in [(ROOT / "firmware/sdkconfig", "sdkconfig"), (ROOT / "firmware/dependencies.lock", "dependencies.lock"),
                         (ROOT / "logs/P3-provisioning-tests.log", "provisioning-tests.txt"), (ROOT / "logs/P3-page-tests.log", "page-tests.txt")]:
        shutil.copy2(source, OUT / name)
    (OUT / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(run([sys.executable, OUT / "flash_p3.py", "--check-files"]).strip())
    print(json.dumps({k: report[k] for k in ("app", "assets", "compatible_apk")}, ensure_ascii=False, indent=2))
    print("PASS: P3 version, actual local dependency, unchanged partition/assets, accepted P2 rollback, provisioning and page tests. Hardware acceptance pending.")


if __name__ == "__main__": main()
