import bpy,bmesh,numpy as np,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path(__file__).resolve().parents[1];R=O.parents[1]
bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v01/assembly-layout-v01.blend'))
o=next(o for o in bpy.data.objects if o.name.startswith('Original_Housing_'))
b=bmesh.new();b.from_mesh(o.data);bmesh.ops.remove_doubles(b,verts=list(b.verts),dist=.00001);bmesh.ops.recalc_face_normals(b,faces=list(b.faces));bmesh.ops.triangulate(b,faces=list(b.faces));bmesh.ops.dissolve_degenerate(b,edges=list(b.edges),dist=.00001);b.to_mesh(o.data);b.free();o.data.update()
m=o.data;m.calc_loop_triangles();v=np.empty(len(m.vertices)*3,np.float32);m.vertices.foreach_get('co',v);v=v.reshape(-1,3);f=np.empty(len(m.loop_triangles)*3,np.int32);m.loop_triangles.foreach_get('vertices',f);f=f.reshape(-1,3);np.savez(O/'reports/original-clean.npz',v=v,f=f)
t=BVHTree.FromPolygons(v,f,all_triangles=True);ay=-.02733765;az=22.28087056
samples=[]
for r in [0,20,23,25,26,27,28,29,30,31,32,33,34,35,36,37,38,40,42,45]:
 for a in range(0,360,10):
  y=ay+r*math.cos(math.radians(a));z=az+r*math.sin(math.radians(a));entry={"r":r,"angle":a}
  for side,x,d in [('front',100,-1),('rear',-100,1)]:
   pt,no,idx,dist=t.ray_cast(Vector((x,y,z)),Vector((d,0,0)),220);entry[side]=list(pt) if pt is not None else None
  samples.append(entry)
report={'bbox':[v.min(0).tolist(),v.max(0).tolist()],'samples':samples,'buttons':{}}
for idx in [1,3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{idx}.npy').reshape(-1,3);a=a[:,[0,2,1]];a[:,1]*=-1
 report['buttons'][str(idx)]={'bbox':[a.min(0).tolist(),a.max(0).tolist()]}
(O/'reports/original-surfaces.json').write_text(json.dumps(report,indent=2))
print('BBOX',report['bbox'],'BUTTONS',report['buttons'],flush=True)
for r in [26,30,34,38]:
 print('R',r,[(s['angle'],round(s['front'][0],2) if s['front'] else None,round(s['rear'][0],2) if s['rear'] else None) for s in samples if s['r']==r and s['angle']%30==0],flush=True)
print('INSPECT_ORIGINAL_DONE',flush=True)
