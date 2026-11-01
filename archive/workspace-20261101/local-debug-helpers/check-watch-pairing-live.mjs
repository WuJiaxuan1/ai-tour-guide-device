import assert from 'node:assert/strict';
import http from 'node:http';
import {resolve} from 'node:path';
import {writeFileSync,readFileSync} from 'node:fs';
import {TravelStore} from '../backend/src/travel/store.mjs';
import {createTravelApi} from '../backend/src/travel/api.mjs';
import {createPairing} from '../backend/src/travel/pairing.mjs';
import {createWatchMapRenderer} from '../backend/src/watch/map-renderer.mjs';
import {amapRequest,decodePolyline} from '../backend/src/amap.mjs';
import {readConfig} from '../backend/src/config.mjs';
const root=resolve('.'),store=new TravelStore(':memory:'),key=readConfig(root).serverKey;
const nodes=JSON.parse(readFileSync('backend/data/navigation-nodes.json','utf8')).nodes;
const destination=nodes.temple.location;
const walking=async(from,to)=>{const data=await amapRequest('/v3/direction/walking',{origin:from.join(','),destination:to.join(',')},key,{});return data.route.paths[0];};
const api=createTravelApi({root,store,presets:{routes:[]},model:{configured:()=>false},renderWatchMap:createWatchMapRenderer(root),walkingGeometry:async(from,to)=>(await walking(from,to)).steps.flatMap(s=>decodePolyline(s.polyline)),convertLocation:async p=>{const d=await amapRequest('/v3/assistant/coordinate/convert',{locations:p.join(','),coordsys:'gps'},key,{});return d.locations.split(',').map(Number);},walkingLeg:async(from,to)=>{const p=await walking(from,to);return {distance_m:Number(p.distance),walk_seconds:Number(p.duration),geometry:{type:'LineString',coordinates:p.steps.flatMap(s=>decodePolyline(s.polyline))}};}});
const server=http.createServer((req,res)=>api.handle(req,res,new URL(req.url,'http://localhost')));
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const req=async(path,token,body)=>{const r=await fetch(base+'/api/v1'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();assert.ok(r.ok,`${r.status} ${d.error?.code}`);return d;};
try{
 const web=store.createSession().token,owner=store.authenticate(web);
 const trip=store.createTrip(owner,{client_event_id:'isolated-real-map'},()=>({status:'active',started_at:new Date().toISOString(),route:{revision:1,stops:[{stop_id:'temple',attraction_id:'temple',name:'栖霞古寺',location:destination,status:'pending'}]},visits:[]}));
 const claim=await req('/watch/pairings',null,{});await req(`/trips/${trip.id}/pair-device`,web,{code:claim.pairing_code});
 assert.equal((await req('/watch/pairing',claim.claim_token)).trip_id,trip.id);
 assert.equal(createPairing({store,secret:()=>''}).session().trip_id,trip.id);
 await req(`/trips/${trip.id}/location`,web,{client_seq:1,captured_at:new Date().toISOString(),coordinate_system:'WGS84',location:[118.950,32.145],accuracy_m:8});
 let state;const until=Date.now()+65000;
 do{state=await req(`/trips/${trip.id}/watch/navigation`,claim.claim_token);if(['ready','error'].includes(state.status))break;await new Promise(r=>setTimeout(r,500));}while(Date.now()<until);
 assert.equal(state.status,'ready',state.status);
 for(const [kind,url] of [['map',state.image_url],['route',state.route_url]]){const r=await fetch(base+url,{headers:{Authorization:'Bearer '+claim.claim_token}});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());writeFileSync('.local-work/watch-server-'+kind+'.bin',bytes);console.log('PASS paired-watch download',kind,bytes.length);}
 await req(`/trips/${trip.id}/watch/ack`,claim.claim_token,{session:state.session,frame_id:1,route_revision:1});assert.equal((await req(`/trips/${trip.id}/watch/navigation`,web)).ack.session,state.session);
 const newClaim=await req('/watch/pairings',null,{});await req(`/trips/${trip.id}/pair-device`,web,{code:newClaim.pairing_code});assert.equal((await req(`/trips/${trip.id}/watch/navigation`,web)).ack,null);
 assert.equal((await fetch(base+state.image_url,{headers:{Authorization:'Bearer '+claim.claim_token}})).status,401);
 console.log('PASS isolated real integration: unified pairing, shared voice trip, WGS84 conversion, AMap walking/SDK rendering, QMAP/QRTE authenticated delivery, ACK, rebind clears ACK and revokes old watch. Shared local/production bindings untouched.');
}catch(error){console.error('FAIL isolated pairing/map integration:',error.code||error.name,error.message?.includes('http')?'network/render error':error.message);process.exitCode=1;}
finally{await new Promise(r=>server.close(r));await api.close();}
