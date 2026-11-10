"""Build an experimental Grok asset image, without serial access or firmware patches."""
from pathlib import Path
import hashlib
import io
import json
import math
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat
from build_static_assets import parse_assets, pack_assets, inspect_firmware, FIRMWARE

ROOT = Path(__file__).resolve().parent
ART = ROOT / 'grok-artwork'
OUT = ROOT / 'grok-output'
SIZE = 466
FPS = 8
FRAMES = 16
SOURCE_COMMIT = 'b7e6cd48db4eeba13271c653c38e1ad0f48037b4'
sha = lambda data: hashlib.sha256(data).hexdigest()


def read_frames(name):
    images = []
    for i in range(FRAMES):
        with Image.open(ART / name / f'{i:02d}.png') as image:
            if image.size != (SIZE, SIZE):
                raise ValueError(f'Unexpected frame size: {name}')
            rgb = image.convert('RGB')
            gray = rgb.convert('L')
            edges = [(0, 0, SIZE, 1), (0, SIZE - 1, SIZE, SIZE),
                     (0, 0, 1, SIZE), (SIZE - 1, 0, SIZE, SIZE)]
            if any(gray.crop(box).getextrema()[1] > 12 for box in edges):
                raise ValueError(f'Source rendering clipped: {name}/{i}')
            images.append(rgb)
    return images


