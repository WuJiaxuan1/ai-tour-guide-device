import bpy,numpy as np,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path(__file__).resolve().parents[1];a=np.load(O/'reports/original-clean.npz');t=BVHTree.FromPolygons(a['v'],a['f'],all_triangles=True);ay=-.02733765;az=22.28087056
n=360;radii=np.arange(25.,43.01,.25);front=np.zeros((len(radii),n));rear=front.copy()
for j,r in enumerate(radii):
 for i in range(n):
  y=ay+r*math.cos(i*math.tau/n);z=az+r*math.sin(i*math.tau/n)
  for x,d,out in [(100,-1,front),(-100,1,rear)]:
   pt,no,idx,dist=t.ray_cast(Vector((x,y,z)),Vector((d,0,0)),220);out[j,i]=pt.x if pt is not None else np.nan
np.savez(O/'reports/surface-profiles.npz',radii=radii,front=front,rear=rear)
print('PROFILE_DONE','missing',int(np.isnan(front).sum()),int(np.isnan(rear).sum()),flush=True)
