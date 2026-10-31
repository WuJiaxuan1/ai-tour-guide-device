import {check, object} from './errors.mjs';
import {TEMPLE_EXPERIENCE,hasTempleExperience} from '../../../shared/immersive.mjs';

export function recommend(data, input) {
  object(input, ['entrance_id', 'exit_id', 'duration', 'intensity', 'has_elderly', 'has_children', 'limit']);
  check(['west', 'south'].includes(input.entrance_id) && ['west', 'south'].includes(input.exit_id), 'INVALID_INPUT', '请选择入口和出口。');
  check(['half_day', 'full_day'].includes(input.duration) && ['easy', 'normal', 'energetic'].includes(input.intensity), 'INVALID_INPUT', '游玩时长或体力选项不正确。');
  check(typeof input.has_elderly === 'boolean' && typeof input.has_children === 'boolean', 'INVALID_INPUT', '老人和儿童同行必须分别填写。');
  const limit = input.limit ?? 3;
  check(Number.isInteger(limit) && limit >= 1 && limit <= 3, 'INVALID_INPUT', '推荐数量为 1 至 3 条。');
  const effective = {...input, intensity: input.has_elderly || input.has_children ? 'easy' : input.intensity};
  const groups = [input.has_elderly && 'senior', input.has_children && 'child'].filter(Boolean);
  if (!groups.length) groups.push('none');
  const matches = groups.map(companions => data.rules.filter(r => r.gate === input.entrance_id && r.duration === (input.duration === 'half_day' ? 'half' : 'full') && r.intensity === effective.intensity && r.companions === companions));
  // Both groups must have evidence. A union would falsely claim suitability for both.
  const pools = matches.map(rules => new Set(rules.filter(r => r.status === 'matched').flatMap(r => r.routeIds)));
  const candidates = data.routes.filter(r => pools.every(p => p.has(r.routeId)) && r.entryGateId === input.entrance_id && r.exitGateId === input.exit_id && r.completeness !== 'missing_exit');
  candidates.sort((a, b) => Number(b.navigationReady) - Number(a.navigationReady) || a.routeId.localeCompare(b.routeId));
  return {catalog_version: data.version, effective_preferences: effective, count: Math.min(candidates.length, limit), status: candidates.length ? 'matched' : matches.some(m => !m.length) ? 'unverified' : 'no_match', routes: candidates.slice(0, limit).map(route => snapshot(route)), warnings: effective.intensity !== input.intensity ? ['有老人或儿童同行，已按轻松强度匹配。'] : []};
}
export function snapshot(route) {
  return {route_id: route.routeId, revision: route.revision, name: route.name, entrance_id: route.entryGateId, exit_id: route.exitGateId,
    estimated_total_seconds: Number.isFinite(route.officialDurationMinutes) ? route.officialDurationMinutes * 60 : null,
    distance_m: route.distanceMeters ?? null, highlights: [route.description].filter(Boolean), source_refs: [route.source || {provider: 'official'}],
    warnings: [...(route.countDiscrepancy ? ['原资料中的景点数量待核对。'] : []), ...(!route.navigationReady ? ['道路资料尚未齐备，暂不能开始导航。'] : [])],
    immersive_experiences:hasTempleExperience(route)?[TEMPLE_EXPERIENCE]:[],navigation_ready: route.navigationReady === true, coordinate_system: 'GCJ02', geometry: route.geometry || null, legs: structuredClone(route.legs || []),
    stops: route.stops.map((s, i) => ({stop_id: s.stopId, attraction_id: s.placeId, name: s.name, sequence_no: i + 1, location: s.location || null, planned_stay_seconds: (s.stayMinutes || 0) * 60, status: 'pending'}))};
}