def make_animation(images, scale):
    result = []
    for image in images:
        resized = image.resize((round(SIZE * scale), round(SIZE * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (SIZE, SIZE), 'black')
        canvas.paste(resized, ((SIZE - resized.width) // 2, (SIZE - resized.height) // 2))
        result.append(canvas.convert('L').quantize(colors=64, dither=Image.Dither.NONE))
    stream = io.BytesIO()
    result[0].save(stream, format='GIF', save_all=True, append_images=result[1:],
                   duration=120, loop=0, disposal=2, optimize=False)
    return stream.getvalue(), result


def main():
    mapping = json.loads((ROOT / 'grok-mapping.json').read_text('utf-8'))
    firmware = FIRMWARE.read_bytes()
    partition, _, info = inspect_firmware(firmware)
    original = (ROOT / 'output/original-v2.2.6-assets.bin').read_bytes()
    entries = parse_assets(original)
    if pack_assets(entries) != original:
        raise ValueError('Original roundtrip failed')
    if original != firmware[0x800000:0x800000 + len(original)]:
        raise ValueError('Baseline resource mismatch')
    baseline = {n: b for n, b, _, _ in entries}
    index = json.loads(baseline['index.json'])
    names = {item['name'] for item in index['emoji_collection']}
    if names != set(mapping):
        raise ValueError('Mapping must cover all and only original emotions')
    raw = {name: read_frames(name) for name in mapping}
    # One common scale avoids size jumps between expressions. Keep bright pixels inside the circle.
    radius = 0
    for images in raw.values():
        for image in images:
            mask = image.convert('L').point(lambda p: 255 if p > 12 else 0)
            for y in range(SIZE):
                line = mask.crop((0, y, SIZE, y + 1)).getbbox()
                if line:
                    radius = max(radius, math.hypot(line[0] - 232.5, y - 232.5),
                                 math.hypot(line[2] - 1 - 232.5, y - 232.5))
    scale = 220 / radius
    OUT.mkdir(exist_ok=True)
    animations = {}
    checks = {}
    previews = {}
    for name, images in raw.items():
        blob, processed = make_animation(images, scale)
        animations[name + '.gif'] = blob
        (OUT / (name + '.gif')).write_bytes(blob)
        with Image.open(io.BytesIO(blob)) as gif:
            if gif.size != (SIZE, SIZE) or gif.n_frames != FRAMES or gif.info.get('loop') != 0:
                raise ValueError(f'GIF metadata invalid: {name}')
            hashes = set()
            for i in range(gif.n_frames):
                gif.seek(i)
                frame = gif.convert('RGB')
                hashes.add(sha(frame.tobytes()))
                bright = frame.convert('L')
                if bright.getextrema()[1] < 200 or ImageStat.Stat(bright).mean[0] < 3:
                    raise ValueError(f'Blank frame: {name}/{i}')
                for point in [(0, 0), (465, 0), (0, 465), (465, 465)]:
                    if frame.getpixel(point) != (0, 0, 0):
                        raise ValueError(f'Corner clipping risk: {name}')
            if len(hashes) < 2:
                raise ValueError(f'No animation motion: {name}')
            gif.seek(6)
            previews[name] = gif.convert('RGB')
        checks[name] = {'frames': FRAMES, 'frame_duration_ms':120, 'unique_frames':len(hashes),
                        'bytes':len(blob), 'sha256':sha(blob), **mapping[name]}
    replacements = {item['file']: item['name'] + '.gif' for item in index['emoji_collection']}
    for item in index['emoji_collection']:
        item['file'] = item['name'] + '.gif'
    index['hide_subtitle'] = True
    # Supported theme fields conceal ordinary status labels, not firmware emergency popups.
    index['skin'] = {mode: {'text_color':'#000000', 'background_color':'#000000'} for mode in ['light','dark']}
    modified = []
    for name, blob, width, height in entries:
        if name in replacements:
            name = replacements[name]
            blob = animations[name]
            width = height = SIZE
        elif name == 'index.json':
            blob = (json.dumps(index, ensure_ascii=False, indent=2) + '\n').encode()
        modified.append((name, blob, width, height))
    result = pack_assets(modified)
    if len(result) > partition['size']:
        raise ValueError('Asset partition overflow')
    parsed = parse_assets(result)
    current = {n: b for n, b, _, _ in parsed}
    for name in ['srmodels.bin', 'font_puhui_common_30_4.bin']:
        if current[name] != baseline[name]:
            raise ValueError('Model/font unexpectedly changed')
    if len(parsed) != len(entries) or set(current) != {'index.json','srmodels.bin','font_puhui_common_30_4.bin',*animations}:
        raise ValueError('Unexpected entry changes')
    if json.loads(current['index.json']) != index or pack_assets(parsed) != result:
        raise ValueError('Final package roundtrip/index mismatch')
    target = OUT / 'grok-round-v2-candidate-assets.bin'
    target.write_bytes(result)
    if target.read_bytes() != result:
        raise ValueError('Written file mismatch')
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)
    sheet = Image.new('RGB', (5 * 240, 5 * 260), '#242424')
    draw = ImageDraw.Draw(sheet)
    for i, (name, spec) in enumerate(mapping.items()):
        x, y = i % 5 * 240, i // 5 * 260
        sheet.paste(previews[name].resize((224,224),Image.Resampling.LANCZOS), (x+8,y))
        draw.text((x+8,y+226),name+' > '+spec['state'],font=font,fill='white')
        draw.text((x+8,y+246),'~' if spec['match'].startswith('approximate') else '=',font=font,fill='#a7bca7')
    sheet.save(OUT / 'expression-map-preview.png')
    report = {
        'status':'host_validated_hardware_test_pending', 'source_commit':SOURCE_COMMIT,
        'baseline':info, 'baseline_sha256':sha(firmware), 'original_assets_sha256':sha(original),
        'flash_offset':'0x800000', 'partition_size_bytes':partition['size'],
        'candidate':{'filename':target.name,'bytes':len(result),'sha256':sha(result)},
        'canvas':[SIZE,SIZE], 'common_scale':scale, 'source_max_radius':radius,
        'expressions':checks,
        'preserved':{n:sha(baseline[n]) for n in ['srmodels.bin','font_puhui_common_30_4.bin']},
        'checks':['all 21 emotions mapped','GIF dimensions, frames, looping, nonblank, motion',
                  'original and new byte-identical repacking','checksum and offsets validated',
                  'model and font unchanged','partition bounds','file readback'],
        'limitations':[
            'Not visually reviewed by an image-capable model; user preview approval required.',
            'No device flashing or readback performed; rendering speed and memory untested.',
            '466px image canvas is not proof that vendor firmware displays it full-screen.',
            'hide_subtitle and black theme hide ordinary text only if vendor code honors them.',
            'Top-bar overlays and emergency/boot/configuration text can remain; strict no-text requires firmware changes.',
            'Approximate mappings are explicitly marked; no native tears, kiss, hearts or sunglasses.',
            'Baked 1.92-second loops do not preserve live physics or pointer interaction.',
            'Upstream README restricts use to learning; do not publish or redistribute derived assets.'
        ]
    }
    (OUT / 'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report['candidate'],indent=2))
    print('PASS: 21 animations, models/font unchanged, roundtrip, checksums, bounds, output readback')


if __name__ == '__main__':
    main()
