"""Build a five-second, editable modeling-process reconstruction from v05.

Run with Blender --background --python. Source manufacturing files are read only.
Intermediate blockouts illustrate a logical sequence, not historical operations.
"""
from pathlib import Path
import bpy
import math
import json
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parents[1]
SOURCE = HERE.parent / 'assembly-snap-v05.blend'
ROOT = HERE.parents[2]
WORK = ROOT / '.local-work/v05-process-video'
WORK.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
scene.name = 'V05 - Modeling process reconstruction'
scene.frame_start, scene.frame_end = 1, 150
scene.render.fps = 30
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.world.color = (.05, .05, .05)
bpy.context.preferences.filepaths.save_version = 0

body = bpy.data.objects['PRINT_01_Closed_Back_Housing_v05']
ring = bpy.data.objects['PRINT_02_Curved_Snap_Ring_v05']
refs = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('REFERENCE_ONLY')]
for o in [body, ring] + refs:
    o.animation_data_clear()
    o.hide_set(False)
    o.hide_viewport = False
    o.hide_render = False
    o.location.z += 74
    o.select_set(False)
body.color = (.63, .65, .68, 1)
ring.color = (.76, .62, .42, 1)

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

block = collection('01  Blockout - illustrative stages')
final = collection('02  V05 final housing and ring')
reference = collection('03  Device reference - NOT FOR PRINT')
for ob in [body, ring]:
    for c in list(ob.users_collection): c.objects.unlink(ob)
    final.objects.link(ob)
for ob in refs:
    for c in list(ob.users_collection): c.objects.unlink(ob)
    reference.objects.link(ob)
for c in list(bpy.data.collections):
    if c not in (block, final, reference) and len(c.objects) == 0:
        bpy.data.collections.remove(c)

def key(ob, prop, frame, value):
    setattr(ob, prop, value)
    ob.keyframe_insert(data_path=prop, frame=frame)

def visible(ob, start, end=150):
    for prop in ('hide_viewport', 'hide_render'):
        key(ob, prop, 1, start > 1)
        if start > 1:
            key(ob, prop, start - 1, True)
            key(ob, prop, start, False)
        key(ob, prop, end, False)
        if end < 150: key(ob, prop, end + 1, True)

def grow(ob, center, scale, start, duration=9):
    ob.location = center
    key(ob, 'scale', start, tuple(x * .04 for x in scale))
    key(ob, 'scale', start + duration, scale)
    visible(ob, start, 64)

def ellipsoid(name, center, scale, start, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1)
    ob = bpy.context.object
    ob.name = name
    for c in list(ob.users_collection): c.objects.unlink(ob)
    block.objects.link(ob)
    ob.color = (.63, .65, .68, 1)
    for p in ob.data.polygons: p.use_smooth = True
    smooth = ob.modifiers.new('Surface refinement', 'SUBSURF')
    smooth.levels = 1
    smooth.render_levels = 1
    grow(ob, center, scale, start)
    return ob

# Anatomical blockouts use the same principal axis and approximate proportions.
torso = ellipsoid('01 Body - proportion blockout', (0, 0, 32), (25, 31, 29), 7)
lf = ellipsoid('02 Foot L', (7, -19, 10), (25, 18, 10), 12)
rf = ellipsoid('03 Foot R', (7, 19, 10), (25, 18, 10), 15)
lh = ellipsoid('04 Arm L', (0, -40, 39), (13, 12, 22), 20)
rh = ellipsoid('05 Arm R', (0, 40, 39), (13, 12, 22), 23)
hood = ellipsoid('06 Hood - sphere to pointed silhouette', (0, 0, 105), (37, 52, 44), 27, 48, 32)
hood.shape_key_add(name='Basis')
pointed = hood.shape_key_add(name='Shape the hood')
for v in pointed.data:
    z = v.co.z
    taper = 1 - .48 * max(z, 0) ** 1.25
    v.co.y *= taper
    v.co.x *= 1 - .16 * max(z, 0)
    if z > 0: v.co.z = z * 1.02
pointed.value = 0
pointed.keyframe_insert(data_path='value', frame=38)
pointed.value = 1
pointed.keyframe_insert(data_path='value', frame=56)
cl = ellipsoid('07 Cape L', (6, -25, 63), (27, 32, 8), 43)
cr = ellipsoid('08 Cape R', (6, 25, 63), (27, 32, 8), 46)
cl.rotation_euler.x = math.radians(-12)
cr.rotation_euler.x = math.radians(12)

# Exact v05 exterior, initially with its maple relief flattened back to the hood.
body.shape_key_add(name='Basis - exact v05')
leaf = body.shape_key_add(name='Maple relief construction')
verts = np.empty(len(body.data.vertices) * 3, np.float32)
body.data.vertices.foreach_get('co', verts)
verts = verts.reshape(-1, 3)
y = verts[:, 1] + .02733765
z = verts[:, 2] - 22.28087056
r = np.hypot(y, z)
theta = (np.degrees(np.arctan2(z, y)) + 360) % 360
guide = 38.0246763347 + .003872879*y - .0428389661*z - .00448269422*y*y + .000281676666*y*z - .00501200704*z*z
mask = (theta > 20) & (theta < 80) & (r > 30) & (verts[:, 0] > 15) & (verts[:, 0] > guide + .25)
flat = verts.copy()
flat[mask, 0] = guide[mask] + .1
leaf.data.foreach_set('co', flat.ravel())
leaf.value = 1
leaf.keyframe_insert(data_path='value', frame=65)
leaf.keyframe_insert(data_path='value', frame=77)
leaf.value = 0
leaf.keyframe_insert(data_path='value', frame=91)
visible(body, 65)

