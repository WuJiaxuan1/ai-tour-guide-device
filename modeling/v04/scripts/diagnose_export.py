import bpy,bmesh,numpy as np,json
from pathlib import Path
O=Path(__file__).resolve().parents[1];bpy.ops.wm.stl_import(filepath=str(O/'exports/01_FULL_HOUSING_CLOSED_BACK_v04.stl'));b=bmesh.new();b.from_mesh(bpy.context.object.data);edges=[e for e in b.edges if e.is_boundary];remaining=set(edges);groups=[]
while remaining:
 stack=[remaining.pop()];g=[]
 while stack:
  e=stack.pop();g.append(e)
  for v in e.verts:
   for ee in v.link_edges:
    if ee in remaining:remaining.remove(ee);stack.append(ee)
 vs=set(v for e in g for v in e.verts);co=np.array([v.co[:] for v in vs]);groups.append({'edges':len(g),'bbox':[co.min(0).tolist(),co.max(0).tolist()],'coords':co.tolist() if len(co)<20 else None,'lengths':[e.calc_length() for e in g]})
print('BOUNDARY_DIAGNOSTIC',json.dumps(groups),flush=True)
