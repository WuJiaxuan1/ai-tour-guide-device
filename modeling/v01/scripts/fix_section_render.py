from pathlib import Path
import re
O=Path(__file__).resolve().parents[1]
source=O/'scripts/build_layout_v01.py';s=source.read_text(encoding='utf-8-sig')
start=s.index('def section(v,f):');end=s.index("np.save(O/'reports/section-before.npy'",start)
new='''def section(v,f):
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
'''
s=s[:start]+new+s[end:];s=s.replace("render('draft-right',(0,300,0));render('draft-left',(0,-300,0))","render('draft-left',(0,300,0));render('draft-right',(0,-300,0))");source.write_text(s,encoding='utf8')
# Recompute both actual mesh sections; handle plane-vertex intersections explicitly.
repair='''import bpy,numpy as np,json
from pathlib import Path
O=Path(__file__).resolve().parents[1];P=json.loads((O/'parameters-v01.json').read_text(encoding='utf-8-sig'))
'''+new+'''
for key,file,prefix in [('before','assembly-layout-v01.blend','Original_Housing_'),('after','cavity-clearance-draft-v01.blend','Cavity_Draft_')]:
 bpy.ops.wm.open_mainfile(filepath=str(O/file));h=next(o for o in bpy.context.scene.objects if o.name.startswith(prefix));v=np.empty(len(h.data.vertices)*3,np.float32);h.data.vertices.foreach_get('co',v);v=v.reshape(-1,3);h.data.calc_loop_triangles();f=np.empty(len(h.data.loop_triangles)*3,np.int32);h.data.loop_triangles.foreach_get('vertices',f);f=f.reshape(-1,3);a=section(v,f);np.save(O/f'reports/section-{key}.npy',a);print(key,len(a))
'''
(O/'scripts/repair_section_v01.py').write_text(repair,encoding='utf8')
report=O/'scripts/create_report_v01.py';s=report.read_text(encoding='utf-8-sig');s=s.replace('cy=y0+290;sc=3.6','cy=y0+300;sc=3.4')
s=s.replace("for line in np.load(O/f'reports/section-{key}.npy'):\n  d.line([xy(*pt) for pt in line],fill='#6b7681',width=2)","""for line in np.load(O/f'reports/section-{key}.npy'):
  a,b=line.copy(); dz=b[1]-a[1]
  if abs(dz)<1e-9:
   if not -15<=a[1]<=65:continue
  else:
   ta,tb=sorted([(-15-a[1])/dz,(65-a[1])/dz]);ta=max(0,ta);tb=min(1,tb)
   if ta>tb:continue
   aa=a+(b-a)*ta;bb=a+(b-a)*tb;a,b=aa,bb
  d.line([xy(*a),xy(*b)],fill='#6b7681',width=2)""")
s=s.replace("'轴线剖面 Y = -0.027 mm：'","'安装区剖面 Y = -0.027 mm：'")
report.write_text(s,encoding='utf8')
