from pathlib import Path
import json
from PIL import Image,ImageDraw,ImageFont
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=R/'modeling/v02';q=json.loads((O/'reports/ring-preform-checks-v02.json').read_text());p=json.loads((O/'parameters-v02.json').read_text())
im=Image.new('RGB',(1500,1010),'#f6f7f9');d=ImageDraw.Draw(im);F=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
d.text((40,25),'前圈接触面草案 v02',font=F(39),fill='#172a3a');d.text((40,86),'2026-10-28  |  单位 mm  |  独立草案，尚未与主体连接，不能直接打印',font=F(22),fill='#566572')
pic=Image.open(O/'previews/ring-contact-front-v02.png');pic.thumbnail((760,700));im.paste(pic,(20,155));x=820
d.text((x,160),'新增实测输入',font=F(29),fill='#172a3a');d.text((x,212),'A：塑料边单侧约 2 mm',font=F(25),fill='#172a3a');d.text((x,253),'B：塑料与玻璃基本齐平',font=F(25),fill='#172a3a');d.text((x,297),'直尺粗测；测量误差尚未量化',font=F(22),fill='#67737e')
d.text((x,365),'候选接触尺寸（同心、名义值）',font=F(27),fill='#172a3a')
for yy,t in [(415,'前圈内径：50.5 mm'),(458,'搭住塑料最外侧：约 0.7 mm'),(501,'前圈内缘距玻璃：约 1.3 mm')]:d.text((x,yy),t,font=F(24),fill='#172a3a')
d.text((x,575),'蓝色：按粗测推算的整片玻璃区域',font=F(22),fill='#347190');d.text((x,614),'橙色：前圈拟接触区域的投影',font=F(22),fill='#bc5f20');d.text((x,653),'浅色：其余露出塑料的示意',font=F(22),fill='#67737e')
d.text((40,871),'已检查：前圈为 1 个连通件；边界边 0，多连接边 0；三处缺口保留外侧连续连接边。',font=F(24),fill='#245f4f')
d.text((40,919),'下一步：设备居中、后承托、主体连接座与轴向限位；核对实物接触区域后再进入试装。',font=F(24),fill='#9b5426')
im.save(O/'previews/ring-contact-overview-v02.png')
report='''# 前圈预形 v02 检查说明

日期：2026-10-28，Asia/Hong_Kong。

用户新输入已保存于 front-rim-observation-20261028.md：A 约 2 mm（毫米刻度直尺粗测，无游标卡尺），B 基本齐平。该输入覆盖并更新上一轮“前缘尺寸未知”的状态，不再重复追问这两项。尺寸精度与承载能力不由本次粗测保证。

## 本轮几何

创建了独立前圈预形 front-ring-preform-v02.blend，局部 X 为厚度、Y 水平、Z 向上；接触背面 X=0，前面 X=3。内径候选 50.5，主圈外径 66，厚 3；含两处 M2.5 候选通孔 Ø2.9，中心 Y=±34；包含安装耳总宽 78，高 66。螺丝长度与螺母座未定，通孔不代表已与主体连接座对齐。

三个按键避让按上一轮官方装配部件的平面包围盒外扩 2 mm 建立，并限制外沿半径至 29.7 mm，从而在外径 66 的环上留下名义约 3.3 mm 连续外侧连接边。前圈保持一个零件。此为几何避让候选，不是手指操作验证。

名义同心状态下，前圈搭住 Ø51.95 原壳外缘约 0.725 mm；以 A≈2 mm 估算玻璃外径约 47.95 mm，其前圈内缘至玻璃的名义径向间距约 1.275 mm。玻璃外径是由粗测推算的示意值，非直接测量、非发光区直径，也不是要修改的设备模型。

Ø53 候选安装腔存在约 0.525 mm 单侧径向游隙，偏心可把一侧搭接减少到约 0.2 mm（理想圆、忽略粗测和打印误差）。因此需要先完成可验证的居中接触，不能直接据本前圈确认固定可靠。

## 检查结果

- 最终独立前圈网格为 1 个连通件。
- 边界边 0，多于两面共边 0，松散边 0。
- 布尔运算在安装耳孔附近产生的一个退化小三角面已定位并补回，面积约 0.1423 mm²；脚本有补面面积与最终闭合断言。
- 已渲染并查看正面及斜视。橙色接触投影已按实际前圈覆盖区域裁切，不在按钮缺口处虚画接触。
- 蓝色玻璃、浅色塑料和橙色接触投影全在 REFERENCE 集合，仅作正面投影示意，不是打印几何。

尚未进行整机装配干涉、自相交、承载能力、螺丝预紧、声音、插头或真实试装验证。后承托、居中结构、主体连接座、螺母座和轴向止挡尚未完成；不能导出最终打印件或让商家直接制造。主体仍使用上一轮 cavity-clearance-draft-v01.blend，未覆盖或改动。

可复现：先保存 parameters-v02.json，然后 Blender 后台执行 scripts/build_ring_preform_v02.py。输入官方部件来自 round1/references。不要重新运行早期 record_rim_measurement.py 覆盖已调整的第二轮候选参数；它仅保留首次录入记录。当前全部最终数值以 parameters-v02.json 为准。
'''
(O/'reports/ring-preform-report-v02.md').write_text(report,encoding='utf8')
status='''# 文旅智能导览设备 项目状态 v02

更新：2026-10-28，Asia/Hong_Kong。当前优先推进完整 StopWatch 外壳，网页与接口工作线继续保留。

## 新增实测

- A：正面露出塑料单侧约 2 mm，毫米刻度直尺垂直视线读数，未使用游标卡尺；按粗测记录，误差未量化。
- B：塑料表面和玻璃表面基本齐平，名义高差约 0 mm，不是精密零高差结论。
- 已解决“是否有露出塑料边及大致关系”的草案输入。不要重复向用户索取这两项，也不必为此立刻要求购买游标卡尺。
- 玻璃外径约 47.95 mm 仅由粗测与官方 Ø51.95 推算，非直接测量。

## 新增成果

- modeling/v02/parameters-v02.json：当前第二轮候选参数与实测来源。
- modeling/v02/front-ring-preform-v02.blend：独立前圈预形，未与主体连接；内径 50.5，主圈外径 66，厚 3，两个 Ø2.9 候选通孔，总宽 78 mm。
- modeling/v02/previews/ring-contact-overview-v02.png：实测输入、候选搭接和玻璃余量示意。
- modeling/v02/reports/ring-preform-report-v02.md：本轮几何、检查与限制。
- modeling/v02/reports/front-rim-observation-20261028.md：用户原话、测量方法及推算边界。

独立前圈已保持一个连通件，闭合边检查为零边界、零多连接、零松散边。按钮缺口保留外侧连续连接边。尚未做整机装配验证，未导出最终打印 STL；这些检查不构成制造通过。

## 下一步

1. 设计设备居中结构，限制 Ø53 腔中的约 0.525 mm 单侧游隙，防止前圈只搭住某一侧约 0.2 mm。
2. 结合真实背部布局设计可靠原壳承托，保持背面开放，避开 PCB/排针/声音部位。
3. 将前圈与主体连接座、两颗 M2.5 候选机螺丝、可接近的螺母和轴向硬限位共同设计；长度、预紧及软垫暂不定稿。
4. 验证按钮手指可达性、USB-C/必要接口插拔包络，以及完整插入取出路径。
5. 完成数字检查后输出完整定位约束的小样，通过实物确认前圈确实落在塑料上，再进入整件制造。

## 已有主体与原始资料

主体沿用 modeling/v01/cavity-clearance-draft-v01.blend。150 mm 外观总高仍为评估值，保留枫叶、一体主体、正面装入、背部开放、两螺丝可拆前圈等已确认约束。原始根目录模型及 round1 成果未覆盖。

历史输入、权限检查与首次数字检查见 project-status-20261028-v01.md 和项目根目录总交接；本文件的新实测覆盖旧记录中“正面塑料边完全未知”的表述。

## 软件与演示工作线

当前项目目录没有发现前后端代码；用户负责前端，队友负责后端/高德、知识库和小智硬件方向。需要在软件接手时定位现有代码与实际接口，沿用团队栈，确定核心游客流程、会话共享、位置来源和游后记忆。未重新验证 API 或真实联通，不修改 Codex 登录，不读取/记录密钥。会议中的赛事安排仍须临提交核对官方通知。

本轮无对外消息、发布、采购或赛事提交。
'''
(R/'docs/history/project-status-20261028-v02.md').write_text(status,encoding='utf8')
print('ROUND2_SAVED_AND_DOCUMENTED')
