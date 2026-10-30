"""Validate and package the P1 baseline. Offline only; never opens a device."""
from pathlib import Path
import hashlib
import json
import shutil
import struct
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
OUT = ROOT / "releases/P1-test01"
BUILD = ROOT / "firmware/build"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def run(args):
    result = subprocess.run([str(x) for x in args], capture_output=True)
    output = (result.stdout + result.stderr).decode("utf-8", errors="replace")
    if result.returncode:
        raise RuntimeError(f"Command failed ({result.returncode}): {args[0]}\n{output}")
    return output


def validate_assets(data):
    header = struct.Struct("<III")
    entry = struct.Struct("<32sIIHH")
    if len(data) < header.size:
        raise ValueError("Truncated assets")
    count, checksum, length = header.unpack_from(data)
    if not 0 < count <= 1024 or length < count * entry.size:
        raise ValueError("Invalid asset header")
    if len(data) != length + header.size or (sum(data[header.size:]) & 0xffff) != checksum:
        raise ValueError("Asset length/checksum mismatch")
    start = header.size + count * entry.size
    expected = 0
    files = {}
    for i in range(count):
        name, size, offset, _, _ = entry.unpack_from(data, header.size + i * entry.size)
        name = name.split(b"\0")[0].decode("ascii")
        end = start + offset + 2 + size
        if not name or name in files or offset != expected or end > len(data):
            raise ValueError("Invalid asset entry")
        if data[start + offset:start + offset + 2] != b"ZZ":
            raise ValueError("Invalid asset marker")
        files[name] = data[start + offset + 2:end]
        expected += size + 2
    if start + expected != len(data):
        raise ValueError("Trailing asset data")
    index = json.loads(files["index.json"])
    if index.get("version") != 1:
        raise ValueError("Unexpected asset index version")
    for item in index.get("emoji_collection", []):
        if item["file"] not in files:
            raise ValueError("Missing emoji")
    if "srmodels.bin" not in files:
        raise ValueError("Missing speech models")
    return {"count": count, "files": sorted(files), "index": index}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    config = (ROOT / "firmware/sdkconfig").read_text("utf-8")
    for required in ["CONFIG_BOARD_TYPE_M5STACK_STOPWATCH=y", "CONFIG_USE_AFE_WAKE_WORD=y",
                     "CONFIG_SR_WN_WN9_NIHAOXIAOZHI_TTS=y", "CONFIG_FLASH_DEFAULT_ASSETS=y",
                     "CONFIG_ESPTOOLPY_FLASHMODE_DIO=y", "CONFIG_LANGUAGE_ZH_CN=y"]:
        if required not in config.splitlines():
            raise ValueError(f"Missing required config: {required}")
    if run(["git", "-C", ROOT / "firmware", "diff", "--name-only"]).strip():
        raise ValueError("P1 must not change upstream tracked firmware source")
    table = (BUILD / "partition_table/partition-table.bin").read_bytes()
    if len(table) > 0x1000:
        raise ValueError("Partition table exceeds a sector")
    sector = table.ljust(0x1000, b"\xff")
    original = (WORKSPACE / "M5Burner-v3-beta-win-x64/packages/firmware/05a2cf9f8c71e46dbd0dca65137ad0c1.bin").read_bytes()
    if sector != original[0x8000:0x9000]:
        raise ValueError("Built partition table differs from cached baseline")
    assets_info = validate_assets((BUILD / "generated_assets.bin").read_bytes())
    image_info = run([sys.executable, "-m", "esptool", "--chip", "esp32s3", "image_info", BUILD / "xiaozhi.bin"])
    (OUT / "firmware-image-info.txt").write_text(image_info, encoding="utf-8")
    android_tools = WORKSPACE / "MotoNav-main/.tools"
    apk = ROOT / "android/app/build/outputs/apk/debug/app-debug.apk"
    cert = run([android_tools / "jdk/jdk-21.0.12.1+1/bin/java.exe", "-jar",
                android_tools / "android-sdk/build-tools/35.0.0/lib/apksigner.jar",
                "verify", "--verbose", "--print-certs", apk])
    badging = run([android_tools / "android-sdk/build-tools/35.0.0/aapt2.exe", "dump", "badging", apk])
    if "name='com.qixia.stopwatchnav'" not in badging or "8.3.26-p1-test01" not in badging:
        raise ValueError("Unexpected APK identity")
    (OUT / "apk-signature.txt").write_text(cert, encoding="utf-8")
    (OUT / "apk-info.txt").write_text(badging, encoding="utf-8")
    report = {
        "stage": "P1-test01", "firmware_source_commit": run(["git", "-C", ROOT / "firmware", "rev-parse", "HEAD"]).strip(),
        "firmware_tracked_source_changes": [], "hardware_function_test": "pending",
        "partition_table_sector_sha256": digest(sector), "assets_validation": assets_info,
        "android_source": "MotoNav-main/android/standard 8.3.26 (local copy)",
        "android_package": "com.qixia.stopwatchnav", "android_wifi_transport": "not implemented in P1",
    }
    items = [
        ("app", BUILD / "xiaozhi.bin", "p1-xiaozhi-app.bin", 0x3f0000),
        ("assets", BUILD / "generated_assets.bin", "p1-xiaozhi-assets.bin", 0x800000),
        ("restore_app", WORKSPACE / "stopwatch-custom/grok-v5/original-v2.2.6-app.bin", "restore-v2.2.6-app.bin", 0x3f0000),
        ("restore_assets", WORKSPACE / "stopwatch-custom/output/original-v2.2.6-assets.bin", "restore-v2.2.6-assets.bin", 0x800000),
        ("apk", apk, "maple-map-P1-test01.apk", 200 * 1024 * 1024),
    ]
    for key, source, name, limit in items:
        data = source.read_bytes()
        if not data or len(data) > limit:
            raise ValueError(f"Invalid length: {name}")
        if key.startswith("restore_"):
            offset = 0x20000 if key == "restore_app" else 0x800000
            if original[offset:offset + len(data)] != data:
                raise ValueError("Rollback image differs from baseline")
        shutil.copy2(source, OUT / name)
        if (OUT / name).read_bytes() != data:
            raise ValueError("Package copy mismatch")
        report[key] = {"filename": name, "bytes": len(data), "sha256": digest(data)}
    shutil.copy2(ROOT / "firmware/sdkconfig", OUT / "sdkconfig")
    shutil.copy2(ROOT / "firmware/dependencies.lock", OUT / "dependencies.lock")
    (OUT / "partition-table.bin").write_bytes(table)
    # Retain the previously reviewed slot-aware writer. Explicit port is mandatory.
    helper = (WORKSPACE / "stopwatch-custom/grok-v5/flash_grok_v5.py").read_text("utf-8")
    helper = helper.replace("Write the new Grok main program AND vector assets", "Write the P1 baseline program AND matching assets")
    helper = helper.replace("parser.add_argument('--port',default='COM3')", "parser.add_argument('--port')")
    helper = helper.replace("args=parser.parse_args()", "args=parser.parse_args()\n    if (args.flash or args.restore) and not args.port:\n        parser.error('--port is required for device operations')")
    (OUT / "flash_p1.py").write_text(helper, encoding="utf-8")
    (OUT / "build-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    check = run([sys.executable, OUT / "flash_p1.py", "--check-files"])
    print(check.strip())
    print("PASS: config, upstream source, partition layout, assets, firmware image, APK signature/package and copied release hashes")
    print(json.dumps({k: report[k] for k in ["app", "assets", "apk"]}, ensure_ascii=False, indent=2))
    print("Hardware tests remain pending. No device access.")


if __name__ == "__main__":
    main()
