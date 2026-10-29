from pathlib import Path
import json,zipfile,shutil,hashlib,xml.etree.ElementTree as ET
from xml.sax.saxutils import escape
import numpy as np
from PIL import Image,ImageDraw,ImageFont
O=Path(__file__).resolve().parents[1];R=O.parents[1];D=R/'modeling/v05/print-delivery-v05';D.mkdir(exist_ok=True)
E=json.loads((O/'reports/export-checks-v05.json').read_text());A=json.loads((O/'reports/assembly-review.json').read_text());M=json.loads((O/'reports/mechanical-checks-v05.json').read_text());NS='http://schemas.microsoft.com/3dmanufacturing/core/2015/02';REL='http://schemas.openxmlformats.org/package/2006/relationships'
for name,e in E.items():shutil.copy2(e['file'],D/name)
def package(name,items):
 resources=[];build=[];occupied=[]
 for idx,(file,x,y) in enumerate(items,1):
  a=np.load(O/f'reports/{file}.npz');v=a['v'];f=a['f'];lo=v.min(0)+[x,y,0];hi=v.max(0)+[x,y,0];assert lo[0]>0 and lo[1]>0 and lo[2]>=-1e-5 and hi[0]<210 and hi[1]<210 and hi[2]<205
  for ll,hh in occupied:assert hi[0]<ll[0] or lo[0]>hh[0] or hi[1]<ll[1] or lo[1]>hh[1]
  occupied.append((lo,hi));verts=''.join(f'<vertex x="{p:.6f}" y="{q:.6f}" z="{r:.6f}"/>' for p,q,r in v);faces=''.join(f'<triangle v1="{p}" v2="{q}" v3="{r}"/>' for p,q,r in f);resources.append(f'<object id="{idx}" name="{escape(file)}" type="model"><mesh><vertices>{verts}</vertices><triangles>{faces}</triangles></mesh></object>');build.append(f'<item objectid="{idx}" transform="1 0 0 0 1 0 0 0 1 {x} {y} 0"/>')
 xml=f'<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="{NS}"><metadata name="Title">AI Tour Guide v05 PLA prototype</metadata><resources>'+''.join(resources)+'</resources><build>'+''.join(build)+'</build></model>'
 with zipfile.ZipFile(D/name,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');z.writestr('_rels/.rels',f'<?xml version="1.0"?><Relationships xmlns="{REL}"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');z.writestr('3D/3dmodel.model',xml)
 with zipfile.ZipFile(D/name) as z:assert z.testzip() is None;tree=ET.fromstring(z.read('3D/3dmodel.model'));assert tree.attrib['unit']=='millimeter' and len(tree.find('{'+NS+'}build'))==len(items)
package('00A_PRINT_FIRST_CLIP_TESTS_v05.3mf',[(f'06_CLIP_TEST_{n}_TENTHS_v05.stl',45+40*(n-2),70) for n in [2,3,4]]+[('05_CLIP_TEST_SOCKET_v05.stl',165,70),('04_RELEASE_TOOL_v05.stl',80,110),('04_RELEASE_TOOL_v05.stl',125,110)])
package('00B_REAL_DEVICE_FIT_TEST_v05.3mf',[('03_FULL_FIT_JIG_v05.stl',60,100),('02_CURVED_SNAP_RING_v05.stl',145,100),('04_RELEASE_TOOL_v05.stl',140,150),('04_RELEASE_TOOL_v05.stl',140,165)])
package('00C_FULL_HOUSING_AND_RING_v05.3mf',[('01_FULL_HOUSING_CLOSED_BACK_v05.stl',60,105),('02_CURVED_SNAP_RING_v05.stl',150,105)])
readme='''# v05：修复前圈曲面；完整背部、前拆卡扣、三个后支柱

这是供实验室 PLA 试装的打印模型，尚未经过真实 StopWatch 装配或卡扣寿命验证。v05 修复了 v04 枫叶下方和前圈周围的波浪、鼓包及下缘拉扯：前圈使用排除装饰物后的帽子基准曲面；主体正面仅局部调整，保留原网格；前圈外边界向内避开枫叶。v03/v04 均保留作历史记录，以 v05 为当前方案。

## 先打印什么

1. `00A_PRINT_FIRST_CLIP_TESTS_v05.3mf`：一个卡槽试片、三档弹性扣试片、两把释放拨片。先尝试 0.3 mm。边缘一条刻痕=0.2 mm，两条=0.3 mm，三条=0.4 mm。刻痕不在弹性臂上。需要更松才试 0.2，更紧才试 0.4；不要靠硬压解决。
2. `00B_REAL_DEVICE_FIT_TEST_v05.3mf`：完整前圈＋真机试装夹具＋两把拨片。默认前圈为 0.3 mm 扣合量。这个夹具保留真实承托端面、三个定位边、按钮避让、卡槽、定位键和前圈相对位置；后方采用简化平底、缩短支柱，便于打印。夹具不是最终吉祥物，也不验证最终长支柱的刚度或背腔声音。
3. 两级小样通过后，打印 `00C_FULL_HOUSING_AND_RING_v05.3mf`。已经通过试装的前圈可以复用，只打印主体 STL 即可。若 0.2/0.4 试片更合适，先把试验结果反馈给建模，再生成对应完整前圈，不能把某一试片的通过当成当前 0.3 mm 完整前圈已通过。

三个 3MF 都是单位明确、已摆放的通用网格包，不包含机器配置、温度或 G-code。选择实验室已经验证的 Anycubic Mega-S / PLA / 实际喷嘴配置。全部按毫米、100% 导入，禁止整体缩放来调松紧。

## 模型结构

- 一体帽子、枫叶、身体；背部封闭，只保留 7 个直径 2.4 mm 的声音孔。声音通过后腔传出，音量效果需真机验证。
- 从后壁向前的三个支柱，端部附短定位边，标称定位圆直径 52.8 mm；整机按 52 × 52 × 15.5 mm，官方原壳与三个按钮的网格共同用于校核。
- 壳体前后定位间的名义总轴向余量约 0.4 mm；上支柱端面跟随官方壳体背部台阶高 0.8 mm。若有轻微晃动，在后支柱端部试贴薄软垫，逐步调整，不能靠前圈压玻璃。
- 前圈内孔 50.5 mm，最大外尺寸 67 mm，外边界在枫叶附近向内避让，外表面顺着帽子基准曲面变化。背面约 1 mm 深的圆形定位边内径 52.8 mm，入口带小倒角，用于限制整机左右晃动。用户用尺子测得塑料边约 2 mm、与玻璃齐平，仍需实物确认前圈仅覆盖塑料边；不能把这次粗测当成精密玻璃尺寸。
- 两条沿圆周展开的弹性臂：有效长度约 16.5 mm、径向厚度 1.2 mm、轴向宽度 3 mm，根部使用圆形连接柱。名义扣合量 0.3 mm，最终松紧以实际打印小样为准。
- 三个按钮在壳内无需操作：只保证安装、存放、取出时不被挤压。调试与充电均取出设备进行，没有外露按钮孔或充电口。

## 安装与拆卸

1. 清除支撑、毛边，确认两个弹性臂周围的空隙贯通。先空装前圈，确认能扣上且能释放，再放真机。
2. 按官方参考方向对准三个按钮的空间，将完整 StopWatch 从正面直线放入，放到三个后支柱上。不要强行压下。
3. 对准前圈上方定位筋，轻按两处卡扣位置，让其回弹进入浅槽。前圈由主体台阶限制深度，不靠玻璃承担卡扣锁紧力。
4. 取出时，把钝头拨片从前圈下方两个小释放口插入，推回凸钩。先解开一侧并保持轻微抬起，再释放另一侧。可用第二把拨片保持第一侧，不要把金属螺丝刀伸向玻璃。
5. 取下前圈后抓住暴露的原壳外缘取出设备。不要从声音孔向内顶，不需要拆后盖。

## 打印与支撑

- 实际喷嘴未确认。若实验室确认使用 0.4 mm 喷嘴，可从 0.2 mm 层高、4 道外墙、4～5 层顶底、15～20% 填充开始；温度、速度沿用该机器和耗材已验证的配置。
- 主体已经脚底朝下、Z=0。封闭后腔、横向支柱、帽口顶部和枫叶悬伸需要检查可拆支撑。切片时确认支撑能从正面清理，不要把不可拆的支撑封在后腔；必须逐层预览，必要时改用能从正面剥离的支撑分区。
- 前圈和弹性扣试片已经按弹性臂平行于打印平台摆放；曲面前圈在弹性臂上方有悬空区域，需要检查支撑或短桥接。不要让支撑与弹性臂、退让缝粘死。先用小试片确认清理方式，不要直接跳过小样。
- 真机试装夹具有平底，可加适量 brim；其顶部卡槽也需检查短桥接与支撑。
- 拨片平放，建议实心打印。尖端为钝边，不是刀片；清除毛边后使用。
- 这些文件尚未在具体切片软件内设置好支撑，也未导出 G-code。模型检查通过不等于打印和装配已经通过。

## 试装记录

记录哪档扣合量合适；空圈反复拆装是否发白、开裂或变松；完整 StopWatch 能否顺利放入、静置和取出；三个按钮是否始终不受压；前圈是否接触玻璃；装好后声音是否够清楚。建议先完成至少 20 次空圈拆装观察，作为本轮原型筛查，不代表寿命认证。不要带真机做破坏或跌落测试。

## 文件与检查边界

STL 只含打印件。Blender 文件中的 `REFERENCE_ONLY_StopWatch_NOT_PRINT` 集合只作参考，绝对不要一起导出打印。预览里的深色圆面是屏幕示意，不是打印件。

几何检查涵盖实体闭合、单一连通体、导出后重新读取、官方外壳/按钮干涉、正面插入路径、按钮连续扫掠、卡扣释放近似运动和工具空间。释放检查使用指定退让位移，不是材料有限元分析；PLA 实际弹性、疲劳、打印误差和粗测玻璃边缘仍需小样验证。
'''
(D/'README_CN_v05.md').write_text(readme,encoding='utf8')
summary={'exports':E,'assembly':A,'mechanical':M,'physical_fit':'PENDING','slicer_supports':'NOT CONFIGURED; user/lab must preview and configure removable supports'}
(D/'CHECKS_v05.json').write_text(json.dumps(summary,indent=2),encoding='utf8')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',32);small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',25)
im=Image.new('RGB',(1600,700),'white');dr=ImageDraw.Draw(im);dr.text((35,22),'v05  修复前圈曲面 · 完整背部 · 从正面拆装',font=font,fill='#20252b')
panels=[('assembled-white','完整外观'),('assembled-back','背部仅留声音孔'),('empty-front-straight','三个后支柱与内部避让'),('ring-back','前圈背面：两个弹性扣')]
for i,(f,label) in enumerate(panels):
 pic=Image.open(O/f'previews/{f}.png').convert('RGB');pic.thumbnail((390,500));x=15+i*397;im.paste(pic,(x,105));dr.text((x+8,560),label,font=small,fill='#20252b')
