from pathlib import Path
import numpy as np,json
O=Path.cwd()/'output/mega-s-first-print';s=np.load(O/'toolpaths.npz')['segments'];out=[]
def point_distance(p,a,b):
 v=b-a;t=np.clip(np.sum((p-a)*v,axis=-1)/np.maximum(np.sum(v*v,axis=-1),1e-16),0,1)
 return np.linalg.norm(p-(a+t[...,None]*v),axis=-1)
for z in sorted(set(np.round(s[:,5],4))):
 layer=s[np.abs(s[:,5]-z)<1e-4];model=layer[layer[:,7]==0];support=layer[layer[:,7]==1]
 if not len(model) or not len(support):continue
 low=1000
 for i in range(0,len(support),100):
  q=support[i:i+100];a=q[:,None,:2];b=q[:,None,3:5];c=model[None,:,:2];d=model[None,:,3:5]
  ds=np.minimum.reduce([point_distance(a,c,d),point_distance(b,c,d),point_distance(c,a,b),point_distance(d,a,b)])
  def cross(u,v):return u[...,0]*v[...,1]-u[...,1]*v[...,0]
  inter=(cross(b-a,c-a)*cross(b-a,d-a)<0)&(cross(d-c,a-c)*cross(d-c,b-c)<0);ds[inter]=0
  clearance=ds-(q[:,None,6]+model[None,:,6])/2;low=min(low,float(clearance.min()))
 out.append({'z_mm':float(z),'minimum_nominal_bead_edge_gap_mm':low})
report={'method':'same-Z XY segment distances minus half commanded extrusion widths; finite centerline bead approximation, not physical extrusion simulation','minimum_gap_mm':min(x['minimum_nominal_bead_edge_gap_mm'] for x in out),'layers':out}
(O/'SUPPORT_CLEARANCE.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));assert report['minimum_gap_mm']>0.1
