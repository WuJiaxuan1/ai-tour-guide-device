import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:5174';
let token,trip;
async function req(path,body,method=body?'POST':'GET'){
 const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});
 const result=await res.json();assert.ok(res.ok,`${path}: ${res.status} ${result.error||''}`);return result;
}
const data=await req('/api/routes/presets');
assert.ok(data.routes.every(r=>r.stops.every(s=>Array.isArray(s.location)&&s.location.every(Number.isFinite))));
for(const [entryId,exitId] of [['gate','facility-b0g0m1mptg'],['facility-b0g0m1mptg','gate']]){
 const {route}=await req('/api/routes/plan',{stopIds:['temple'],entryId,exitId});
 assert.equal(route.stops[0].placeId,entryId);assert.equal(route.stops.at(-1).placeId,exitId);assert.ok(route.navigationReady);
 console.log(`PASS real walking route ${route.stops[0].name} -> ${route.stops.at(-1).name}: ${route.distanceMeters}m; ${route.geometry.coordinates.length} points`);
}
try{
 token=(await req('/api/v1/sessions',{})).token;
 trip=await req('/api/v1/trips/from-selection',{client_event_id:randomUUID(),selection:{presetId:'R02',entryId:'gate',exitId:'facility-b0g0m1mptg'}});
 assert.equal(trip.route.entrance_id,'west');assert.equal(trip.route.exit_id,'south');assert.equal(trip.route.stops.at(-1).attraction_id,'facility-b0g0m1mptg');
 console.log('PASS saved preset trip: west -> south, gate coordinates retained');
}finally{
 if(trip)await req('/api/v1/trips/'+trip.id,{expected_version:trip.version},'DELETE');
}
console.log('PASS runtime presets have no unknown coordinates; synthetic trip cleaned up');
