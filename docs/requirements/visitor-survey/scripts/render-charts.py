"""Render six descriptive survey figures from the archived synthetic workbook.

Python dependencies: matplotlib, openpyxl, numpy, pypdf.
No web requests or questionnaire submissions. Source answers are never modified.
"""
from pathlib import Path
import os
import sys
import json
import csv
import hashlib
import math
from collections import Counter

ARCHIVE = Path(__file__).resolve().parents[1]
PROJECT = ARCHIVE.parents[2]
WORK = PROJECT / '.local-work/survey-figures'
WORK.mkdir(parents=True, exist_ok=True)
os.environ['MPLCONFIGDIR'] = str(WORK / 'mpl-cache')
os.environ['XDG_CACHE_HOME'] = str(WORK / 'cache')
os.environ['TMPDIR'] = os.environ['TEMP'] = os.environ['TMP'] = str(WORK / 'tmp')
(WORK / 'tmp').mkdir(exist_ok=True)
sys.dont_write_bytecode = True

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.patches import FancyBboxPatch
from matplotlib.lines import Line2D
from matplotlib.backends.backend_pdf import PdfPages
import numpy as np
import openpyxl
from pypdf import PdfReader

SOURCE = ARCHIVE / '枫叶精灵-76份模拟答卷.xlsx'
FIGURES = ARCHIVE / 'figures'
FIGURES.mkdir(exist_ok=True)
PDF = ARCHIVE / '问卷可视化报告-模拟数据.pdf'
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
book = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
data = list(book.worksheets[0].values)[1:]
book.close()
assert len(data) == 76 and len({row[1] for row in data}) == 76
assert all(row[2] == '模拟数据' for row in data)
questions = json.loads((ARCHIVE / 'questionnaire.json').read_text(encoding='utf-8'))['questions']
stats = {}
for q in questions:
    n = q['n']
    answers = [row[n + 3] for row in data if row[n + 3] is not None]
    counts = Counter(code for answer in answers for code in str(answer).split(';'))
    stats[n] = {'n': len(answers), 'counts': {k: counts[k] for k in 'ABCD'}}
for row in data:
    q = row[4:18]
    assert (q[2] is None) == (q[1] == 'A')
    for i in (3, 4, 5):
        assert (q[i] is None) == (q[0] in ('C', 'D'))
    for i, answer in enumerate(q):
        if answer is None:
            assert i in (2, 3, 4, 5)
            continue
        codes = answer.split(';')
        assert set(codes) <= set('ABCD') and len(codes) == len(set(codes))
        if i in (0, 1, 11):
            assert len(codes) == 1
        if i != 2 and 'D' in codes:
            assert len(codes) == 1
    if row[18]:
        assert q[2] is not None and 'D' in q[2]
    if row[19]:
        assert q[11] == 'B'
assert [stats[i]['n'] for i in (1, 3, 4, 5, 6, 12)] == [76, 60, 62, 62, 62, 76]
assert sum(stats[12]['counts'].values()) == 76

# Confirm that the archived generator reproduces every original record, if run.
regenerated = WORK / 'regenerated-rows.json'
if regenerated.exists():
    expected = json.loads(regenerated.read_text(encoding='utf-8-sig'))
    actual = []
    for row in data:
        row = list(row)
        row[3] = row[3].strftime('%Y-%m-%dT00:00:00.000Z')
        actual.append(row)
    assert expected == actual, 'Archived generation script changed the approved answers.'

