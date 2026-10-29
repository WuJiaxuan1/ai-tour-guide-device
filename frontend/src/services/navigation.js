export const routeEndpoint = import.meta.env?.VITE_ROUTE_PLAN_URL?.trim() || '/api/navigation/routes';
export const placesEndpoint = import.meta.env?.VITE_NAVIGATION_PLACES_URL?.trim() || '/api/navigation/places';
const finiteNonnegative = value => Number.isFinite(value) && value >= 0;
export const validLocation = value => Array.isArray(value) && value.length === 2 &&
  Number.isFinite(value[0]) && Number.isFinite(value[1]) &&
  Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;

export function validateRoute(route, stopIds, {optimize=false}={}) {
  const invalid = () => {throw new Error('路线数据不完整，请稍后重试。');};
  if (!route || route.schemaVersion !== '1.0' || route.travelMode !== 'walking' ||
      route.coordinateSystem !== 'GCJ02' || route.coordinateOrder !== 'lng,lat' ||
      typeof route.routeId !== 'string' || !route.routeId ||
      !Number.isInteger(route.revision) || route.revision < 1 ||
      route.source?.provider !== 'amap' || !Number.isFinite(Date.parse(route.source?.generatedAt)) ||
      !finiteNonnegative(route.distanceMeters) || !finiteNonnegative(route.walkingSeconds)) invalid();
  if (!Array.isArray(route.stops) || route.stops.length !== stopIds.length ||
      route.stops.some((p, i) => !p || !validLocation(p.location) || (optimize?!stopIds.includes(p.id):p.id!==stopIds[i])) || new Set(route.stops.map(p=>p.id)).size!==stopIds.length || (optimize&&route.stops[0]?.id!==stopIds[0])) invalid();
  const points = route.geometry?.coordinates;
  if (route.geometry?.type !== 'LineString' || !Array.isArray(points) ||
      points.length < 2 || points.length > 20000 || points.some(p => !validLocation(p))) invalid();
  if (route.steps !== undefined && (!Array.isArray(route.steps) || route.steps.some(step =>
    typeof step?.instruction !== 'string' || !validLocation(step?.location) ||
    !finiteNonnegative(step.distanceMeters) || !finiteNonnegative(step.walkingSeconds)))) invalid();
  return route;
}

export async function planWalkingRoute({stopIds, signal, optimize=false, returnToStart=false, endpoint = routeEndpoint, fetcher = globalThis.fetch}) {
  if (!endpoint) throw new Error('路线服务尚未连接，先把喜欢的景点留在这里。');
  if (!Array.isArray(stopIds) || stopIds.length < 2 || new Set(stopIds).size !== stopIds.length) {
    throw new Error('请先选择至少两个不同景点。');
  }
  const response = await fetcher(endpoint, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'omit', signal,
    body: JSON.stringify({schemaVersion: '1.0', travelMode: 'walking', stopIds,
      coordinateSystem: 'GCJ02', coordinateOrder: 'lng,lat',...(optimize||returnToStart?{optimize,returnToStart}:{})}),
  });
  if (!response.ok) {let problem;try{problem=await response.json();}catch{}throw new Error(typeof problem?.error==='string'?problem.error:`暂时无法规划路线（${response.status}），请稍后重试。`);}
  let data;
  try {data = await response.json();} catch {throw new Error('路线服务暂不可用，请稍后重试。');}
  return validateRoute(data?.route, stopIds,{optimize});
}

export async function loadNavigationPlaces({signal, stopIds, endpoint = placesEndpoint, fetcher = globalThis.fetch} = {}) {
  if (!endpoint) return [];
  if (Array.isArray(stopIds)&&!stopIds.length)return [];
  const url=Array.isArray(stopIds)?`${endpoint}${endpoint.includes('?')?'&':'?'}ids=${encodeURIComponent(stopIds.join(','))}`:endpoint;
  const response = await fetcher(url, {signal, credentials: 'omit'});
  if (!response.ok) throw new Error('景点位置暂不可用');
  const data = await response.json();
  if (data?.coordinateSystem !== 'GCJ02' || data.coordinateOrder !== 'lng,lat' || !Array.isArray(data.places) ||
      data.places.some(p => typeof p?.id !== 'string' || !validLocation(p?.location))) {
    throw new Error('景点位置格式不符合约定');
  }
  return data.places;
}
