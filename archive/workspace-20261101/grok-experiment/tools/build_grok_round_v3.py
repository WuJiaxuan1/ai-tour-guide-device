"""Offline Grok round-screen resources. Never opens a serial port."""
from pathlib import Path
import hashlib
import html
import io
import json
import math
import struct
from PIL import Image, ImageChops, ImageDraw, ImageFont
from build_static_assets import parse_assets, pack_assets, inspect_firmware, FIRMWARE
from build_grok_assets import read_frames, make_animation, SOURCE_COMMIT, SIZE

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'grok-round-v3'
sha = lambda data: hashlib.sha256(data).hexdigest()
LABELS = dict(zip(
    ['neutral','happy','laughing','sad','angry','confused','thinking','surprised','sleepy',
     'confident','embarrassed','shocked','funny','silly','relaxed','cool','loving','kissy',
     'crying','delicious','winking'],
    ['默认','开心','大笑','难过','生气','困惑','思考','惊讶','困倦','自信','害羞','震惊',
     '搞怪','傻笑','放松','酷','喜爱','亲吻','哭泣','美味','眨眼']))


def blank_text_font(blob):
    """Zero only the verified uncompressed 4bpp glyph plane of this exact CBin font.

    CBin loader relocates pointers relative to the descriptor. Retain every pointer,
    character map, glyph metric and kerning value; alpha=0 makes text transparent.
    See vendor/src_cbin_font.c and vendor/lv_font_fmt_txt-v9.3.h.
    """
    if sha(blob) != '21f517503683dba20172bde4cff2e45ccdf496e713ecd1b8ce1eb09f12d9f6e2':
        raise ValueError('Unsupported baseline text font')
    descriptor, = struct.unpack_from('<I',blob,24)
    bitmap,glyphs,cmaps,kern,kern_scale,flags = struct.unpack_from('<IIIIHH',blob,descriptor)
    bpp,fmt,cmap_count = (flags>>9)&15,flags>>14,flags&511
    start,end = descriptor+bitmap,descriptor+glyphs
    glyph_end = descriptor+cmaps
    if descriptor != 36 or bpp != 4 or fmt != 0 or cmap_count != 27:
        raise ValueError('Unsupported CBin layout or compressed glyphs')
    if not (descriptor+24 < start < end < glyph_end < len(blob)) or (glyph_end-end)%16:
        raise ValueError('Invalid CBin glyph bounds')
    count = (glyph_end-end)//16
    nonempty = 0
    for i in range(count):
        offset,advance,w,h,x,y = struct.unpack_from('<IIHHhh',blob,end+i*16)
        if offset+(w*h*bpp+7)//8 > end-start or w>128 or h>128:
            raise ValueError(f'Glyph bitmap out of bounds: {i}')
        nonempty += bool(w*h)
    result = blob[:start]+bytes(end-start)+blob[end:]
    return result, {'method':'transparent 4bpp glyph bitmap; metrics/maps/kerning untouched',
                    'bitmap_start':start,'bitmap_end':end,'glyph_count':count,
                    'nonempty_glyphs':nonempty,'source_sha256':sha(blob),'sha256':sha(result),
                    'font_source_commit':'d45dbc64052d57048f20ab1770074172ce9eb53b'}


def max_radius(images):
    radius = 0
    for image in images:
        mask = image.convert('L').point(lambda p: 255 if p > 12 else 0)
        for y in range(SIZE):
            line = mask.crop((0,y,SIZE,y+1)).getbbox()
            if line:
                radius = max(radius, math.hypot(line[0]-232.5,y-232.5),
                             math.hypot(line[2]-1-232.5,y-232.5))
    if not radius:
        raise ValueError('Blank source animation')
    return radius


