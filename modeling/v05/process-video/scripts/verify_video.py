from pathlib import Path
import bpy
import numpy as np
import json
import hashlib

HERE = Path(__file__).resolve().parents[1]
WORK = HERE.parents[2] / '.local-work/v05-process-video'
report = {}
bpy.ops.wm.open_mainfile(filepath=str(HERE/'v05-modeling-process-5s.blend'))
bpy.context.scene.frame_set(150)
names = ['PRINT_01_Closed_Back_Housing_v05','PRINT_02_Curved_Snap_Ring_v05']
animated = {n:bpy.data.objects[n] for n in names}
with bpy.data.libraries.load(str(HERE.parent/'assembly-snap-v05.blend')) as (src,dst):
    dst.objects = list(names)
for source, name in zip(dst.objects, names):
    target = animated[name]
    a = np.empty(len(source.data.vertices)*3, np.float32)
    b = np.empty(len(target.data.vertices)*3, np.float32)
    source.data.vertices.foreach_get('co', a)
    target.data.vertices.foreach_get('co', b)
    assert np.array_equal(a,b), name
    assert len(source.data.polygons) == len(target.data.polygons)
    assert not target.hide_viewport
    if target.data.shape_keys:
        assert all(k.value == 0 for k in list(target.data.shape_keys.key_blocks)[1:])
    report[name] = {'source_vertices_preserved':True,'vertices':len(target.data.vertices)}

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
sc.render.resolution_x, sc.render.resolution_y = 1920,1080
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
sc.render.use_sequencer = True
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
movie = sc.sequence_editor_create().strips.new_movie('MP4 verification',str(HERE/'v05-modeling-process-5s.mp4'),channel=1,frame_start=1)
assert movie.frame_duration == 150, movie.frame_duration
report['movie_frames'] = movie.frame_duration
report['fps'] = movie.fps
report['duration_seconds'] = movie.frame_duration/movie.fps
report['dimensions'] = [movie.elements[0].orig_width,movie.elements[0].orig_height]
assert report['dimensions'] == [1920,1080]
assert report['duration_seconds'] == 5
for f in [1,30,60,78,95,115,150]:
    sc.frame_set(f)
    sc.render.filepath = str(WORK/f'decoded-{f:04d}.png')
    bpy.ops.render.render(write_still=True)
report['mp4_bytes'] = (HERE/'v05-modeling-process-5s.mp4').stat().st_size
report['mp4_sha256'] = hashlib.sha256((HERE/'v05-modeling-process-5s.mp4').read_bytes()).hexdigest()
(HERE/'verification.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print('VERIFIED',json.dumps(report),flush=True)
