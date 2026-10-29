from pathlib import Path
import json,numpy as np
O=Path(r'F:\coding_projects\ai-tour-guide-device\modeling/v03');pf=O/'parameters/print-v03.json';p=json.loads(pf.read_text());patch=[]
for point,normal in [([-19.07904,19.79472,46.20171],[-.755276,.162659,.634901]),([-18.86667,20.34893,46.25687],[-.701055,.232874,.674011])]:
 patch.append((np.array(point)-2.4*np.array(normal)).tolist())
p['local_rear_hood_thickening']={'method':'two overlapping 2.5mm radius internal spheres, centers 2.4mm inward from sampled exterior surface','centers_mm':patch,'radius_mm':2.5,'outward_local_allowance_mm':0.1,'reason':'repair measured 0.37-0.43mm original appearance skin; remote from hardware'};pf.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
f=O/'scripts/build_print_v03.py';s=f.read_text();s=s.replace("log('Cut shared access openings through preserved appearance')", "log('Cut shared access openings through preserved appearance')")
s=s.replace("# Both soles share a flat bed plane.","patches=[M.Manifold.sphere(2.5,circular_segments=48).translate(tuple(c)) for c in P['local_rear_hood_thickening']['centers_mm']];body=union([body]+patches)\n# Both soles share a flat bed plane.")
f.write_text(s,encoding='utf8')
# Compact diagnostics for subsequent reruns.
f=O/'scripts/check_hardware_and_package_v03.py';s=f.read_text();s=s.replace("print(json.dumps(results,indent=2))", "print('HARDWARE_OVERLAPS', {k:v for k,v in results.items() if k!='static_standing_proxy'});print('STANDING_SCENARIOS',results['static_standing_proxy']['scenarios'])");f.write_text(s,encoding='utf8')
