from pathlib import Path
import sys,json,math,struct,subprocess,time
import numpy as np
O=Path(__file__).resolve().parents[1];R=O.parents[1];sys.path.insert(0,str(R/'modeling/v03/mesh-tools'));import manifold3d as M
P=json.loads((O/'parameters/print-v05.json').read_text());checks={};t0=time.time()
def log(s):print(f'{time.time()-t0:.1f}s {s}',flush=True)
def load(n):
 a=np.load(O/f'reports/{n}.npz');mesh=M.Mesh(np.ascontiguousarray(a['v'],np.float32),np.ascontiguousarray(a['f'],np.uint32));mesh.merge();m=M.Manifold(mesh);assert str(m.status())=='Error.NoError',(n,m.status());return m
def cyl(r,x0,x1):return M.Manifold.cylinder(x1-x0,r,circular_segments=256).rotate((0,90,0)).translate((x0,0,0))
def box(lo,hi):return M.Manifold.cube(tuple(np.array(hi)-lo)).translate(tuple(lo))
def sector(ri,ro,x0,x1,a,b):
 ang=np.linspace(math.radians(a),math.radians(b),int((b-a)*2)+1);pts=[(ro*math.cos(t),ro*math.sin(t)) for t in ang]+[(ri*math.cos(t),ri*math.sin(t)) for t in ang[::-1]];return M.CrossSection([pts]).extrude(x1-x0).rotate((90,0,90)).translate((x0,0,0))
body=load('body-local').set_tolerance(.005).simplify(.005);ring=load('ring-local').set_tolerance(.003).simplify(.003);jig=load('jig-local').set_tolerance(.005).simplify(.005)
# Remove only sub-voxel isolated debris after numerical simplification, never substantial parts.
def one(n,m):
 parts=m.decompose();main=[x for x in parts if x.volume()>1];other=[x for x in parts if x.volume()<=1];assert len(main)==1 and sum(abs(x.volume()) for x in other)<.02,(n,[(x.volume(),x.bounding_box()) for x in parts]);return main[0]
