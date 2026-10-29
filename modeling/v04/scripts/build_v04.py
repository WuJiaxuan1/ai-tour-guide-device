from pathlib import Path
import sys,json,math,struct,time,subprocess
import numpy as np
O=Path(__file__).resolve().parents[1];R=O.parents[1];OLD=R/'modeling/v03';sys.path.insert(0,str(OLD/'mesh-tools'))
import manifold3d as M
t0=time.time();N=360;AY=-.02733765;AZ=22.28087056;S=np.array([0,AY,AZ]);checks={}
def log(s):print(f'{time.time()-t0:.1f}s {s}',flush=True)
def cyl(r,x0,x1,y=0,z=0,n=360):return M.Manifold.cylinder(x1-x0,r,circular_segments=n).rotate((0,90,0)).translate((x0,y,z))
def box(lo,hi):return M.Manifold.cube(tuple(np.array(hi)-lo)).translate(tuple(lo))
def union(a):return M.Manifold.batch_boolean(a,M.OpType.Add)
def sub(a,b):return M.Manifold.batch_boolean([a]+b,M.OpType.Subtract)
def ann(ri,ro,x0,x1):return cyl(ro,x0,x1)-cyl(ri,x0-1,x1+1)
def sector(ri,ro,x0,x1,a,b):
 ang=np.linspace(math.radians(a),math.radians(b),max(5,int(abs(b-a)*2)+1));p=[(ro*math.cos(t),ro*math.sin(t)) for t in ang]+[(ri*math.cos(t),ri*math.sin(t)) for t in ang[::-1]]
 return M.CrossSection([p]).extrude(x1-x0).rotate((90,0,90)).translate((x0,0,0))
def radial_box(x0,x1,r0,r1,t0,t1,a):return box((x0,r0,t0),(x1,r1,t1)).rotate((a,0,0))
def sphere(r,p):return M.Manifold.sphere(r,circular_segments=24).translate(tuple(p))
def smooth_signal(a,k=14):
 f=np.fft.rfft(a);f[k+1:]=0;return np.fft.irfft(f,n=len(a))
profile=np.load(O/'reports/surface-profiles.npz');rads=profile['radii']
def profile_at(side,r):
 j=np.searchsorted(rads,r)-1;j=max(0,min(j,len(rads)-2));t=(r-rads[j])/(rads[j+1]-rads[j]);return smooth_signal(profile[side][j]*(1-t)+profile[side][j+1]*t)
rear_edge=profile_at('rear',40.05);rear_der=np.clip((profile_at('rear',40.55)-profile_at('rear',39.55)), -1.5,2.5)
front_edge=profile_at('front',35.0);front_der=np.clip((profile_at('front',35.5)-profile_at('front',34.5)),-1,1)
def rear_x(r):
 u=r/40.05;bc=np.fft.rfft(rear_edge)/N;dc=np.fft.rfft(smooth_signal(rear_der))*40.05/N;cc=np.zeros_like(bc)
 delta=bc[0].real+36.5;cc[0]=-36.5+(2*delta-.5*dc[0].real)*u*u+(.5*dc[0].real-delta)*u**4
 for k in range(1,15):cc[k]=u**k*((((k+2)*bc[k]-dc[k])/2)+((dc[k]-k*bc[k])/2)*u*u)
 return np.fft.irfft(cc*N,n=N)
def face_x(r):
 u=np.clip((r-25.25)/(35-25.25),0,1);return (2*u**3-3*u*u+1)*34.1+(-2*u**3+3*u*u)*front_edge+(u**3-u*u)*(35-25.25)*front_der
