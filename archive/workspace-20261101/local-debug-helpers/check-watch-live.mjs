import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:5174';let token,trip,device;
async function req(path,body,method=body?'POST':'GET',auth=token){const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});const d=await r.json();assert.ok(r.ok,`${path}: ${r.status} ${d.error?.code||''}`);return d;}
try{
 token=(await req('/sessions',{})).token;
 trip=await req('/trips/from-selection',{client_event_id:randomUUID(),selection:{presetId:'R02',entryId:'gate',exitId:'gate'}});
 trip=await req(`/trips/${trip.id}/commands`,{client_event_id:randomUUID(),expected_version:trip.version,action:'start'});
 device=(await req(`/trips/${trip.id}/device-binding`,{})).token;
 let state=await req(`/trips/${trip.id}/watch/navigation`,undefined,'GET',device);assert.equal(state.status,'waiting_location');
 await req(`/trips/${trip.id}/location`,{client_seq:Date.now(),captured_at:new Date().toISOString(),coordinate_system:'WGS84',location:[118.950,32.145],accuracy_m:8});
 const until=Date.now()+65000;
 do{state=await req(`/trips/${trip.id}/watch/navigation`,undefined,'GET',device);if(state.status==='ready'||state.status==='error')break;await new Promise(r=>setTimeout(r,1000));}while(Date.now()<until);
 assert.equal(state.status,'ready',state.message||state.status);
 for(const [type,path] of [['map',state.image_url],['route',state.route_url]]){const r=await fetch(base+path,{headers:{Authorization:'Bearer '+device}});assert.equal(r.status,200);const b=Buffer.from(await r.arrayBuffer());writeFileSync('.local-work/watch-server-'+type+'.bin',b);console.log('PASS authenticated',type,b.length,'bytes');}
 assert.equal((await fetch(base+state.image_url)).status,401);
 await req(`/trips/${trip.id}/watch/ack`,{session:state.session,frame_id:1,route_revision:1},'POST',device);
 assert.equal((await req(`/trips/${trip.id}/watch/navigation`)).ack.session,state.session);
 trip=await req(`/trips/${trip.id}`);trip=await req(`/trips/${trip.id}/commands`,{client_event_id:randomUUID(),expected_version:trip.version,action:'pause'});
 assert.equal((await req(`/trips/${trip.id}/watch/navigation`,undefined,'GET',device)).status,'paused');
 const stale=await fetch(base+state.route_url,{headers:{Authorization:'Bearer '+device}});assert.equal(stale.status,409);
 console.log('PASS real HTTP: web start, synthetic GPS -> AMap walking route + official SDK map -> watch credential download -> ACK -> pause invalidates assets');
}finally{if(trip){trip=await req(`/trips/${trip.id}`);if(['active','paused'].includes(trip.status))trip=await req(`/trips/${trip.id}/commands`,{client_event_id:randomUUID(),expected_version:trip.version,action:'complete'});await req(`/trips/${trip.id}`,{expected_version:trip.version},'DELETE');}}
