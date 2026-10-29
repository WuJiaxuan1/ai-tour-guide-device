from pathlib import Path
import numpy as np,json,struct
import pypdfium2 as pdfium
from PIL import Image,ImageOps,ImageDraw
root=Path(r'F:\coding_projects\ai-tour-guide-device'); out=root/'modeling/v01'
pdf=pdfium.PdfDocument(str(root/'stopwatch-nav/reference/StopWatch.pdf'))
for i in [0,1,10,11]:
 img=pdf[i].render(scale=1.65).to_pil(); img.save(out/f'previews/manual-page-{i+1:02}.png')
f=(root/'stopwatch-nav/reference/StopWatch-official.stl').read_bytes(); n=struct.unpack_from('<I',f,80)[0]
dt=np.dtype([('normal','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')]); a=np.frombuffer(f,dtype=dt,offset=84,count=n)['v'].copy()
u,inv=np.unique(np.round(a.reshape(-1,3),4),axis=0,return_inverse=True); faces=inv.reshape(-1,3); par=np.arange(len(u))
def find(x):
 while par[x]!=x: par[x]=par[par[x]];x=par[x]
 return x
for t in faces:
 r=find(t[0])
 for v in t[1:]: par[find(v)]=r
labels=np.array([find(t[0]) for t in faces]); comps=[]
for k,label in enumerate(sorted(set(labels))):
 tri=a[labels==label]; v=tri.reshape(-1,3); info=dict(id=k,triangles=len(tri),min=v.min(0).tolist(),max=v.max(0).tolist(),dimensions=np.ptp(v,axis=0).tolist(),centroid=v.mean(0).tolist())
 comps.append(info); np.save(out/f'references/component-{k}.npy',tri)
(out/'reports/stl-components.json').write_text(json.dumps(comps,indent=2),encoding='utf8');print(json.dumps(comps,indent=2))

