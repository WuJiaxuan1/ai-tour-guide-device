import json
from pathlib import Path
R=Path(r'F:\coding_projects\ai-tour-guide-device');O=R/'modeling/v02'
p=json.loads((R/'modeling/v01/parameters-v01.json').read_text(encoding='utf-8-sig'))
p['status']='front_ring_independent_preform_NOT_ASSEMBLED_NOT_FOR_PRINT'
p['front_bearing_dimensions']={
 'source':'User report on 2026-10-28 Asia/Hong_Kong',
 'material_identification':'User reports exposed plastic rim after viewing the A/B explainer; not independently inspected',
 'exposed_rim_single_side_width_approx_mm':2,
 'measurement_method':'ruler, read perpendicular to surface; no vernier caliper',
 'reading_resolution_mm':1,
 'measurement_uncertainty_mm':None,
 'plastic_top_minus_glass_top_approx_mm':0,
 'height_description':'surfaces essentially coplanar; not a precision zero',
 'status':'rough_observation_sufficient_for_draft_not_manufacturing_certification'}
p['ring_contact_candidate']={
 'device_outer_diameter_nominal_mm':51.95,
 'glass_outer_diameter_derived_approx_mm':47.95,
 'glass_diameter_status':'derived from 51.95 - 2*2; not directly measured',
 'ring_inner_diameter_mm':50.5,
 'ring_outer_diameter_mm':62,
 'ring_thickness_mm':3,
 'nominal_plastic_overlap_radial_mm':0.725,
 'nominal_glass_clearance_radial_mm':1.275,
 'nominal_radial_device_play_mm':0.525,
 'idealized_play_adjusted_minimum_glass_clearance_mm':0.75,
 'idealized_play_adjusted_minimum_plastic_overlap_mm':0.2,
 'play_analysis_status':'ideal circles only; unknown ruler error and print error excluded; centering needs design',
 'screw_count':2,
 'screw_candidate':'M2.5 machine screws and accessible hex nuts; length not set',
 'screw_clearance_hole_diameter_mm':2.9,
 'ear_center_offsets_y_mm':[-34,34],
 'ear_radius_mm':5,
 'button_channel_margin_mm':2,
 'coordinate_system':'local X thickness (back contact face X=0, front face X=3), Y horizontal, Z up; independent ring not placed on full housing',
 'housing_interface_status':'not designed; ear holes do not align with any validated housing seats',
 'bearing_force_or_torque':None,
 'limitations':['No verified back support','No housing fastening seats or axial hard stop','No verified pad thickness or preload','No final fit test','Bore play can reduce local plastic overlap to about 0.2 mm under ideal assumptions']}
(O/'parameters-v02.json').write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
measurement='''# 前缘实测记录

日期：2026-10-28，Asia/Hong_Kong。

用户原话：“精确到毫米，用尺子垂直视线进行读数，大概看一下是2mm，没有用游标卡尺，B的话两个表面基本上持平”。

对应示意图：A=单侧露出的塑料宽度约 2 mm；B=塑料表面与玻璃表面基本齐平，名义高差约 0 mm。读数分辨率约 1 mm，不代表误差已经确定为 ±1 mm 或数值精确到 2.000 mm。未独立查看实物，不从颜色替代材质判断。

该答复解决了此前“正面是否存在露出塑料边及大致关系”的设计输入。无需重复索取该尺寸，也不因暂时没有游标卡尺停止草案设计。实际受力边界、宽度沿圆周变化、打印误差和预紧仍须通过可检查试样/实物校核。

候选前圈内径 50.5 mm，依据官方壳体名义 Ø51.95：塑料搭接约 (51.95-50.5)/2=0.725 mm。按单侧塑料约 2 mm 推得玻璃外径约 47.95 mm（计算值，非直接实测），前圈内缘离玻璃约 1.275 mm。两个值都是理想同心状态，不是实物保证。

Ø53 候选安装腔与 Ø51.95 壳体间单侧游隙约 0.525 mm。在理想圆和忽略测量误差时，一侧玻璃余量可减至约 0.75 mm；另一侧塑料搭接可减至约 0.20 mm。因此下一步应加入经验证的居中结构/可控软垫，不能仅靠这片前圈承认装配完成。

本轮只建立独立参数化前圈预形及可视接触图，不施加螺丝预紧，不输出最终打印 STL。螺丝长度、主体连接座、轴向硬限位与后承托仍待共同设计。
'''
(O/'reports/front-rim-observation-20261028.md').write_text(measurement,encoding='utf8')
