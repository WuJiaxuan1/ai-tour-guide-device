"""Offline regression checks for the experimental Grok asset package."""
import io
import json
from pathlib import Path
import unittest
from PIL import Image, ImageChops
from build_static_assets import parse_assets, pack_assets, sha256

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'grok-output'


class GrokAssetsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blob = (OUT / 'grok-round-v2-candidate-assets.bin').read_bytes()
        cls.entries = parse_assets(cls.blob)
        cls.current = {n: b for n, b, _, _ in cls.entries}
        cls.original_blob = (ROOT / 'output/original-v2.2.6-assets.bin').read_bytes()
        cls.original = {n: b for n, b, _, _ in parse_assets(cls.original_blob)}
        cls.index = json.loads(cls.current['index.json'])
        cls.mapping = json.loads((ROOT / 'grok-mapping.json').read_text('utf-8'))
        cls.report = json.loads((OUT / 'validation-report.json').read_text('utf-8'))

    def test_roundtrip_and_bounds(self):
        self.assertEqual(pack_assets(self.entries), self.blob)
        self.assertLessEqual(len(self.blob), 0x800000)
        self.assertEqual(len(self.entries), 24)

    def test_all_original_emotions_replaced(self):
        original_index = json.loads(self.original['index.json'])
        self.assertEqual({e['name'] for e in original_index['emoji_collection']}, set(self.mapping))
        self.assertEqual({e['name'] for e in self.index['emoji_collection']}, set(self.mapping))
        for item in self.index['emoji_collection']:
            self.assertEqual(item['file'], item['name'] + '.gif')
            self.assertEqual(self.current[item['file']], (OUT / item['file']).read_bytes())
        self.assertFalse(any(n.endswith('.png') for n in self.current))

    def test_voice_and_font_preserved(self):
        for name in ['srmodels.bin','font_puhui_common_30_4.bin']:
            self.assertEqual(self.current[name], self.original[name])
        original_index = json.loads(self.original['index.json'])
        for field in ['version','srmodels','text_font']:
            self.assertEqual(self.index[field], original_index[field])
        expected = {**original_index, 'emoji_collection':self.index['emoji_collection'],
                    'hide_subtitle':True, 'skin':self.index['skin']}
        self.assertEqual(self.index, expected)

    def test_subtitle_and_theme_settings(self):
        self.assertIs(self.index['hide_subtitle'], True)
        for mode in ['light','dark']:
            self.assertEqual(self.index['skin'][mode], {'text_color':'#000000','background_color':'#000000'})

    def test_animation_geometry_motion_and_round_mask(self):
        mask = Image.new('L', (466,466))
        from PIL import ImageDraw
        ImageDraw.Draw(mask).ellipse((2,2,463,463),fill=255)
        outside = ImageChops.invert(mask)
        for name, blob, w, h in self.entries:
            if not name.endswith('.gif'):
                continue
            self.assertEqual((w,h),(466,466))
            with Image.open(io.BytesIO(blob)) as image:
                self.assertEqual(image.size,(466,466))
                self.assertEqual(image.n_frames,16)
                self.assertEqual(image.info['loop'],0)
                unique = set()
                for i in range(image.n_frames):
                    image.seek(i)
                    frame = image.convert('L')
                    unique.add(sha256(frame.tobytes()))
                    self.assertEqual(image.info['duration'],120)
                    bright = frame.point(lambda p: 255 if p > 12 else 0)
                    self.assertIsNone(ImageChops.multiply(bright,outside).getbbox(), name)
                self.assertGreater(len(unique),1,name)

    def test_render_states_and_report_hashes(self):
        render = json.loads((ROOT / 'grok-artwork/render-report.json').read_text('utf-8'))
        for name,spec in self.mapping.items():
            state = render['expressions'][name]['snapshot']
            self.assertEqual(state['state'],spec['state'])
            self.assertEqual(state['mode'],'hold')
            self.assertEqual(state['scheme'],'dark')
            self.assertEqual(sha256(self.current[name+'.gif']), self.report['expressions'][name]['sha256'])
        self.assertEqual(sha256(self.blob),self.report['candidate']['sha256'])
        self.assertEqual(len(self.blob),self.report['candidate']['bytes'])
        self.assertEqual(sha256(self.original_blob),self.report['original_assets_sha256'])

    def test_damage_and_truncation_rejected(self):
        damaged=bytearray(self.blob)
        damaged[-1]^=1
        with self.assertRaises(ValueError):
            parse_assets(damaged)
        with self.assertRaises(ValueError):
            parse_assets(self.blob[:-1])


if __name__ == '__main__':
    unittest.main(verbosity=2)
