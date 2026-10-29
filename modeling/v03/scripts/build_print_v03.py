from pathlib import Path
import sys,json,math,struct,time,subprocess
import numpy as np
O=Path(__file__).resolve().parents[1];R=O.parents[1];sys.path.insert(0,str(O/'mesh-tools'))
import manifold3d as M
P=json.loads((O/'parameters/print-v03.json').read_text(encoding='utf-8-sig'));N=P['circular_segments'];checks={};t0=time.time()
def log(s):print(f'{time.time()-t0:.1f}s {s}',flush=True)
def cyl(r,x0,x1,y=0,z=0,n=N):return M.Manifold.cylinder(x1-x0,r,circular_segments=n).rotate((0,90,0)).translate((x0,y,z))
def box(lo,hi):return M.Manifold.cube(tuple(np.array(hi)-lo)).translate(tuple(lo))
def union(xs):return M.Manifold.batch_boolean(xs,M.OpType.Add)
def boss(x0,x1,y):
 half=P['ear_half_size_mm'];r=P['ear_corner_radius_mm'];d=half-r;return union([cyl(r,x0,x1,y+dy,dz,32) for dy in [-d,d] for dz in [-d,d]]).hull()
def subtract(a,xs):return M.Manifold.batch_boolean([a]+xs,M.OpType.Subtract)
def annulus(ri,ro,x0,x1):return cyl(ro,x0,x1)-cyl(ri,x0-1,x1+1)
def sector(ri,ro,x0,x1,angle,half):
 # An arc support with the same outer collar radius. Full planar cross section is triangulated by the solid engine.
 ang=np.linspace(math.radians(angle-half),math.radians(angle+half),33)
 points=np.array([(ro*math.cos(a),ro*math.sin(a)) for a in ang]+[(ri*math.cos(a),ri*math.sin(a)) for a in ang[::-1]])
 # CrossSection is XY; extrude Z then rotate so (X,Y,Z)->(Z,X,Y).
 cs=M.CrossSection([points]);return cs.extrude(x1-x0).rotate((90,0,90)).translate((x0,0,0))
# Input STL buttons are the correct assembled components, mapped into local Y/Z.
reliefs=[]
for idx in [3,5,7]:
 a=np.load(R/f'modeling/v01/references/component-{idx}.npy').reshape(-1,3);yz=a[:,[2,1]].copy();yz[:,0]*=-1;lo=yz.min(0)-P['button_bbox_yz_margin_mm'];hi=yz.max(0)+P['button_bbox_yz_margin_mm'];reliefs.append(box((-60,lo[0],lo[1]),(80,hi[0],hi[1])) ^ cyl(P['button_relief_outer_radius_mm'],-61,81))
log('Build carrier with rear supports and centering bore')
rear=P['carrier_rear_x_mm'];seat=P['front_ring_seat_x_mm'];ri=P['cavity_diameter_mm']/2;ro=P['carrier_outer_diameter_mm']/2
carrier=annulus(ri,ro,rear,seat)
carrier=union([carrier]+[sector(s['inner_radius_mm'],s['outer_radius_mm'],rear,s['front_x_mm'],s['angle_deg'],s['half_angle_deg']) for s in P['rear_supports']]+[boss(rear,seat,y) for y in P['ear_centers_y_mm']])
carrier=subtract(carrier,reliefs)
# Identical seats, screw bores, hex pockets and access openings in both sample and full body.
common_cuts=[]
S=P['screw'];pocket_mid=(S['nut_pocket_x_min_mm']+S['nut_pocket_x_max_mm'])/2
for y in P['ear_centers_y_mm']:
 common_cuts.append(cyl(S['clearance_hole_mm']/2,rear-2,seat+8,y))
 pts=np.array([(y+S['nut_pocket_across_flats_mm']/math.sqrt(3)*math.cos(i*math.tau/6),S['nut_pocket_across_flats_mm']/math.sqrt(3)*math.sin(i*math.tau/6)) for i in range(6)])
 nut=M.CrossSection([pts]).extrude(S['nut_pocket_x_max_mm']-S['nut_pocket_x_min_mm']).rotate((90,0,90)).translate((S['nut_pocket_x_min_mm'],0,0));common_cuts.append(nut)
 ya,yb=(y,80) if y>0 else (-80,y);common_cuts.append(box((S['nut_pocket_x_min_mm'],ya,-S['nut_entry_z_height_mm']/2),(S['nut_pocket_x_max_mm'],yb,S['nut_entry_z_height_mm']/2)))
