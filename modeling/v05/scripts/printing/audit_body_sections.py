import numpy as np,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
P=Path('F:/coding_projects/ai-tour-guide-device/modeling/working/20261028-print-v05')
a=np.load(P/'reports/01_FULL_HOUSING_CLOSED_BACK_v05.stl.npz');e=json.loads((P/'reports/export-checks-v05.json').read_text())['01_FULL_HOUSING_CLOSED_BACK_v05.stl'];v=a['v']-np.array(e['translation']);t=BVHTree.FromPolygons(v.tolist(),a['f'].tolist(),all_triangles=True)
def firstspan(origin,direction):
 p,n,fi,dd=t.ray_cast(Vector(origin),Vector(direction),200)
 if p is None:return None
 q,nn,ff,dist=t.ray_cast(p+Vector(direction)*.001,Vector(direction),200)
 if q is None:return None
 return {'entry':list(p),'exit':list(q),'thickness_in_probe_direction_mm':(q-p).length}
back=[{'y':y,'z':z,'measurement':firstspan((-100,y,z),(1,0,0))} for y,z in [(0,0),(10,0),(-10,0),(0,10),(0,20),(15,15),(-15,15)]]
side=[]
for x in [-10,0,10,20,25]:
 for deg in [0,30,60,90,120,150,180]:
  c,s=math.cos(math.radians(deg)),math.sin(math.radians(deg));side.append({'x':x,'angle_deg':deg,'measurement':firstspan((x,100*c,100*s),(0,-c,-s))})
o=Path.cwd()/'output/printing-guide';o.mkdir(parents=True,exist_ok=True);report={'back_axial_probes':back,'upper_side_radial_probes':side,'limitation':'Selected directional sections, not global minimum wall thickness; radial/axial distances differ from normal thickness. Probes may include posts or decorative relief.'};(o/'v05-wall-section-audit.json').write_text(json.dumps(report,indent=2));print('BACK',[(p['y'],p['z'],round(p['measurement']['thickness_in_probe_direction_mm'],3)) for p in back]);print('SIDE',[(p['x'],p['angle_deg'],round(p['measurement']['thickness_in_probe_direction_mm'],3) if p['measurement'] else None) for p in side]);print('SECTION_AUDIT_DONE')
