import bpy,numpy as np,json
from pathlib import Path
from mathutils import Vector
O=Path(__file__).resolve().parents[1];bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.world=bpy.data.worlds.new('Preview_World');s.world.color=(.94,.94,.94)
def add(name,ar,offset,color):
 v=ar['v']+np.array(offset);f=ar['f'];m=bpy.data.meshes.new(name);m.vertices.add(len(v));m.vertices.foreach_set('co',v.astype(np.float32).ravel());m.loops.add(f.size);m.loops.foreach_set('vertex_index',f.astype(np.int32).ravel());m.polygons.add(len(f));m.polygons.foreach_set('loop_start',np.arange(0,f.size,3,dtype=np.int32));m.polygons.foreach_set('loop_total',np.full(len(f),3,dtype=np.int32));m.update();o=bpy.data.objects.new(name,m);s.collection.objects.link(o);o.color=color
add('FIT_TEST_CARRIER',np.load(O/'reports/01_FIT_TEST_CARRIER_52p6mm_PLA_v03.stl.npz'),(-40,0,0),(.7,.72,.75,1));add('COMMON_FRONT_RING',np.load(O/'reports/02_FRONT_RING_50p5mm_PLA_v03.stl.npz'),(40,0,0),(.92,.64,.2,1));bpy.ops.mesh.primitive_plane_add(size=210);bpy.context.object.color=(.85,.87,.89,1)
bpy.ops.object.camera_add(location=(200,-230,210));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=230;s.camera=cam;s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=1100;s.render.resolution_y=800;s.render.resolution_percentage=100;sh=s.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.background_type='WORLD';sh.show_shadows=True;sh.show_cavity=True;s.render.filepath=str(O/'previews/print-first-pair-v03.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.open_mainfile(filepath=str(O/'assembly-print-v03.blend'));s=bpy.context.scene
for o in s.objects:
 if o.name.startswith('REFERENCE_ONLY_') or o.name.startswith('PRINT_PART_Removable_'):o.hide_render=True
cam=s.camera;cam.location=(-200,100,70);cam.rotation_euler=(Vector((0,0,22))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=112;s.render.filepath=str(O/'previews/rear-support-closeup-v03.png');bpy.ops.render.render(write_still=True)
