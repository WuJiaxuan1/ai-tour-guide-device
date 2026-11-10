"""Capture real Blender UI frames with Blender's own screen screenshot operator."""
from pathlib import Path
import bpy
import json
import sys
import traceback

HERE = Path(__file__).resolve().parents[1]
ROOT = HERE.parents[2]
WORK = ROOT / '.local-work/v05-process-video'
pilot = '--pilot' in sys.argv
FRAMES = [1, 30, 60, 85, 115, 150] if pilot else list(range(1, 151))
OUT = WORK / ('pilot' if pilot else 'frames')
OUT.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
state = {'index': 0, 'phase': 'set'}

def tick():
    try:
        if state['index'] >= len(FRAMES):
            (OUT / 'complete.json').write_text(json.dumps({'frames':FRAMES, 'count':len(FRAMES)}))
            print('UI_CAPTURE_COMPLETE', len(FRAMES), flush=True)
            bpy.ops.wm.quit_blender()
            return None
        f = FRAMES[state['index']]
        if state['phase'] == 'set':
            scene.frame_set(f)
            for ob in bpy.context.selected_objects: ob.select_set(False)
            active = None
            if 7 <= f < 65:
                candidates = [o for o in bpy.data.collections['01  Blockout - illustrative stages'].objects
                              if not o.hide_viewport and o.name[:2].isdigit()]
                if candidates: active = sorted(candidates, key=lambda o:o.name)[-1]
            elif f < 96 and f >= 65:
                active = bpy.data.objects['PRINT_01_Closed_Back_Housing_v05']
            elif 105 <= f < 125:
                active = bpy.data.objects['PRINT_02_Curved_Snap_Ring_v05']
            if active:
                active.select_set(True)
                bpy.context.view_layer.objects.active = active
            for area in bpy.context.screen.areas:
                if area.type == 'VIEW_3D':
                    sp = area.spaces.active
                    sp.region_3d.view_rotation = scene.camera.rotation_euler.to_quaternion()
                    sp.region_3d.view_distance = 190
                    sp.region_3d.view_location = (0, 0, 76)
                    sp.region_3d.view_perspective = 'ORTHO'
                if area.type == 'DOPESHEET_EDITOR' and f == FRAMES[0]:
                    region = next((r for r in area.regions if r.type == 'WINDOW'), None)
                    if region:
                        with bpy.context.temp_override(area=area, region=region):
                            bpy.ops.action.view_all()
                area.tag_redraw()
            state['phase'] = 'capture'
            return .22
        bpy.ops.screen.screenshot(filepath=str(OUT / f'{f:04d}.png'))
        state['index'] += 1
        state['phase'] = 'set'
        if state['index'] % 15 == 0: print('CAPTURED', state['index'], flush=True)
        return .04
    except Exception:
        (OUT / 'error.txt').write_text(traceback.format_exc(), encoding='utf8')
        print(traceback.format_exc(), flush=True)
        return None

bpy.app.timers.register(tick, first_interval=3.0)
