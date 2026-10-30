import {validLocation} from './navigation.js';
export function validatePersonalRoute(route,expected,{fixedOrder=false}={}){
 const fail=()=>{throw Error('路线数据不完整，请重新规划。');};
 if(!route||route.navigationReady!==true||route.coordinateSystem!=='GCJ02'||route.coordinateOrder!=='lng,lat'||route.travelMode!=='walking'||route.source?.provider!=='amap'||!Number.isFinite(Date.parse(route.source.generatedAt))||![route.distanceMeters,route.walkingSeconds].every(n=>Number.isFinite(n)&&n>=0))fail();
 if(!Array.isArray(route.stops)||route.stops.length!==expected.length||new Set(route.stops.map(s=>s?.stopId)).size!==expected.length||route.stops.some(s=>typeof s?.stopId!=='string'||!s.stopId||typeof s.name!=='string'||!validLocation(s.location)))fail();
 const ids=route.stops.map(s=>s.placeId||s.id);
 if(ids[0]!==expected[0]||ids.at(-1)!==expected.at(-1)||(fixedOrder?ids.some((id,i)=>id!==expected[i]):[...ids].sort().join('|')!==[...expected].sort().join('|')))fail();
 const points=route.geometry?.coordinates;
 if(route.geometry?.type!=='LineString'||!Array.isArray(points)||points.length<2||points.length>20000||points.some(p=>!validLocation(p)))fail();
 if(!Array.isArray(route.legs)||route.legs.length!==ids.length-1||route.legs.some((leg,i)=>leg.fromStopId!==route.stops[i].stopId||leg.toStopId!==route.stops[i+1].stopId||![leg.distanceMeters,leg.walkingSeconds].every(n=>Number.isFinite(n)&&n>=0)))fail();
 if(!['preset','exact','road-heuristic'].includes(route.optimization?.mode))fail();
 return route;
}
