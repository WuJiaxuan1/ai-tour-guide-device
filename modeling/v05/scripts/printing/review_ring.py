from pathlib import Path
import numpy as np,json
from PIL import Image,ImageDraw,ImageFont
O=Path.cwd()/'output/mega-s-ring-fine-010';s=np.load(O/'body-support-paths.npz')['selected']
im=Image.new('RGB',(1500,1120),'white');d=ImageDraw.Draw(im)
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
d.text((30,15),'前压圈实际切片路径｜正面朝上，背面环状支撑',font=font(29),fill='#182e3d')
d.text((30,62),'蓝色：前圈与卡扣　橙色：可拆支撑　灰色：附着边 / 裙边；图中为机器实际挤出路径',font=font(21),fill='#456072')
colors={0:'#236789',1:'#e68a28',3:'#aeb7c0'}
panels=[('全部高度叠加',None),('首层 Z = 0.20 mm',.2),('卡扣区域 Z ≈ 1.00 mm',1),('卡扣区域 Z ≈ 2.00 mm',2),('前圈下方 Z ≈ 3.00 mm',3),('前圈曲面 Z ≈ 5.00 mm',5)]
for i,(title,z) in enumerate(panels):
 x=30+(i%3)*490;y=115+(i//3)*490;size=450;lo=63;scale=size/84
 d.rectangle((x,y,x+size,y+size),fill='#f4f7fa')
 rows=s if z is None else s[abs(s[:,5]-z)<.051]
 for kind in [3,1,0]:
  for a in rows[rows[:,7]==kind]:
   pts=[(x+(a[k]-lo)*scale,y+size-(a[k+1]-lo)*scale) for k in [0,3]]
   d.line(pts,fill=colors[kind],width=max(1,round(a[6]*scale)))
 d.text((x,y+size+5),title,font=font(20),fill='#182e3d')
d.text((30,1090),'支撑与前圈一起打印；拆除前先冷却。卡扣细臂不可当作撬动支点。',font=font(20),fill='#456072')
im.save(O/'RING_SUPPORT_PATHS.png')
# Same-height bead clearance. Does not certify physical support removal.
def pd(p,a,b):
 v=b-a;t=np.clip(np.sum((p-a)*v,axis=-1)/np.maximum(np.sum(v*v,axis=-1),1e-16),0,1)
 return np.linalg.norm(p-a-t[...,None]*v,axis=-1)
out=[]
for z in sorted(set(np.round(s[:,5],4))):
 layer=s[abs(s[:,5]-z)<1e-4]; model=layer[layer[:,7]==0];sup=layer[layer[:,7]==1]
 if not len(model) or not len(sup):continue
 low=1000
 for i in range(0,len(sup),80):
  q=sup[i:i+80];a=q[:,None,:2];b=q[:,None,3:5];c=model[None,:,:2];e=model[None,:,3:5]
  ds=np.minimum.reduce([pd(a,c,e),pd(b,c,e),pd(c,a,b),pd(e,a,b)])
  def cross(u,v):return u[...,0]*v[...,1]-u[...,1]*v[...,0]
  inter=(cross(b-a,c-a)*cross(b-a,e-a)<0)&(cross(e-c,a-c)*cross(e-c,b-c)<0);ds[inter]=0
  low=min(low,float((ds-(q[:,None,6]+model[None,:,6])/2).min()))
 out.append({'z':float(z),'gap':low})
r={'method':'same-height XY path distance minus half bead widths; excludes intended vertical support contacts; not a physical-fit guarantee','minimum_gap_mm':min(x['gap'] for x in out),'layers':out}
(O/'SUPPORT_CLEARANCE.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2));assert r['minimum_gap_mm']>.1

