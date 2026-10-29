import bpy,math,json,numpy as np
from pathlib import Path
from mathutils import Vector
O=Path(__file__).resolve().parents[1];R=O.parents[1];P=json.loads((O/'parameters-v02.json').read_text());C=P['ring_contact_candidate'];bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS'
def annulus(name,ri,ro,x0,x1,segments=256):
 verts=[]
 for x,r in [(x0,ri),(x0,ro),(x1,ri),(x1,ro)]:
  verts.extend([(x,r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments)) for i in range(segments)])
 faces=[]
 for i in range(segments):
  j=(i+1)%segments;faces.extend([(i,j,segments+j,segments+i),(2*segments+i,3*segments+i,3*segments+j,2*segments+j),(i,2*segments+i,2*segments+j,j),(segments+i,segments+j,3*segments+j,3*segments+i)])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);return obj
ring=annulus('RING_PREFORM_ID50p5mm_NOT_ASSEMBLED_NOT_FOR_PRINT',C['ring_inner_diameter_mm']/2,C['ring_outer_diameter_mm']/2,0,C['ring_thickness_mm']);ring.color=(.65,.67,.7,1)
def boolean(obj,op):
 bpy.context.view_layer.objects.active=ring;mod=ring.modifiers.new(op,'BOOLEAN');mod.operation=op;mod.solver='EXACT';mod.object=obj;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(obj,do_unlink=True)
for y in C['ear_center_offsets_y_mm']:
 bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=C['ear_radius_mm'],depth=C['ring_thickness_mm'],location=(C['ring_thickness_mm']/2,y,0),rotation=(0,math.pi/2,0));boolean(bpy.context.object,'UNION')
 bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=C['screw_clearance_hole_diameter_mm']/2,depth=12,location=(1.5,y,0),rotation=(0,math.pi/2,0));boolean(bpy.context.object,'DIFFERENCE')
for idx in [3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{idx}.npy').reshape(-1,3);yz=a[:,[2,1]].copy();yz[:,0]*=-1;lo=yz.min(0)-C['button_channel_margin_mm'];hi=yz.max(0)+C['button_channel_margin_mm'];mid=(lo+hi)/2;dim=hi-lo
 bpy.ops.mesh.primitive_cube_add(size=1,location=(1.5,float(mid[0]),float(mid[1])));o=bpy.context.object;o.dimensions=(12,float(dim[0]),float(dim[1]));bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.ops.mesh.primitive_cylinder_add(vertices=256,radius=C['button_relief_outer_radius_mm'],depth=16,location=(1.5,0,0),rotation=(0,math.pi/2,0));cap=bpy.context.object
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Limit_Relief_To_Preserve_Continuous_Outer_Web','BOOLEAN');mod.operation='INTERSECT';mod.solver='EXACT';mod.object=cap;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cap,do_unlink=True);boolean(o,'DIFFERENCE')
import bmesh
bm=bmesh.new();bm.from_mesh(ring.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.0001);boundary=[e for e in bm.edges if e.is_boundary];filled=bmesh.ops.holes_fill(bm,edges=boundary,sides=3)['faces'] if len(boundary)==3 else [];repair_area=sum(f.calc_area() for f in filled);assert repair_area<0.2;assert not any(e.is_boundary for e in bm.edges);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ring.data);bm.free();ring.data.update()
# Inspection only: circles show front projection of an approximately centered real device.
refs=bpy.data.collections.new('PROJECTION_GUIDES_NOT_PRINT_PARTS_NOT_COMPLETE_DEVICE');scene.collection.children.link(refs)
def guide(obj,color):
 for c in list(obj.users_collection):c.objects.unlink(obj)
 refs.objects.link(obj);obj.color=color
rim=annulus('REFERENCE_ONLY_Approx_2mm_Plastic_Rim',23.975,25.975,3.01,3.015);guide(rim,(.95,.77,.5,1))
contact=annulus('REFERENCE_ONLY_Contact_Projection_0p725mm_At_Centered_Nominal_Position',25.25,25.975,3.02,3.025);guide(contact,(1,.35,.08,1));tool=bpy.data.objects.new('Temporary_Projection_Clip',ring.data.copy());scene.collection.objects.link(tool);tool.scale.x=1.1;bpy.context.view_layer.objects.active=contact;mod=contact.modifiers.new('Actual_Ring_Contact_Projection','BOOLEAN');mod.operation='INTERSECT';mod.solver='EXACT';mod.object=tool;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(tool,do_unlink=True)
bpy.ops.mesh.primitive_cylinder_add(vertices=256,radius=23.975,depth=.01,location=(3.015,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.name='REFERENCE_ONLY_Approx_Glass_Diameter_DERIVED_47p95mm_NOT_MEASURED';guide(o,(.27,.57,.76,1))
bpy.ops.object.camera_add(location=(200,0,0));cam=bpy.context.object;cam.name='Orthographic_Contact_Projection';cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=92;scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1100;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.world=bpy.data.worlds.new('Inspection_World');scene.world.color=(.94,.94,.94);sh=scene.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.background_type='WORLD';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
scene.render.filepath=str(O/'previews/ring-contact-front-v02.png');bpy.ops.render.render(write_still=True)
refs.hide_render=True;scene.render.filepath=str(O/'previews/ring-preform-front-v02.png');bpy.ops.render.render(write_still=True)
cam.location=(130,75,50);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(O/'previews/ring-preform-oblique-v02.png');bpy.ops.render.render(write_still=True)
refs.hide_render=False;cam.location=(200,0,0);cam.rotation_euler=(-cam.location).to_track_quat('-Z','Y').to_euler()
counts=np.empty(len(ring.data.loops),np.int32);ring.data.loops.foreach_get('edge_index',counts);counts=np.bincount(counts,minlength=len(ring.data.edges));parent=list(range(len(ring.data.vertices)))
def find(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
for edge in ring.data.edges:parent[find(edge.vertices[1])]=find(edge.vertices[0])
components=len({find(i) for i in range(len(parent))})
assert components==1, f'Ring was split into {components} components'
report={'boolean_sliver_face_repair_area_mm2':repair_area,'connected_components':components,'status':P['status'],'units':'mm','ring_dimensions_local_xyz':list(ring.dimensions),'boundary_edges':int(sum(counts==1)),'edges_with_more_than_two_faces':int(sum(counts>2)),'loose_edges':int(sum(counts==0)),'ring_inner_diameter_candidate_mm':50.5,'contact_data':C,'body_assembly_interference_checked':False,'is_print_file':False}
(O/'reports/ring-preform-checks-v02.json').write_text(json.dumps(report,indent=2),encoding='utf8');bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'front-ring-preform-v02.blend'));print(json.dumps(report))
