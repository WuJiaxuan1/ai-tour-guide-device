import bpy, numpy as np, json, math, struct, time
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=Path(__file__).resolve().parents[1];P=json.loads((O/'parameters-v01.json').read_text(encoding='utf-8-sig'))
report={'parameters':P,'limitations':['Not a printable or retaining assembly','Front glass and bearing boundary absent in manual','Official STL omits screen and electronics','USB plug, support contacts, wall thickness and self intersection not verified']}
bpy.ops.wm.open_mainfile(filepath=str(R/'modeling/v00/device-housing.blend'));scene=bpy.context.scene
for obj in list(bpy.data.objects):
 if obj.type!='MESH':bpy.data.objects.remove(obj,do_unlink=True)
h=next(o for o in scene.objects if o.type=='MESH');h.name='Original_Housing_Scaled_150mm_No_Cavity_Changes'
s=P['appearance_height']/h.dimensions.z;h.scale=(s,)*3;bpy.context.view_layer.objects.active=h;bpy.ops.object.select_all(action='DESELECT');h.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);h.color=(.70,.70,.73,1)
scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS';scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1000;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.world.color=(.92,.92,.92)
sh=scene.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD'
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
bpy.ops.object.camera_add();cam=bpy.context.object;cam.name='Orthographic_Inspection';cam.data.type='ORTHO';scene.camera=cam

def render(name,loc,target=(0,0,0),scale=175):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;scene.render.filepath=str(O/f'previews/{name}.png');bpy.ops.render.render(write_still=True)

def collection(name):
 c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
refs=collection('REFERENCE_ONLY_Official_Casing_And_Buttons_NOT_PRINT_PARTS');parts=[];tris=[]
for idx in P['official_assembly_component_ids']:
 a=np.load(O/f'references/component-{idx}.npy').copy();a=a[:,:,[0,2,1]];a[:,:,1]*=-1;a[:,:,0]+=P['device_back_x'];a[:,:,1]+=P['axis_y'];a[:,:,2]+=P['axis_z'];tris.append(a)
 v,inv=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);mesh=bpy.data.meshes.new(f'Official_Component_{idx}');mesh.from_pydata(v.tolist(),[],inv.reshape(-1,3).tolist());mesh.update();obj=bpy.data.objects.new({1:'Official_Plastic_Casing_SCREEN_AND_PCB_ABSENT',3:'Official_Power_Button',5:'Official_Upper_Left_Button',7:'Official_Upper_Right_Button'}[idx],mesh);refs.objects.link(obj);obj.color={1:(.1,.4,.65,1),3:(.9,.1,.1,1),5:(1,.7,.03,1),7:(.1,.25,.9,1)}[idx];parts.append(obj)
# Binary STL in mm contains only the correct four official components; reference only.
a=np.concatenate(tris);out=bytearray(b'REFERENCE ONLY assembled official casing and 3 buttons; mm'.ljust(80,b' '))+struct.pack('<I',len(a));n=np.cross(a[:,1]-a[:,0],a[:,2]-a[:,0]);n/=np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-30)
dt=np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')]);buf=np.zeros(len(a),dt);buf['n']=n;buf['v']=a;out.extend(buf.tobytes());(O/'references/stopwatch-assembled-reference-mm.stl').write_bytes(out)
report['appearance_dimensions_mm']=list(h.dimensions);report['appearance_scale_to_mm']=s;report['official_casing_dimensions_mm']=list(parts[0].dimensions);report['reference_faces']=len(a)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(O/'assembly-layout-v01.blend'))
render('before-front',(300,0,0));render('before-rear',(-300,0,0));render('before-right',(0,300,0))
# Bulk array access preserves every triangle; welding coincident coordinates only avoids UV seams in booleans.
mesh=h.data;v=np.empty(len(mesh.vertices)*3,np.float32);mesh.vertices.foreach_get('co',v);v=v.reshape(-1,3);mesh.calc_loop_triangles();f=np.empty(len(mesh.loop_triangles)*3,np.int32);mesh.loop_triangles.foreach_get('vertices',f);f=f.reshape(-1,3)
# Save actual Y=axis slice for the dimension sheet; no projection is called a section.
def section(v,f):
 tri=v[f];d=tri[:,:,1]-P['axis_y'];mask=(d.min(1)<1e-6)&(d.max(1)>-1e-6);segments=[]
 for t in tri[mask]:
  ds=t[:,1]-P['axis_y'];pts=[]
  if max(abs(ds))<1e-6:continue
  for i,j in [(0,1),(1,2),(2,0)]:
   if abs(ds[i])<1e-6:pts.append(t[i,[0,2]])
   if ds[i]*ds[j]<0:
    a=ds[i]/(ds[i]-ds[j]);pts.append((t[i]+a*(t[j]-t[i]))[[0,2]])
  if len(pts)>=2:
   pts=np.array(pts);delta=pts[:,None,:]-pts[None,:,:];i,j=np.unravel_index(np.argmax((delta*delta).sum(2)),(len(pts),len(pts)))
   if np.linalg.norm(pts[i]-pts[j])>1e-6:segments.append([pts[i],pts[j]])
 return np.array(segments,dtype=np.float32)
