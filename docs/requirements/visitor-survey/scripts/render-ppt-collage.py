"""Compose the approved survey charts for the right half of a presentation.

The host presentation declares the synthetic dataset on its opening slide.
This presentation-specific image therefore omits repeated provenance labels.
The original workbook, six figures and report remain unchanged.
"""
from pathlib import Path
import os
import io
import csv
import json
import hashlib

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[2]
WORK = ROOT / '.local-work/survey-ppt-image'
WORK.mkdir(parents=True, exist_ok=True)
os.environ['MPLCONFIGDIR'] = str(WORK / 'mpl-cache')
os.environ['TEMP'] = os.environ['TMP'] = str(WORK / 'tmp')
(WORK / 'tmp').mkdir(exist_ok=True)

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np

SCALE = 2
W, H = 2400, 2640
OUT = BASE / 'figures/06-问卷图表-右侧交错展示.png'
C = dict(ink='#40362D', muted='#86745F', red='#A84333', line='#E8DDCA',
         gold='#E5C98F', gray='#B8AA95', soft='#EFE5D3', paper='#FFFDF7')
font = os.getenv('SURVEY_FONT', 'C:/Windows/Fonts/msyh.ttc')
fm.fontManager.addfont(font)
plt.rcParams.update({'font.family': fm.FontProperties(fname=font).get_name(),
                     'axes.unicode_minus': False})
with (BASE / '选项统计明细.csv').open(encoding='utf-8-sig', newline='') as f:
    source = list(csv.DictReader(f))
assert len(source) == 56
stats = {}
for n in range(1, 15):
    items = [r for r in source if r['题号'] == f'Q{n}']
    assert [r['选项'] for r in items] == list('ABCD')
    stats[n] = (int(items[0]['适用答卷数']), [int(r['选择人数']) for r in items])
    for item, count in zip(items, stats[n][1]):
        assert abs(float(item['选择比例']) - count / stats[n][0]) < 1e-8

texts = []
coverage = []

def text(fig, x, y, value, size=28, color='ink', bold=False, align='left'):
    w, h = fig.logical_size
    texts.append(value)
    artist = fig.text(x / w, 1 - y / h, value, fontsize=size * .72,
                     color=C.get(color, color), weight='bold' if bold else 'normal',
                     ha=align, va='top', linespacing=1.25)
    return artist

def make(w, h, title, eyebrow, badge=None):
    fig = plt.figure(figsize=(w / 100, h / 100), dpi=100 * SCALE)
    fig.patch.set_alpha(0)
    fig.logical_size = (w, h)
    text(fig, 50, 36, eyebrow, 22, 'red', True)
    text(fig, 48, 77, title, 49, bold=True)
    if badge:
        text(fig, w - 50, 44, badge, 25, 'muted', align='right')
    line = plt.Line2D([50 / w, (w - 50) / w], [1 - 145 / h] * 2,
                      transform=fig.transFigure, color=C['line'], linewidth=.8)
    fig.add_artist(line)
    return fig

def group(fig, y, n, title, labels, row=34, label_width=370, size=24):
    w, h = fig.logical_size
    denom, counts = stats[n]
    coverage.append(n)
    text(fig, 50, y, title, 28, bold=True)
    kind = '单选' if n in (1, 2, 12) else '多选'
    text(fig, w - 50, y + 3, f'{kind} · n={denom}', 21, 'muted', align='right')
    start = y + 49
    bar_x = label_width + 50
    bar_w = w - bar_x - 210
    assert bar_w > 200
    ax = fig.add_axes([bar_x / w, 1 - (start + row * 4) / h, bar_w / w, row * 4 / h])
    ax.patch.set_alpha(0)
    ax.set_xlim(0, 100)
    ax.set_ylim(3.5, -.5)
    ax.axis('off')
    colors = [C['red']] * 3 + [C['gray']]
    if n == 12:
        colors = [C['red'], C['muted'], C['gray'], C['gold']]
    ax.barh(range(4), [100] * 4, height=.29, color=C['soft'], zorder=0)
    ax.barh(range(4), [100 * k / denom for k in counts], height=.29, color=colors)
    for i, (label, count) in enumerate(zip(labels, counts)):
        cy = start + row * (i + .5)
        text(fig, 50, cy - size * .61, label, size)
        text(fig, w - 50, cy - size * .61, f'{count} · {count / denom:.1%}', size,
             'muted' if i == 3 else 'ink', align='right')

