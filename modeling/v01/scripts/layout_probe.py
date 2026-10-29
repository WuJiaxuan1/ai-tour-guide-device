import bpy, numpy as np, json, math
from pathlib import Path
from mathutils import Vector
R=Path(r'F:\coding_projects\ai-tour-guide-device'); O=R/'modeling/v01'
bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v00/device-housing.blend'))
for o in list(bpy.data.objects):
 if o.type!='MESH': bpy.data.objects.remove(o,do_unlink=True)
h=next(o for o in bpy.context.scene.objects if o.type=='MESH');h.name='Housing_appearance_150mm_UNMODIFIED_CAVITY'
s=150/h.dimensions.z
h.scale=(s,s,s);bpy.context.view_layer.objects.active=h;h.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
h.color=(.72,.72,.75,1)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS'
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=900;scene.render.resolution_y=1100;scene.render.resolution_percentage=100
scene.world.color=(.95,.95,.95)
sh=scene.display.shading;sh.light='STUDIO';sh.studiolight_rotate_z=.4;sh.color_type='OBJECT';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';sh.show_specular_highlight=True
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=175

def view(name,loc,target=(0,0,0),scale=175):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;scene.render.filepath=str(O/f'previews/{name}.png');bpy.ops.render.render(write_still=True)
view('housing-positive-x',(300,0,0));view('housing-negative-x',(-300,0,0))
h.hide_render=True
parts=[]
for idx in [1,3,5,7]:
 a=np.load(O/f'references/component-{idx}.npy').reshape(-1,3);v,inv=np.unique(a,axis=0,return_inverse=True);v=v[:,[0,2,1]];v[:,1]*=-1
 mesh=bpy.data.meshes.new(f'Official_part_{idx}');mesh.from_pydata(v.tolist(),[],inv.reshape(-1,3).tolist());mesh.update();o=bpy.data.objects.new(f'Official_part_{idx}',mesh);scene.collection.objects.link(o);o.color=(.15,.4,.62,1) if idx==1 else (.92,.55,.12,1);parts.append(o)
view('device-positive-x',(200,0,0),target=(7.5,0,0),scale=70);view('device-negative-x',(-200,0,0),target=(7.5,0,0),scale=70)
print('SCALE',s,'DIM_MM',list(h.dimensions))
# Inspect geometric end planes: establishes shell back/open side from actual mesh.
a=np.load(O/'references/component-1.npy');print('END_PLANES',sum(np.all(abs(a[:,:,0])<.01,axis=1)),sum(np.all(abs(a[:,:,0]-15)<.01,axis=1)))
