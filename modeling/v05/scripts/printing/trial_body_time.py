from pathlib import Path
import subprocess,json,sys,math,re,time
W=Path.cwd();base=W/'output/mega-s-body-fine';O=W/'output/mega-s-body-time-trials';O.mkdir(parents=True,exist_ok=True)
tag=sys.argv[1];h=float(sys.argv[2]);outer=float(sys.argv[3]);inner=float(sys.argv[4]);fill=float(sys.argv[5]);support=float(sys.argv[6])
d=dict(s.split(' = ',1) for s in (base/'MegaS_BODY_008.ini').read_text().splitlines() if ' = ' in s)
d.update({'layer_height':str(h),'external_perimeter_speed':str(outer),'perimeter_speed':str(inner),'infill_speed':str(fill),'solid_infill_speed':str(inner),'top_solid_infill_speed':str(min(outer,30)),'support_material_speed':str(support),'support_material_interface_speed':str(min(support,25)),'small_perimeter_speed':'20','gap_fill_speed':'30','max_print_speed':str(max(inner,fill,support)),'top_solid_layers':str(math.ceil(1.2/h)),'bottom_solid_layers':str(math.ceil(1.2/h)),'support_material_contact_distance':'0.2','support_material_bottom_contact_distance':'0.2','output_filename_format':tag+'.gcode'})
if len(sys.argv)>7:d.update({'perimeters':sys.argv[7],'fill_density':sys.argv[8]+'%'})
cfg=O/(tag+'.ini');cfg.write_text('\n'.join(f'{k} = {v}' for k,v in sorted(d.items()))+'\n')
cmd=[str(W/'tmp/mega-s-guide/slicer/PrusaSlicer-2.9.6/prusa-slicer-console.exe'),'--load',str(cfg),'--dont-arrange','--center','105,105','--export-gcode','--output',str(O/(tag+'.gcode')),str(base/'BODY_FACE_UP.stl')]
r=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace');(O/(tag+'.log')).write_text(r.stdout+'\n'+r.stderr);assert r.returncode==0 and 'Error:' not in r.stdout+r.stderr,(r.stdout,r.stderr)
p=O/(tag+'.gcode')
with p.open('rb') as f:f.seek(max(0,p.stat().st_size-70000));tail=f.read().decode()
stats={s[2:].split(' = ',1)[0]:s.split(' = ',1)[1] for s in tail.splitlines() if s.startswith(('; estimated printing','; filament used','; estimated first layer'))}
result={'tag':tag,'layer_height':h,'outer_speed':outer,'inner_speed':inner,'fill_speed':fill,'support_speed':support,'perimeters':d['perimeters'],'fill_density':d['fill_density'],'stats':stats,'bytes':p.stat().st_size};(O/(tag+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2),flush=True)
