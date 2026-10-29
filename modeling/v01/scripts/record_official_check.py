from pathlib import Path
import hashlib
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=Path(__file__).resolve().parents[1]
note='''# 官方结构资料补查

核查日期：2026-10-28，Asia/Hong_Kong。

- 产品页：https://docs.m5stack.com/en/core/StopWatch
- 产品页链接的单页机械尺寸 PDF：https://m5stack-doc.oss-cn-shenzhen.aliyuncs.com/1242/C152-StopWatch-model-size.pdf
- 结构目录：https://github.com/m5stack/M5_Hardware/tree/master/Products/C152_StopWatch/Structures

已打开产品页和结构目录。所查结构目录列出 StopWatch.stl，未列出 STEP 或完整屏幕装配文件。已下载单页机械尺寸 PDF 到 references/StopWatch-official-dimensions.pdf 并实际渲染查看，其图与本地手册第 12 页一致：外径 Ø51.95、整体厚度 15.5、背部孔尺寸等。没有标注玻璃直径、前塑料承力环宽度、高差或允许压力。此结论只覆盖本次核查的公开资料，不宣称所有官方资料均无这些尺寸。

因此尚无依据定稿前圈受力面。后续应由持有设备的队友或厂商确认；没有授权自动对外发消息。现有压圈不能通过等比缩小直接变成制造件。暂定 M2.5 机螺丝+螺母仅为结构评估方向，采购长度需等连接座设计。
'''
note+='\n下载 PDF SHA256：'+hashlib.sha256((O/'references/StopWatch-official-dimensions.pdf').read_bytes()).hexdigest()+'\n'
(O/'reports/official-source-check-20261028.md').write_text(note,encoding='utf8')
# Keep the report builder reproducible with this new source-check result.
f=O/'scripts/create_report_v01.py';s=f.read_text(encoding='utf8');s=s.replace('1. 寻找官方更详细装配资料，或由实际持有设备的队友确认玻璃外的塑料承力边界、背部可支承位置和必要插头尺寸。不需要用户独立完成 Blender 操作。','1. 已补查官方产品页链接的单页尺寸 PDF 与结构目录，仍未找到玻璃承力边界标注；记录见 reports/official-source-check-20261028.md。下一步由持有设备的队友或厂商确认前沿、背部可支承位置和必要插头尺寸，不要求用户独立使用 Blender。')
s=s.replace('下一步找更详细官方结构资料或请持有实物的队友确认。','已补查官方产品页链接的单页机械尺寸 PDF 并实际渲染查看，标注与手册第 12 页一致；所查结构目录仅列出 StopWatch.stl。记录和 URL 见 official-source-check-20261028.md。下一步需持有实物的队友或厂商确认。')
f.write_text(s,encoding='utf8')
