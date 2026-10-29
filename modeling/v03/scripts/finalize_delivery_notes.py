from pathlib import Path
import json
O=Path(r'F:\coding_projects\ai-tour-guide-device\modeling/v03');pf=O/'parameters/print-v03.json';p=json.loads(pf.read_text());
for support in p['rear_supports']:support['outer_radius_mm']=32.0
p.pop('ear_radius_mm',None);pf.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
f=O/'scripts/build_print_v03.py';s=f.read_text();s=s.replace("sector(s['inner_radius_mm'],32.0","sector(s['inner_radius_mm'],s['outer_radius_mm']");f.write_text(s,encoding='utf8')
f=O/'scripts/create_print_delivery_v03.py';s=f.read_text(encoding='utf-8-sig');s=s.replace('两份 STL 已摆好打印方向，不要再自动缩放；使用 100% / 毫米。','两份 STL 已摆好打印方向；同时导入时使用自动排列，确认物体不重叠。不要自动缩放，使用 100% / 毫米。');f.write_text(s,encoding='utf8')
