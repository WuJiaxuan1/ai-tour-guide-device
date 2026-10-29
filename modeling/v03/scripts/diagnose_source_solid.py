import sys,numpy as np
from pathlib import Path
O=Path(__file__).resolve().parents[1];sys.path.insert(0,str(O/'mesh-tools'));import manifold3d as M
a=np.load(O/'reports/source-body-arrays.npz');v=np.ascontiguousarray(a['v'],np.float32);f=np.ascontiguousarray(a['f'],np.uint32);mesh=M.Mesh(v,f,tolerance=.0001);print('MERGE',mesh.merge(),flush=True);m=M.Manifold(mesh);print('RAW_MERGED',m.status(),flush=True)
for decimals in [5,4,3]:
 vv,ix=np.unique(np.round(v,decimals),axis=0,return_inverse=True);ff=ix[f];keep=(ff[:,0]!=ff[:,1])&(ff[:,1]!=ff[:,2])&(ff[:,0]!=ff[:,2]);ff=ff[keep];tri=vv[ff].astype(float);ar=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1);ff=ff[ar>1e-12];mesh=M.Mesh(np.ascontiguousarray(vv,np.float32),np.ascontiguousarray(ff,np.uint32),tolerance=10**(-decimals));mesh.merge();m=M.Manifold(mesh);print('ROUNDED',decimals,len(vv),len(ff),m.status(),flush=True)
 if str(m.status())=='Error.NoError':np.savez(O/'reports/source-body-cleaned.npz',v=vv,f=ff);print('SOURCE_CLEANED',decimals,flush=True);break
