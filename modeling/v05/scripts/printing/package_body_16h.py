from pathlib import Path
import json,hashlib,shutil,zipfile
W=Path.cwd();O=W/'output/mega-s-body-16h';trials=W/'output/mega-s-body-time-trials';D=Path('F:/coding_projects/ai-tour-guide-device/print-gcode-v05/03-body-about-16h');D.mkdir(parents=True,exist_ok=True)
r=json.loads((O/'GCODE_CHECKS.json').read_text());r['file']='BODY16.gcode';r['combined_model_support_z_level_count']=r.pop('object_layer_count');r['combined_model_support_z_steps_mm']=r.pop('object_layer_steps_mm');r['nominal_model_layer_height_mm']=.22;r['first_layer_height_mm']=.2
(O/'GCODE_CHECKS.json').write_text(json.dumps(r,indent=2))
assert 'Error:' not in (trials/'trial022b.log').read_text()
m=json.loads((W/'output/mega-s-body-fine/preparation.json').read_text());assert hashlib.sha256(Path(m['source_stl']).read_bytes()).hexdigest()==m['source_sha256'];m.update({'layer_height_mm':.22,'outer_speed_mm_s':40,'inner_and_infill_speed_mm_s':80,'perimeters':3,'fill_percent':10,'support_style':'snug','support_z_contact_distance_mm':.2,'selected_trial':json.loads((trials/'trial022b.json').read_text()),'time_constraint':'15-16 hours desired; slicer prediction 15h50m36s; actual duration may exceed 16h','comparison':'old clip layer 0.20 mm and external wall speed 25 mm/s; new body 0.22 mm and 40 mm/s, not finer'})
(O/'preparation.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
for n in ['BODY16.gcode','MegaS_BODY_022.ini','GCODE_CHECKS.json','preparation.json']:shutil.copy2(O/n,D/n)
table=[json.loads(p.read_text()) for p in sorted(trials.glob('trial*.json'))];(D/'切片时间试算.json').write_text(json.dumps(table,ensure_ascii=False,indent=2),encoding='utf-8')
guide='''# 预计约 16 小时的 v05 主体试打印

只打印一个完整主体，原模型未修改，前圈不打印。正面开口朝上、弧形背面朝下，沿用上一版方向。
复制 BODY16.gcode 到 Mega-S 正常使用的 SD 卡根目录。不要与其他模型重新合并。

## 时间与参数
- 预计 15 小时 50 分 36 秒；不是实际完工保证，机器状态不同可能超过 16 小时。
- 预计 PLA 194.80 g / 65.31 m；请留足耗材余量。
- 0.4 mm 喷嘴按用户指定默认值，1.75 mm PLA。
- 模型层高 0.22 mm，首层 0.20 mm。
- 外墙 40 mm/s，普通墙和内部填充 80 mm/s；支撑 50 mm/s，支撑接触面 25 mm/s；空走 100 mm/s，Z 移动 5 mm/s。
- 三道外墙、10% gyroid 填充；顶底各 6 层（名义 1.32 mm，最小厚度设置 1.2 mm）。这是省时省料取舍，不能视为与四道外墙、20% 填充版本等强度。
- 首层喷嘴 205°C，后续 200°C，热床 60°C。
- 支撑接触间距 0.20 mm、侧向 0.35 mm，6 mm 外底边。

## 和 44 分钟卡扣的区别
小卡扣层高 0.20 mm、外墙 25 mm/s。本版层高 0.22 mm，比小卡扣高 10%，外墙也更快，因此不能称为更精细。打印时间主要由整体尺寸、层高、路径长度、速度及内部材料共同决定，不代表精度数值。
主体的摆放方式不同，可以减少部分支撑接触面的问题；但不能据此保证所有表面更光滑。拉丝、出料异常、原网格不平整仍可能影响质量。

## 打印与清理
第一层预计约 29 分钟，观察最初几层是否牢固附着。内部支撑要从正面开口分段拆除，不要整圈硬拔，不要剪断三根实体支柱或误剪前口薄边。弧形背面可能留下支撑痕迹。
原 v05 的壁厚、卡槽、台阶保持不变，没有做磁铁座或全局最小壁厚修复。仅通过数字路径与温度检查，未进行本参数组合的实物打印和装配验证。
之前的 BODY008.gcode 是约 75 小时的版本；本次要试约 16 小时方案，应选择 BODY16.gcode。
'''
(D/'约16小时版本说明.md').write_text(guide,encoding='utf-8')
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in D.iterdir() if p.is_file() and p.name!='MANIFEST_SHA256.json'};assert manifest['BODY16.gcode']==r['sha256'];(D/'MANIFEST_SHA256.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
zpath=D.parents[1]/'MegaS_Body_About16h_v05.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=5) as z:
 for p in D.iterdir():
  if p.is_file():z.write(p,'03-body-about-16h/'+p.name)
with zipfile.ZipFile(zpath) as z:assert z.testzip() is None
print('BODY16_PACKAGE_VERIFIED',D,zpath,sep='\n')