def finish(fig):
    fig.canvas.draw()
    # Guard against content escaping its panel before perspective/rotation.
    renderer = fig.canvas.get_renderer()
    fw, fh = fig.canvas.get_width_height()
    protect = Image.new('L', (fw, fh))
    pd = ImageDraw.Draw(protect)
    for artist in list(fig.texts) + list(fig.axes):
        box = artist.get_window_extent(renderer)
        assert box.x0 >= 0 and box.y0 >= 0 and box.x1 <= fw and box.y1 <= fh
        pd.rectangle((box.x0, fh - box.y1, box.x1, fh - box.y0), fill=255)
    stream = io.BytesIO()
    fig.savefig(stream, format='png', transparent=True, dpi=100 * SCALE)
    plt.close(fig)
    stream.seek(0)
    content = Image.open(stream).convert('RGBA')
    cw, ch = content.size
    card = Image.new('RGBA', (cw, ch))
    mask = Image.new('L', (cw, ch))
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle((1, 1, cw - 2, ch - 2), 31 * SCALE, fill=255)
    # Subtle paper gradient, white rim and a warm card edge.
    yy = np.linspace(0, 1, ch)[:, None, None]
    top = np.array([255, 254, 249])[None, None, :]
    bottom = np.array([252, 247, 235])[None, None, :]
    rgb = np.broadcast_to((top * (1 - yy) + bottom * yy).astype('uint8'), (ch, cw, 3))
    card.paste(Image.fromarray(rgb), (0, 0), mask)
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle((2, 2, cw - 3, ch - 3), 31 * SCALE, outline='#DCCCB1', width=2 * SCALE)
    draw.rounded_rectangle((5, 5, cw - 6, ch - 6), 29 * SCALE, outline='#FFFFFF', width=SCALE)
    card.alpha_composite(content)
    card.info['protect'] = protect
    return card

cards = {}
f = make(990, 720, '谁在出游', '01 / 出游画像', '76 份答卷')
group(f, 175, 1, '近期经历', ['游玩过栖霞山', '游玩过类似景区', '无经历，有计划', '无经历，无计划'], row=29, label_width=340)
group(f, 350, 2, '同行人数', ['独自出游', '与1人同行', '与2人及以上同行', '未定或记不清'], row=29, label_width=340)
group(f, 525, 3, '同行关系', ['情侣 / 伴侣', '朋友 / 同学 / 同事', '自己照看的孩子', '其他关系 / 未定'], row=29, label_width=340)
cards['sample'] = finish(f)

f = make(1180, 700, '旅行中，想用什么？', 'MAPLE SPRITE / 功能兴趣', 'n=76')
text(f, 50, 172, '路线与设施', 33, bold=True)
route_count = 76 - stats[7][1][3]
text(f, 50, 223, f'{route_count / 76:.1%}', 118, 'red', True)
text(f, 610, 218, f'{route_count} / 76', 49, bold=True)
text(f, 610, 288, '选择了至少一项路线或设施功能', 25, 'muted')
names = ['路线与设施', '拍照参考', '语音互动', '景点体验', '纪念贴纸']
counts = [76 - stats[n][1][3] for n in range(7, 12)]
ax = f.add_axes([.29, .07, .48, .42])
ax.set_xlim(0, 100)
ax.set_ylim(4.5, -.5)
ax.axis('off')
ax.barh(range(5), [100] * 5, height=.27, color=C['soft'])
ax.barh(range(5), [k / 76 * 100 for k in counts], height=.27, color=C['red'])
for i, (name, count) in enumerate(zip(names, counts)):
    y = 700 * (1 - (.07 + .42 * (1 - (i + .5) / 5)))
    text(f, 50, y - 18, name, 29)
    text(f, 1130, y - 18, f'{count} · {count / 76:.1%}', 29, align='right')
cards['overview'] = finish(f)

f = make(1070, 805, '沿途的困扰与期待', '02 / 游玩体验', '多选 · n=62')
group(f, 180, 4, '行程安排', ['景点顺序不好安排', '时长或体力不明确', '找设施或出口费时', '没有上述问题 / 记不清'], row=35, label_width=395)
group(f, 385, 5, '拍照体验', ['不知道合适地点', '构图或姿势没思路', '不容易一起入镜', '没有上述情况 / 未拍照'], row=35, label_width=395)
group(f, 590, 6, '交流与探索', ['想了解景物故事', '想和同行者做活动', '想分享发现或心情', '没有上述想法 / 记不清'], row=35, label_width=395)
cards['pain'] = finish(f)