b=P['charging_bay_local_bounds'];charging=box((b['x'][0],b['y'][0],b['z'][0]),(b['x'][1],b['y'][1],b['z'][1]));common_cuts.append(charging)
carrier=subtract(carrier,common_cuts)
ring=union([annulus(P['front_ring_inner_diameter_mm']/2,ro,seat,seat+3)]+[boss(seat,seat+3,y) for y in P['ear_centers_y_mm']]);ring=subtract(ring,reliefs+[cyl(S['clearance_hole_mm']/2,seat-1,seat+5,y) for y in P['ear_centers_y_mm']])
for name,obj in [('carrier',carrier),('ring',ring)]:
 assert str(obj.status())=='Error.NoError',(name,obj.status());assert len(obj.decompose())==1,(name,'disconnected');checks[name]={'status':str(obj.status()),'volume_mm3':obj.volume(),'bounding_box':obj.bounding_box(),'connected_components':len(obj.decompose())}
log('Low-poly parts pass solid checks')
# Save engineering pieces first so the small test can be printed even before the full mesh is assembled.
def export_stl(name,obj,where,print_orientation=True,world=False):
 obj=obj.set_tolerance(0.005).simplify(0.005)
 # For ring and test carrier, X thickness becomes build Z. Body remains feet down.
 if print_orientation:obj=obj.rotate((0,-90,0))
 bb=obj.bounding_box();obj=obj.translate((-(bb[0]+bb[3])/2,-(bb[1]+bb[4])/2,-bb[2]))
 mesh=obj.to_mesh();raw=np.asarray(mesh.vert_properties)[:,:3].copy();parents=np.arange(len(raw));parents[np.asarray(mesh.merge_from_vert,dtype=int)]=np.asarray(mesh.merge_to_vert,dtype=int)
 while np.any(parents!=parents[parents]):parents=parents[parents]
 raw=raw[parents];v,iv=np.unique(raw,axis=0,return_inverse=True);f=iv[np.asarray(mesh.tri_verts)];keep=(f[:,0]!=f[:,1])&(f[:,1]!=f[:,2])&(f[:,2]!=f[:,0]);removed=int(sum(~keep));f=f[keep];tri=v[f];norm=np.cross(tri[:,1].astype(float)-tri[:,0],tri[:,2].astype(float)-tri[:,0]);lens=np.linalg.norm(norm,axis=1);good=lens>0;removed+=int(sum(~good));f=f[good];tri=tri[good];norm=norm[good];lens=lens[good]
 norm/=lens[:,None];dt=np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')]);buf=np.zeros(len(tri),dt);buf['n']=norm;buf['v']=tri
 path=O/where/name;path.write_bytes(f'AI TOUR GUIDE PLA PROTOTYPE {name}; mm'.encode()[:80].ljust(80,b' ')+struct.pack('<I',len(tri))+buf.tobytes())
 checks[name]={'float32_collapsed_triangles_removed':removed,'triangles':len(f),'dimensions_mm':np.ptp(v,axis=0).tolist(),'min_z':float(v[:,2].min()),'volume_mm3':obj.volume(),'connected_components':len(obj.decompose()),'manifold_status':str(obj.status()),'file':str(path)}
 # Re-read the physical STL and reconstruct a closed solid, not merely trusting an export return code.
 def reimport():
  data=path.read_bytes();num=struct.unpack_from('<I',data,80)[0];rt=np.frombuffer(data,dt,count=num,offset=84)['v'].copy();verts,inv=np.unique(rt.reshape(-1,3),axis=0,return_inverse=True);ff=np.ascontiguousarray(inv.reshape(-1,3),np.uint32);mm=M.Manifold(M.Mesh(np.ascontiguousarray(verts,np.float32),ff));return mm,verts,ff
 mm,verts,ff=reimport()
 if str(mm.status())!='Error.NoError':
  result=subprocess.run([r'D:\mapping software\blender\blender.exe','--background','--factory-startup','--python',str(O/'scripts/repair_stl_tjunction.py'),'--',str(path)],capture_output=True,text=True,encoding='utf8',errors='replace');log(result.stdout.strip());assert result.returncode==0 and 'T_JUNCTION_REPAIRED' in result.stdout,result.stderr
  mm,verts,ff=reimport()
 assert str(mm.status())=='Error.NoError',(name,'reimport',mm.status());assert len(mm.decompose())==1
 checks[name]['reimport_dimensions_mm']=np.ptp(verts,axis=0).tolist();checks[name]['reimport_manifold_status']=str(mm.status());checks[name]['actual_readback_triangles']=len(ff);checks[name]['print_translation_mm']=[-(bb[0]+bb[3])/2,-(bb[1]+bb[4])/2,-bb[2]]
 v=verts;f=ff
 np.savez(O/f'reports/{name}.npz',v=v,f=f)
 log('EXPORTED '+name)
