import bpy, math
from pathlib import Path
from mathutils import Vector
R=Path('F:/coding_projects/ai-tour-guide-device/print-delivery-v05')
O=Path(r'C:/Users/Macaroon/.codex/.chatgpt-projects/g-p-6aba0812d9c08191b8113a7e66f4ee79/output/printing-guide')
O.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH'
sc.render.resolution_x=700;sc.render.resolution_y=600;sc.render.resolution_percentage=100
sc.world=bpy.data.worlds.new('World');sc.world.color=(.94,.95,.97)
sh=sc.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.background_type='WORLD';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';sc.camera=cam
items=[('05_CLIP_TEST_SOCKET_v05.stl','01_socket',(-100,120,150),(.26,.55,.75,1)),('06_CLIP_TEST_3_TENTHS_v05.stl','02_clip',(100,-120,-150),(.85,.57,.2,1)),('03_FULL_FIT_JIG_v05.stl','03_fixture',(100,-140,180),(.26,.55,.75,1)),('02_CURVED_SNAP_RING_v05.stl','04_ring',(100,-120,-160),(.85,.57,.2,1))]
for filename,name,view,color in items:
 bpy.ops.wm.stl_import(filepath=str(R/filename));ob=bpy.context.object;ob.color=color
 pts=[ob.matrix_world@Vector(p) for p in ob.bound_box];lo=Vector(tuple(min(p[k] for p in pts) for k in range(3)));hi=Vector(tuple(max(p[k] for p in pts) for k in range(3)));center=(lo+hi)/2
 cam.location=center+Vector(view);cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=max(hi-lo)*1.45
 sc.render.filepath=str(O/(name+'.png'));bpy.ops.render.render(write_still=True);bpy.data.objects.remove(ob,do_unlink=True)
print('TEST_PART_RENDERS_DONE')