dr.text((35,630),'模型单位：mm；整机约 76 × 113 × 149。深色屏幕为参考件；实物试装尚未完成。',font=small,fill='#40464d');im.save(D/'MODEL_OVERVIEW_v05.png')
comparison=Image.new('RGB',(1280,720),'white');cd=ImageDraw.Draw(comparison);cd.text((28,18),'相同视角的前圈曲面对比',font=font,fill='#20252b')
for x,version in [(20,'v04'),(650,'v05')]:
 source=O.parent/f'{version}/previews/assembled-white.png';pic=Image.open(source).convert('RGB').crop((165,180,780,700));pic=pic.resize((610,516),Image.Resampling.LANCZOS);comparison.paste(pic,(x,115));cd.text((x+10,75),version+'  '+('修改前' if version=='v04' else '修改后'),font=small,fill='#20252b')
cd.text((30,663),'枫叶附近、右侧和下缘使用同角度模型渲染；不是概念效果图。',font=small,fill='#40464d');comparison.save(D/'V04_V05_SURFACE_COMPARISON.png')
shutil.copy2(O/'assembly-snap-v05.blend',D/'assembly-snap-v05.blend')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in D.iterdir() if p.is_file() and p.name!='MANIFEST_SHA256.json'};(D/'MANIFEST_SHA256.json').write_text(json.dumps(manifest,indent=2))
zip_path=R/'modeling/v05/AI_Tour_Guide_Closed_Back_Snap_v05.zip'
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(D.iterdir()):
  if p.is_file():z.write(p,'print-delivery-v05/'+p.name)
