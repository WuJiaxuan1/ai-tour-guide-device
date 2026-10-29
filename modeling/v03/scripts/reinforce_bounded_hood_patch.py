import bpy,json
from pathlib import Path
from mathutils import Vector
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=Path(__file__).resolve().parents[1];pf=O/'parameters/print-v03.json';p=json.loads(pf.read_text());bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v01/cavity-clearance-draft-v01.blend'));h=next(o for o in bpy.data.objects if o.name.startswith('Cavity_Draft_'));centers=[]
for y in [18,19.5,21,22.5,24,25.5,27,28.5]:
 for z in [43,44.5,46,47.5,49]:
  hit,pt,n,face=h.ray_cast(Vector((-80,y,z)),Vector((1,0,0)),distance=100)
  if hit and n.x<-.2:centers.append(list(pt-n*2.4))
p['local_rear_hood_thickening']={'method':'bounded 18..28.5 Y,43..49 Z rear-hood internal reinforcement; 2.5mm-radius overlapping spheres 2.4mm inside original outer surface','centers_mm':centers,'radius_mm':2.5,'outward_local_allowance_mm':0.1,'reason':'continuous backing of localized thin original hood skin, remote from hardware'};pf.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8');print('LOCAL_HOOD_REINFORCEMENT_SAMPLES',len(centers))
