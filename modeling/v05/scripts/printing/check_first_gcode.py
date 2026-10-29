from pathlib import Path
import re,json,hashlib,zipfile,xml.etree.ElementTree as ET
import numpy as np
from PIL import Image,ImageDraw,ImageFont
O=Path.cwd()/'output/mega-s-first-print';p=O/'FIRST_CLIP_V05.gcode';text=p.read_text();lines=text.splitlines()
pos=np.zeros(3);relative_xyz=False;relative_e=False;ep=0.;feature='Custom';width=.45;nozzle=0.;bed=0.;hot=False;homed=False
motions=[];segments=[];temps=[];commands=set();max_feed=0.;feed=0.
for lineno,line in enumerate(lines,1):
 if line.startswith(';TYPE:'):feature=line.split(':',1)[1]
 if line.startswith(';WIDTH:'):width=float(line.split(':',1)[1])
 s=line.split(';',1)[0].strip()
 if not s:continue
 cmd=s.split()[0];commands.add(cmd);a={k:float(v) for k,v in re.findall(r'([XYZEFSP])\s*(-?\d*\.?\d+)',s)}
 if cmd=='G90':relative_xyz=False
 if cmd=='G91':relative_xyz=True
 if cmd=='M82':relative_e=False
 if cmd=='M83':relative_e=True
 if cmd in ['M104','M109']:
  nozzle=a.get('S',nozzle);temps.append((lineno,cmd,nozzle));hot=(cmd=='M109' and nozzle==205) or (hot and nozzle==205)
 if cmd in ['M140','M190']:bed=a.get('S',bed);temps.append((lineno,cmd,bed))
 if cmd=='G28':pos[:]=0;homed=True
 if cmd=='G92':
  for j,k in enumerate('XYZ'):
   if k in a:pos[j]=a[k]
  if 'E' in a:ep=a['E']
 if cmd in ['G0','G1']:
  old=pos.copy()
  for j,k in enumerate('XYZ'):
   if k in a:pos[j]=pos[j]+a[k] if relative_xyz else a[k]
  e=a.get('E',0) if relative_e else a.get('E',ep)-ep
  if 'E' in a:ep=ep+a['E'] if relative_e else a['E']
  feed=a.get('F',feed);max_feed=max(max_feed,feed)
  assert homed,('motion before home',lineno)
  assert 0<=pos[0]<=210 and 0<=pos[1]<=210 and 0<=pos[2]<=205,('range',lineno,pos)
  motions.append(pos.copy())
  if e>0:
   assert hot,('positive extrusion before heat wait',lineno)
   if np.linalg.norm(pos[:2]-old[:2])>1e-6:
    segments.append((old.copy(),pos.copy(),width,feature,e))
assert not commands.intersection({'M500','M502','M92','M301','M303','M851','G29','M900','M572'}),commands
assert nozzle==bed==0 and lines.index('M84')>lines.index('M140 S0')
assert all(v<=205 for _,c,v in temps if c in ['M104','M109'])
assert all(v<=60 for _,c,v in temps if c in ['M140','M190'])
kind=lambda f:2 if f=='Custom' else 1 if f.startswith('Support') else 3 if f=='Skirt/Brim' else 0
v=np.array([[*a,*b,w,kind(f),e] for a,b,w,f,e in segments]);np.savez(O/'toolpaths.npz',segments=v)
printable=v[v[:,7]!=2];xyz=printable[:,:6].reshape(-1,3);motion=np.array(motions)
def statistic(label):
 return next((s.split(' = ',1)[1] for s in lines if s.startswith('; '+label+' = ')),None)
report={'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'all_commanded_positions_within_210x210x205':True,'motion_min_xyz':motion.min(0).tolist(),'motion_max_xyz':motion.max(0).tolist(),'print_extrusion_bounds_min':xyz.min(0).tolist(),'print_extrusion_bounds_max':xyz.max(0).tolist(),'extrusion_waits_for_205C':True,'heaters_off_at_end':True,'no_firmware_configuration_write_commands':True,'ordinary_text_gcode':True,'support_segment_count':int((v[:,7]==1).sum()),'max_commanded_feed_mm_s':max_feed/60,'estimated_time':statistic('estimated printing time (normal mode)'),'filament_grams':statistic('filament used [g]'),'filament_mm':statistic('filament used [mm]'),'physical_print_test':'NOT PERFORMED','nozzle':'0.4 mm assumed per user instruction'}
(O/'GCODE_CHECKS.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
im=Image.new('RGB',(1500,1050),'white');d=ImageDraw.Draw(im);d.text((30,15),'第一盘实际 G-code 路径：卡槽 + 三档卡扣 + 两把拨片',font=font(28),fill='#182E3D');d.text((30,60),'蓝：零件路径   橙：可拆支撑   灰：裙边 / 底边；下方剖层放大中间的 0.3 mm 卡扣',font=font(21),fill='#456072')
colors={0:'#236789',1:'#E68A28',3:'#98A2AC'}
def panel(x0,y0,size,bounds,selected,title):
 lo=np.array(bounds[:2]);hi=np.array(bounds[2:]);scale=min(size[0]/(hi[0]-lo[0]),size[1]/(hi[1]-lo[1]))
 def xy(p):return (int(x0+(p[0]-lo[0])*scale),int(y0+size[1]-(p[1]-lo[1])*scale))
 d.rectangle((x0,y0,x0+size[0],y0+size[1]),fill='#F4F7FA',outline='#D4DDE5')
 for a in selected:
  if int(a[7])==2:continue
  if np.all(a[:2]>=lo) and np.all(a[:2]<=hi) and np.all(a[3:5]>=lo) and np.all(a[3:5]<=hi):d.line([xy(a[:2]),xy(a[3:5])],fill=colors[int(a[7])],width=max(1,int(a[6]*scale)))
 d.text((x0,y0+size[1]+6),title,font=font(19),fill='#182E3D')
panel(35,120,(700,390),(20,45,185,125),printable,'整盘俯视叠加：左至右为 0.2 / 0.3 / 0.4 mm 卡扣、卡槽')
panel(780,120,(650,390),(20,45,185,125),printable[np.abs(printable[:,5]-.2)<.001],'第一层：检查零件与支撑的落地位置')
for i,z in enumerate([1.4,2.8,3.4,4.2]):
 sel=printable[np.abs(printable[:,5]-z)<.051]
 panel(35+i*365,590,(340,365),(68,54,102,87),sel,f'0.3 mm 卡扣：Z = {z:.1f} mm')
d.text((35,1010),'检查范围：路径、温度、行程、支撑分布；实际松紧和支撑拆除效果需首次打印确认。',font=font(21),fill='#456072')
im.save(O/'FIRST_PLATE_PATHS.png');print(json.dumps(report,ensure_ascii=False,indent=2))