with (ARCHIVE / '选项统计明细.csv').open('w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow(['数据性质', '题号', '题型', '完整题目', '选项', '完整选项', '选择人数', '适用答卷数', '选择比例', '跳过答卷数'])
    for q in questions:
        n = q['n']
        for i, code in enumerate('ABCD'):
            count = stats[n]['counts'][code]
            writer.writerow(['模拟数据', f'Q{n}', '多选' if q['multi'] else '单选', q['title'], code,
                             q['options'][i], count, stats[n]['n'], f'{count / stats[n]["n"]:.8f}', 76 - stats[n]['n']])

# Palette taken from the user-supplied autumn interface design.
C = {'bg': '#EEE5D3', 'paper': '#FFFAF0', 'card': '#FFFDF7', 'ink': '#40362D',
     'muted': '#786855', 'red': '#A84333', 'line': '#DFD2B8', 'gold': '#F5E4BC',
     'softred': '#F7E7DC', 'taupe': '#B3A48D'}
font_path = os.getenv('SURVEY_FONT')
if not font_path:
    font_path = next((p for p in ['C:/Windows/Fonts/msyh.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'] if Path(p).exists()), None)
if not font_path:
    raise RuntimeError('Set SURVEY_FONT to an installed Chinese TrueType/OpenType font.')
fm.fontManager.addfont(font_path)
font_name = fm.FontProperties(fname=font_path).get_name()
plt.rcParams.update({'font.family': font_name, 'font.size': 11, 'axes.unicode_minus': False,
                     'pdf.fonttype': 42, 'ps.fonttype': 42, 'svg.fonttype': 'path',
                     'savefig.facecolor': C['bg']})

ALL_FIGURES = []
def text(fig, x, y, value, size=11, color='ink', weight='normal', **kwargs):
    return fig.text(x, y, value, fontsize=size, color=C.get(color, color), weight=weight,
                    va=kwargs.pop('va', 'center'), **kwargs)

def base(index, title, subtitle):
    fig = plt.figure(figsize=(16, 9), facecolor=C['bg'])
    text(fig, .045, .948, '枫叶精灵 / 出游体验问卷', 11, 'red', 'bold')
    text(fig, .955, .948, '模拟数据 · 非真实游客调查', 10.5, 'red', ha='right')
    text(fig, .045, .879, title, 27, 'ink', 'bold')
    text(fig, .045, .826, subtitle, 11, 'muted')
    fig.add_artist(Line2D([.045, .955], [.795, .795], transform=fig.transFigure, color=C['line'], lw=1))
    fig.add_artist(Line2D([.045, .955], [.078, .078], transform=fig.transFigure, color=C['line'], lw=1))
    text(fig, .045, .043, '来源：76条程序生成的模拟答卷；仅用于统计与呈现演示。人数为整数，百分比四舍五入至1位小数。', 9, 'muted')
    text(fig, .955, .043, f'{index + 1:02d} / 06', 10, 'muted', ha='right')
    return fig

def panel(fig, x, y, w, h):
    fig.add_artist(FancyBboxPatch((x, y), w, h, boxstyle='round,pad=0,rounding_size=0.012',
                                 transform=fig.transFigure, facecolor=C['card'], edgecolor=C['line'], lw=.8, zorder=0))

def bars(fig, rect, title, labels, counts, denominator, note, colors=None, compact=False):
    x, y, w, h = rect
    panel(fig, x, y, w, h)
    text(fig, x + .018, y + h - .037, title, 12.5 if compact else 14, 'ink', 'bold')
    text(fig, x + .018, y + h - .075, note, 9.1, 'muted')
    bottom = y + .055
    plot_h = h - .165
    ax = fig.add_axes([x + w * .455, bottom, w * .505, plot_h], facecolor=C['card'], zorder=2)
    positions = np.arange(len(counts))
    percentages = np.array(counts) / denominator * 100
    colors = colors or [C['red']] * (len(counts) - 1) + [C['taupe']]
    ax.barh(positions, percentages, height=.48, color=colors, zorder=3)
    ax.set_xlim(0, 132)
    ax.set_ylim(len(counts) - .45, -.55)
    ax.set_yticks([])
    ax.set_xticks([0, 50, 100], ['0%', '50%', '100%'], fontsize=8.3, color=C['muted'])
    ax.tick_params(axis='x', length=0, pad=7)
    ax.grid(axis='x', color=C['line'], alpha=.6, linewidth=.6, zorder=0)
    for spine in ax.spines.values():
        spine.set_visible(False)
    for i, (label, count, pct) in enumerate(zip(labels, counts, percentages)):
        yf = bottom + plot_h * (1 - ((i + .55) / (len(counts) + .1)))
        text(fig, x + .018, yf, label, 10.1 if compact else 11, linespacing=1.4)
        ax.text(pct + 2.5, i, f'{count}人  {pct:.1f}%', va='center', fontsize=8.8 if compact else 9.5, color=C['ink'])
    return ax

def qbars(fig, rect, n, title, labels, **kwargs):
    return bars(fig, rect, title, labels, list(stats[n]['counts'].values()), stats[n]['n'],
                f'Q{n} · {"多选" if questions[n-1]["multi"] else "单选"} · 适用答卷 n={stats[n]["n"]}', **kwargs)

def save(fig, slug, pdf):
    fig.savefig(FIGURES / f'{slug}.png', dpi=200)
    fig.savefig(FIGURES / f'{slug}.svg')
    pdf.savefig(fig, facecolor=C['bg'])
    ALL_FIGURES.append(slug)
    plt.close(fig)

with PdfPages(PDF, metadata={'Title': '枫叶精灵问卷可视化报告（模拟数据）', 'Author': '项目团队',
                            'Subject': '76条合成答卷的描述统计，不代表真实游客需求'}) as pdf:
    fig = base(0, '功能兴趣与玩偶价值，分别观察', '本页汇总功能兴趣及携带意愿；全部数字来自同一份模拟答卷，不代表真实游客结论。')
    for x, number, label, detail in [(.045, 76, '模拟答卷', '所有记录均有模拟标记'), (.355, 62, '经历题适用记录', 'Q4-Q6，另14条按逻辑跳过'), (.665, 60, '同行关系适用记录', 'Q3，另16条为独自出游')]:
        panel(fig, x, .642, .29, .115)
        text(fig, x + .018, .703, str(number), 29, 'red', 'bold')
        text(fig, x + .077, .718, label, 12, 'ink', 'bold')
        text(fig, x + .077, .679, detail, 9, 'muted')
    interest = [76 - stats[n]['counts']['D'] for n in range(7, 12)]
    bars(fig, (.045, .154, .51, .46), '功能类别中的任一选项被选择',
         ['路线与设施 Q7', '拍照参考 Q8', '语音互动 Q9', '景点体验 Q10', '纪念贴纸 Q11'], interest, 76,
         'n=76；同题A/B/C任一项计1人，类别之间不相加。', colors=[C['red']]*5)
    qbars(fig, (.575, .154, .38, .46), 12, '是否额外携带玩偶',
          ['愿意', '特定场景愿意', '网页已足够', '先体验再决定'],
          colors=[C['red'], C['muted'], C['taupe'], C['gold']])
    text(fig, .045, .113, '口径提醒：有功能兴趣，不等于愿意携带玩偶；“先体验再决定”不计入愿意。', 10.2, 'muted')
    save(fig, '00_总览_模拟数据', pdf)

    fig = base(1, '这76条模拟记录由哪些场景组成？', '经历与同行人数为单选；同行关系为多选，同一记录可能属于多个关系类别。')
    qbars(fig, (.045,.205,.29,.55), 1, '近期游玩经历', ['游玩过栖霞山', '游玩过类似景区', '无经历，有计划', '无经历，无计划'], compact=True,
          colors=[C['red'],C['muted'],C['taupe'],C['gold']])
    qbars(fig, (.355,.205,.29,.55), 2, '同行人数', ['独自出游', '与1人同行', '与2人及以上同行', '未定或记不清'], compact=True,
          colors=[C['red'],C['red'],C['red'],C['taupe']])
    qbars(fig, (.665,.205,.29,.55), 3, '同行关系', ['情侣 / 伴侣', '朋友 / 同学 / 同事', '自己照看的孩子', '其他关系 / 未定'], compact=True)
    text(fig, .045,.144,'Q1、Q2的分布由生成规则预设，用于覆盖不同分支；不是现场招募比例或真实用户画像。',10.4,'muted')
    text(fig, .045,.109,'Q3以60条适用记录为分母；多选合计可能超过100%，不把各关系人数相加当作总人数。',10.4,'muted')
    save(fig, '01_模拟样本构成', pdf)

    fig = base(2, '经历题：问题与想法分别呈现', '以下三题均以62条适用记录为分母；“没有 / 记不清”等排除项完整保留。')
    qbars(fig,(.045,.205,.29,.55),4,'行程中的问题',['景点顺序不好安排','时长或体力不明确','找设施或出口费时','没有上述问题\n或记不清'],compact=True)
    qbars(fig,(.355,.205,.29,.55),5,'拍照时的情况',['不知道合适地点','构图或姿势没思路','不容易一起入镜','没有上述情况\n或未拍照'],compact=True)
    qbars(fig,(.665,.205,.29,.55),6,'游玩中的想法',['想了解景物故事','想和同行者做活动','想分享发现或心情','没有上述想法\n或记不清'],compact=True)
    text(fig,.045,.144,'三题均为多选，A/B/C之间可以同时选择；D与其他选项互斥。跳过题目不计为“没有需求”。',10.4,'muted')
    text(fig,.045,.109,'D包含不同情形，不能进一步拆算“没有问题”“没有拍照”或“记不清”各自的比例。',10.4,'muted')
    save(fig, '02_游玩问题与想法', pdf)

    fig = base(3, '功能偏好：保留每一个具体选项', 'Q7-Q11均为多选，分母均为76；横轴统一为选择比例，选项保持问卷顺序。')
    cells=[(.045,.455,.29,.30),(.355,.455,.29,.30),(.665,.455,.29,.30),(.045,.12,.29,.30),(.355,.12,.29,.30)]
    labels=[['按时间体力选路线','选点并查看顺序','设施与出入口查询','不需要上述功能'],
            ['拍照地点与位置','构图站位姿势示例','单人及合影参考','不需要拍照参考'],
            ['主动问讲解或设施','主动分享见闻心情','与同行者一起互动','不愿使用上述互动'],
            ['简短景点故事','网页剧情选择','观察与探索小任务','都不想尝试'],
            ['照片转贴纸风格','加入枫叶精灵形象','加地点日期纪念卡','都不感兴趣']]
    for rect,n,title,lab in zip(cells,range(7,12),['路线与设施','拍照参考','语音与表情互动','景点体验','照片纪念贴纸'],labels):
        qbars(fig,rect,n,title,lab,compact=True)
    panel(fig,.665,.12,.29,.30)
    text(fig,.685,.377,'如何阅读这些结果',13,'ink','bold')
    for y,line in [(.325,'每条标签显示人数与比例。'),(.279,'多选合计可以超过100%。'),(.233,'兴趣不等于功能使用效果。'),(.187,'不能据此推断购买或付费意愿。')]:
        text(fig,.685,y,line,10.5,'muted')
    save(fig, '03_功能偏好', pdf)

    fig = base(4, '手机之外，玩偶增加了什么？', 'Q12询问携带意愿，Q13询问额外吸引力；两题不能互相替代。')
    qbars(fig,(.045,.255,.445,.50),12,'额外携带玩偶的意愿',['愿意','只在特定场景愿意','不愿意，网页足够','先体验后再决定'],colors=[C['red'],C['muted'],C['taupe'],C['gold']])
    qbars(fig,(.51,.255,.445,.50),13,'相较网页的额外吸引力',['毛绒外观、挂件合影','语音与表情交流','与同行者共同互动','暂时没有额外吸引力'])
    panel(fig,.045,.12,.91,.10)
    text(fig,.065,.184,'意愿与吸引力可以不同',12,'red','bold')
    carry = stats[12]['counts']
    text(fig,.065,.145,f'“愿意”{carry["A"]}人；“特定场景愿意”{carry["B"]}人；“不愿意”{carry["C"]}人；“待体验”{carry["D"]}人。喜欢某个特征，也可能不愿额外携带。',10.5)
    save(fig, '04_玩偶额外价值', pdf)

    fig = base(5, '使用顾虑：把改进方向看清楚', 'Q14为多选，分母为76；每个选项描述一类顾虑，不能拆成更细的独立比例。')
    qbars(fig,(.045,.195,.59,.56),14,'可能减少或阻止使用的因素',
          ['信息准确性、实用性\n或与现有工具重复','携带、充电\n或联网麻烦','公共场合说话、打扰\n或隐私顾虑','暂时没有上述顾虑'])
    panel(fig,.66,.195,.295,.56)
    text(fig,.68,.713,'解释边界',14,'ink','bold')
    for y,title,body in [(.625,'按选项大类报告','不能单独声称某比例担心重量、\n续航、识别率或隐私。'),
                         (.463,'允许多种顾虑并存','同一记录可选多个顾虑；\n人数与比例不直接相加。'),
                         (.301,'与真实测试区分','本报告是模拟结果展示，\n不能代替设备或游客使用验收。')]:
        text(fig,.68,y,title,11.5,'red','bold')
        text(fig,.68,y-.058,body,10.5,'muted',linespacing=1.6)
    text(fig,.045,.126,'报告范围：仅描述这76条合成记录，不进行显著性检验、置信区间估计或真实游客总体推断。',10.4,'muted')
    save(fig, '05_使用顾虑', pdf)

assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == source_hash
pdf = PdfReader(PDF)
assert len(pdf.pages) == 6
for page in pdf.pages:
    assert '模拟' in page.extract_text(), 'Missing simulation label in PDF page.'
for slug in ALL_FIGURES:
    assert (FIGURES / f'{slug}.png').stat().st_size > 10000
    assert '<svg' in (FIGURES / f'{slug}.svg').read_text(encoding='utf-8')[:1000]
result = {'records':len(data),'source_sha256':source_hash,'pdf_pages':len(pdf.pages),
          'figures':ALL_FIGURES,'statistics':stats,'checks':'skip rules, exclusivity, source unchanged, 6 PDF pages, PNG/SVG pairs passed'}
(WORK / 'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'records':len(data),'pdf_pages':len(pdf.pages),'figure_pairs':len(ALL_FIGURES),'checks':'passed'},ensure_ascii=False))