np.save(O/'reports/section-before.npy',section(v,f))
u,inv=np.unique(np.round(v,5),axis=0,return_inverse=True);fm=inv[f];new=bpy.data.meshes.new('Local_Boolean_Working_Copy_Welded_0p00001mm');new.vertices.add(len(u));new.vertices.foreach_set('co',u.ravel());new.loops.add(fm.size);new.loops.foreach_set('vertex_index',fm.ravel());new.polygons.add(len(fm));new.polygons.foreach_set('loop_start',np.arange(0,fm.size,3,dtype=np.int32));new.polygons.foreach_set('loop_total',np.full(len(fm),3,dtype=np.int32));new.update()
original=h;original.hide_render=True;original.hide_set(True);h=bpy.data.objects.new('Cavity_Draft_53mm_Through_Bore_And_Three_Button_Channels_NO_RETENTION',new);scene.collection.objects.link(h);h.color=(.7,.7,.73,1);report['welded_vertices_before_boolean']=len(u)
cutcol=collection('BOOLEAN_TOOLS_Candidates_Hidden_NOT_PRINT_PARTS')
def apply_cut(obj):
 for c in list(obj.users_collection):c.objects.unlink(obj)
 cutcol.objects.link(obj);bpy.context.view_layer.objects.active=h;bpy.ops.object.select_all(action='DESELECT');h.select_set(True);mod=h.modifiers.new('Candidate_Clearance','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=obj;bpy.ops.object.modifier_apply(modifier=mod.name);obj.hide_render=True;obj.hide_set(True)
bpy.ops.mesh.primitive_cylinder_add(vertices=192,radius=P['bore_diameter_candidate']/2,depth=P['through_cutter_length'],location=(0,P['axis_y'],P['axis_z']),rotation=(0,math.pi/2,0));obj=bpy.context.object;obj.name='Candidate_Bore_53mm_ALL_DEPTHS';apply_cut(obj)
for part in parts[1:]:
 coords=np.array([list(part.matrix_world@Vector(c)) for c in part.bound_box]);lo=coords.min(0);hi=coords.max(0);mid=(lo+hi)/2;dim=hi-lo;mid[0]=0;dim[0]=P['through_cutter_length'];dim[1:]+=2*P['button_bbox_margin_candidate'];bpy.ops.mesh.primitive_cube_add(size=1,location=mid.tolist());obj=bpy.context.object;obj.dimensions=dim.tolist();bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.name='Through_Channel_'+part.name;apply_cut(obj)
bpy.context.view_layer.update()
# Numeric surface interference checks. These do not establish real hardware safety or complete fit.
dg=bpy.context.evaluated_depsgraph_get();tree=BVHTree.FromObject(h,dg,epsilon=0.00001);checks=[]
for offset in range(0,61,5):
 total=0
 for part in parts:
  vs=[part.matrix_world@v.co+Vector((offset,0,0)) for v in part.data.vertices];fs=[tuple(p.vertices) for p in part.data.polygons];ref=BVHTree.FromPolygons(vs,fs,all_triangles=True,epsilon=0.00001);total+=len(tree.overlap(ref))
 checks.append({'front_translation_mm':offset,'surface_triangle_intersection_pairs':total})
report['official_surface_insertion_samples']=checks
# 360 radial clearance rays per plane through the device depth and full path.
mins=[]
for x in [10,15,20,25,30,35,40,50,60]:
 dist=[]
 for i in range(360):
  a=i*math.tau/360;origin=Vector((x,P['axis_y'],P['axis_z']));d=Vector((0,math.cos(a),math.sin(a)));ok,pt,no,fi=h.ray_cast(origin,d,distance=80)
  if ok:dist.append((pt-origin).length)
 mins.append({'x_mm':x,'minimum_sampled_radius_mm':min(dist) if dist else None,'hit_rays':len(dist)})
report['cylinder_clearance_samples']=mins
v2=np.empty(len(h.data.vertices)*3,np.float32);h.data.vertices.foreach_get('co',v2);v2=v2.reshape(-1,3);h.data.calc_loop_triangles();f2=np.empty(len(h.data.loop_triangles)*3,np.int32);h.data.loop_triangles.foreach_get('vertices',f2);f2=f2.reshape(-1,3);np.save(O/'reports/section-after.npy',section(v2,f2))
report['after_dimensions_mm']=list(h.dimensions);report['after_triangles']=len(f2)
render('draft-front',(300,0,0));render('draft-rear',(-300,0,0));render('draft-left',(0,300,0));render('draft-right',(0,-300,0));render('draft-oblique',(240,160,65),target=(0,0,5))
# Default scene opens from the true front. Original geometry and boolean tools are hidden.
cam.location=(300,0,0);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=175
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_distance=210
bpy.ops.wm.save_as_mainfile(filepath=str(O/'cavity-clearance-draft-v01.blend'))
(O/'reports/layout-checks-v01.json').write_text(json.dumps(report,indent=2),encoding='utf8');print('ROUND1_REPORT',json.dumps(report))