with zipfile.ZipFile(zip_path) as z:assert z.testzip() is None
(R/'docs/history/project-status-20261028-v05.md').write_text('''# v05 项目状态

用户已授权建模：封闭背部，只留小出声孔；从正面安装和取出完整 StopWatch；三个按钮只需避让，不需要壳内操作；取出充电；三根后支柱；前圈沿原曲面，采用隐藏可释放卡扣。此决定替代早先背面开放、螺丝耳和充电开口方案。

本轮完成独立主体和前圈、三档卡扣试片、卡槽试片、真机试装夹具和释放拨片，全部另存 v05。原始输入与旧版本保留。

交付目录：`F:/coding_projects/ai-tour-guide-device/modeling/v05/print-delivery-v05`。主编辑文件：`modeling/v05/assembly-snap-v05.blend`。权威参数：同目录 `parameters/print-v05.json`。详细检查见交付 `CHECKS_v05.json` 和工作目录 reports。

当前为经过数字几何检查的 PLA 原型；未完成真实打印、切片支撑配置、真实 StopWatch 试装、声音效果或卡扣寿命验证。应先打印 00A 卡扣试片，再打印 00B 真机夹具，最后 00C 完整主体。v03 不再作为当前最终外观方案。

网页、后端、固件集成和比赛材料仍沿用既有项目工作线；本轮仅机械建模，没有完成或宣称完成软件对接，没有对外发送、发布或采购。
''',encoding='utf8')
print('V05_PACKAGE_READY',str(zip_path),zip_path.stat().st_size,flush=True)
