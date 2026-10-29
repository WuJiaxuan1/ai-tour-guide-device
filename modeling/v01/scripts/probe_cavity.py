import bpy,math,json
from pathlib import Path
from mathutils import Vector
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=R/'modeling/v01'
bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v00/device-housing.blend'));h=next(o for o in bpy.context.scene.objects if o.type=='MESH');s=150/h.dimensions.z;h.scale=(s,s,s);bpy.context.view_layer.objects.active=h;h.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
result=[]
for x in range(-30,36,5):
 ds=[]
 for j in range(72):
  a=j*math.tau/72;d=Vector((0,math.cos(a),math.sin(a)));ok,p,n,i=h.ray_cast(Vector((x,0,22)),d,distance=70);ds.append(round((p-Vector((x,0,22))).length,3) if ok else None)
 valid=sorted(v for v in ds if v is not None);result.append(dict(x=x,hit_count=len(valid),min=valid[0] if valid else None,median=valid[len(valid)//2] if valid else None,max=valid[-1] if valid else None,radii=ds))
(O/'reports/cavity-radial-probe.json').write_text(json.dumps(result,indent=2));print(json.dumps([{k:v for k,v in d.items() if k!='radii'} for d in result]))
