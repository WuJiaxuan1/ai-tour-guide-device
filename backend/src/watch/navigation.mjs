import {check,object} from '../travel/errors.mjs';
import {encodeMap,encodeRoute,newSession,simplify,advanceProgress} from './wire.mjs';

export function createWatchNavigation({store,renderMap,walkingGeometry}){
 const entries=new Map();
 const tripState=(session,id)=>{const trip=store.getTrip(session,id),sample=store.location(session,id),next=trip.route.stops.find(s=>s.status==='pending');return {trip,sample,next};};
 const fresh=(trip,sample)=>sample&&store.clock()-Date.parse(sample.captured_at)>=0&&store.clock()-Date.parse(sample.captured_at)<=15000&&sample.accuracy_m>0&&sample.accuracy_m<=50&&(!trip.location_required_after||Date.parse(sample.received_at)>=Date.parse(trip.location_required_after));
 const keyFor=(trip,next)=>[trip.id,trip.route.revision,next?.stop_id,trip.started_at,trip.location_required_after].join(':');
 function entryFor(id){
  if(!entries.has(id)){if(entries.size>=32){const oldest=[...entries].find(([,e])=>!e.pending);check(oldest,'WATCH_BUSY','地图服务繁忙，请稍后重试。',503);entries.delete(oldest[0]);}entries.set(id,{touched:store.clock()});}
  const e=entries.get(id);e.touched=store.clock();return e;
 }
 async function prepare(session,id,entry,key,sample,next){
  try{
   check(renderMap&&walkingGeometry,'WATCH_UNAVAILABLE','手表地图服务尚未配置。',503);
   const raw=sample.estimate?.stop_id===next.stop_id?sample.estimate.geometry?.coordinates:null;
   const points=simplify(raw||await walkingGeometry(sample.location,next.location));
   const sessionId=newSession(),route=encodeRoute(points,next.location,sessionId),rendered=await renderMap([...points,next.location]);
   const image=encodeMap(rendered.rgb,rendered.bounds,sessionId,route);
   const current=tripState(session,id);
   if(current.trip.status!=='active'||keyFor(current.trip,current.next)!==key||entries.get(id)!==entry)return;
   entry.asset={key,session:sessionId,image,route,points,next_stop:{stop_id:next.stop_id,name:next.name},progress:{cursor:0,meters:0},seq:0};entry.error=null;
  }catch{entry.error='地图或步行路线暂时无法生成，请检查地图服务配置后重试。';entry.retryAt=store.clock()+15000;}
  finally{entry.pending=false;}
 }
 function manifest(session,id){
  const {trip,sample,next}=tripState(session,id),entry=entryFor(id),key=keyFor(trip,next);
  if(session.kind==='device')entry.lastSeen=store.clock();
  const base={protocol:1,trip_id:id,state_version:trip.version,poll_ms:2500,device_last_seen:entry.lastSeen?new Date(entry.lastSeen).toISOString():null,ack:entry.ack||null};
  if(trip.status!=='active'||!next){entry.asset=null;return {...base,status:trip.status==='active'?'finished':trip.status};}
  if(entry.asset?.key!==key){entry.asset=null;entry.ack=null;
   if(!fresh(trip,sample))return {...base,ack:null,status:'waiting_location'};
   if(!entry.pending&&(!entry.retryAt||store.clock()>=entry.retryAt)){entry.pending=true;entry.error=null;void prepare(session,id,entry,key,sample,next);}
   return {...base,ack:null,status:entry.error?'error':'preparing',message:entry.error||'正在生成下一站地图'};
  }
  const asset=entry.asset,usable=fresh(trip,sample);
  if(usable)advanceProgress(asset.progress,asset.points,sample,store.clock());
  const prefix=`/api/v1/trips/${id}/watch/assets/${asset.session}`;
  return {...base,status:'ready',session:asset.session,frame_id:1,route_revision:1,next_stop:asset.next_stop,image_url:prefix+'/map',route_url:prefix+'/route',
   position:{protocol:1,session:asset.session,frame_id:1,seq:++asset.seq,valid:Boolean(usable),lat:usable?sample.location[1]:0,lng:usable?sample.location[0]:0,accuracy:usable?sample.accuracy_m:0,age_ms:usable?Math.max(0,store.clock()-Date.parse(sample.captured_at)):0,route_revision:1,route_progress:asset.progress.cursor}};
 }
 function asset(session,id,wireSession,type){
  const {trip,next}=tripState(session,id),value=entries.get(id)?.asset;
  check(trip.status==='active'&&value?.key===keyFor(trip,next)&&value.session===wireSession,'WATCH_CHANGED','行程或下一站已更新，请重新同步。',409);
  return type==='map'?value.image:value.route;
 }
 function acknowledge(session,id,input){
  check(session.kind==='device','FORBIDDEN','由手表确认接收。',403);object(input,['session','frame_id','route_revision']);
  const entry=entries.get(id);asset(session,id,input.session,'route');check(input.frame_id===1&&input.route_revision===1,'INVALID_INPUT','确认编号无效。');
  entry.ack={session:input.session,frame_id:1,route_revision:1,at:new Date(store.clock()).toISOString(),meaning:'image_installed_route_accepted'};
  return {accepted:true};
 }
 return {manifest,asset,acknowledge,forget:id=>entries.delete(id)};
}
