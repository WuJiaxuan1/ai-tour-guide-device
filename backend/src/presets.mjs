import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {matchPresets,customRoute} from '../../shared/routes.mjs';
export function createPresetService(root,catalog){
 const read=p=>JSON.parse(readFileSync(resolve(root,'backend/data',p),'utf8'));
 const presets=read('routes/preset-routes.v1.json'),filter=read('routes/route-filter-matrix.v1.json'),matrix=read('routes/walking-matrix.v1.json'),shuttles=read('transport/shuttle-lines.v1.json');
 const overrides=read('routes/point-overrides.v1.json');
 const nodes=read('routes/route-node-mapping.v1.json').nodes.map(n=>({...n,...overrides.nodes.find(o=>o.nodeId===n.nodeId)}));
 for(const route of presets.routes)route.stops=route.stops.map(s=>{const n=nodes.find(n=>n.nodeId===s.nodeId);return {...s,location:n?.location||s.location,placeId:s.placeId||s.nodeId};});
 const roads=existsSync(resolve(root,'backend/data/routes/road-routes.v1.json'))?read('routes/road-routes.v1.json').routes:[];
 for(const route of presets.routes){const saved=roads.find(r=>r.routeId===route.routeId&&r.stops.length===route.stops.length&&r.stops.every((s,i)=>s.stopId===route.stops[i].stopId&&s.placeId===route.stops[i].placeId&&JSON.stringify(s.location)===JSON.stringify(route.stops[i].location)));if(saved)Object.assign(route,{geometry:saved.geometry,legs:saved.legs,distanceMeters:saved.distanceMeters,walkingSeconds:saved.walkingSeconds,source:saved.source,navigationReady:true,roadPlan:saved});}
 const data={...presets,...filter,matrix,gates:[{id:'west',name:'西门（牌坊）',placeId:'gate'},{id:'south',name:'南门（蝴蝶谷）',placeId:catalog.find(p=>p.name==='栖霞山风景名胜区南门售票处')?.id||null}]};
 data.nodes=nodes.map(n=>({...n,id:n.placeId||n.nodeId}));
 data.gateIds=data.gates.map(g=>g.placeId).filter(Boolean);
 data.allowedPlaceIds=[...new Set([...data.gateIds,...data.routes.flatMap(r=>r.stops.map(s=>s.placeId).filter(Boolean))])];
 return {data,shuttles,match:filters=>matchPresets(filters,data),custom:input=>customRoute(input,catalog,matrix,data)};
}
