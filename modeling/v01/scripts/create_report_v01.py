from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,hashlib,struct
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=Path(__file__).resolve().parents[1]
p=json.loads((O/'parameters-v01.json').read_text(encoding='utf-8-sig'));q=json.loads((O/'reports/layout-checks-v01.json').read_text())
fontpath='C:/Windows/Fonts/msyh.ttc'
def font(n):return ImageFont.truetype(fontpath,n)
im=Image.new('RGB',(1920,1530),'#f5f6f8');d=ImageDraw.Draw(im)
d.text((48,30),'StopWatch 首轮装配与尺寸检查',font=font(44),fill='#152535')
d.text((48,93),'2026-10-28  |  单位 mm  |  灰色主体，蓝色官方壳体参照  |  草案，禁止直接打印',font=font(24),fill='#516173')
views=[('before-front','原孔与设备重叠（正面）'),('draft-front','扩孔草案（正面）'),('draft-rear','扩孔草案（背面）'),('draft-right','扩孔草案（正右侧）')]
for i,(file,title) in enumerate(views):
 x=40+i*470;d.rounded_rectangle((x,145,x+450,705),12,fill='white');pic=Image.open(O/f'previews/{file}.png');pic.thumbnail((438,482));im.paste(pic,(x+(450-pic.width)//2,156));d.text((x+12,655),title,font=font(23),fill='#263747')
d.text((48,730),'外观草案：高 150.00 × 宽 113.18 × 深 75.93；150 mm 是评估值，尚未锁定。',font=font(25),fill='#263747')
# Actual triangulated center-plane intersections, not a perspective rendering.
for j,key in enumerate(['before','after']):
 x0=40+j*940;y0=790;d.rounded_rectangle((x0,y0,x0+920,y0+515),12,fill='white')
 d.text((x0+20,y0+15),'安装区剖面 Y = -0.027 mm：'+('原孔' if key=='before' else '扩孔草案'),font=font(26),fill='#263747')
 cx=x0+460;cy=y0+300;sc=3.4
 def xy(x,z):return (cx+x*sc,cy-z*sc)
 for line in np.load(O/f'reports/section-{key}.npy'):
  a,b=line.copy(); dz=b[1]-a[1]
  if abs(dz)<1e-9:
   if not -15<=a[1]<=65:continue
  else:
   ta,tb=sorted([(-15-a[1])/dz,(65-a[1])/dz]);ta=max(0,ta);tb=min(1,tb)
   if ta>tb:continue
   aa=a+(b-a)*ta;bb=a+(b-a)*tb;a,b=aa,bb
  d.line([xy(*a),xy(*b)],fill='#6b7681',width=2)
 z=p['axis_z'];x1,z1=xy(10,z+26);x2,z2=xy(25.5,z-26)
 d.rectangle((x1,z1,x2,z2),outline='#0086a4',width=3)
 # Candidate bore boundaries and central datum.
 for zz in [z-26.5,z+26.5]:d.line([xy(-48,zz),xy(48,zz)],fill='#e88e18',width=2)
 d.line([xy(60,z),xy(28,z)],fill='#1674bf',width=4);a,b=xy(28,z);d.polygon([(a,b),(a+12,b-6),(a+12,b+6)],fill='#1674bf')
 d.text((x0+20,y0+375),'蓝框：手册整体占用示意 52 × 15.5，非玻璃几何',font=font(21),fill='#00809b')
 d.text((x0+20,y0+410),'橙线：Ø53 候选通道；箭头：从正面沿 -X 装入',font=font(21),fill='#b36508')
 d.text((x0+20,y0+449),'本剖面不经过斜向按键，按键须结合三维检查。',font=font(20),fill='#627181')
d.text((48,1330),'已检查：13 个路径位置表面相交数为 0；原孔同位置为 10,127；草案边界边与多连接边均为 0。',font=font(25),fill='#185f50')
d.text((48,1382),'仍未完成：压圈承力面、可靠后承托、两颗螺丝连接、USB 插头空间、最薄壁、自相交及真实试装。',font=font(25),fill='#a34f20')
d.text((48,1435),'官方 STL 未含完整屏幕与电子件。蓝色内部结构不是游客看到的屏幕效果，也不能代表完整实物。',font=font(23),fill='#516173')
im.save(O/'previews/round1-dimensions-and-sections.png')
# Preserve handoff as a discoverable project-level reference without overwriting any input.
handoff=R/'docs/history/ai-tour-guide-device-codex-handoff-20261027.md'
if not handoff.exists():handoff.write_bytes((O/'reports/project-handoff-20261027.md').read_bytes())
docs=R/'docs';docs.mkdir(exist_ok=True)
status='''# 文旅智能导览设备 项目状态

更新日期：2026-10-28，Asia/Hong_Kong。第一轮接手与装配草案。用户尚未改变建模优先级。当前没有任何制造通过或全项目完成结论。

## 本轮实际完成

- 已读取总交接、根目录会议纪要与 StopWatch 手册全部 14 页、旧建模交接，并检查主体和压圈 Blender 文件。
- 已查看 v5 主体正背外观参考，以及实际网格双面、装配正背左右和斜视渲染。
- 根目录及递归搜索没有发现前端/后端源代码或依赖文件。此结论只针对当前 F 盘项目目录。
- Blender 实测为 5.2.3 LTS，可后台执行。默认沙箱仍出现 .sandbox-bin 启动失败；受控提升调用已获准，F 盘独占临时写入并删除成功。这不表示 F 盘成为当前默认可写工作目录；没有修改系统权限。
- 原文件大小、时间与交接一致，版本哈希见本轮 reports/input-provenance.json；所有修改均另存，没有改动原始输入。
- 官方 STL 已重新拆分为 8 个部件，正确装配组为 component 1、3、5、7，共 8,534 三角形，排除了重复壳体和散开展示按钮。
- 提取了参照 STL（仅参照，不能作为打印外壳），重新导入测得壳体 15.00 × 51.94694 × 51.94579 mm。
- 外观等比缩至 150 mm 高的候选尺寸为宽 113.18196、深 75.93181 mm；设备保持毫米实尺寸。主体保留一体外观与枫叶，不做头身拆分。
- 原孔深度收窄得到复核。已另存 Ø53 贯通扩孔、三个按键包围盒外扩 2 mm 并贯通插入方向的草案。移除了通道内原有侵入凸起，目前没有可靠后承托或前保持结构。
- 已保存正面、背面、严格左右侧视、明确标为斜视的渲染及真实轴线剖面尺寸总览。

## 可打开的成果

- modeling/v01/assembly-layout-v01.blend：原孔缩放后与正确官方装配组的对照，仍存在干涉。
- modeling/v01/cavity-clearance-draft-v01.blend：局部通道草案。名称明确标注 NO_RETENTION。隐藏集合保留原网格与布尔工具。
- modeling/v01/previews/round1-dimensions-and-sections.png：尺寸、原孔/草案对比及轴线剖面。
- modeling/v01/parameters-v01.json：所有候选值和未知参数。
- modeling/v01/reports/modeling-report-v01.md：检查条件与限制。
- docs/history/ai-tour-guide-device-codex-handoff-20261027.md：原始总交接完整副本。

## 数字检查结果的范围

同一假定装配位置，原主体与官方四部件表面的相交三角形对为 10,127；扩孔后沿正面平移 0–60 mm、步长 5 mm 的 13 个位置均为 0。该检查验证的是有限采样下的表面相交，不证明实物全部电子件、连续运动、壁厚、可靠承托和插拔操作通过。

候选通道在 X=10、15、20、25、30 mm 的 360 向径向采样最小约 26.4965 mm，符合 192 边柱体对 Ø53 名义圆的逼近。对应手册 Ø52 整体示意体，最小单侧约 0.4965 mm；对应官方 Ø51.95 壳体约 0.523 mm。未计打印误差、上色或表面毛刺。

草案网格边界边、多于两面共边和松散边计数均为 0；尚未检查自相交、内壳、整体连通性、最薄壁和受力根部，不能据此认定可打印。

## 本次新增决定与答复

- 用户：正面塑料边缘尺寸先查 stopwatch-nav/reference/StopWatch.pdf；如果手册没有，用户也不知道。已核对手册照片与第 12 页尺寸图，没有玻璃直径、承力环内外径或高差。不要重复要求用户提供其不知道的尺寸。
- 用户：螺丝规格未定，可以购买。允许根据结构选择通用紧固件；本轮暂评估 M2.5 机螺丝和可接近的六角螺母，两颗数量保持。长度和最终规格待连接座设计，不应立即按本草案购买。
- 150 mm、Ø53、轴线坐标和装配深度仍是本轮评估值，不是用户最终尺寸要求。
- 前圈不猜测玻璃承力，不输出未经确认的压屏结构。原 Tripo 压圈不等比缩小冒充最终件。

## 下一步 建模与试制

1. 已补查官方产品页链接的单页尺寸 PDF 与结构目录，仍未找到玻璃承力边界标注；记录见 reports/official-source-check-20261028.md。下一步由持有设备的队友或厂商确认前沿、背部可支承位置和必要插头尺寸，不要求用户独立使用 Blender。
2. 比较当前假定设备位置与帽口前后关系，确定实际安装深度和轴向限位。当前后面较空，是通道验证草案，不能直接固定设备。
3. 完成后承托、参数化可拆前圈和两颗机螺丝/螺母连接座，核对螺丝刀空间。必要时用可调整接触垫试制，不把玻璃作为受力面。
4. 按所需接口建 USB-C 插头及线缆插拔包络，再复核电源键、声音和触摸。
5. 完成最薄壁、断开壳体、自相交、连续插入与取出包络及稳定性检查。
6. 导出保留全部定位约束的安装小样 STL，重导入复测毫米尺寸。实物 PLA 试装后再考虑完整件和树脂公差。

## 网页与软硬件工作线

| 工作项 | 当前证据 | 下一步入口 |
| --- | --- | --- |
| 网页前端 | 用户负责；当前目录无代码 | 获取已有代码位置后读依赖与启动说明，沿用团队技术栈 |
| 后端与高德 | 会议记载由马雨晨负责 | 获取实际接口，不凭空决定 REST/WS 或定位方式 |
| 知识库 | 会议记载由杨金萍负责 | 核对景点 ID、检索/讲解接口、语料覆盖 |
| 硬件 | 会议记载吴佩泽已刷小智 | 核对实际固件与服务端、会话、语音和表情接口 |
| API | 交接称曾测试成功 | 尚未重新测试，不读取或记录密钥，不修改 Codex 登录 |
| 最小演示 | 路线、讲解、真实交互、游后记忆仍需结合实际接口 | 记录真实与模拟数据边界、超时及离线后备流程 |
| 赛事材料 | 会议记载 10 月 31 日至 11 月 1 日 | 临提交再查官方通知，尚未核验最新公告 |

软件接手时优先确认代码位置、已可用接口和第一版真实核心流程；随后确定会话共享、位置来源与游后记忆形式。没有删除或取消任何软件工作包。

## 可转发给硬件队友的短问题 未发送

“我们按带原壳的完整 StopWatch 做前装、背面开放、两螺丝可拆前圈。手册没有玻璃外缘承力尺寸。请帮忙确认：正面有没有能让前圈接触的塑料边缘及大致宽度/高差；背部哪些原壳位置能承托；现场必须插哪些线、插头外壳多大。无需拆机。若正面全是玻璃，也请直接说明，我们会调整保持结构。”

## 权限与交付边界

本轮无网站发布、赛事提交、公开上传、队友消息或采购。未导出可打印主体或 fit-test STL：承托、前保持结构和接口尚不完整，当前文件禁止直接交给商家制造。全部成果在 F 盘指定项目中；C 盘同步 sources 未改动。
'''
(docs/'project-status-20261028-v01.md').write_text(status,encoding='utf8')
report=f'''# 首轮装配与通道检查报告

日期：2026-10-28，Asia/Hong_Kong。状态：布局和局部通道草案，不能打印或固定设备。

## 输入与单位

根目录 modeling/v00/device-housing.blend、modeling/v00/device-ring.blend、stopwatch-nav/reference/StopWatch-official.stl、stopwatch-nav/reference/StopWatch.pdf、会议纪要和旧建模交接均保持原文件。输入校验见 input-provenance.json。Blender 场景一坐标单位为 1 mm（scale_length=0.001），参照 STL 顶点坐标为毫米。设备未缩放以迁就外观。官方 STL 源厚度轴为 X，变换为 X=源X、Y=-源Z、Z=源Y，再平移。源 X=15 是屏幕朝向的内侧开口；X=0 是带标识的后外壳。官方文件无屏幕/电子件，不能把裸露内部面渲染误称完整产品正面。

## 候选布局

外观高 150.00、宽 113.18196、深 75.93181。轴线 (Y,Z)=(-0.02734,22.28087)。轴线由原孔 X=30 mm 截面有效半径点拟合，仍为布局草案。设备后壳平面 X=10.00，STL 前沿 X=25.00；手册整体厚度 15.5 的示意包络前沿 X=25.50。新增 0.5 mm 仅是保守占用示意，不能确认真实玻璃位于该位置。

Ø53 柱体贯通主体全深，192 边离散。三个按钮分别用正确装配部件包围盒 Y/Z 各方向外扩 2 mm，沿 X 贯通。该量是候选净空，不保证手指操作舒适。前视屏幕右侧为角色左侧，严格右侧视从 -Y 看，左侧视从 +Y 看；斜视文件单独命名。

## 已执行检查

- 同一假定布局下原孔相交三角形对：{q['original_at_same_placement_surface_intersection_pairs']}，说明检测能够检出原始干涉。
- 修改后官方壳体+3 按钮在 X 正向平移 0–60、步长 5 的 13 位置均无表面交对。有限离散采样不等于整个连续插装已认证。
- 在设备深度范围内，360 向孔壁采样最小半径约 26.496465，名义 Ø53 的多边形逼近误差约 0.003535 mm。
- 当前草案边界边 0、多于两面共边 0、松散边 0。没有由这些计数推导自相交或整体强度结论。
- 官方参照独立 STL 导出后重导入尺寸 {q['reference_stl_reimport_dimensions_mm']}，保持实尺寸。该文件在 references 中，仅参照，不能混入外壳打印。
- 已实际查看原孔/草案正背侧与斜视渲染。尺寸总览使用真实三角网格与 Y=轴线平面的交线，非投影伪剖面。

## 不满足制造验收的项目

目前通道内旧承托凸起已去除，尚无经过验证的新后承托，设备会前后移动或掉出。没有新前圈、可靠承力面、两螺丝连接座或轴向止挡。旧孔附近原有螺孔不能当作已设计连接。未核对 USB-C/Grove 插头、指尖完整操作、声音、最薄壁、内壳、自相交、根部强度、脚底和稳定性。

手册全部 14 页与第 12 页尺寸图均未给出玻璃边界或塑料承力环内外径/高差。不能从 1.75 英寸显示规格推算可承压范围。用户答复其不知道未标注尺寸，不再重复追问；已补查官方产品页链接的单页机械尺寸 PDF 并实际渲染查看，标注与手册第 12 页一致；所查结构目录仅列出 StopWatch.stl。记录和 URL 见 official-source-check-20261028.md。下一步需持有实物的队友或厂商确认。

## 可复现运行

使用 Blender 5.2.3 LTS 和已配置 Python：先运行 scripts/inspect_reference.py，然后 Blender 后台运行 scripts/build_layout_v01.py，再运行 scripts/verify_layout_v01.py，最后 Python 运行 scripts/create_report_v01.py。所有路径按脚本所在版本目录与项目根目录；参数见 parameters-v01.json。重跑会更新本轮派生成果，不改根目录原始输入；需要保留此草案时先复制版本目录并调整脚本根路径。

数字原始结果见 layout-checks-v01.json 与 cavity-radial-probe.json。未来制造验收必须另外补齐连续包络、完整设备、连接结构、壁厚和真实试装。
'''
(O/'reports/modeling-report-v01.md').write_text(report,encoding='utf8')
print('REPORTS_WRITTEN',str(docs/'project-status-20261028-v01.md'));print('SHEET',str(O/'previews/round1-dimensions-and-sections.png'))