export_stl('01_FIT_TEST_CARRIER_52p6mm_PLA_v03.stl',carrier,'fit-test')
export_stl('02_FRONT_RING_50p5mm_PLA_v03.stl',ring,'exports')
# Store local engineering geometry for assembly inspection. Reference objects never enter printable STL.
for name,obj in [('carrier-local',carrier),('ring-local',ring)]:
 mesh=obj.to_mesh();np.savez(O/f'reports/{name}.npz',v=np.asarray(mesh.vert_properties)[:,:3],f=np.asarray(mesh.tri_verts))
log('Read appearance mesh')
a=np.load(O/'reports/source-body-reoriented.npz');v=np.ascontiguousarray(a['v'],np.float32);f=np.ascontiguousarray(a['f'],np.uint32);srcmesh=M.Mesh(v,f,tolerance=0.0001);srcmesh.merge();body=M.Manifold(srcmesh);assert str(body.status())=='Error.NoError',body.status();checks['source_body']={'status':str(body.status()),'volume_mm3':body.volume()}
shift=(0,P['axis_y'],P['axis_z']);log('Union carrier into preserved appearance')
body=union([body,carrier.translate(shift),annulus(26.3,33,-32,-24).translate(shift)]);log('Cut shared access openings through preserved appearance')
body=subtract(body,[c.translate(shift) for c in common_cuts])
# Retain the keyed insertion swept envelope through any original material behind the sleeve.
# Bore only extends back to the rear support face; never erase the engineered stops.
body=body-cyl(ri,27.6,80).translate(shift)
body=subtract(body,[r.translate(shift) for r in reliefs])
patches=[M.Manifold.sphere(2.5,circular_segments=48).translate(tuple(c)) for c in P['local_rear_hood_thickening']['centers_mm']];body=union([body]+patches)
# Both soles share a flat bed plane.
body=body-box((-150,-150,-200),(150,150,P['floor_trim_plane_z_mm']))
log('Evaluate full body')
assert str(body.status())=='Error.NoError',body.status();parts=body.decompose();negative=[x for x in parts if x.volume()<0];positive=[x for x in parts if x.volume()>0];checks['filled_enclosed_microvoids_mm3']=[-x.volume() for x in negative];assert sum(checks['filled_enclosed_microvoids_mm3'])<100;assert len(positive)==1;body=positive[0];parts=body.decompose();checks['full_body_components']=[{'volume_mm3':x.volume(),'bbox':x.bounding_box()} for x in parts];assert len(parts)==1,('body disconnected',checks['full_body_components'])
export_stl('03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl',body,'exports',False)
mesh=body.to_mesh();np.savez(O/'reports/body-assembly.npz',v=np.asarray(mesh.vert_properties)[:,:3],f=np.asarray(mesh.tri_verts))
# Static assembly surface checks are supplemented by known cylindrical/box sweep clearances.
# Save parameters and all pass/fail results immediately after geometry export.
checks['ring_vs_body_intersection_volume_mm3']=(body ^ ring.translate(shift)).volume();assert checks['ring_vs_body_intersection_volume_mm3']<0.001
checks['fit_sample_constraints']='Same carrier, rear supports, bore, key reliefs, nut seats, screw holes, ring seats and charging bay as full body; no locating feature cropped.'
checks['physical_fit_status']='PENDING REAL STOPWATCH TEST'
(O/'reports/export-checks-v03.json').write_text(json.dumps(checks,indent=2),encoding='utf8');log('ALL V03 EXPORTS SAVED')