body=one('body',body);ring=one('ring',ring)
# A flat-bottom laboratory fixture retains the exact contact/clip coordinates but shortens the rear posts.
jig=(jig^box((-10,-100,-100),(50,100,100)))+cyl(35.2,-10,-7.5)
for aa in [45,135,270]:jig=jig+sector(33,35.2,-8,25,aa-5,aa+5)
jig=one('jig',jig)
# Full installed official solids and continuous convex button sweep. Front allowance covers missing 0.5-mm stack.
checks['official_static_volume_mm3']={};checks['continuous_button_sweep_volume_mm3']={}
for idx in [1,3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{idx}.npy')[:,:,[0,2,1]].copy();a[:,:,1]*=-1;a[:,:,0]+=P['device_back_x'];v,f=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);mm=M.Mesh(np.ascontiguousarray(v,np.float32),np.ascontiguousarray(f.reshape(-1,3),np.uint32));mm.merge();ref=M.Manifold(mm);assert str(ref.status())=='Error.NoError',(idx,ref.status())
 checks['official_static_volume_mm3'][str(idx)]={'body':(body^ref).volume(),'ring':(ring^ref).volume()}
 if idx!=1:
  sweep=M.Manifold.hull_points(np.vstack([v,v+np.array([70,0,0])]).astype(float));checks['continuous_button_sweep_volume_mm3'][str(idx)]=(body^sweep).volume()
checks['front_manual_allowance_continuous_sweep_mm3']=(body^cyl(26,31,101.5)).volume()
checks['ring_front_allowance_mm3']=(ring^cyl(26,31,31.5)).volume()
log('Device/sweep volume checks '+str({k:v for k,v in checks.items()}))
assert all(abs(v)<.001 for d in checks['official_static_volume_mm3'].values() for v in d.values())
assert all(abs(v)<.001 for v in checks['continuous_button_sweep_volume_mm3'].values())
assert abs(checks['front_manual_allowance_continuous_sweep_mm3'])<.001 and abs(checks['ring_front_allowance_mm3'])<.001
# Kinematic release proxy, not a material simulation: ease each arm inward to 0.65mm at its free end.
def flex(v):
 x,y,z=v;r=math.hypot(y,z);a=math.degrees(math.atan2(z,y))%360
 if x<30.25 and 30.4<r<33.5:
  t=None
  if 198<=a<=237:t=np.clip((a-200)/30,0,1)
  if 303<=a<=342:t=np.clip((340-a)/30,0,1)
  if t is not None:
   delta=.65*t*t*(3-2*t);return (x,y*(r-delta)/r,z*(r-delta)/r)
 return (x,y,z)
released=ring.warp(flex);checks['release_proxy_overlap_samples']=[]
for d in np.arange(0,8.001,.5):checks['release_proxy_overlap_samples'].append({'forward_mm':float(d),'volume_mm3':(body^released.translate((float(d),0,0))).volume()})
checks['rigid_unreleased_pull_1mm_overlap_mm3']=(body^ring.translate((1,0,0))).volume()
log('Release proxy max '+str(max(x['volume_mm3'] for x in checks['release_proxy_overlap_samples'])))
assert max(abs(x['volume_mm3']) for x in checks['release_proxy_overlap_samples'])<.02
assert checks['rigid_unreleased_pull_1mm_overlap_mm3']>.01
checks['release_proxy_limitation']='Prescribed vertex displacement, not FEA or proof of PLA strain/fatigue.'
# Blunt stopped release tool. X points toward the opening, Y is radial, Z is tangential.
pts=np.array([[27,32.75],[27,33.25],[35.0,33.25],[35.,32.3],[29.2,32.3]])
tool=M.CrossSection([pts[::-1]]).extrude(3).translate((0,0,-1.5))
tool=tool+box((34.7,31.3,-1.5),(49,35.1,1.5))
assert tool.volume()>0 and str(tool.status())=='Error.NoError'
checks['tool_inserted_body_overlap_mm3']={};checks['tool_released_ring_overlap_mm3']={}
for a in [230,310]:
 t=tool.rotate((a,0,0));checks['tool_inserted_body_overlap_mm3'][str(a)]=(body^t).volume();checks['tool_released_ring_overlap_mm3'][str(a)]=(released^t).volume()
log('Tool overlaps '+str([checks['tool_inserted_body_overlap_mm3'],checks['tool_released_ring_overlap_mm3']]))
assert max(abs(v) for v in checks['tool_inserted_body_overlap_mm3'].values())<.001
assert max(abs(v) for v in checks['tool_released_ring_overlap_mm3'].values())<.02
DT=np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')]);exports={}
def readstl(path):
 data=path.read_bytes();num=struct.unpack_from('<I',data,80)[0];a=np.frombuffer(data,DT,count=num,offset=84)['v'].copy();v,f=np.unique(a.reshape(-1,3),axis=0,return_inverse=True);f=np.ascontiguousarray(f.reshape(-1,3),np.uint32);mm=M.Manifold(M.Mesh(np.ascontiguousarray(v,np.float32),f));return mm,v,f
def export(name,m,rotate,folder='exports'):
 m=one(name,m)
 if rotate:m=m.rotate(rotate)
 bb=m.bounding_box();trans=np.array([-(bb[0]+bb[3])/2,-(bb[1]+bb[4])/2,-bb[2]]);m=m.translate(tuple(trans));me=m.to_mesh();v=np.asarray(me.vert_properties)[:,:3].copy();parent=np.arange(len(v));parent[np.asarray(me.merge_from_vert,int)]=np.asarray(me.merge_to_vert,int)
 while np.any(parent!=parent[parent]):parent=parent[parent]
 v=v[parent];v,iv=np.unique(v,axis=0,return_inverse=True);f=iv[np.asarray(me.tri_verts)];tri=v[f];nn=np.cross(tri[:,1].astype(float)-tri[:,0],tri[:,2].astype(float)-tri[:,0]);length=np.linalg.norm(nn,axis=1);good=length>1e-12;tri=tri[good];nn=nn[good]/length[good,None];buf=np.zeros(len(tri),DT);buf['v']=tri;buf['n']=nn;path=O/folder/name;path.write_bytes(('AI Tour Guide v05; millimeters; '+name).encode()[:80].ljust(80,b' ')+struct.pack('<I',len(tri))+buf.tobytes());mm,v,f=readstl(path)
 if str(mm.status())!='Error.NoError':
  q=subprocess.run([r'D:\mapping software\blender\blender.exe','--background','--factory-startup','--python',str(O/'scripts/repair_stl_tjunction.py'),'--',str(path)],capture_output=True,text=True,encoding='utf8',errors='replace');log(q.stdout[-1500:]);assert q.returncode==0 and 'T_JUNCTION_REPAIRED' in q.stdout;mm,v,f=readstl(path)
 assert str(mm.status())=='Error.NoError' and len(mm.decompose())==1,(name,mm.status(),len(mm.decompose()))
 exports[name]={'file':str(path),'dimensions_mm':np.ptp(v,axis=0).tolist(),'triangles':len(f),'readback_status':str(mm.status()),'components':len(mm.decompose()),'min_z':float(v[:,2].min()),'rotation_deg':rotate,'translation':trans.tolist()};np.savez(O/f'reports/{name}.npz',v=v,f=f);log('EXPORTED '+name)
export('01_FULL_HOUSING_CLOSED_BACK_v05.stl',body,(0,0,0))
export('02_CURVED_SNAP_RING_v05.stl',ring,(0,-90,0))
export('03_FULL_FIT_JIG_v05.stl',jig,(0,-90,0),'fit-test')
export('04_RELEASE_TOOL_v05.stl',tool,(0,0,0),'fit-test')
# One actual latch sector for rapid tuning, marked by 1 / 2 / 3 witness grooves on a nonfunctional rim.
socket=(body^sector(30,35.2,23.5,40,192,240))+sector(30,35.2,23.5,25.2,192,240)
export('05_CLIP_TEST_SOCKET_v05.stl',socket,(0,-90,0),'fit-test')
for num,engage in enumerate([.2,.3,.4],1):
 variant=ring
 if engage<.3:variant=variant-box((27.1,32.6+engage,-3.2),(30.21,34,3.2)).rotate((230,0,0))
 if engage>.3:
  pp=np.array([[27.2,31.6],[27.2,32.05],[29.2,32.6+engage],[30.2,32.6+engage],[30.2,31.6]])
  variant=variant+M.CrossSection([pp[::-1]]).extrude(6.0).translate((0,0,-3.0)).rotate((230,0,0))
 coupon=variant^sector(25.2,35.2,26.5,40,192,240)
 for i in range(num):coupon=coupon-sector(32.8,35.2,31,40,193+i*3,194+i*3)
 export(f'06_CLIP_TEST_{int(engage*10)}_TENTHS_v05.stl',coupon,(0,-90,0),'fit-test')
(O/'reports/export-checks-v05.json').write_text(json.dumps(exports,indent=2));(O/'reports/mechanical-checks-v05.json').write_text(json.dumps(checks,indent=2));log('V05_EXPORT_CHECKS_PASSED')
