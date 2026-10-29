from pathlib import Path
import json,shutil,hashlib,zipfile
from PIL import Image,ImageDraw,ImageFont
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=R/'modeling/v03';D=R/'modeling/v03/print-delivery-v03';D.mkdir(exist_ok=True)
P=json.loads((O/'parameters/print-v03.json').read_text());E=json.loads((O/'reports/export-checks-v03.json').read_text());A=json.loads((O/'reports/assembly-checks-v03.json').read_text());H=json.loads((O/'reports/hardware-and-standing-checks-v03.json').read_text())
# Presentation is an inspection sheet assembled from exact final mesh renders.
im=Image.new('RGB',(1800,1370),'#f5f6f8');d=ImageDraw.Draw(im);F=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
d.text((40,24),'PLA 打印试制版 v03',font=F(43),fill='#172b3c');d.text((40,85),'ANYCUBIC MEGA-S  |  毫米单位，100% 尺寸  |  主体一体 + 可拆前圈  |  待实物试装',font=F(25),fill='#526574')
for x,w,fn,title in [(35,710,'print-first-pair-v03.png','先打印：安装小样 + 前圈'),(780,480,'assembled-front-v03.png','完整装配（正面）'),(1290,480,'rear-support-closeup-v03.png','后承托与开放背面')]:
 pic=Image.open(O/'previews'/fn);pic.thumbnail((w,650));im.paste(pic,(x+(w-pic.width)//2,160+(650-pic.height)//2));d.text((x+10,825),title,font=F(25),fill='#172b3c')
d.text((45,900),'先用小样验证同一套安装孔、按键通道、三处后承托、前圈、螺母槽和螺丝位置。',font=F(29),fill='#225e50')
d.text((45,954),'试装通过后，再打印完整主体；已经通过的小样前圈可继续用于完整主体。',font=F(28),fill='#225e50')
d.text((45,1030),'打印尺寸：小样 66 × 81 × 19.4；前圈 66 × 81 × 3；主体 81 × 113 × 149 mm。',font=F(28),fill='#172b3c')
d.text((45,1080),'紧固件：M2.5 × 10 mm 机螺丝 2 颗 + 普通六角螺母 2 颗；螺母对边 5 mm、厚约 2 mm。',font=F(27),fill='#172b3c')
d.text((45,1150),'图中橙色仅用于区分前圈，蓝灰色设备为参照，不进入打印文件；主体与前圈均可打印白色。',font=F(25),fill='#526574')
d.text((45,1200),'下方凹口供插线，前圈落在止挡上；不要靠继续拧紧来消除设备松动，先调整承托软垫。',font=F(25),fill='#895323')
d.text((45,1270),'数字检查：闭合实体与 STL 回读通过，141 个装入位置无表面干涉；实物配合、按键与插头仍须试装。',font=F(25),fill='#526574')
im.save(O/'previews/PRINT_OVERVIEW_v03.png')
readme='''# 文旅智能导览设备 PLA 打印包 v03

更新：2026-10-28，Asia/Hong_Kong。打印机已由用户照片确认是 ANYCUBIC MEGA-S，材料为实验室 PLA。实际喷嘴口径、耗材品牌和机器状态未由照片确认。

本包已经包含实际 STL 和通用 3MF，可以进入切片和 PLA 试装打印。它不是只有预览的建模草案。实物试装尚未完成，因此请按下面顺序先打印小样；完整主体文件也已经一并交付。

## 最快开始

1. 用实验室平时的切片软件打开 `00_PRINT_FIRST_TEST_PAIR_PLA_v03.3mf`。里面已摆好安装小样和前圈两个物体，单位毫米，底面 Z=0。3MF 仅含模型和摆放，没有绑定温度、机器动作或支撑参数。
2. 如果软件不接收 3MF，分别导入 `01_FIT_TEST_CARRIER_52p6mm_PLA_v03.stl` 和 `02_FRONT_RING_50p5mm_PLA_v03.stl`。两份 STL 已摆好打印方向；同时导入时使用自动排列，确认物体不重叠。不要自动缩放，使用 100% / 毫米。
3. 选择实验室已有的 Mega-S 与当前 PLA/喷嘴对应预设，切片后输出 G-code 给机器。机器需要切片后的 G-code；不要直接把 STL 当打印任务。可把小样任务命名为 `FIT03.gcode`。
4. 打印完小样和前圈，按后面的步骤装入真实完整 StopWatch，检查装入、取出、按键和插线。
5. 通过后再打开 `04_FULL_HOUSING_AND_RING_PLA_v03.3mf` 打印完整件；如果前圈已经试装合适，只打印 `03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl`，不必重复打印前圈。主体任务可命名为 `BODY03.gcode`。

## 文件与方向

| 文件 | 用途 | 已摆好的方向 | 外形约 mm |
| --- | --- | --- | --- |
| 00_PRINT_FIRST_TEST_PAIR_PLA_v03.3mf | 最先打印的小样与前圈 | 两件平放，已排在平台内 | 两物体 |
| 01_FIT_TEST_CARRIER_52p6mm_PLA_v03.stl | 安装区域小样，含完整定位约束 | 大平面朝下，安装轴竖直 | 66 × 81 × 19.4 |
| 02_FRONT_RING_50p5mm_PLA_v03.stl | 小样和完整件共用前圈 | 平放 | 66 × 81 × 3 |
| 03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl | 头、帽、枫叶、身体等一体主体 | 两脚平底朝下 | 81 × 113 × 149 |
| 04_FULL_HOUSING_AND_RING_PLA_v03.3mf | 完整主体与前圈的通用模型组合 | 主体脚朝下，前圈平放 | 两物体 |
| PRINT_OVERVIEW_v03.png | 打印顺序、装配与后承托预览 | 不打印 | — |
| CHECKS_SUMMARY_v03.md | 数字检查条件与限制 | 不打印 | — |
| MANIFEST_SHA256.json | 文件尺寸及校验值 | 不打印 | — |

3MF 为通用模型包，不会自动配置打印机。若切片软件提示使用其预设或当前实验室预设，请使用已经验证的实验室 Mega-S/PLA 预设。打印包没有设备参照体、相机或布尔工具。

## 切片建议

- 首先沿用实验室验证过的 PLA 温度、速度、回抽和平台处理。
- 如果当前实际喷嘴是 0.4 mm，可从层高 0.20 mm、4 道壁、4–5 层顶底、15–20% 填充开始。当前照片没有确认喷嘴是否被更换；喷嘴不同时，用对应的切片预设，模型仍保持 100%。
- 小样和前圈可先不加支撑；螺母槽顶部是短桥接，需要看切片预览。小样可加 3–5 mm brim，避免底部配合面出现明显象脚。
- 完整主体要加可从正面、背面清理的支撑：重点看帽口内部上缘、披肩和叶片悬空处。优先树状/有机支撑；用切片预览确认横向圆腔顶部确实被支撑，支撑能从开放前后口取出。
- 配合孔内壁、后承托接触面、螺母槽尽量避免支撑黏连。不要让支撑封死背面，也不要为了去除支撑大幅打磨功能尺寸。
- 成型空间按 Mega-S 说明书的 210 × 210 × 205 mm 校验；本包模型与通用排布均在此范围内。最终层数、耗材和时间以实际切片为准，本包未生成 G-code。

## 准备的紧固件

- M2.5 × 10 mm 机螺丝 2 颗：10 mm 指螺丝头下的杆长。用平底盘头/圆柱头，头径不大于 5.5 mm；不用沉头，不用自攻螺丝。
- M2.5 普通六角螺母 2 颗：本槽按对边约 5 mm、厚约 2 mm 设计。不要换成更厚的尼龙防松螺母。
- 可选薄软垫：约 0.3–0.5 mm 的 EVA/硅胶片，在三处后承托上按实际原壳接触位置裁贴。先干装，再按松动程度加垫。胶只用于固定垫片到打印件，不胶封设备。

本包没有要求购买热熔嵌件，没有把螺丝直接拧进 PLA，也没有改动设备原壳或供电。

## 小样试装

1. 去掉毛边和象脚，确认孔道、螺母入口没有支撑残留。不要先上色功能面。
2. 先不装前圈，把带原壳的完整 StopWatch 从正面直线放入。不能强压，不拆原壳。上方黄蓝键、下方红色电源键对准各自开口。
3. 后侧有三处外围承托，顶部一处跟随官方后壳约 0.8 mm 的局部台阶，另外两处在两侧偏下。检查接触点确实落在原壳塑料上，PCB、排针、扬声器和接口不受压。
4. 两颗六角螺母从左右外侧的横槽滑入，对准轴向螺孔。必要时用镊子辅助；不需要从深孔里盲塞螺母。
5. 装上前圈，从正面穿入两颗 M2.5×10 螺丝拧入螺母。前圈应落在安装套固定座面上；轻手拧到座面贴合即可，不靠增加拧紧力把设备压死。
6. 近看前圈内缘，确认只可能接触露出的塑料边，和玻璃保持间距。用户提供的塑料边宽约 2 mm、表面基本齐平属于直尺粗测，所以此项仍需实物确认。
7. 如果有少量前后松动，取出设备，在三处确认可承力的原壳接触位置加薄垫后重试；不要填压 PCB，不要用螺丝硬压玻璃消除松动。
8. 实际按动三个按钮，确认能按下、回弹且没有持续误触。用现场真实 USB-C 线插拔充电，检查前圈和窗口不挡插头外壳。下方窗口为宽裕预留，未测量某一款具体线缆。
9. 检查声音、触摸、能否拆下前圈并取出设备。通过后保留这一只前圈，用于完整主体。

若卡住：记录卡住深度、位置和小样孔实测值，先改安装尺寸，不整体缩放角色或设备。若前圈触及玻璃或后托碰到电子件，该次试装不通过，记录位置再修订。小样通过不能自动代替完整件装配检查，也不能替代树脂版本公差验证。

## 已完成和未完成

已完成一体主体、安装居中套、三处后承托、两螺丝侧装螺母座、前圈轴向止挡、按键通道、下方充电凹口、局部补强和平脚底。枫叶和角色主体保留，背面开放。为插头空间，脸部下方增加了明显的前向凹口，见预览图。

已通过：三份 STL 均闭合、单实体、毫米尺寸回读；141 个前装位置未检出官方原壳与按钮的表面相交；前圈与主体、设备参照及正面补充包络无体积/表面干涉；螺母侧向装入、螺丝杆、螺丝刀和充电预留盒的实体检查通过。

尚未完成：真实设备试装、具体切片软件中的支撑清理预览、实际打印和收音/播放验证。有限壁厚采样不等于逐面证明没有自相交；材料强度与机器误差也尚未实测。完整件已可作为 PLA 试制模型进入切片，不能表述为“实物制造验收通过”。

## 工程源文件

装配 Blender 文件：`F:/coding_projects/ai-tour-guide-device/modeling/v03/assembly-print-v03.blend`
参数、脚本和完整检查日志在同一版本目录的 parameters、scripts、reports 中。

原始输入模型、前两轮草案及 C 盘同步 sources 均未覆盖。机器照片保存在该版本 reference-snapshot 中，仅作本地型号依据。
'''
(D/'README_CN_v03.md').write_text(readme,encoding='utf8')
report=f'''# v03 数字检查摘要

日期：2026-10-28，Asia/Hong_Kong。状态：可进入 PLA 切片与试装打印；真实 StopWatch 试装待完成。

## 检查结果

- 三份 STL 均在写出后重新读取、重建为闭合实体，状态 NoError，连通实体数均为 1。
- 完整主体实际 STL：边界边 {A['physical_body_stl_topology']['boundary_edges']}，多面共边 {A['physical_body_stl_topology']['nonmanifold_edges']}，松散边 {A['physical_body_stl_topology']['loose_edges']}。
- 完整前装路径：前移 0–70 mm，间隔 0.5 mm，共 {len(A['front_insertion_path'])} 个位置，官方原壳及 3 个按钮表面相交数均为 0。
- 前圈与官方原壳、按钮和正面 0.5 mm 补充占用示意的表面相交数均为 0。
- 前圈与完整主体实体相交体积约 {E['ring_vs_body_intersection_volume_mm3']:.3g} mm³（数值零）；固定座面之间预期贴合。
- 两颗 M2.5 螺丝杆、对应 5 mm 对边/2 mm 厚六角螺母的完整侧向装入扫掠、直径 10 mm 螺丝刀通道，均无主体体积干涉。
- 预留盒 12×32×20 mm 放在下方充电窗口内，无主体干涉。这是设计净空盒，不是所选插头的真实 CAD，线缆必须实插。
- 壁厚有限法向采样 {A['wall_sampling']['valid_rays']} 条有效射线，最小约 {A['wall_sampling']['min_mm']:.2f} mm，低于 0.8 mm 的命中 {A['wall_sampling']['below_0p8_count']}；低于 1.2 mm 的命中 {A['wall_sampling']['below_1p2_count']}。该方法不覆盖每个面或所有尖角，不能当作全局最薄壁或自相交认证。
- 新装配结构名义尺寸：外套 Ø66、居中腔 Ø52.6、按钮外侧连续连接边约 3.3、后承托厚至少 3.2、前圈厚 3 mm；螺母前方止挡实体厚 2.7 mm。圆角方座为 13×13 mm，螺母口对边 5.4 mm。
- 两脚已切到共同平面。基于均匀体积分布的主体重心代理和 39 g 设备，假定主体 50/100/200 g 时，组合重心投影均在脚底凸包内；实际打印质量分布和动态使用稳定性未实测。
- 3MF 单位明确为 millimeter，两个对象底面 Z=0，摆放及高度检查在 210×210×205 mm 内。3MF 不包含切片工艺、打印机动作或 G-code。

## 网格处理

保留现有外观，未全局体素重建。原主体经检查有 6 条相邻面朝向不连续的边，已在工作副本重算朝向并清理退化几何，然后与参数化安装套做实体并集。最终浮点 STL 清理容差 0.005 mm；修复了螺母槽处一处共线 T 接缝，方法为拆分已有长边、保持所有表面位置不变。合并产生的约 51.7 mm³ 微小封闭内腔已填实，避免孤立内部壳体。

后开口外围和后帽口局部薄皮已补强。后帽口采用局部内衬而非全模型重建，名义外表面增量约 0.1 mm，远离设备接触区。根目录所有原始输入未改动。

## 尺寸与界限

前圈内径 50.5 mm。以用户的单侧塑料约 2 mm 粗测、原壳 Ø51.95 推算，同心搭接约 0.725 mm，玻璃余量约 1.275 mm；Ø52.6 居中腔使名义最大偏心约 0.325 mm，对应最小搭接约 0.40 mm、玻璃余量约 0.95 mm。以上忽略粗测误差、打印误差及上色，必须实物核对，不能把理论数值写成制造保证。

后承托接触半径从 23.1 mm 起，选择官方外壳外围塑料区域；顶部根据实际 STL 后壳台阶提高约 0.8 mm。设计预留 0.5 mm 后垫和整体约 16.2 mm 轴向空间。原 STL 缺少完整玻璃与电子件；原壳可检出的表面检查通过，不证明全部真实突出物都已建模。

## 证据文件

完整参数与检查日志保存在工作版本的 parameters/print-v03.json、reports/export-checks-v03.json、reports/assembly-checks-v03.json、reports/hardware-and-standing-checks-v03.json、reports/stl-tjunction-repair.json。源文件签名见 round1/reports/input-provenance.json。

机器型号直接依据用户本轮照片。Mega-S 厂商说明书镜像可参考：https://www.treatstock.com/static/uploads/printers/ANYCUBIC%20MEGA%20S-User-Manual.pdf 。该文档写出的标准规格不证明实验室机器喷嘴或固件未被修改。
'''
(D/'CHECKS_SUMMARY_v03.md').write_text(report,encoding='utf8')
files=[O/'fit-test/00_PRINT_FIRST_TEST_PAIR_PLA_v03.3mf',O/'fit-test/01_FIT_TEST_CARRIER_52p6mm_PLA_v03.stl',O/'exports/02_FRONT_RING_50p5mm_PLA_v03.stl',O/'exports/03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl',O/'exports/04_FULL_HOUSING_AND_RING_PLA_v03.3mf',O/'previews/PRINT_OVERVIEW_v03.png']
for path in files:shutil.copy2(path,D/path.name)
manifest={x.name:{'bytes':x.stat().st_size,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in D.iterdir() if x.is_file() and x.name!='MANIFEST_SHA256.json'}
(D/'MANIFEST_SHA256.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
zipout=R/'modeling/v03/AI_Tour_Guide_PLA_Print_v03.zip'
with zipfile.ZipFile(zipout,'w',zipfile.ZIP_DEFLATED) as z:
 for x in sorted(D.iterdir()):
  if x.is_file():z.write(x,'print-delivery-v03/'+x.name)
with zipfile.ZipFile(zipout) as z:assert z.testzip() is None
# Record the machine photo locally without altering its source.
ref=O/'reference-snapshot';ref.mkdir(exist_ok=True);shutil.copy2(Path(r'C:\Users\Macaroon\AppData\Local\Temp\codex-clipboard-100e042b-b144-42c6-a6a1-87702a2b96ce.jpg'),ref/'ANYCUBIC_MEGA_S_lab_20261028.jpg')
status='''# 文旅智能导览设备 项目状态 v03

日期：2026-10-28，Asia/Hong_Kong。用户明确优先尽快获得可进行 3D 打印的模型。已交付真实打印文件，不再停留在仅有草案预览的阶段。

## 当前交付

打印包目录：F:/coding_projects/ai-tour-guide-device/modeling/v03/print-delivery-v03
压缩包：F:/coding_projects/ai-tour-guide-device/modeling/v03/AI_Tour_Guide_PLA_Print_v03.zip

包含：完整安装约束的小样 STL、与完整件通用的可拆前圈 STL、帽/枫叶/头/身体等一体主体 STL、小样和完整件两个通用 3MF 组合、中文使用说明、检查摘要、预览和哈希清单。

原始 Tripo/Blender 输入与前两轮草案未覆盖，C 盘同步 sources 未改。

## 机器与尺寸

用户照片已确认 ANYCUBIC MEGA-S；材料为实验室 PLA，实际喷嘴口径未知，不继续阻塞建模。主体约 81×113×149 mm，小样 66×81×19.4，前圈 66×81×3。STL 已摆正方向，3MF 单位毫米，均 100% 尺寸打印，不按角色外形整体缩放。

## 完成的机械结构

Ø52.6 居中腔；设备正面装入/取出；三处原壳外围后承托，顶部跟随官方约 0.8 mm 后壳台阶；前圈 ID50.5；两颗 M2.5×10 机螺丝与对边5 mm/厚2 mm的普通六角螺母；左右侧装螺母槽；前圈落在硬止挡；三个按钮通道；下方充电预留凹口；开放背部；后帽口局部补强和平脚底。主体与前圈仍仅两个打印零件。

前缘 A≈2 mm、B基本齐平按用户直尺粗测记录，不要求用户重复测量或现在购买卡尺。树脂工艺暂不认定通过。

## 已验证

三份打印 STL 写出后重读为单一闭合实体。主体零边界/零多连接边。141个前装位置无官方壳体/按钮表面干涉；前圈与参考和主体无非法相交；螺母侧向装入、螺丝杆、直径10mm螺丝刀通道与指定充电净空盒无体积干涉。脚底静态重心代理检查通过。壁厚有限采样与条件详见交付检查摘要，不夸大为逐面或实物认证。

## 下一步 由真实打印推进

先打印00号小样3MF（或01小样STL+02前圈STL），用完整StopWatch验证装入、后托接触塑料、前圈不碰玻璃、三个按键回弹、真实充电插头及声音。通过后再打印03完整主体；合格前圈可复用。实物试装未完成，不标“最终制造通过”。若卡住，按卡住的位置修改参数，不强压设备、不整体缩放。

## 工程入口

工作版本：modeling/v03
装配文件：assembly-print-v03.blend
参数：parameters/print-v03.json
脚本：scripts/build_print_v03.py、verify_and_render_v03.py、check_hardware_and_package_v03.py

原始面朝向清理脚本repair_source_orientation.py在重建时先运行，然后执行build、verify/render、hardware/package、create_print_delivery_v03。依赖manifold3d局部安装在本版本mesh-tools，仅用于本地网格处理，没有修改系统Python。

## 软件与演示线继续保留

此前当前项目目录未找到前后端代码；软件接手时仍需定位现有代码和实际接口，沿用团队技术栈，确定游客主流程、会话、位置与游后记忆。尚未重新验证API或真实端到端连接，不修改Codex登录、不读取记录密钥。赛事提交前核对最新官方通知。

本轮没有对外发消息、发布网站、提交赛事或采购。
'''
(R/'docs/history/project-status-20261028-v03.md').write_text(status,encoding='utf8')
print('DELIVERY_READY',str(D));print('ZIP',str(zipout),zipout.stat().st_size);print('FINAL_SAMPLE_WALL_MIN',A['wall_sampling']['min_mm']);print('FINAL_FILES',list(manifest))
