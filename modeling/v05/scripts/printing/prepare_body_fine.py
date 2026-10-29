from pathlib import Path
import subprocess,json,hashlib,sys
W=Path.cwd();T=W/'tmp/mega-s-guide/slicer/PrusaSlicer-2.9.6';O=W/'output/mega-s-body-fine';O.mkdir(parents=True,exist_ok=True)
src=Path('F:/coding_projects/ai-tour-guide-device/print-delivery-v05/01_FULL_HOUSING_CLOSED_BACK_v05.stl')
d={}
for line in (W/'output/mega-s-first-print/MegaS_PLA_04_205C.ini').read_text().splitlines():
 if ' = ' in line:k,v=line.split(' = ',1);d[k]=v
d.update({'layer_height':'0.08','first_layer_height':'0.2','min_layer_height':'0.05','max_layer_height':'0.3','perimeters':'4','top_solid_layers':'15','bottom_solid_layers':'15','top_solid_min_thickness':'1.2','bottom_solid_min_thickness':'1.2','fill_density':'20%','fill_pattern':'gyroid','temperature':'200','first_layer_temperature':'205','external_perimeter_speed':'15','perimeter_speed':'25','small_perimeter_speed':'15','solid_infill_speed':'25','top_solid_infill_speed':'20','infill_speed':'35','gap_fill_speed':'20','bridge_speed':'15','first_layer_speed':'15','external_perimeter_extrusion_width':'0.42','resolution':'0','gcode_resolution':'0.0125','perimeter_generator':'arachne','support_material_style':'organic','support_material_buildplate_only':'0','support_material_threshold':'45','support_material_contact_distance':'0.16','support_material_bottom_contact_distance':'0.16','support_material_interface_layers':'3','support_material_interface_spacing':'0.2','support_material_xy_spacing':'0.35','support_material_speed':'25','support_material_interface_speed':'20','brim_width':'6','brim_separation':'0.1','skirts':'2','skirt_distance':'3','seam_position':'rear','support_tree_branch_diameter':'2','support_tree_branch_diameter_double_wall':'3','output_filename_format':'BODY008.gcode'})
d.update({'support_material_style':'snug','support_material_spacing':'2.5','support_material_closing_radius':'0.5','gcode_comments':'0'})
d['start_gcode']=d['start_gcode'].replace('AI Tour Guide v05 FIRST clip tests only','AI Tour Guide v05 BODY ONLY; face opening up; geometry unchanged').replace('1.75mm PLA label 195-220C','1.75mm PLA; first layer 205C; other layers 200C')
(O/'MegaS_BODY_008.ini').write_text('\n'.join(f'{k} = {v}' for k,v in sorted(d.items()))+'\n')
meta={'source_stl':str(src),'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'geometry_changes':'none; rigid rotation only','rotation_y_deg':-90,'orientation':'front opening up; curved back down','nozzle_mm':0.4,'nozzle_assumed':True,'layer_height_mm':0.08,'first_layer_height_mm':0.2,'temperature_C':200,'first_layer_temperature_C':205,'bed_C':60,'physical_quality':'not yet validated'}
(O/'preparation.json').write_text(json.dumps(meta,indent=2))
exe=str(T/'prusa-slicer-console.exe')
if not (O/'BODY_FACE_UP.stl').exists():
 r=subprocess.run([exe,'--rotate-y','-90','--center','105,105','--export-stl','--output',str(O/'BODY_FACE_UP.stl'),str(src)],capture_output=True,text=True,encoding='utf-8',errors='replace');print(r.stdout,r.stderr,flush=True);assert r.returncode==0
r=subprocess.run([exe,'--load',str(O/'MegaS_BODY_008.ini'),'--dont-arrange','--center','105,105','--export-gcode','--output',str(O/'BODY008.gcode'),str(O/'BODY_FACE_UP.stl')],capture_output=True,text=True,encoding='utf-8',errors='replace');(O/'slicing.log').write_text(r.stdout+'\n'+r.stderr,encoding='utf-8');print(r.stdout,r.stderr,flush=True);assert r.returncode==0
print('BODY_FINE_SLICE_DONE',flush=True)
