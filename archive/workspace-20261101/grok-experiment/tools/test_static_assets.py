import json
import unittest
from build_static_assets import OUTPUT, HEADER, parse_assets, pack_assets, sha256


class AssetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = (OUTPUT / 'original-v2.2.6-assets.bin').read_bytes()
        cls.custom = (OUTPUT / 'maple-static-v1-assets.bin').read_bytes()

    def test_roundtrip(self):
        for blob in (self.original, self.custom):
            self.assertEqual(pack_assets(parse_assets(blob)), blob)

    def test_only_neutral_changed(self):
        before = {n: (b, w, h) for n, b, w, h in parse_assets(self.original)}
        after = {n: (b, w, h) for n, b, w, h in parse_assets(self.custom)}
        self.assertEqual(list(before), list(after))
        self.assertEqual([n for n in before if before[n] != after[n]], ['neutral.png'])

    def test_corruption_rejected(self):
        damaged = bytearray(self.custom)
        damaged[-1] ^= 1
        with self.assertRaises(ValueError):
            parse_assets(bytes(damaged))

    def test_truncation_rejected(self):
        with self.assertRaises(ValueError):
            parse_assets(self.custom[:-1])

    def test_offset_rejected_even_with_valid_checksum(self):
        import struct
        damaged = bytearray(self.custom)
        struct.pack_into('<I', damaged, HEADER.size + 36, 1)
        struct.pack_into('<I', damaged, 4, sum(damaged[HEADER.size:]) & 0xffff)
        with self.assertRaises(ValueError):
            parse_assets(bytes(damaged))

    def test_manifest_hashes(self):
        report = json.loads((OUTPUT / 'validation-report.json').read_text(encoding='utf-8'))
        for name, metadata in report['outputs'].items():
            blob = (OUTPUT / name).read_bytes()
            self.assertEqual(len(blob), metadata['bytes'])
            self.assertEqual(sha256(blob), metadata['sha256'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
