from pathlib import Path
import configparser,json,subprocess,hashlib
W=Path.cwd(); T=W/'tmp/mega-s-guide/slicer/PrusaSlicer-2.9.6'; O=W/'output/mega-s-first-print';O.mkdir(parents=True,exist_ok=True)
c=configparser.ConfigParser(interpolation=None,strict=False);c.read(T/'resources/profiles/Anycubic.ini',encoding='utf-8')
def resolve(section):
 d={};kind=section.split(':')[0]
 for p in c[section].get('inherits','').split(';'):
  if p.strip():d.update(resolve(kind+':'+p.strip()))
 d.update(dict(c[section]));d.pop('inherits',None);return d
d={}
for s in ['print:0.20mm QUALITY @MEGA','filament:Generic PLA @MEGA','printer:Anycubic i3 Mega S']:d.update(resolve(s))
for k in list(d):
 if k.startswith(('compatible_','default_')) or k in ['printer_notes','filament_notes']:d.pop(k)
d.update({
 'nozzle_diameter':'0.4','filament_diameter':'1.75','temperature':'205','first_layer_temperature':'205','bed_temperature':'60','first_layer_bed_temperature':'60',
 'binary_gcode':'0','gcode_flavor':'marlin','use_relative_e_distances':'1','gcode_comments':'1','gcode_label_objects':'disabled','remaining_times':'0','thumbnails':'',
 'layer_height':'0.2','first_layer_height':'0.2','perimeters':'4','top_solid_layers':'5','bottom_solid_layers':'5','fill_density':'100%','fill_pattern':'rectilinear',
 'perimeter_speed':'35','external_perimeter_speed':'25','small_perimeter_speed':'20','infill_speed':'40','solid_infill_speed':'35','top_solid_infill_speed':'25','gap_fill_speed':'25','first_layer_speed':'20','bridge_speed':'20','travel_speed':'100','travel_speed_z':'5','max_print_speed':'40',
 'default_acceleration':'0','perimeter_acceleration':'0','infill_acceleration':'0','bridge_acceleration':'0','first_layer_acceleration':'0','machine_limits_usage':'time_estimate_only',
 'support_material':'1','support_material_auto':'1','support_material_buildplate_only':'0','support_material_style':'snug','support_material_contact_distance':'0.2','support_material_bottom_contact_distance':'0.2','support_material_xy_spacing':'0.35','support_material_interface_layers':'2','support_material_interface_spacing':'0.25','support_material_spacing':'2.5','support_material_threshold':'45','support_material_speed':'30','support_material_interface_speed':'20','support_material_extrusion_width':'0.4',
 'brim_type':'outer_only','brim_width':'3','brim_separation':'0.15','skirts':'1','skirt_height':'1','skirt_distance':'3','min_skirt_length':'4',
 'complete_objects':'0','extrusion_multiplier':'1','disable_fan_first_layers':'2','min_fan_speed':'100','max_fan_speed':'100','bridge_fan_speed':'100','retract_length':'5','retract_speed':'35','deretract_speed':'35',
 'start_gcode':r'; AI Tour Guide v05 FIRST clip tests only\n; Mega-S, assumed 0.4mm nozzle, 1.75mm PLA label 195-220C\nG21\nG90\nM83\nM107\nM140 S60\nM104 S140\nG28\nG1 Z5 F600\nM190 S60\nM104 S205\nM109 S205\nG1 X5 Y10 F3000\nG1 Z0.2 F600\nG92 E0\nG1 X5 Y190 E12 F900\nG1 X5.5 Y190 F3000\nG1 X5.5 Y10 E12 F900\nG92 E0\nG1 E-1 F1800\nG1 Z1 F600\nG1 E1 F1800',
 'end_gcode':r'; End: lift before parking, heaters off\nM400\nG92 E0\nG1 E-2 F1800\nG91\nG1 Z5 F600\nG90\nG1 X10 Y200 F3000\nM104 S0\nM140 S0\nM107\nM84',
 'output_filename_format':'FIRST_CLIP_V05.gcode',
})
(O/'MegaS_PLA_04_205C.ini').write_text('\n'.join(f'{k} = {v}' for k,v in sorted(d.items()))+'\n',encoding='utf-8')
meta={'slicer':'PrusaSlicer 2.9.6 official portable','source':'https://github.com/prusa3d/PrusaSlicer/releases/tag/version_2.9.6','printer':'Anycubic i3 Mega S','nozzle_mm':0.4,'nozzle_status':'user instructed default; not physically measured','filament_diameter_mm':1.75,'filament':'PLA','user_label_temperature_C':[195,220],'selected_nozzle_C':205,'selected_bed_C':60,'objects':['0.2 mm clip','0.3 mm clip','0.4 mm clip','matching socket','release tool','release tool'],'physical_test':'not performed','source_3mf':r'F:\coding_projects\ai-tour-guide-device\print-delivery-v05\00A_PRINT_FIRST_CLIP_TESTS_v05.3mf'}
(O/'preparation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
cmd=[str(T/'prusa-slicer-console.exe'),'--load',str(O/'MegaS_PLA_04_205C.ini'),'--dont-arrange','--export-gcode','--output',str(O/'FIRST_CLIP_V05.gcode'),meta['source_3mf']]
p=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace');(O/'slicing.log').write_text(p.stdout+'\n'+p.stderr,encoding='utf-8');print(p.stdout);print(p.stderr);assert p.returncode==0,p.returncode
print('FIRST_GCODE_GENERATED')
