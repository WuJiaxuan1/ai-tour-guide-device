import bpy,numpy as np,json
from pathlib import Path
O=Path(__file__).resolve().parents[1];P=json.loads((O/'parameters-v01.json').read_text(encoding='utf-8-sig'))
def section(v,f):
 tri=v[f];d=tri[:,:,1]-P['axis_y'];mask=(d.min(1)<1e-6)&(d.max(1)>-1e-6);segments=[]
 for t in tri[mask]:
  ds=t[:,1]-P['axis_y'];pts=[]
  if max(abs(ds))<1e-6:continue
  for i,j in [(0,1),(1,2),(2,0)]:
   if abs(ds[i])<1e-6:pts.append(t[i,[0,2]])
   if ds[i]*ds[j]<0:
    a=ds[i]/(ds[i]-ds[j]);pts.append((t[i]+a*(t[j]-t[i]))[[0,2]])
  if len(pts)>=2:
   pts=np.array(pts);delta=pts[:,None,:]-pts[None,:,:];i,j=np.unravel_index(np.argmax((delta*delta).sum(2)),(len(pts),len(pts)))
   if np.linalg.norm(pts[i]-pts[j])>1e-6:segments.append([pts[i],pts[j]])
 return np.array(segments,dtype=np.float32)

for key,file,prefix in [('before','assembly-layout-v01.blend','Original_Housing_'),('after','cavity-clearance-draft-v01.blend','Cavity_Draft_')]:
 bpy.ops.wm.open_mainfile(filepath=str(O/file));h=next(o for o in bpy.context.scene.objects if o.name.startswith(prefix));v=np.empty(len(h.data.vertices)*3,np.float32);h.data.vertices.foreach_get('co',v);v=v.reshape(-1,3);h.data.calc_loop_triangles();f=np.empty(len(h.data.loop_triangles)*3,np.int32);h.data.loop_triangles.foreach_get('vertices',f);f=f.reshape(-1,3);a=section(v,f);np.save(O/f'reports/section-{key}.npy',a);print(key,len(a))
