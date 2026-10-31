export const isServerTourActive=trip=>['active','paused'].includes(trip?.status);
export function legacyRoute(route){
  if(!route)return null;
  return {...route,routeId:route.route_id,navigationReady:route.navigation_ready,
    stops:route.stops.map(s=>({...s,id:s.attraction_id,placeId:s.attraction_id,stopId:s.stop_id,stayMinutes:s.planned_stay_seconds/60}))};
}
export function selectedStays(plan,minutes){
  return Object.fromEntries([...new Set(plan.stops.map(s=>s.placeId))].filter(id=>Object.hasOwn(minutes,id)).map(id=>[id,minutes[id]]));
}
