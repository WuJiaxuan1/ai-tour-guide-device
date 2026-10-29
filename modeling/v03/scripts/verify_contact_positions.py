import bpy,math,numpy as np,json
from pathlib import Path
from mathutils import Vector
R=Path(r'F:\coding_projects\ai-tour-guide-device');bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v01/cavity-clearance-draft-v01.blend'));h=next(o for o in bpy.data.objects if o.name.startswith('Cavity_Draft_'))
print('TORSO_FRONT_X',[(z,tuple(h.ray_cast(Vector((80,0,z)),Vector((-1,0,0)))[1])) for z in [-2,-5,-10,-15,-20,-25]])
a=np.load(R/'modeling/v01/references/component-1.npy');v,ix=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);v=v[:,[0,2,1]];v[:,1]*=-1;m=bpy.data.meshes.new('probe');m.from_pydata(v.tolist(),[],ix.reshape(-1,3).tolist());o=bpy.data.objects.new('probe',m);bpy.context.scene.collection.objects.link(o)
print('REAR_SEAT_RAYS',[(deg,r,tuple(o.ray_cast(Vector((-5,r*math.cos(math.radians(deg)),r*math.sin(math.radians(deg)))),Vector((1,0,0)))[1])) for deg in [80,90,100,190,200,210,330,340,350] for r in [23.1,23.4,23.65]])
