import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {matchPresets,customRoute} from '../../shared/routes.mjs';
import {hasRouteLocation,routeWithGates} from '../../shared/route-gates.mjs';
export function createPresetService(root,catalog){
 const read=p=>JSON.parse(readFileSync(resolve(root,'backend/data',p),'utf8'));
 const presets=read('routes/preset-routes.v1.json'),filter=read('routes/route-filter-matrix.v1.json'),matrix=read('routes/walking-matrix.v1.json'),shuttles=read('transport/shuttle-lines.v1.json');
 const overrides=read('routes/point-overrides.v1.json');
 const nodes=read('routes/route-node-mapping.v1.json').nodes.map(n=>({...n,...overrides.nodes.find(o=>o.nodeId===n.nodeId)}));
 const gates=read('routes/gates.v1.json').gates;
 presets.routes=presets.routes.map(raw=>{
  const originalStops=raw.stops.map(s=>{const n=nodes.find(n=>n.nodeId===s.nodeId);return {...s,location:n?.location||s.location,placeId:s.placeId||s.nodeId};});
  const bounded=routeWithGates({...raw,stops:originalStops},gates);
  const removedStops=bounded.stops.filter(s=>!hasRouteLocation(s.location)).map(s=>({stopId:s.stopId,placeId:s.placeId,name:s.name}));
  const stops=bounded.stops.filter(s=>hasRouteLocation(s.location));
  const changed=JSON.stringify(stops.map(s=>[s.placeId,s.location]))!==JSON.stringify(originalStops.map(s=>[s.placeId,s.location]));
  return {...bounded,stops,removedStops,revision:changed?raw.revision+1:raw.revision,uniqueNodeCount:new Set(stops.map(s=>s.placeId)).size,
   originalUniqueNodeCount:raw.uniqueNodeCount,sourceCountDiscrepancy:raw.countDiscrepancy,countDiscrepancy:false,
   ...(changed?{geometry:null,legs:[],roadPlan:undefined,navigationReady:false,distanceMeters:null,walkingSeconds:null}:{}),
  };
 });
 const roads=existsSync(resolve(root,'backend/data/routes/road-routes.v1.json'))?read('routes/road-routes.v1.json').routes:[];
 for(const route of presets.routes){const saved=roads.find(r=>r.routeId===route.routeId&&r.revision===route.revision&&r.stops.length===route.stops.length&&r.stops.every((s,i)=>s.stopId===route.stops[i].stopId&&s.placeId===route.stops[i].placeId&&JSON.stringify(s.location)===JSON.stringify(route.stops[i].location)));if(saved)Object.assign(route,{geometry:saved.geometry,legs:saved.legs,distanceMeters:saved.distanceMeters,walkingSeconds:saved.walkingSeconds,source:saved.source,navigationReady:true,roadPlan:saved});}
 const data={...presets,...filter,matrix,gates};
 data.nodes=[...nodes.map(n=>({...n,id:n.placeId||n.nodeId})),...gates.map(g=>({...g,id:g.placeId}))];
 data.gateIds=data.gates.map(g=>g.placeId).filter(Boolean);
 data.allowedPlaceIds=[...new Set([...data.gateIds,...data.routes.flatMap(r=>r.stops.map(s=>s.placeId).filter(Boolean))])];
 return {data,shuttles,match:filters=>matchPresets(filters,data),custom:input=>customRoute(input,catalog,matrix,data)};
}
