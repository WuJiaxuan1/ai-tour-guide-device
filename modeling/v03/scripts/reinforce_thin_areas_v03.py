from pathlib import Path
import json
O=Path(r'F:\coding_projects\ai-tour-guide-device\modeling/v03');pf=O/'parameters/print-v03.json';p=json.loads(pf.read_text(encoding='utf-8-sig'));p['ear_shape']='rounded square, 13x13 mm, corner radius 1';p['ear_half_size_mm']=6.5;p['ear_corner_radius_mm']=1;p['rear_opening_reinforcement']={'x_min':-32,'x_max':-24,'inner_radius_mm':26.3,'outer_radius_mm':33};p['charging_bay_local_bounds']['z'][1]=-18;pf.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
f=O/'scripts/build_print_v03.py';s=f.read_text();needle="def union(xs):return M.Manifold.batch_boolean(xs,M.OpType.Add)";s=s.replace(needle,needle+"\ndef boss(x0,x1,y):\n half=P['ear_half_size_mm'];r=P['ear_corner_radius_mm'];d=half-r;return union([cyl(r,x0,x1,y+dy,dz,32) for dy in [-d,d] for dz in [-d,d]]).hull()")
s=s.replace("cyl(P['ear_radius_mm'],rear,seat,y)","boss(rear,seat,y)").replace("cyl(P['ear_radius_mm'],seat,seat+3,y)","boss(seat,seat+3,y)")
s=s.replace("body=body+carrier.translate(shift);log", "body=union([body,carrier.translate(shift),annulus(26.3,33,-32,-24).translate(shift)]);log")
f.write_text(s,encoding='utf8')
