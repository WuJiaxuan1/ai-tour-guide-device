"""Offline checks; never accesses the device or serial ports."""
import io
import json
import struct
import unittest
from PIL import Image, ImageChops, ImageDraw
from build_static_assets import parse_assets,pack_assets,sha256
from build_grok_round_v3 import ROOT,OUT,blank_text_font


class RoundV3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blob = (OUT/'grok-round-v3-assets.bin').read_bytes()
        cls.entries = parse_assets(cls.blob)
        cls.current = {n:b for n,b,_,_ in cls.entries}
        cls.original = {n:b for n,b,_,_ in parse_assets((ROOT/'output/original-v2.2.6-assets.bin').read_bytes())}
        cls.index = json.loads(cls.current['index.json'])
        cls.mapping = json.loads((ROOT/'grok-mapping.json').read_text('utf-8'))
        cls.report = json.loads((OUT/'validation-report.json').read_text('utf-8'))

    def test_all_emotions_replaced_without_original_images(self):
        original_index = json.loads(self.original['index.json'])
        self.assertEqual({e['name'] for e in original_index['emoji_collection']},set(self.mapping))
        self.assertEqual({e['name'] for e in self.index['emoji_collection']},set(self.mapping))
        self.assertEqual(set(self.current),{'index.json','srmodels.bin','font_puhui_common_30_4.bin',
                                          *(n+'.gif' for n in self.mapping)})
        for e in self.index['emoji_collection']:
            self.assertEqual(e['file'],e['name']+'.gif')
            self.assertEqual(self.current[e['file']],(OUT/e['file']).read_bytes())

    def test_voice_and_unrelated_index_fields_preserved(self):
        self.assertEqual(self.current['srmodels.bin'],self.original['srmodels.bin'])
        original_index = json.loads(self.original['index.json'])
        expected = {**original_index,'emoji_collection':self.index['emoji_collection'],
                    'hide_subtitle':True,'skin':self.index['skin']}
        self.assertEqual(expected,self.index)
        self.assertEqual(self.report['preserved']['srmodels.bin'],sha256(self.original['srmodels.bin']))

    def test_transparent_font_preserves_every_structure_and_metric(self):
        before = self.original['font_puhui_common_30_4.bin']
        after = self.current['font_puhui_common_30_4.bin']
        desc, = struct.unpack_from('<I',before,24)
        bitmap,glyphs,cmaps = struct.unpack_from('<III',before,desc)
        start,end = desc+bitmap,desc+glyphs
        self.assertEqual(len(before),len(after))
        self.assertEqual(before[:start],after[:start])
        self.assertEqual(before[end:],after[end:])
        self.assertTrue(any(before[start:end]))
        self.assertFalse(any(after[start:end]))
        self.assertEqual((desc+cmaps-end)//16,6658)
        # Independently visit each glyph using its stored offset and 4bpp dimensions.
        nonempty = 0
        for cursor in range(end,desc+cmaps,16):
            offset,advance,w,h,x,y = struct.unpack_from('<IIHHhh',after,cursor)
            length = (w*h*4+7)//8
            self.assertLessEqual(start+offset+length,end)
            self.assertFalse(any(after[start+offset:start+offset+length]))
            nonempty += bool(w*h)
        self.assertGreater(nonempty,6000)
        self.assertEqual(sha256(after),self.report['silent_text_font']['sha256'])

    def test_unsupported_font_rejected(self):
        original = self.original['font_puhui_common_30_4.bin']
        with self.assertRaises(ValueError):
            blank_text_font(original[:-1])
        damaged = bytearray(original)
        damaged[54] ^= 0x40
        with self.assertRaises(ValueError):
            blank_text_font(damaged)

    def test_gifs_fit_circle_all_frames_animate_and_loop(self):
        circle = Image.new('L',(466,466))
        ImageDraw.Draw(circle).ellipse((2,2,463,463),fill=255)
        outside = ImageChops.invert(circle)
        for name,blob,w,h in self.entries:
            if not name.endswith('.gif'):
                continue
            self.assertEqual((w,h),(466,466))
            with Image.open(io.BytesIO(blob)) as gif:
                self.assertEqual(gif.size,(466,466))
                self.assertEqual(gif.n_frames,16)
                self.assertEqual(gif.info['loop'],0)
                unique = set()
                for i in range(gif.n_frames):
                    gif.seek(i)
                    self.assertEqual(gif.info['duration'],120)
                    gray = gif.convert('L')
                    unique.add(sha256(gray.tobytes()))
                    self.assertGreaterEqual(gray.getextrema()[1],200)
                    bright = gray.point(lambda p:255 if p>12 else 0)
                    self.assertIsNone(ImageChops.multiply(bright,outside).getbbox(),name)
                self.assertGreater(len(unique),1,name)

    def test_original_backup_still_matches_factory_resources(self):
        backup = (ROOT/'stopwatch-device-backup.bin').read_bytes()
        original = (ROOT/'output/original-v2.2.6-assets.bin').read_bytes()
        self.assertEqual(len(backup),0x1000000)
        self.assertEqual(backup[0x800000:0x800000+len(original)],original)

    def test_partition_roundtrip_report_and_hashes(self):
        self.assertEqual(pack_assets(self.entries),self.blob)
        self.assertLessEqual(len(self.blob),0x800000)
        self.assertEqual(self.report['candidate']['sha256'],sha256(self.blob))
        self.assertEqual(self.report['candidate']['bytes'],len(self.blob))
        self.assertEqual(len(self.entries),24)
        self.assertEqual(self.report['flash_offset'],'0x800000')
        for name,spec in self.report['expressions'].items():
            self.assertEqual(spec['sha256'],sha256(self.current[name+'.gif']))

    def test_damaged_or_truncated_package_rejected(self):
        damaged = bytearray(self.blob)
        damaged[-1] ^= 1
        for data in [damaged,self.blob[:-1]]:
            with self.assertRaises(ValueError):
                parse_assets(data)


if __name__ == '__main__':
    unittest.main(verbosity=2)