f = make(1080, 1120, '让每一程更有趣', '03 / 具体功能偏好', '多选 · n=76')
groups = [
    ('路线与设施', ['按时间体力选路线', '选点并查看顺序', '设施与出入口查询', '不需要上述功能']),
    ('拍照参考', ['拍照地点与位置', '构图站位姿势示例', '单人及合影参考', '不需要拍照参考']),
    ('语音与表情互动', ['主动问讲解或设施', '主动分享见闻心情', '与同行者一起互动', '不愿使用上述互动']),
    ('景点体验', ['简短景点故事', '网页剧情选择', '观察与探索小任务', '都不想尝试']),
    ('照片纪念贴纸', ['照片转贴纸风格', '加入枫叶精灵形象', '加地点日期纪念卡', '都不感兴趣'])]
for i, (title, labels) in enumerate(groups):
    group(f, 175 + i * 184, i + 7, title, labels, row=30, label_width=375)
cards['features'] = finish(f)

f = make(1100, 685, '手机之外的陪伴', '04 / 玩偶的额外价值', 'n=76')
group(f, 185, 12, '是否愿意额外携带', ['愿意', '特定场景愿意', '不愿意，网页足够', '先体验再决定'], row=42, label_width=380, size=27)
group(f, 425, 13, '相较网页的吸引力', ['毛绒外观 / 挂件合影', '语音与表情交流', '与同行者共同互动', '暂时没有额外吸引力'], row=42, label_width=380, size=27)
cards['value'] = finish(f)

f = make(1010, 400, '使用之前的顾虑', '05 / 使用顾虑', '多选 · n=76')
group(f, 166, 14, '哪些因素影响使用', ['信息准确实用 / 功能重复', '携带、充电或联网麻烦', '公共说话、打扰或隐私', '暂时没有上述顾虑'], row=37, label_width=415, size=23)
cards['concern'] = finish(f)

assert sorted(coverage) == list(range(1, 15))
assert not any(any(word in t for word in ['模拟', '合成', '非真实']) for t in texts)
canvas = Image.new('RGBA', (W * SCALE, H * SCALE))
protected = Image.new('L', canvas.size)

def place(name, x, y, angle):
    global protected
    card = cards[name]
    # Rotate the entire chart plane, so labels and geometry retain alignment.
    rotated = card.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    cx = (x + card.width / SCALE / 2) * SCALE
    cy = (y + card.height / SCALE / 2) * SCALE
    ox, oy = round(cx - rotated.width / 2), round(cy - rotated.height / 2)
    alpha = rotated.getchannel('A')
    footprint = Image.new('L', canvas.size)
    footprint.paste(alpha, (ox, oy))
    assert ImageChops.multiply(protected, footprint).getbbox() is None, f'{name} covers content'
    rotated_protect = card.info['protect'].rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    placed_protect = Image.new('L', canvas.size)
    placed_protect.paste(rotated_protect, (ox, oy))
    protected = ImageChops.lighter(protected, placed_protect)
    for blur, dx, dy, opacity in [(25, 6, 27, .19), (7, 0, 9, .13)]:
        shadow_mask = Image.new('L', canvas.size)
        shadow_mask.paste(alpha, (ox + dx * SCALE, oy + dy * SCALE))
        shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(blur * SCALE))
        shadow_mask = shadow_mask.point(lambda a: round(a * opacity))
        shadow = Image.new('RGBA', canvas.size, (80, 57, 31, 0))
        shadow.putalpha(shadow_mask)
        canvas.alpha_composite(shadow)
    # A narrow warm rim under the paper provides physical depth.
    rim = Image.new('RGBA', rotated.size, (208, 191, 165, 0))
    rim.putalpha(alpha)
    canvas.alpha_composite(rim, (ox, oy + 5 * SCALE))
    canvas.alpha_composite(rotated, (ox, oy))

place('sample', 105, 85, 4)
place('pain', 80, 860, 2.5)
place('features', 1220, 965, -3)
place('value', 65, 1760, 3)
place('concern', 1240, 2160, -3)
place('overview', 1085, 205, -4)

canvas.save(OUT, dpi=(300, 300), optimize=True)
# Temporary opaque preview is not a second deliverable.
preview = Image.new('RGBA', canvas.size, '#F9F4E9')
preview.alpha_composite(canvas)
preview.convert('RGB').resize((1200, 1320), Image.Resampling.LANCZOS).save(WORK / 'preview.jpg', quality=94)
result = {'file': str(OUT), 'size': list(canvas.size), 'mode': canvas.mode,
          'question_coverage': sorted(coverage), 'all_56_options': True,
          'source_sha256': hashlib.sha256((BASE / '选项统计明细.csv').read_bytes()).hexdigest()}
(WORK / 'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
