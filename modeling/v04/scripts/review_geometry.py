import bpy,bmesh,numpy as np,json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path(__file__).resolve().parents[1];R=O.parents[1];P=json.loads((O/'parameters/print-v04.json').read_text());S=np.array([0,P['axis_y'],P['axis_z']]);bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=.001;sc.unit_settings.length_unit='MILLIMETERS';sc.world=bpy.data.worlds.new('World');sc.world.color=(.92,.92,.92)
def obj(name,v,f,color,smooth=False):
 m=bpy.data.meshes.new(name);m.vertices.add(len(v));m.vertices.foreach_set('co',np.asarray(v,np.float32).ravel());m.loops.add(f.size);m.loops.foreach_set('vertex_index',np.asarray(f,np.int32).ravel());m.polygons.add(len(f));m.polygons.foreach_set('loop_start',np.arange(0,f.size,3,dtype=np.int32));m.polygons.foreach_set('loop_total',np.full(len(f),3,dtype=np.int32));m.update();o=bpy.data.objects.new(name,m);sc.collection.objects.link(o);o.color=color
 if smooth:
  b=bmesh.new();b.from_mesh(m);bmesh.ops.remove_doubles(b,verts=list(b.verts),dist=.00001);bmesh.ops.recalc_face_normals(b,faces=list(b.faces));b.to_mesh(m);b.free();m.update();m.polygons.foreach_set('use_smooth',np.ones(len(m.polygons),bool));m.set_sharp_from_angle(angle=math.radians(40))
 return o
def load(name,color,smooth=False):
 exported={'body-local':'01_FULL_HOUSING_CLOSED_BACK_v04.stl','ring-local':'02_CURVED_SNAP_RING_v04.stl'}
 if name in exported and (O/'reports/export-checks-v04.json').exists():
  fn=exported[name];a=np.load(O/f'reports/{fn}.npz');ex=json.loads((O/'reports/export-checks-v04.json').read_text())[fn];v=a['v']-np.array(ex['translation'])
  if name=='ring-local':v=np.stack([v[:,2],v[:,1],-v[:,0]],axis=1)
 else:a=np.load(O/f'reports/{name}.npz');v=a['v']
 return obj(name,v+S,a['f'],color,smooth)
body=load('body-local',(.75,.75,.77,1),True);ring=load('ring-local',(.82,.64,.35,1),True)
references=[]
for i in [1,3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{i}.npy')[:,:,[0,2,1]].copy();a[:,:,1]*=-1;a+=S+np.array([P['device_back_x'],0,0]);v,iv=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);references.append(obj('REFERENCE_ONLY_'+str(i),v,iv.reshape(-1,3),(.14,.26,.31,1)))
bpy.ops.mesh.primitive_cylinder_add(vertices=180,radius=23.975,depth=.45,location=(31.25,P['axis_y'],P['axis_z']),rotation=(0,math.pi/2,0));screen=bpy.context.object;screen.name='REFERENCE_ONLY_GLASS_SCHEMATIC';screen.color=(.07,.15,.19,1);references.append(screen)
bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();tb=BVHTree.FromObject(body,dg);tr=BVHTree.FromObject(ring,dg);report={}
path=[]
for step in np.arange(0,70.01,.5):
 overlaps={}
 for o in references[:4]:
  t=BVHTree.FromPolygons([v.co+Vector((float(step),0,0)) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],all_triangles=True);count=len(tb.overlap(t))
  if count:overlaps[o.name]=count
 if overlaps:path.append({'offset':float(step),'overlaps':overlaps})
report['path_nonzero']=path;report['path_sample_count']=141;report['ring_static']={o.name:len(tr.overlap(BVHTree.FromObject(o,dg))) for o in references}
body.data.calc_loop_triangles();vv=np.empty(len(body.data.vertices)*3,np.float32);body.data.vertices.foreach_get('co',vv);vv=vv.reshape(-1,3);ff=np.empty(len(body.data.loop_triangles)*3,np.int32);body.data.loop_triangles.foreach_get('vertices',ff);ff=ff.reshape(-1,3);tri=vv[ff].astype(float);norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);areas=np.linalg.norm(norm,axis=1);rng=np.random.default_rng(44);ids=rng.choice(len(ff),size=4000,replace=False,p=areas/areas.sum());thick=[]
for idx in ids:
 c=Vector(tri[idx].mean(0));n=Vector(norm[idx]/areas[idx]);pt,no,fi,dd=tb.ray_cast(c-n*.03,-n,100)
 if pt is not None and no.dot(-n)>.1:thick.append({'mm':(pt-c).length,'point':list(c)})
report['body_wall_samples']={'valid':len(thick),'minimum_mm':min(t['mm'] for t in thick),'below_0p8':sum(t['mm']<.8 for t in thick),'below_1p2':sum(t['mm']<1.2 for t in thick),'lowest_20':sorted(thick,key=lambda t:t['mm'])[:20],'limitation':'finite normal rays; sharp edges may yield shorter ray lengths than nominal wall thickness'}
report['actual_stl_readback_used']=True
(O/'reports/assembly-review.json').write_text(json.dumps(report,indent=2));print('CHECKS',json.dumps({k:v for k,v in report.items() if k!='body_wall_samples'}),flush=True);print('WALL',json.dumps(report['body_wall_samples'])[:3000],flush=True)
sc.render.engine='BLENDER_WORKBENCH';sc.render.resolution_x=1000;sc.render.resolution_y=1100;sc.render.resolution_percentage=100;sh=sc.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.background_type='WORLD';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';sc.camera=cam
def render(name,pos,target=(0,0,0),scale=175):
 cam.location=pos;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;sc.render.filepath=str(O/f'previews/{name}.png');bpy.ops.render.render(write_still=True)
render('assembled-front',(300,0,0));render('assembled-back',(-300,0,0));render('assembled-oblique',(260,150,75));render('assembled-side',(0,-300,0))
ring.color=(.75,.75,.77,1);render('assembled-white',(260,150,75));ring.color=(.82,.64,.35,1)
ring.hide_render=True
for o in references:o.hide_render=True
render('empty-front',(300,50,20));render('empty-front-straight',(300,0,22),target=(0,0,22),scale=100)
body.hide_render=True;ring.hide_render=False
render('ring-back',(-250,80,80),target=(30,0,22),scale=83)
body.hide_render=False
for o in references:o.hide_render=False
# Separate reference collection is explicitly labeled and excluded from print exports.
refs=bpy.data.collections.new('REFERENCE_ONLY_StopWatch_NOT_PRINT');sc.collection.children.link(refs)
for o in references:
 for c in list(o.users_collection):c.objects.unlink(o)
 refs.objects.link(o)
body.name='PRINT_01_Closed_Back_Housing_v04';ring.name='PRINT_02_Curved_Snap_Ring_v04'
cam.location=(300,120,60);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=175
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_rotation=cam.rotation_euler.to_quaternion();area.spaces.active.region_3d.view_distance=200;area.spaces.active.region_3d.view_location=(0,0,0);area.spaces.active.shading.color_type='OBJECT'
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'assembly-snap-v04.blend'));print('REVIEW_V04_DONE',flush=True)
assert not report['path_nonzero'] and all(v==0 for v in report['ring_static'].values())
