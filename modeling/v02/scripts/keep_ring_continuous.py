from pathlib import Path
import json
O=Path(r'F:\coding_projects\ai-tour-guide-device\modeling/v02')
pfile=O/'parameters-v02.json';p=json.loads(pfile.read_text());p['ring_contact_candidate']['ring_outer_diameter_mm']=66;p['ring_contact_candidate']['button_relief_outer_radius_mm']=29.7;p['ring_contact_candidate']['minimum_outer_web_nominal_mm']=3.3;pfile.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
f=O/'scripts/build_ring_preform_v02.py';s=f.read_text(encoding='utf-8-sig')
s=s.replace("bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);boolean(o,'DIFFERENCE')", """bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.ops.mesh.primitive_cylinder_add(vertices=256,radius=C['button_relief_outer_radius_mm'],depth=16,location=(1.5,0,0),rotation=(0,math.pi/2,0));cap=bpy.context.object
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Limit_Relief_To_Preserve_Continuous_Outer_Web','BOOLEAN');mod.operation='INTERSECT';mod.solver='EXACT';mod.object=cap;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cap,do_unlink=True);boolean(o,'DIFFERENCE')""")
s=s.replace("report={'status':P['status']", """parent=list(range(len(ring.data.vertices)))
def find(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
for edge in ring.data.edges:parent[find(edge.vertices[1])]=find(edge.vertices[0])
components=len({find(i) for i in range(len(parent))})
assert components==1, f'Ring was split into {components} components'
report={'connected_components':components,'status':P['status']""")
f.write_text(s,encoding='utf8')
