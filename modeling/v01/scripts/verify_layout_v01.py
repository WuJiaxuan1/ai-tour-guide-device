import bpy,numpy as np,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path(__file__).resolve().parents[1];P=json.loads((O/'parameters-v01.json').read_text(encoding='utf-8-sig'));report=json.loads((O/'reports/layout-checks-v01.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(O/'cavity-clearance-draft-v01.blend'))
scene=bpy.context.scene;h=next(o for o in scene.objects if o.name.startswith('Cavity_Draft_'));old=next(o for o in scene.objects if o.name.startswith('Original_Housing_'));dg=bpy.context.evaluated_depsgraph_get()
tree=BVHTree.FromObject(old,dg,epsilon=0.00001);pairs=0
for o in scene.objects:
 if o.name.startswith('Official_'):
  ref=BVHTree.FromObject(o,dg,epsilon=0.00001);pairs+=len(tree.overlap(ref))
report['original_at_same_placement_surface_intersection_pairs']=pairs
edges=np.empty(len(h.data.loops),np.int32);h.data.loops.foreach_get('edge_index',edges);counts=np.bincount(edges,minlength=len(h.data.edges));report['draft_edge_usage']={'boundary':int(sum(counts==1)),'more_than_two_faces':int(sum(counts>2)),'loose':int(sum(counts==0))}
# Missing-electronics clearance body is a schematic occupancy proxy, never a print part.
c=bpy.data.collections.new('MANUAL_ENVELOPE_ONLY_Not_Real_Electronics_Geometry');scene.collection.children.link(c)
bpy.ops.mesh.primitive_cylinder_add(vertices=192,radius=26,depth=15.5,location=(17.75,P['axis_y'],P['axis_z']),rotation=(0,math.pi/2,0));proxy=bpy.context.object;proxy.name='Manual_52x52x15p5mm_Clearance_Proxy_NOT_SCREEN_OR_PRINT_PART';proxy.display_type='WIRE';proxy.hide_render=True
for cc in list(proxy.users_collection):cc.objects.unlink(proxy)
c.objects.link(proxy)
cam=scene.camera
for label,loc in [('draft-right',(0,-300,0)),('draft-left',(0,300,0))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(O/f'previews/{label}.png');bpy.ops.render.render(write_still=True)
# Reference STL import as separate temporary object verifies physical coordinate scale.
bpy.ops.wm.stl_import(filepath=str(O/'references/stopwatch-assembled-reference-mm.stl'),global_scale=1.0,use_scene_unit=False);check=bpy.context.object;report['reference_stl_reimport_dimensions_mm']=list(check.dimensions);bpy.data.objects.remove(check,do_unlink=True)
cam.location=(300,0,0);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'cavity-clearance-draft-v01.blend'))
(O/'reports/layout-checks-v01.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps({k:report[k] for k in ['original_at_same_placement_surface_intersection_pairs','draft_edge_usage','reference_stl_reimport_dimensions_mm']}))
