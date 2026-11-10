"""Offline safety regressions for the P1 flash helper and asset validation."""
import binascii
import importlib.util
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import json

import package_p1

ROOT = Path(__file__).resolve().parents[1]
STAGE = sys.argv.pop(1) if len(sys.argv) > 1 and sys.argv[1] in ("P1-test01", "P2-test01", "P3-test01", "P4-test01", "P5-test01", "P6-test01", "P7-test01", "P7-test03", "P7-test04", "P7-test07", "P8-test01", "P8-test02") else "P1-test01"
RELEASE = ROOT / "releases" / STAGE
HELPER = RELEASE / ("flash_" + STAGE.split('-')[0].lower() + ".py")
spec = importlib.util.spec_from_file_location("p1_flash", HELPER)
flash = importlib.util.module_from_spec(spec)
spec.loader.exec_module(flash)


def ota(*records):
    data = bytearray(b"\xff" * 0x2000)
    for offset, sequence, state in records:
        raw = struct.pack("<I", sequence)
        struct.pack_into("<I", data, offset, sequence)
        struct.pack_into("<II", data, offset + 24, state, binascii.crc32(raw, 0xffffffff) & 0xffffffff)
    return data


class ReleaseGuards(unittest.TestCase):
    def test_newest_valid_slot_wins(self):
        self.assertEqual(flash.select_app_slot(ota((0, 1, 2), (0x1000, 2, 2))), (0x410000, 2))
        self.assertEqual(flash.select_app_slot(ota((0, 3, 2), (0x1000, 2, 2))), (0x20000, 3))

    def test_pending_update_is_rejected(self):
        with self.assertRaises(ValueError):
            flash.select_app_slot(ota((0, 1, 2), (0x1000, 2, 1)))

    def test_corrupt_ota_is_rejected(self):
        data = ota((0, 1, 2))
        data[28] ^= 1
        with self.assertRaises(ValueError):
            flash.select_app_slot(data)

    def test_blank_or_truncated_ota_is_rejected(self):
        for data in [b"\xff" * 0x2000, b"\xff" * 50]:
            with self.subTest(length=len(data)), self.assertRaises(ValueError):
                flash.select_app_slot(data)

    def test_write_modes_require_an_explicit_port(self):
        for mode in ["--flash", "--restore"]:
            result = subprocess.run([sys.executable, HELPER, mode], capture_output=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn(b"--port is required", result.stderr)

    def test_corrupt_package_rejected_before_device_access(self):
        original_root = flash.ROOT
        try:
            with tempfile.TemporaryDirectory() as tmp:
                flash.ROOT = Path(tmp)
                (flash.ROOT / "app.bin").write_bytes(b"corrupt")
                report = {"app": {"filename": "app.bin", "bytes": 7, "sha256": "0" * 64}}
                report["assets"] = report["app"]
                with self.assertRaises(ValueError):
                    flash.check_files(report)
        finally:
            flash.ROOT = original_root

    def test_truncated_and_corrupt_assets_rejected(self):
        report = json.loads((RELEASE / "build-report.json").read_text("utf-8"))
        data = (RELEASE / report["assets"]["filename"]).read_bytes()
        corrupt = bytearray(data)
        corrupt[-1] ^= 1
        for candidate in [data[:10], data[:-1], corrupt]:
            with self.subTest(length=len(candidate)), self.assertRaises(ValueError):
                package_p1.validate_assets(candidate)


if __name__ == "__main__":
    unittest.main(verbosity=2)