# A solid face plug establishes a subtractive opening operation before revealing
# the existing final cavity and its supports. It is an animation-only object.
vv, ff = [], []
for x, radius in [(27.7, 32.8), (30.7, 32.8), (27.7, .12), (30.7, .12)]:
    for i in range(96):
        a = i * math.tau / 96
        vv.append((x, radius * math.cos(a) - .02733765, radius * math.sin(a) + 96.28087056))
for i in range(96):
    j = (i+1) % 96
    ff.extend([(i,j,96+j,96+i), (192+i,288+i,288+j,192+j),
               (96+i,96+j,288+j,288+i), (i,192+i,192+j,j)])
mesh = bpy.data.meshes.new('Animated opening surface')
mesh.from_pydata(vv, [], ff)
mesh.update()
plug = bpy.data.objects.new('Animated opening', mesh)
block.objects.link(plug)
plug.name = '09 Face blank - before cavity opening'
plug.color = body.color
visible(plug, 65, 85)
plug.shape_key_add(name='Basis')
opening = plug.shape_key_add(name='Open the device cavity')
for i in range(192, 384):
    a = (i % 96) * math.tau / 96
    opening.data[i].co.y = 32.799 * math.cos(a) - .02733765
    opening.data[i].co.z = 32.799 * math.sin(a) + 96.28087056
opening.value = 0
opening.keyframe_insert(data_path='value', frame=68)
opening.value = 1
opening.keyframe_insert(data_path='value', frame=85)

# Reference device enters from the open front, followed by the real snap ring.
for ob in refs:
    base = ob.location.copy()
    visible(ob, 96)
    key(ob, 'location', 96, base + Vector((42, 0, 0)))
    key(ob, 'location', 111, base)
    ob.color = (.13, .22, .27, 1)
visible(ring, 105)
base = ring.location.copy()
key(ring, 'location', 105, base + Vector((48, 0, 0)))
key(ring, 'location', 124, base)

cam = scene.camera
cam.name = 'Process review camera'
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 215
target = Vector((0, 0, 76))
for f, degrees in [(1, 15), (90, 15), (122, 15), (150, 28)]:
    a = math.radians(degrees)
    cam.location = target + Vector((300*math.cos(a), 300*math.sin(a), 48))
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.keyframe_insert(data_path='location', frame=f)
    cam.keyframe_insert(data_path='rotation_euler', frame=f)
cam.hide_set(True)
for name, f in [('BLOCKOUT', 1), ('SHAPE', 38), ('DETAILS', 65), ('ASSEMBLY', 96), ('V05', 125)]:
    scene.timeline_markers.new(name, frame=f)

for ob in bpy.context.selected_objects: ob.select_set(False)
bpy.context.view_layer.objects.active = body
scene.frame_set(150)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            sp = area.spaces.active
            sp.shading.type = 'SOLID'
            sp.shading.light = 'STUDIO'
            sp.shading.studiolight_rotate_z = .35
            sp.shading.color_type = 'OBJECT'
            sp.shading.show_shadows = True
            sp.shading.show_cavity = True
            sp.shading.cavity_type = 'BOTH'
            sp.shading.curvature_ridge_factor = 1.15
            sp.shading.curvature_valley_factor = 1.0
            sp.shading.background_type = 'VIEWPORT'
            sp.shading.background_color = (.055, .055, .055)
            sp.overlay.show_floor = True
            sp.overlay.show_axis_x = True
            sp.overlay.show_axis_y = True
            sp.overlay.show_extras = False
            sp.overlay.show_relationship_lines = False
            sp.show_region_ui = False
            sp.region_3d.view_perspective = 'ORTHO'
            sp.region_3d.view_rotation = cam.rotation_euler.to_quaternion()
            sp.region_3d.view_distance = 190
            sp.region_3d.view_location = target
        elif area.type == 'PROPERTIES':
            area.spaces.active.context = 'MODIFIER'

note = bpy.data.texts.new('ABOUT_THIS_ANIMATION.txt')
note.write('Five-second modeling-process reconstruction. 150 frames at 30 fps.\n'
 'Early blockout meshes illustrate a logical construction sequence.\n'
 'Final housing and ring preserve the v05 source geometry; the maple shape key is zero at completion.\n'
 'Device objects are references, not print parts. This scene is for video, not manufacturing.\n'
 'The MP4 is assembled from actual Blender-window screenshots, not a simulated UI.\n')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'v05-modeling-process-5s.blend'))
(WORK / 'build.json').write_text(json.dumps({'source': str(SOURCE), 'frames':150, 'fps':30,
    'body_vertices':len(body.data.vertices), 'leaf_vertices_animated':int(mask.sum()),
    'output':str(HERE / 'v05-modeling-process-5s.blend')}, indent=2), encoding='utf8')
print('PROCESS_SCENE_READY', flush=True)
