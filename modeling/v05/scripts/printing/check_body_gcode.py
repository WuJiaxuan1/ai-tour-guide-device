from pathlib import Path
import re,json,hashlib,math,collections,time,sys
import numpy as np
O=Path(sys.argv[1]) if len(sys.argv)>1 else Path.cwd()/'output/mega-s-body-fine';p=O/(sys.argv[2] if len(sys.argv)>2 else 'BODY008.gcode');t=time.time();pos=[0.,0.,0.];rel=False;erel=False;ep=0.;feature='Custom';width=.45;hot=False;nozzle=bed=0;homed=False;feed=0;mn=[999.]*3;mx=[-999.]*3;print_mn=[999.]*3;print_mx=[-999.]*3;positive=0;commands=collections.Counter();support=[];selected=[];types=collections.Counter();zs=set();temps=[];stats={};layers=[];last_layer=-1
pat=re.compile(r'([XYZEFSP])\s*(-?\d*\.?\d+)');lastcommands=[]
with p.open() as f:
 for i,line in enumerate(f,1):
  if line.startswith(';'):
   if line.startswith(';TYPE:'):feature=line[6:].strip()
   elif line.startswith(';WIDTH:'):width=float(line[7:])
   elif line.startswith(';Z:'):layers.append(float(line[3:]))
   elif line.startswith(('; estimated printing time','; filament used','; estimated first layer printing')):
    k,v=line[2:].strip().split(' = ',1);stats[k]=v
   continue
  s=line.split(';',1)[0].strip()
  if not s:continue
  cmd=s.split()[0];commands[cmd]+=1;lastcommands.append(cmd);lastcommands=lastcommands[-10:];a={k:float(v) for k,v in pat.findall(s)}
  if cmd=='G90':rel=False
  elif cmd=='G91':rel=True
  elif cmd=='M82':erel=False
  elif cmd=='M83':erel=True
  elif cmd=='G28':pos=[0.,0.,0.];homed=True
  elif cmd in ['M104','M109']:
   nozzle=a.get('S',nozzle);temps.append([i,cmd,nozzle]);hot=(cmd=='M109' and nozzle>=195) or (hot and nozzle>=195)
  elif cmd in ['M140','M190']:bed=a.get('S',bed);temps.append([i,cmd,bed])
  elif cmd=='G92':
   if 'E' in a:ep=a['E']
   for j,k in enumerate('XYZ'):
    if k in a:pos[j]=a[k]
  elif cmd in ['G0','G1']:
   old=pos.copy()
   for j,k in enumerate('XYZ'):
    if k in a:pos[j]=pos[j]+a[k] if rel else a[k]
   e=a.get('E',0) if erel else a.get('E',ep)-ep
   if 'E' in a:ep=ep+a['E'] if erel else a['E']
   feed=a.get('F',feed)
   assert homed and all(0<=pos[j]<=([210,210,205][j]) for j in range(3)),(i,pos)
   for j in range(3):mn[j]=min(mn[j],pos[j]);mx[j]=max(mx[j],pos[j])
   if e>0:
    positive+=1;assert hot,(i,'cold extrusion')
    if math.hypot(pos[0]-old[0],pos[1]-old[1])>1e-6 and feature!='Custom':
     types[feature]+=1
     for j in range(3):print_mn[j]=min(print_mn[j],pos[j],old[j]);print_mx[j]=max(print_mx[j],pos[j],old[j])
     kind=1 if feature.startswith('Support') else 3 if feature=='Skirt/Brim' else 0
     row=old+pos+[width,kind]
     if kind==1:support.append(row)
     if kind==3 or any(abs(pos[2]-z)<.045 for z in [.2,10.04,20.04,30.04,40.04,50.04,60.04,65.0,70.04]):selected.append(row)
assert nozzle==0 and bed==0 and 'M84' in lastcommands
assert not set(commands)&{'M500','M502','M92','M301','M303','G29','M851','M900','M572'}
assert max(t[2] for t in temps if t[1] in ['M104','M109'])==205 and max(t[2] for t in temps if t[1] in ['M140','M190'])==60
assert 200 in [t[2] for t in temps if t[1]=='M104']
np.savez_compressed(O/'body-support-paths.npz',support=np.asarray(support,np.float32),selected=np.asarray(selected,np.float32))
report={'file':'BODY008.gcode','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'bytes':p.stat().st_size,'all_commanded_positions_in_210x210x205':True,'motion_min':mn,'motion_max':mx,'printed_path_min':print_mn,'printed_path_max':print_mx,'heating_wait_before_positive_extrusion':True,'heaters_off_at_end':True,'no_firmware_calibration_writes':True,'temperature_commands':temps,'motion_feature_segment_counts':dict(types),'object_layer_count':len(layers),'object_layer_steps_mm':sorted(set(round(b-a,4) for a,b in zip(layers,layers[1:]))),'stats':stats,'support_path_count':len(support),'physical_print_validation':'not performed','wall_thickness':'unchanged v05; not a global minimum-wall certification'}
(O/'GCODE_CHECKS.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));print('BODY_GCODE_AUDITED',time.time()-t,flush=True)
