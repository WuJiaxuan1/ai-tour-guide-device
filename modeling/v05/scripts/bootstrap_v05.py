from pathlib import Path
O=Path(__file__).resolve().parents[1];V4=O.parent/'v04'
for name in ['build_v04.py','export_and_check_v04.py','review_geometry.py','repair_stl_tjunction.py','package_v04.py']:
 text=(V4/'scripts'/name).read_text(encoding='utf8').replace('v04','v05').replace('V04','V05')
 (O/'scripts'/name.replace('v04','v05')).write_text(text,encoding='utf8')