def main():
    OUT.mkdir(exist_ok=True)
    mapping = json.loads((ROOT/'grok-mapping.json').read_text('utf-8'))
    firmware = FIRMWARE.read_bytes()
    partition, _, info = inspect_firmware(firmware)
    original = (ROOT/'output/original-v2.2.6-assets.bin').read_bytes()
    entries = parse_assets(original)
    baseline = {n:b for n,b,_,_ in entries}
    if pack_assets(entries) != original or original != firmware[0x800000:0x800000+len(original)]:
        raise ValueError('Baseline mismatch')
    index = json.loads(baseline['index.json'])
    if {e['name'] for e in index['emoji_collection']} != set(mapping):
        raise ValueError('Mapping coverage mismatch')
    circle = Image.new('L',(SIZE,SIZE))
    ImageDraw.Draw(circle).ellipse((2,2,463,463),fill=255)
    outside = ImageChops.invert(circle)
    animations, checks, previews = {}, {}, {}
    for name,spec in mapping.items():
        images = read_frames(name)
        radius = max_radius(images)
        # One scale per expression, fixed throughout its loop. Preserve all source FX.
        scale = 224 / radius
        blob, _ = make_animation(images,scale)
        with Image.open(io.BytesIO(blob)) as gif:
            if gif.size != (SIZE,SIZE) or gif.n_frames != 16 or gif.info.get('loop') != 0:
                raise ValueError('GIF metadata mismatch')
            hashes = set()
            for i in range(gif.n_frames):
                gif.seek(i)
                gray = gif.convert('L')
                hashes.add(sha(gray.tobytes()))
                bright = gray.point(lambda p:255 if p>12 else 0)
                if ImageChops.multiply(bright,outside).getbbox() is not None:
                    raise ValueError(f'Outside round display: {name}/{i}')
                if gray.getextrema()[1] < 200:
                    raise ValueError(f'Blank frame: {name}/{i}')
            if len(hashes) < 2:
                raise ValueError('No motion')
            gif.seek(6)
            previews[name] = gif.convert('RGB')
        (OUT/(name+'.gif')).write_bytes(blob)
        animations[name+'.gif'] = blob
        checks[name] = {**spec,'label':LABELS[name],'scale':scale,'source_max_radius':radius,
                       'frames':16,'frame_duration_ms':120,'unique_frames':len(hashes),
                       'bytes':len(blob),'sha256':sha(blob)}
    replacements = {e['file']:e['name']+'.gif' for e in index['emoji_collection']}
    for e in index['emoji_collection']:
        e['file'] = e['name']+'.gif'
    index['hide_subtitle'] = True
    index['skin'] = {mode:{'text_color':'#000000','background_color':'#000000'}
                     for mode in ['light','dark']}
    silent_font,font_report = blank_text_font(baseline['font_puhui_common_30_4.bin'])
    modified = []
    for name,blob,w,h in entries:
        if name in replacements:
            name = replacements[name]
            blob,w,h = animations[name],SIZE,SIZE
        elif name == 'index.json':
            blob = (json.dumps(index,ensure_ascii=False,indent=2)+'\n').encode()
        elif name == 'font_puhui_common_30_4.bin':
            blob = silent_font
        modified.append((name,blob,w,h))
    result = pack_assets(modified)
    current = {n:b for n,b,_,_ in parse_assets(result)}
    if len(result)>partition['size'] or pack_assets(parse_assets(result)) != result:
        raise ValueError('Package validation failed')
    for name in ['srmodels.bin']:
        if current[name] != baseline[name]:
            raise ValueError('Voice model changed')
    target = OUT/'grok-round-v3-assets.bin'
    target.write_bytes(result)
    report = {
        'status':'host_validated_device_test_pending','source_commit':SOURCE_COMMIT,
        'm5_source_reference_commit':'356541a94d6ea73f291388eb028a670e6c75f2f3',
        'm5_source_identity':'StopWatch support commit; binary-to-source identity not proven',
        'baseline':info,'baseline_sha256':sha(firmware),'original_assets_sha256':sha(original),
        'flash_offset':'0x800000','partition_size_bytes':partition['size'],
        'candidate':{'filename':target.name,'bytes':len(result),'sha256':sha(result)},
        'canvas':[SIZE,SIZE],'expressions':checks,
        'preserved':{'srmodels.bin':sha(baseline['srmodels.bin'])},'silent_text_font':font_report,
        'visual_review':'21-expression contact sheet and sampled frames reviewed; not a device render',
        'limitations':[
            'Not flashed or tested on hardware. GIF speed, memory and exact layout need device testing.',
            'hide_subtitle requests no conversation captions. Transparent text font hides ordinary labels after assets load.',
            'Boot text before assets load, alternate built-in fonts, missing-character placeholders and firmware popups may remain.',
            'Top bar can dim or obscure the image. A strict full-screen, text-free UI requires firmware changes.',
            'Near-full-circle artwork bounds do not prove the firmware displays the image at native size.',
            'Fixed 1.92s loops replace the interactive JavaScript physics.',
            'Approximate mappings lack original tears, kiss, heart and sunglasses.',
            'Original wake word preserved. No custom wake word included.'
        ]}
    (OUT/'validation-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
    (OUT/'expression-mapping.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n','utf-8')
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18)
    small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',14)
    sheet = Image.new('RGB',(5*244,5*278),'#222222')
    draw = ImageDraw.Draw(sheet)
    cards = []
    for i,(name,spec) in enumerate(mapping.items()):
        x,y = i%5*244,i//5*278
        p = previews[name].resize((228,228),Image.Resampling.LANCZOS)
        sheet.paste(p,(x+8,y+4))
        draw.ellipse((x+8,y+4,x+235,y+231),outline='#555555',width=1)
        draw.text((x+8,y+234),f'{LABELS[name]} / {name}',font=font,fill='white')
        kind = '直接' if spec['match']=='direct' else '动作' if spec.get('wink') else '近似'
        draw.text((x+8,y+258),f"→ {spec['state']}（{kind}）",font=small,fill='#b9c9c0')
        cards.append(f'<article><img src="{name}.gif" alt="{html.escape(LABELS[name])}"><p>{LABELS[name]} / {name}</p><small>→ {html.escape(spec["state"])} · {kind}</small></article>')
    sheet.save(OUT/'expression-map-preview.png')
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>StopWatch Grok 表情预览</title><style>body{background:#17191d;color:#eee;font:16px system-ui;margin:32px auto;max-width:1200px;padding:0 20px}h1{font-size:26px}header p{line-height:1.7;color:#c4cad2}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:18px}article{background:#23262c;padding:14px;border-radius:14px}img{width:100%;aspect-ratio:1;border-radius:50%;border:1px solid #646870;background:#000}p{margin:10px 0 6px}small{color:#b8cabb}</style><header><h1>21 个 Grok 表情 · 圆屏资源 v3</h1><p>黑底白色角色，466×466；16 帧循环。此页仅预览素材，文字说明不会画进 GIF。各表情按动作范围放大，带轨迹的表情主体可能较小。</p><p>尚未进行真机测试。隐藏对话字幕并将普通文字字体设为透明字形；顶部覆盖层仍可能遮挡形象，开机/特殊字体提示仍可能出现。原唤醒词保持不变。</p><p>来源：<a href="https://github.com/blessonism/grok-icon-study" style="color:#a8c9ff">grok-icon-study</a>，仅供本地学习测试。</p></header><main>'''+''.join(cards)+'</main></html>'
    (OUT/'preview.html').write_text(page,'utf-8')
    if target.read_bytes() != result or FIRMWARE.read_bytes() != firmware:
        raise ValueError('Output/baseline readback mismatch')
    print(json.dumps(report['candidate'],indent=2))
    print('PASS: 21 animations, circle bounds, voice model preserved, transparent text font, roundtrip, checksum, partition bounds')


if __name__ == '__main__':
    main()
