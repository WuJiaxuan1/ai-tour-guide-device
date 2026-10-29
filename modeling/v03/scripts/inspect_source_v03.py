import bpy,numpy as np,json,time
from pathlib import Path
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=R/'modeling/v03';bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v01/cavity-clearance-draft-v01.blend'));o=next(o for o in bpy.data.objects if o.name.startswith('Cavity_Draft_'));m=o.data
par=np.arange(len(m.vertices),dtype=np.int32);sizes=np.ones(len(m.vertices),dtype=np.int32)
def find(i):
 while par[i]!=i:par[i]=par[par[i]];i=par[i]
 return i
for e in m.edges:
 a,b=map(find,e.vertices)
 if a!=b:
  if sizes[a]<sizes[b]:a,b=b,a
  par[b]=a;sizes[a]+=sizes[b]
labels=np.array([find(i) for i in range(len(par))]);ids,counts=np.unique(labels,return_counts=True);result=[]
for idx,n in sorted(zip(ids,counts),key=lambda t:-t[1])[:20]:
 vs=[v.co[:] for v in m.vertices if labels[v.index]==idx];vs=np.array(vs);result.append({'root':int(idx),'vertices':int(n),'bounds_min':vs.min(0).tolist(),'bounds_max':vs.max(0).tolist()})
(O/'reports/source-components.json').write_text(json.dumps({'component_count':len(ids),'largest':result},indent=2));print('BODY_COMPONENTS',json.dumps({'component_count':len(ids),'largest':result}))
# End-plane shell contacts at raw rear X=0, and radial positions in cylindrical frame.
a=np.load(R/'modeling/v01/references/component-1.npy');v=a.reshape(-1,3);mask=abs(v[:,0])<.02;v=v[mask];r=np.linalg.norm(v[:,1:],axis=1);print('REAR_PLASTIC_RADII',np.quantile(r,[0,.1,.5,.9,1]).tolist())
