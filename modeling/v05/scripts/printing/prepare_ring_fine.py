from pathlib import Path
import subprocess, json, hashlib
W=Path.cwd(); O=W/'output/mega-s-ring-fine-010'; O.mkdir(parents=True,exist_ok=True)
src=Path('F:/coding_projects/ai-tour-guide-device/print-delivery-v05/02_CURVED_SNAP_RING_v05.stl')
base=Path('F:/coding_projects/ai-tour-guide-device/print-gcode-v05/02-body-fine-008/MegaS_BODY_008.ini')
d=dict(line.split(' = ',1) for line in base.read_text().splitlines() if ' = ' in line)
d.update({'layer_height':'0.1','first_layer_height':'0.2','perimeters':'4','fill_density':'20%', 'top_solid_layers':'10','bottom_solid_layers':'10','top_solid_min_thickness':'1','bottom_solid_min_thickness':'1','external_perimeter_speed':'15','perimeter_speed':'25','infill_speed':'30','top_solid_infill_speed':'15','max_print_speed':'30','support_material_contact_distance':'0.2','support_material_bottom_contact_distance':'0.2','support_material_xy_spacing':'0.4','support_material_interface_layers':'2','support_material_interface_spacing':'0.3','support_material_spacing':'3','support_material_closing_radius':'0','support_material_threshold':'40','brim_width':'2','brim_separation':'0.15','skirts':'1','output_filename_format':'RING010.gcode','gcode_comments':'1'})
d['start_gcode']=d['start_gcode'].replace('BODY ONLY; face opening up','FRONT RING ONLY; cosmetic face up')
ini=O/'MegaS_RING_010.ini'; ini.write_text('\n'.join(f'{k} = {v}' for k,v in sorted(d.items()))+'\n')
meta={'source_stl':str(src),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'geometry_changes':False,'orientation':'original STL, cosmetic face up, clips horizontal near bed','layer_mm':.1,'nozzle_mm':.4,'nozzle_verified':False,'PLA_density_g_cm3':1.24,'support':'snug automatic overhang threshold 40 degrees, XY gap 0.4, Z gap 0.2, no raft','physical_fit':'unverified'}
(O/'preparation.json').write_text(json.dumps(meta,indent=2))
p=subprocess.run([str(W/'tmp/mega-s-guide/slicer/PrusaSlicer-2.9.6/prusa-slicer-console.exe'),'--load',str(ini),'--center','105,105','--export-gcode','--output',str(O/'RING010.gcode'),str(src)],capture_output=True,text=True,encoding='utf-8',errors='replace')
(O/'slicing.log').write_text(p.stdout+'\n'+p.stderr); print(p.stdout,p.stderr); assert p.returncode==0
