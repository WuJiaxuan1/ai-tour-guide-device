from pathlib import Path
import sys,json,math,struct,zipfile,hashlib
import numpy as np
O=Path(__file__).resolve().parents[1];sys.path.insert(0,str(O/'mesh-tools'));import manifold3d as M
P=json.loads((O/'parameters/print-v03.json').read_text());E=json.loads((O/'reports/export-checks-v03.json').read_text());shift=np.array((0,P['axis_y'],P['axis_z']));t=np.array(E['03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl']['print_translation_mm']);a=np.load(O/'reports/03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl.npz');v=a['v']-t;f=a['f'];body=M.Manifold(M.Mesh(np.ascontiguousarray(v,np.float32),np.ascontiguousarray(f,np.uint32)));results={}
def cyl(r,x0,x1,y=0,z=0):return M.Manifold.cylinder(x1-x0,r,circular_segments=96).rotate((0,90,0)).translate((x0,y,z))
def hexsolid(y):
 p=np.array([(y+5/math.sqrt(3)*math.cos(i*math.tau/6),5/math.sqrt(3)*math.sin(i*math.tau/6)) for i in range(6)]);return M.CrossSection([p]).extrude(2).rotate((90,0,90)).translate((38.3,0,0))
for y in [-34,34]:
 nut=hexsolid(y);start=nut.translate((0,math.copysign(40,y),0));sweep=(nut+start).hull().translate(tuple(shift));results[f'nut_side_insertion_{y}_overlap_mm3']=(body^sweep).volume();shaft=cyl(1.25,36,46,y).translate(tuple(shift));results[f'screw_shank_{y}_overlap_mm3']=(body^shaft).volume();driver=cyl(5,48.5,90,y).translate(tuple(shift));results[f'driver_access_{y}_overlap_mm3']=(body^driver).volume()
plug=M.Manifold.cube((12,32,20)).translate((30.5,-16,-46)).translate(tuple(shift));results['clearance_box_12x32x20mm_in_underchin_bay_overlap_mm3']=(body^plug).volume();assert all(abs(v)<.001 for v in results.values()),results
# Static standing check: body uniform-density centroid proxy, plus 39g device at its geometric center.
tri=v[f].astype(float);vol6=np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2]));com=np.sum((tri.sum(1)/4)*vol6[:,None],axis=0)/sum(vol6);floor=v[abs(v[:,2]+74)<.001,:2];pts=sorted(set(map(tuple,floor.tolist())))
def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
lo=[]
for x in pts:
 while len(lo)>=2 and cross(lo[-2],lo[-1],x)<=0:lo.pop()
 lo.append(x)
hi=[]
for x in reversed(pts):
 while len(hi)>=2 and cross(hi[-2],hi[-1],x)<=0:hi.pop()
 hi.append(x)
hull=lo[:-1]+hi[:-1];cases=[]
for mass in [50,100,200]:
 c=(com*mass+39*np.array((35.05,P['axis_y'],P['axis_z'])))/(mass+39);inside=all(cross(hull[i],hull[(i+1)%len(hull)],c[:2])>=-1e-5 for i in range(len(hull)));cases.append({'assumed_printed_body_mass_g':mass,'combined_COM_xy_mm':c[:2].tolist(),'inside_sole_convex_hull':inside})
results['static_standing_proxy']={'body_uniform_volume_centroid_mm':com.tolist(),'sole_hull_xy':hull,'device_assumed_mass_g':39,'scenarios':cases,'limitation':'printed mass distribution and real hardware CG unmeasured; static proxy only'}
(O/'reports/hardware-and-standing-checks-v03.json').write_text(json.dumps(results,indent=2),encoding='utf8');print('HARDWARE_OVERLAPS', {k:v for k,v in results.items() if k!='static_standing_proxy'});print('STANDING_SCENARIOS',results['static_standing_proxy']['scenarios'])
# Unit-declared generic 3MF files: only mesh and placement, no temperatures or machine motions.
from xml.sax.saxutils import escape
REL='http://schemas.openxmlformats.org/package/2006/relationships';NS='http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
def write3mf(path,items):
 resources=[];build=[]
 for idx,(stlname,tx,ty) in enumerate(items,1):
  ar=np.load(O/f'reports/{stlname}.npz');vv=ar['v'];ff=ar['f'];verts=''.join(f'<vertex x="{x:.6f}" y="{y:.6f}" z="{z:.6f}"/>' for x,y,z in vv);faces=''.join(f'<triangle v1="{x}" v2="{y}" v3="{z}"/>' for x,y,z in ff);resources.append(f'<object id="{idx}" type="model" name="{escape(stlname)}"><mesh><vertices>{verts}</vertices><triangles>{faces}</triangles></mesh></object>');build.append(f'<item objectid="{idx}" transform="1 0 0 0 1 0 0 0 1 {tx} {ty} 0"/>')
  assert vv[:,2].min()>=-1e-6
  assert vv[:,0].min()+tx>0 and vv[:,0].max()+tx<210 and vv[:,1].min()+ty>0 and vv[:,1].max()+ty<210 and vv[:,2].max()<205
 xml=f'<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="{NS}"><metadata name="Title">AI Tour Guide PLA Fit Prototype v03</metadata><resources>'+''.join(resources)+'</resources><build>'+''.join(build)+'</build></model>'
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');z.writestr('_rels/.rels',f'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="{REL}"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');z.writestr('3D/3dmodel.model',xml)
 # Verify package and resource counts after writing.
 import xml.etree.ElementTree as ET
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None;tree=ET.fromstring(z.read('3D/3dmodel.model'));assert tree.attrib['unit']=='millimeter';assert len(tree.find('{'+NS+'}build'))==len(items)
write3mf(O/'fit-test/00_PRINT_FIRST_TEST_PAIR_PLA_v03.3mf',[('01_FIT_TEST_CARRIER_52p6mm_PLA_v03.stl',65,105),('02_FRONT_RING_50p5mm_PLA_v03.stl',145,105)])
write3mf(O/'exports/04_FULL_HOUSING_AND_RING_PLA_v03.3mf',[('03_FULL_HOUSING_ONE_PIECE_PLA_v03.stl',65,105),('02_FRONT_RING_50p5mm_PLA_v03.stl',155,105)])
print('3MF_PACKAGES_CHECKED')
