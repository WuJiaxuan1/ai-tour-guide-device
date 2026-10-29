import bpy,bmesh,numpy as np,math
from pathlib import Path
O=Path(__file__).resolve().parents[1];a=np.load(O/'reports/outer-before-smoothing.npz');bpy.ops.wm.read_factory_settings(use_empty=True)
m=bpy.data.meshes.new('appearance');m.from_pydata(a['v'].tolist(),[],a['f'].tolist());m.update();o=bpy.data.objects.new('Appearance_only_before_functional_features',m);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
# Rebuild only appearance at 0.18 mm; all fitted surfaces, clips, posts and vents are added afterwards.
mod=o.modifiers.new('Uniform_appearance_surface','REMESH');mod.mode='VOXEL';mod.voxel_size=.18;mod.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=mod.name)
g=o.vertex_groups.new(name='Rear_cap_join_blend')
for v in o.data.vertices:
 x,y,z=v.co;r=math.hypot(y,z)
 if x<9 and abs(r-40)<4.5:
  weight=.5+.5*math.cos(math.pi*(r-40)/4.5);g.add([v.index],weight,'REPLACE')
mod=o.modifiers.new('Blend_rear_join_geometry','SMOOTH');mod.factor=.8;mod.iterations=18;mod.vertex_group=g.name;bpy.ops.object.modifier_apply(modifier=mod.name)
mod=o.modifiers.new('Remove_voxel_staircase','SMOOTH');mod.factor=.5;mod.iterations=3;bpy.ops.object.modifier_apply(modifier=mod.name)
# Blend the rear boundary heightfield over a wider band; this removes the residual circular lip geometrically.
pr=np.load(O/'reports/surface-profiles.npz');rr=pr['radii'];n=360
def prof(r):
 j=np.searchsorted(rr,r)-1;t=(r-rr[j])/(rr[j+1]-rr[j]);f=np.fft.rfft(pr['rear'][j]*(1-t)+pr['rear'][j+1]*t);f[15:]=0;return np.fft.irfft(f,n=n)
edge=prof(40.05);der=np.clip(prof(40.55)-prof(39.55),-1.5,2.5);fd=np.fft.rfft(der);fd[15:]=0;der=np.fft.irfft(fd,n=n)
o.data.update();co=np.empty(len(o.data.vertices)*3,np.float32);no=co.copy();o.data.vertices.foreach_get('co',co);o.data.vertices.foreach_get('normal',no);co=co.reshape(-1,3);no=no.reshape(-1,3);rad=np.hypot(co[:,1],co[:,2]);ids=np.where((co[:,0]<9)&(rad<44)&(no[:,0]<-.1))[0]
vtx=co[ids].copy();rad=rad[ids];ang=np.arctan2(vtx[:,2],vtx[:,1]);idx=(ang*180/math.pi)%360;ii=np.floor(idx).astype(int);ff=idx-ii;xe=edge[ii]*(1-ff)+edge[(ii+1)%360]*ff;de=der[ii]*(1-ff)+der[(ii+1)%360]*ff;u=np.clip((rad-40.05)/(44-40.05),0,1);weight=1-u*u*(3-2*u);target=xe+de*(rad-40.05)
inside=rad<40.05;t=rad[inside]/40.05;bc=np.fft.rfft(edge)/360;dc=np.fft.rfft(der)*40.05/360;delta=bc[0].real+36.5;val=-36.5+(2*delta-.5*dc[0].real)*t*t+(.5*dc[0].real-delta)*t**4
for k in range(1,15):val+=2*np.real(np.exp(1j*k*ang[inside])*t**k*((((k+2)*bc[k]-dc[k])/2)+((dc[k]-k*bc[k])/2)*t*t))
target[inside]=val;co[ids,0]=vtx[:,0]*(1-weight)+target*weight;o.data.vertices.foreach_set('co',co.ravel())
b=bmesh.new();b.from_mesh(o.data);bmesh.ops.recalc_face_normals(b,faces=list(b.faces));bmesh.ops.triangulate(b,faces=list(b.faces));b.to_mesh(o.data);b.free();m=o.data;m.calc_loop_triangles();v=np.empty(len(m.vertices)*3,np.float32);m.vertices.foreach_get('co',v);f=np.empty(len(m.loop_triangles)*3,np.int32);m.loop_triangles.foreach_get('vertices',f);np.savez(O/'reports/outer-smoothed.npz',v=v.reshape(-1,3),f=f.reshape(-1,3));print('OUTER_SMOOTHED',len(m.vertices),len(m.loop_triangles),flush=True)
