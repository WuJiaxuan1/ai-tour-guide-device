import bpy,bmesh,sys,struct,json
import numpy as np
from pathlib import Path
path=Path(sys.argv[sys.argv.index('--')+1]).resolve();O=Path(__file__).resolve().parents[1]
assert path.is_relative_to(O/'exports') or path.is_relative_to(O/'fit-test')
bpy.ops.wm.stl_import(filepath=str(path));obj=bpy.context.object;b=bmesh.new();b.from_mesh(obj.data);repairs=[]
for attempt in range(5):
 boundaries=[e for e in b.edges if e.is_boundary]
 if not boundaries:break
 fixed=False
 for edge in sorted(boundaries,key=lambda e:-e.calc_length()):
  a,c=edge.verts;delta=c.co-a.co
  for v in set(v for e in boundaries for v in e.verts):
   if v in edge.verts:continue
   t=(v.co-a.co).dot(delta)/delta.length_squared
   if 1e-6<t<1-1e-6 and (v.co-(a.co+t*delta)).length<0.0001:
    co=v.co.copy();newedge,newvert=bmesh.utils.edge_split(edge,a,t);newvert.co=co
    for face in list(newvert.link_faces):
     if len(face.verts)==4:
      opposite=next(w for w in face.verts if w is not a and w is not c and w is not newvert);bmesh.utils.face_split(face,newvert,opposite)
    bmesh.ops.remove_doubles(b,verts=list(b.verts),dist=.00001);repairs.append({'point':list(co),'edge_split_fraction':t});fixed=True;break
  if fixed:break
 if not fixed:raise RuntimeError('Open boundary is not a collinear T junction; no blind hole fill')
assert all(e.is_manifold for e in b.edges)
bmesh.ops.recalc_face_normals(b,faces=list(b.faces));b.to_mesh(obj.data);b.free();m=obj.data;m.calc_loop_triangles();v=np.empty(len(m.vertices)*3,np.float32);m.vertices.foreach_get('co',v);v=v.reshape(-1,3);f=np.empty(len(m.loop_triangles)*3,np.int32);m.loop_triangles.foreach_get('vertices',f);f=f.reshape(-1,3);tri=v[f];n=np.cross(tri[:,1].astype(float)-tri[:,0],tri[:,2].astype(float)-tri[:,0]);s=np.linalg.norm(n,axis=1);assert np.all(s>0);n/=s[:,None];dt=np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')]);a=np.zeros(len(f),dt);a['n']=n;a['v']=tri;path.write_bytes(b'AI TOUR GUIDE PLA PROTOTYPE mm; topological edge split only'.ljust(80,b' ')+struct.pack('<I',len(f))+a.tobytes());(O/'reports/stl-tjunction-repair.json').write_text(json.dumps(repairs,indent=2));print('T_JUNCTION_REPAIRED',len(repairs))
