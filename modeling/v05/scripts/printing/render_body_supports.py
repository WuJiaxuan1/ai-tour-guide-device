import bpy,bmesh,numpy as np,math
from pathlib import Path
from mathutils import Vector
O=Path.cwd()/'output/mega-s-body-fine';bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
sc.world=bpy.data.worlds.new('World');sc.world.color=(.94,.95,.97);sc.render.engine='BLENDER_WORKBENCH';sc.render.resolution_x=1200;sc.render.resolution_y=1000;sc.render.resolution_percentage=100
sh=sc.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.background_type='WORLD';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
bpy.ops.wm.stl_import(filepath=str(O/'BODY_FACE_UP.stl'));body=bpy.context.object;body.color=(.68,.75,.8,1)
# Compare rendered object bounds against the actual exported print-path coordinates before overlaying support paths.
vv=np.array([v.co[:] for v in body.data.vertices]);lo=vv.min(0);hi=vv.max(0);print('BODY_BOUNDS',lo,hi,flush=True)
a=np.load(O/'body-support-paths.npz')['support'];mask=np.mod(a[:,5],.8)<.18;a=a[mask]
# Horizontal extrusion ribbons represent sampled support toolpaths, not an additional print mesh.
d=a[:,3:5]-a[:,:2];length=np.linalg.norm(d,axis=1);a=a[length>1e-5];d=d[length>1e-5];length=length[length>1e-5];side=np.stack([-d[:,1],d[:,0]],axis=1)/length[:,None]*a[:,6,None]/2
p=a[:,:3];q=a[:,3:6];w=np.column_stack([side,np.zeros(len(side))]);v=np.stack([p-w,p+w,q+w,q-w],axis=1).reshape(-1,3);f=np.arange(len(v)).reshape(-1,4)
me=bpy.data.meshes.new('support_paths');me.from_pydata(v.tolist(),[],f.tolist());ob=bpy.data.objects.new('SUPPORT_PATHS_SAMPLED',me);sc.collection.objects.link(ob);ob.color=(1,.45,.08,1)
bpy.ops.object.camera_add();cam=bpy.context.object;sc.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=215
target=Vector((105,105,35));cam.location=(290,-140,245);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.filepath=str(O/'BODY_SUPPORTS_OVERVIEW.png');bpy.ops.render.render(write_still=True)
for meshobj in [body,ob]:
 bm=bmesh.new();bm.from_mesh(meshobj.data);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=.0001,plane_co=(0,105,0),plane_no=(0,-1,0),clear_outer=True,clear_inner=False);bm.to_mesh(meshobj.data);bm.free()
cam.location=(190,-200,160);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=190
sc.render.filepath=str(O/'BODY_SUPPORTS_CUTAWAY.png');bpy.ops.render.render(write_still=True)
print('BODY_SUPPORT_PREVIEWS_DONE')