def polar_solid(radii,lo,hi):
 # Closed annular/disk heightfield in axial X; vertices are exact shared indexed seams.
 rr=np.array(radii);disk=rr[0]==0
 if disk:rr=rr[1:]
 angles=np.arange(N)*math.tau/N;verts=[]
 for fun in [lo,hi]:
  for r in rr:
   xx=np.broadcast_to(fun(float(r)),(N,))
   verts.extend(np.stack([xx,r*np.cos(angles),r*np.sin(angles)],axis=1))
 nv=len(rr)*N;faces=[]
 for side in [0,1]:
  off=side*nv
  for j in range(len(rr)-1):
   for i in range(N):
    a=off+j*N+i;b=off+j*N+(i+1)%N;c=b+N;d=a+N
    fs=[[a,b,c],[a,c,d]]
    faces.extend([f[::-1] for f in fs] if side==1 else fs)
 if disk:
  for side,fun in [(0,lo),(1,hi)]:
   center=len(verts);verts.append([float(np.mean(fun(0))),0,0])
   for i in range(N):
    a=side*nv+i;b=side*nv+(i+1)%N;faces.append([center,b,a] if side==0 else [center,a,b])
 else:
  for i in range(N):
   a=i;b=(i+1)%N;c=b+nv;d=a+nv;faces.extend([[a,c,b],[a,d,c]])
 for i in range(N):
  a=(len(rr)-1)*N+i;b=(len(rr)-1)*N+(i+1)%N;c=b+nv;d=a+nv;faces.extend([[a,b,c],[a,c,d]])
 v=np.asarray(verts,np.float32);f=np.asarray(faces,np.uint32);mm=M.Manifold(M.Mesh(v,f));assert str(mm.status())=='Error.NoError',mm.status()
 if mm.volume()<0:mm=M.Manifold(M.Mesh(v,np.ascontiguousarray(f[:,::-1])))
 return mm
def save_local(name,obj):
 m=obj.to_mesh();np.savez(O/f'reports/{name}.npz',v=np.asarray(m.vert_properties)[:,:3],f=np.asarray(m.tri_verts))
source=np.load(O/'reports/original-clean.npz');mesh=M.Mesh(np.ascontiguousarray(source['v'],np.float32),np.ascontiguousarray(source['f'],np.uint32),tolerance=.00001);mesh.merge();body=M.Manifold(mesh);assert str(body.status())=='Error.NoError',body.status();body=body.translate(tuple(-S));log('Original appearance solid loaded; no v03 geometry reused')
# Replace rear aperture/rim with a continuously curved rear surface joined at the original hood.
cap=polar_solid(np.linspace(0,40.05,82),rear_x,lambda r:np.full(N,8.5))
inner=polar_solid(np.linspace(0,36.8,76),lambda r:rear_x(r)+4.0,lambda r:np.full(N,16.0))
body=body-cyl(40,-100,8.0)
body=union([body,cap])
if '--prepare' in sys.argv:
 save_local('outer-before-smoothing',body);log('OUTER_PREPARED');sys.exit(0)
smoothed=O/'reports/outer-smoothed.npz'
if smoothed.exists():
 a=np.load(smoothed);me=M.Mesh(np.ascontiguousarray(a['v'],np.float32),np.ascontiguousarray(a['f'],np.uint32));me.merge();body=M.Manifold(me);assert str(body.status())=='Error.NoError'
