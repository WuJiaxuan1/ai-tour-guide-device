// Pure preset rules shared by browser and HTTP service. Roads are a separate service.
export function effectivePreferences(filters={}){
 const companions=Array.isArray(filters.companions)?filters.companions:[filters.companions];
 const lowEffort=companions.some(v=>v==='senior'||v==='child');
 return {...filters,intensity:lowEffort?'easy':filters.intensity||'normal',companions:lowEffort?'low-effort':companions.includes('none')?'none':null,lowEffort};
}
export function matchPresets(filters,{rules,routes}){
 if(!filters||typeof filters!=='object'||Array.isArray(filters))return {status:'invalid',routes:[]};
 const effective=effectivePreferences(filters);
 const matching=rules.filter(r=>['gate','duration','intensity'].every(k=>!effective[k]||r[k]===effective[k])&&(!effective.companions||effective.companions==='low-effort'&&['senior','child'].includes(r.companions)||r.companions===effective.companions));
 const ids=new Set(matching.filter(r=>r.status==='matched').flatMap(r=>r.routeIds));
 return {status:ids.size?'matched':matching.some(r=>r.status==='no_match')?'no_match':'unverified',routes:routes.filter(r=>ids.has(r.routeId)),effective};
}
export function visitKey(stop){return stop.stopId||stop.id;}
export function closestPreset(stopIds,routes,entryGateId){
 const ids=[...new Set(stopIds||[])];
 const candidates=routes.filter(r=>!entryGateId||r.entryGateId===entryGateId).map(route=>{const matched=ids.filter(id=>route.stops.some(s=>s.placeId===id));return {route,matched,extra:ids.filter(id=>!matched.includes(id))};}).sort((a,b)=>b.matched.length-a.matched.length||a.route.routeId.localeCompare(b.route.routeId));
 return candidates[0]?.matched.length?candidates[0]:null;
}
export function customRoute(input,catalog,matrix,{gateIds,allowedPlaceIds}={}){
 const {stopIds,entryId,exitId}=input||{};
 const known=new Map(catalog.map(p=>[p.id,p]));
 if(!Array.isArray(stopIds)||!stopIds.length||!entryId||!exitId||[entryId,exitId,...stopIds].some(id=>!known.has(id)))return {status:'invalid',message:'请选择有效的出入口和地点。'};
 if(gateIds&&(!gateIds.includes(entryId)||!gateIds.includes(exitId)))return {status:'invalid',message:'请从固定出入口中选择起点和终点。'};
 if(allowedPlaceIds&&stopIds.some(id=>!allowedPlaceIds.includes(id)))return {status:'outside_pool',message:'部分地点尚不在已确认的预设点位池中。已保留你的选择，可参考覆盖地点最多的官方路线。'};
 const ids=[...new Set(stopIds)].filter(id=>id!==entryId&&id!==exitId).sort();
 const usable=e=>e.verified===true&&e.walkable===true&&Number.isFinite(e.distanceMeters)&&e.distanceMeters>=0&&Number.isFinite(e.walkingSeconds)&&e.walkingSeconds>=0&&e.geometry?.type==='LineString'&&e.geometry.coordinates?.length>=2&&e.geometry.coordinates.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);
 const datumValid=matrix?.coordinateSystem==='GCJ02'&&matrix?.coordinateOrder==='lng,lat';
 const near=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&a.every((v,i)=>Math.abs(v-b[i])<=0.0002);
 const edge=(from,to)=>datumValid&&matrix?.edges?.find(e=>e.fromId===from&&e.toId===to&&usable(e)&&near(e.geometry.coordinates[0],known.get(from)?.location)&&near(e.geometry.coordinates.at(-1),known.get(to)?.location));
 const pool=[...new Set([entryId,...ids,exitId])];
 const missing=[];for(const a of pool)for(const b of pool)if(a!==b&&!edge(a,b))missing.push({fromId:a,toId:b});
 if(missing.length)return {status:'missing_matrix',message:'所选地点之间的步行道路资料尚未齐全。已保留你的选择，可以先查看官方路线。',missing};
 // Deterministic nearest-neighbour ordering; never advertised as globally shortest.
 const order=[entryId],pending=[...ids];
 while(pending.length){const from=order.at(-1);pending.sort((a,b)=>edge(from,a).distanceMeters-edge(from,b).distanceMeters||(a<b?-1:a>b?1:0));order.push(pending.shift());}
 if(order.at(-1)!==exitId)order.push(exitId);
 const legs=order.slice(1).map((id,i)=>({...edge(order[i],id),fromStopId:'custom-'+i,toStopId:'custom-'+(i+1)}));
 if(!legs.length)return {status:'invalid',message:'请至少选择一个途经地点。'};
 const routeId='custom-'+order.join('.');
 return {status:'ready',route:{schemaVersion:'2.0',routeId,revision:1,name:'我的自选路线',source:{provider:'preset-matrix',version:matrix.version},coordinateSystem:'GCJ02',coordinateOrder:'lng,lat',stops:order.map((id,i)=>({...known.get(id),placeId:id,stopId:'custom-'+i,stayMinutes:0})),legs,geometry:{type:'LineString',coordinates:legs.flatMap(l=>l.geometry.coordinates)},distanceMeters:legs.reduce((s,l)=>s+l.distanceMeters,0),walkingSeconds:legs.reduce((s,l)=>s+l.walkingSeconds,0),navigationReady:true}};
}
