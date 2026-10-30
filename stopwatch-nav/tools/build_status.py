"""Read bounded build-log tails without waiting on a live build process."""
from pathlib import Path
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

root = Path(__file__).resolve().parents[1]
stage = sys.argv[1] if len(sys.argv) > 1 else "P1"
names = ("P1-firmware-build.log", "P1-android-build-normal-user.log") if stage == "P1" else ("P2-firmware-build.log", "P2-android-build.log", "P2-android-tests.log")
if stage == "P3": names = ("P3-firmware-build.log", "P3-provisioning-tests.log", "P3-page-tests.log")
if stage == "P4": names = ("P4-firmware-build.log", "P4-wake-assets-tests.log")
if stage == "P5": names = ("P5-firmware-build.log", "P5-voice-tests.log", "P5-pages-tests.log")
if stage == "P6": names = ("P6-firmware-build.log", "P6-android-build.log", "P6-device-protocol-tests.log", "P6-pages-tests.log")
if stage == "P7": names = ("P7-firmware-build.log", "P7-android-build.log", "P7-device-protocol-tests.log", "P7-pages-tests.log")
for name in names:
    path = root / "logs" / name
    print(f"{name}:")
    if path.exists():
        data = path.read_bytes()
        encoding = "utf-16" if data.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8"
        print("\n".join(data.decode(encoding, errors="replace").splitlines()[-14:]))
    else:
        print("Not started")
