import bpy,numpy as np,json,math,struct,time
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
O=Path(__file__).resolve().parents[1];R=O.parents[1];P=json.loads((O/'parameters/print-v03.json').read_text(encoding='utf-8-sig'));E=json.loads((O/'reports/export-checks-v03.json').read_text());report={}
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=.001;scene.unit_settings.length_unit='MILLIMETERS';scene.world=bpy.data.worlds.new('Inspection_World');scene.world.color=(.94,.94,.94)
def array_obj(name,v,f,color):
 m=bpy.data.meshes.new(name);m.vertices.add(len(v));m.vertices.foreach_set('co',np.asarray(v,dtype=np.float32).ravel());m.loops.add(f.size);m.loops.foreach_set('vertex_index',np.asarray(f,dtype=np.int32).ravel());m.polygons.add(len(f));m.polygons.foreach_set('loop_start',np.arange(0,f.size,3,dtype=np.int32));m.polygons.foreach_set('loop_total',np.full(len(f),3,dtype=np.int32));m.update();o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);o.color=color;return o
# Use the exact verified print STL readback for the full housing, restored to engineering coordinates.
a=np.load(O/'reports/03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl.npz');v=a['v']-np.array(E['03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl']['print_translation_mm']);h=array_obj('PRINT_PART_One_Piece_Housing_v03',v,a['f'],(.72,.73,.75,1))
a=np.load(O/'reports/ring-local.npz');ring=array_obj('PRINT_PART_Removable_Front_Ring_v03',a['v']+np.array((0,P['axis_y'],P['axis_z'])),a['f'],(.95,.64,.2,1))
parts=[]
for idx in [1,3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{idx}.npy').copy();a=a[:,:,[0,2,1]];a[:,:,1]*=-1;a[:,:,0]+=P['reference_device_back_x_mm'];a[:,:,1]+=P['axis_y'];a[:,:,2]+=P['axis_z'];v,f=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);o=array_obj('REFERENCE_ONLY_Official_'+str(idx),v,f.reshape(-1,3),{1:(.13,.25,.32,1),3:(.85,.07,.04,1),5:(1,.7,.04,1),7:(.07,.3,.9,1)}[idx]);parts.append(o)
# Front allowance schematic: entire supplied device envelope, not a dimensional reconstruction of its missing glass.
bpy.ops.mesh.primitive_cylinder_add(vertices=256,radius=25.975,depth=.49,location=(42.555,P['axis_y'],P['axis_z']),rotation=(0,math.pi/2,0));front=bpy.context.object;front.name='REFERENCE_ONLY_Manual_Front_Allowance_SCREEN_SCHEMATIC';front.color=(.05,.12,.16,1)
# Record edge topology of the exact physical STL.
def mesh_stats(o):
 e=np.empty(len(o.data.loops),np.int32);o.data.loops.foreach_get('edge_index',e);n=np.bincount(e,minlength=len(o.data.edges));return {'boundary_edges':int(sum(n==1)),'nonmanifold_edges':int(sum(n>2)),'loose_edges':int(sum(n==0))}
report['physical_body_stl_topology']=mesh_stats(h)
# Build BVH once; check every 0.5 mm along the entire straight front approach.
bpy.context.view_layer.update();tree=BVHTree.FromObject(h,bpy.context.evaluated_depsgraph_get(),epsilon=.00001);path=[]
for offset in np.arange(0,70.001,.5):
 count=0
 for o in parts:
  ref=BVHTree.FromPolygons([v.co+Vector((float(offset),0,0)) for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons],all_triangles=True,epsilon=.00001);count+=len(tree.overlap(ref))
 path.append({'front_translation_mm':float(offset),'surface_intersection_pairs':count})
report['front_insertion_path']=path;report['nonzero_path_samples']=[r for r in path if r['surface_intersection_pairs']]
# Static ring avoids all real supplied parts and the front allowance.
rtree=BVHTree.FromObject(ring,bpy.context.evaluated_depsgraph_get(),epsilon=.00001)
report['ring_vs_reference_intersection_pairs']={o.name:len(rtree.overlap(BVHTree.FromObject(o,bpy.context.evaluated_depsgraph_get(),epsilon=.00001))) for o in parts+[front]}
# Estimate wall thickness on area-weighted appearance samples. New functional dimensions are analytic in the parameter file.
h.data.calc_loop_triangles();vv=np.empty(len(h.data.vertices)*3,np.float32);h.data.vertices.foreach_get('co',vv);vv=vv.reshape(-1,3);ff=np.empty(len(h.data.loop_triangles)*3,np.int32);h.data.loop_triangles.foreach_get('vertices',ff);ff=ff.reshape(-1,3);tri=vv[ff].astype(float);norm=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);area=np.linalg.norm(norm,axis=1);rng=np.random.default_rng(43);ids=rng.choice(len(ff),size=2500,replace=False,p=area/area.sum());thick=[]
for idx in ids:
 if area[idx]<1e-8:continue
 c=Vector(tri[idx].mean(0));n=Vector(norm[idx]/area[idx]);pt,no,face,distance=tree.ray_cast(c-n*.03,-n,100)
 if pt is not None and no.dot(-n)>.1:thick.append({'thickness_mm':float((pt-c).length),'point':list(c)})
