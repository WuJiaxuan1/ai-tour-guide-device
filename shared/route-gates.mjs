export function hasRouteLocation(location) {
  return Array.isArray(location)&&location.length===2&&location.every(Number.isFinite)&&
    location[0]>118.93&&location[0]<119.01&&location[1]>32.12&&location[1]<32.19;
}

/** Replace only the template's boundary stops; repeated interior visits keep their IDs. */
export function routeWithGates(route,gates,entryId,exitId) {
  const entry=gates.find(g=>g.placeId===entryId||g.id===(entryId||route.entryGateId));
  const exit=gates.find(g=>g.placeId===exitId||g.id===(exitId||route.exitGateId));
  if(!entry||!hasRouteLocation(entry.location))return route;
  const stop=(gate,old,role)=>({...old,id:gate.placeId,placeId:gate.placeId,nodeId:gate.placeId,
    stopId:old?.stopId||`${route.routeId}-${role}`,name:gate.name,location:gate.location,stayMinutes:0,endpoint:role});
  const tail=route.exitGateId?route.stops.slice(1,-1):route.stops.slice(1);
  const stops=[stop(entry,route.stops[0],'start'),...tail];
  if(exit&&hasRouteLocation(exit.location))stops.push(stop(exit,route.exitGateId?route.stops.at(-1):null,'end'));
  const changed=JSON.stringify(stops.map(s=>[s.placeId,s.location]))!==JSON.stringify(route.stops.map(s=>[s.placeId,s.location]));
  return {...route,entryGateId:entry.id,exitGateId:exit?.id||null,stops,
    uniqueNodeCount:new Set(stops.map(s=>s.placeId)).size,
    completeness:exit?'listed':'missing_exit',
    ...(changed?{geometry:null,legs:[],roadPlan:undefined,distanceMeters:null,walkingSeconds:null,navigationReady:false}:{}),
  };
}

export function presetSelection(route,entryId,exitId) {
  return {presetId:route.routeId,entryId,exitId};
}