body=body-inner
# Remove old front support clutter and create a shallow hidden seat following the original face contour.
body=body-cyl(35,26.4,90)
# Rebuild the narrow original front rim as a backed surface, eliminating thin cut remnants.
front_band=polar_solid(np.linspace(34.98,38.6,16),lambda r:np.full(N,23.45),lambda r:profile_at('front',r))
body=body-(ann(35,38.5,23.5,90))
body=union([body,front_band])
seat=polar_solid(np.linspace(32.6,35.05,12),lambda r:np.full(N,23.5),lambda r:face_x(r)-2.4-.15)
body=union([body,seat])
device_back=16.;cavity_r=26.4;contact_x=31.7
button_cuts=[];button_bounds={}
for idx in [3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{idx}.npy').reshape(-1,3)[:,[0,2,1]].copy();a[:,1]*=-1
 lo=a.min(0);hi=a.max(0);button_bounds[str(idx)]={'raw_bbox':[lo.tolist(),hi.tolist()],'margin_each_side_mm':.65}
 button_cuts.append(box((15.3,lo[1]-.65,lo[2]-.65),(90,hi[1]+.65,hi[2]+.65)))
body=sub(body,[cyl(cavity_r,15.3,90),cyl(32.6,15.3,90)]+button_cuts)
# Three back-wall posts, with short outer lips for centering. No rear carrier plate.
posts=[]
for a,front in [(90,16.6),(200,15.8),(340,15.8)]:
 p=radial_box(-38,front,23.2,29.2,-2.6,2.6,a)
 # End pads contact only peripheral plastic; an outer lip centers without touching buttons.
 p=p-radial_box(front-.05,front+1,25.6,26.4,-4,4,a)
 p=union([p,radial_box(front-.5,25.7,26.4,29.2,-2.6,2.6,a)])
 # Widen root only behind the back of the real device; merge into curved rear wall.
 p=union([p,radial_box(-38,-18,21.5,30.7,-4,4,a)])
 # Constrain all root additions within the smooth exterior volume.
 p=p ^ cap
 # cap stops at 8.5; add remaining forward portion separately.
 p=union([p,radial_box(8,front,23.2,29.2,-2.6,2.6,a),radial_box(front-.5,25.7,26.4,29.2,-2.6,2.6,a)])
 posts.append(p)
body=union([body]+posts)
body=sub(body,button_cuts)
# Curved independent ring face. Its inner back edge is x=31.7, ahead of 15.5-mm whole device.
face=polar_solid(np.linspace(25.25,34.75,40),lambda r:face_x(r)-2.4,face_x)
log('face '+str((face.status(),face.volume(),face.num_tri())))
ring=face
clip_arms=[];hooks=[];roots=[];release_cuts=[];slot_cuts=[];guides=[]
for root_a,end_a in [(200,230),(340,310)]:
 a,b=sorted([root_a,end_a]);arm=sector(30.9,32.1,27.2,30.2,a,b)
 # Round free end and root in the radial/tangential plane.
 for angle in [a,b]:
  y,z=31.5*math.cos(math.radians(angle)),31.5*math.sin(math.radians(angle));arm=union([arm,cyl(.6,27.2,30.2,y,z,32)])
 # Root fillet + substantial axial bridge to the decorative face.
 root=cyl(1.15,27.2,33.3,31.2*math.cos(math.radians(root_a)),31.2*math.sin(math.radians(root_a)),64)
 # Wedge profile in X/r, extruded along the circumferential direction.
 pts=np.array([[27.2,31.6],[27.2,32.05],[29.2,32.9],[30.2,32.9],[30.2,31.6]])
 # local (X,r,t) from XY extrusion Z, then rotate around X into position.
 hook=M.CrossSection([pts[::-1]]).extrude(6.0).translate((0,0,-3.0)).rotate((end_a,0,0))
 for nm,ob in [('arm',arm),('hook',hook),('root',root)]:assert str(ob.status())=='Error.NoError' and ob.volume()>0,(nm,ob.status(),ob.volume())
 clip_arms.append(arm);hooks.append(hook);roots.append(root)
 slot_cuts.append(radial_box(26.9,30.5,32.35,33.35,-3.4,3.4,end_a))
 # Outer-edge service channel with a stopped bottom; no path to glass.
 release_cuts.append(radial_box(30.45,45,32.0,33.7,-1.9,1.9,end_a))
 # Solid inner guard between device and released clip; ends before ring plate.
 guides.append(union([sector(28.6,29.8,24.7,30.45,end_a-7,end_a+7),sector(28.6,33.1,24.7,26.2,end_a-7,end_a+7)]))
ring=union([ring]+clip_arms+hooks+roots)
log('ring before guides '+str((ring.status(),ring.volume(),ring.num_tri())))
# Three short guide rails and one asymmetric top key; they do not squeeze the screen.
for a in [90,180,0]:
 guide=sector(30.8,32.1,27.2,32.0,a-2,a+2);ring=union([ring,guide])
key=radial_box(27.2,32.3,31.7,33.15,-1.5,1.5,90);ring=union([ring,key]);slot_cuts.append(radial_box(26.8,40,31.5,33.5,-1.85,1.85,90))
external_limit=polar_solid(np.linspace(25.25,34.75,40),lambda r:np.full(N,20),face_x)
ring=(ring^external_limit)+face
body=sub(body,slot_cuts+release_cuts)
ring=sub(ring,release_cuts)
log('ring after cuts '+str((ring.status(),ring.volume(),ring.num_tri())))
body=union([body]+guides)
# Hard stops are three small ledges under the ring, away from the flexible arms.
for a in [45,135,270]:
 pad=polar_solid(np.linspace(33.9,34.5,3),lambda r:face_x(r)-3,lambda r:face_x(r)-2.4)
 pad=pad ^ sector(33.8,34.6,20,40,a-3,a+3);body=union([body,pad])
# Seven small rear sound holes, opening into the shared air cavity; no charging or button holes.
vents=[]
for y,z in [(-12,-5),(-8,-7),(-4,-8.2),(0,-8.6),(4,-8.2),(8,-7),(12,-5)]:vents.append(cyl(1.2,-65,0,y,z,48))
body=sub(body,vents)
# Floor trim in world coordinates.
body=body-box((-120,-120,-200),(120,120,-74-AZ))
log('Curved shell, three posts, two circumferential clips built')
checks['body_vs_ring_volume_mm3']=(body^ring).volume();log('Initial body-ring overlap '+str(checks['body_vs_ring_volume_mm3']))
assert checks['body_vs_ring_volume_mm3']<.02
body=body-ring
for nm,ob in [('body',body),('ring',ring)]:
 assert str(ob.status())=='Error.NoError' and ob.volume()>0,(nm,ob.status())
 checks[nm+'_components']=[{'volume_mm3':p.volume(),'bbox':p.bounding_box()} for p in ob.decompose()]
parts=body.decompose();major=[p for p in parts if p.volume()>1];minor=[p for p in parts if p.volume()<=1];assert len(major)==1 and sum(abs(p.volume()) for p in minor)<.01,[(p.volume(),p.bounding_box()) for p in parts];body=major[0];checks['discarded_sub_voxel_islands_mm3']=sum(abs(p.volume()) for p in minor)
save_local('body-local',body);save_local('ring-local',ring);save_local('back-cap-local',cap);save_local('posts-local',union(posts));save_local('clips-local',union(clip_arms+hooks+roots))
# Reduced complete fit jig: real rear pad positions, guides, key and latch sockets, no mascot exterior.
jig=body ^ cyl(35.2,-45,45)
# Retain the curved rear wall, all three posts and front constraints but omit the large ornamental skirt.
save_local('jig-local',jig)
P={'version':'v04','units':'mm','source':'round1 assembly-layout-v01 original appearance, no v03 carrier','axis_y':AY,'axis_z':AZ,'device_back_x':device_back,'manual_device_diameter':52.,'manual_device_thickness':15.5,'centering_diameter':52.8,'front_contact_x':contact_x,'front_ring_aperture':50.5,'ring_outer_diameter':69.5,'rear_surface_axial_thickness':4.,'post_angles_deg':[90,200,340],'post_lower_contact_x':15.8,'post_upper_contact_x':16.6,'nominal_rear_gap':.2,'nominal_front_gap':.2,'button_clearances':button_bounds,'clip':{'root_angles':[200,340],'hook_angles':[230,310],'arm_inner_radius':30.9,'arm_outer_radius':32.1,'arm_length_mm':31.5*math.radians(30),'axial_width':3.,'hook_outer_radius':32.9,'socket_mouth_radius':32.6,'nominal_engagement':.3,'release_travel_target':.6,'axial_range':[27.2,30.2]},'sound_holes':{'count':7,'diameter':2.4,'note':'rear cavity vents; acoustic performance pending physical test'},'glass_boundary':'user ruler approx 2mm plastic rim; coplanar glass/plastic; not precision measured','status':'building; no physical acceptance','printer':'Anycubic Mega-S; PLA; actual nozzle unknown'}
(O/'parameters/print-v04.json').write_text(json.dumps(P,indent=2),encoding='utf8');(O/'reports/build-prechecks.json').write_text(json.dumps(checks,indent=2));log('BUILD_V04_GEOMETRY_SAVED')