report['wall_sampling']={'valid_rays':len(thick),'min_mm':min(x['thickness_mm'] for x in thick),'below_0p8_count':sum(x['thickness_mm']<.8 for x in thick),'below_1p2_count':sum(x['thickness_mm']<1.2 for x in thick),'lowest_20':sorted(thick,key=lambda x:x['thickness_mm'])[:20],'limitation':'finite normal-ray sampling; not exhaustive wall or self-intersection certification'}
(O/'reports/assembly-checks-v03.json').write_text(json.dumps(report,indent=2),encoding='utf8');print('ASSEMBLY_CHECKS',json.dumps({'nonzero_samples':report['nonzero_path_samples'][:10],'ring':report['ring_vs_reference_intersection_pairs'],'topology':report['physical_body_stl_topology'],'wall':{k:v for k,v in report['wall_sampling'].items() if k!='lowest_20'}}),flush=True)
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1100;scene.render.resolution_y=1200;scene.render.resolution_percentage=100;sh=scene.display.shading;sh.light='STUDIO';sh.color_type='OBJECT';sh.background_type='WORLD';sh.show_shadows=True;sh.show_cavity=True;sh.cavity_type='BOTH'
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam

def render(name,loc,target=(0,0,0),scale=178):
 cam.location=loc;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale;scene.render.filepath=str(O/f'previews/{name}.png');bpy.ops.render.render(write_still=True)
render('assembled-front-v03',(350,0,0));render('assembled-rear-v03',(-350,0,0));render('assembled-right-v03',(0,-350,0));render('assembled-oblique-v03',(270,180,100))
# Exploded view is clearly named; source hardware is reference, never in print exports.
for o in parts+[front]:o.location.x=18
ring.location.x=42
render('exploded-oblique-v03',(270,200,100),target=(20,0,0),scale=190)
for o in parts+[front]:o.location.x=0
ring.location.x=0
# Small test contains the same full locating constraints, no cropping.
h.hide_render=True
for o in parts+[front]:o.hide_render=True
ring.hide_render=True
a=np.load(O/'reports/carrier-local.npz');carrier=array_obj('SAMPLE_ONLY_Same_Carrier_No_Appearance',a['v'],a['f'],(.7,.72,.75,1));render('fit-carrier-oblique-v03',(180,110,65),target=(33,0,0),scale=98);carrier.hide_render=True
h.hide_render=False;ring.hide_render=False
for o in parts+[front]:o.hide_render=False
cam.location=(300,150,70);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=178
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'assembly-print-v03.blend'))
assert not report['nonzero_path_samples'],'Actual supplied hardware interferes along the path'
assert all(x==0 for x in report['ring_vs_reference_intersection_pairs'].values()),'Ring interferes with supplied reference'
print('ASSEMBLY_VERIFIED',flush=True)
