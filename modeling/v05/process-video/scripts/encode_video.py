"""Assemble 150 unmodified screenshots into a 5-second H.264 MP4 using Blender."""
from pathlib import Path
import bpy
import json

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[2]
WORK = ROOT / '.local-work/v05-process-video'
FRAMES = WORK / 'frames'
files = [FRAMES / f'{n:04d}.png' for n in range(1,151)]
assert all(p.is_file() for p in files), 'Incomplete screenshot sequence'
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.frame_start = 1
sc.frame_end = 150
sc.render.fps = 30
sc.render.resolution_x = 1920
sc.render.resolution_y = 1080
sc.render.resolution_percentage = 100
sc.render.image_settings.media_type = 'VIDEO'
sc.render.image_settings.file_format = 'FFMPEG'
sc.render.ffmpeg.format = 'MPEG4'
sc.render.ffmpeg.codec = 'H264'
sc.render.ffmpeg.constant_rate_factor = 'HIGH'
sc.render.ffmpeg.ffmpeg_preset = 'GOOD'
sc.render.ffmpeg.audio_codec = 'NONE'
sc.render.filepath = str(HERE / 'v05-modeling-process-5s.mp4')
sc.render.use_sequencer = True
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
ed = sc.sequence_editor_create()
strip = ed.strips.new_image('Actual Blender UI - 150 frames', str(files[0]), channel=1, frame_start=1)
for p in files[1:]: strip.elements.append(p.name)
strip.frame_final_duration = 150
strip.colorspace_settings.name = 'sRGB'
bpy.ops.render.render(animation=True)
print('VIDEO_READY', sc.render.filepath, flush=True)
