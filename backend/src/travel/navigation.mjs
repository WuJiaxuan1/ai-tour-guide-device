import {check, object} from './errors.mjs';
import {TEMPLE_EXPERIENCE,immersiveQueryHint} from '../../../shared/immersive.mjs';
import {navigationReply} from './navigation-replies.mjs';
const radians = n => n * Math.PI / 180;
export function distance(a, b) {
  const dLat=radians(b[1]-a[1]),dLng=radians(b[0]-a[0]);
  return 6371000*2*Math.atan2(Math.sqrt(Math.sin(dLat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dLng/2)**2),Math.sqrt(Math.max(0,1-(Math.sin(dLat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(dLng/2)**2))));
}
function distanceToLine(point, geometry) {
  const line=geometry?.coordinates;if(!Array.isArray(line)||line.length<2)return null;
  const scaleX=111320*Math.cos(radians(point[1])),scaleY=111320;
  let best=Infinity;
  for(let i=1;i<line.length;i++){
    const a=[(line[i-1][0]-point[0])*scaleX,(line[i-1][1]-point[1])*scaleY],b=[(line[i][0]-point[0])*scaleX,(line[i][1]-point[1])*scaleY];
    const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,(-a[0]*dx-a[1]*dy)/(dx*dx+dy*dy||1)));
    best=Math.min(best,Math.hypot(a[0]+t*dx,a[1]+t*dy));
  }return best;
}
export function navigationContext(trip, sample, now=Date.now()) {
  const age=sample?now-Date.parse(sample.captured_at):Infinity;
  const freshness=trip.status!=='active'?trip.status:!sample?'unavailable':trip.location_required_after&&Date.parse(sample.received_at)<Date.parse(trip.location_required_after)?'awaiting_update':age>90000?'stale':sample.accuracy_m>60?'low_accuracy':'fresh';
  const next=trip.status==='completed'?null:trip.route.stops.find(s=>s.status==='pending')||null;
  const current=trip.status==='active'&&sample&&freshness==='fresh'&&sample.nearby_candidate?{...sample.nearby_candidate,basis:'proximity_candidate'}:{attraction_id:null,stop_id:null,basis:'unknown'};
  const address=trip.status==='active'&&freshness==='fresh'?(sample.address||{status:'unavailable'}):{status:freshness};
  const metrics={to_next_distance_m:null,to_next_walk_seconds:null,remaining_distance_m:null,remaining_walk_seconds:null,remaining_stay_seconds:null,remaining_total_seconds:null,estimated_finish_at:null,method:'unavailable',computed_at:null};
  const estimate=sample?.estimate;
  if(trip.status==='active'&&next&&freshness==='fresh'&&estimate?.stop_id===next.stop_id&&now-Date.parse(estimate.computed_at)<=90000){
    metrics.to_next_distance_m=estimate.distance_m;metrics.to_next_walk_seconds=estimate.walk_seconds;metrics.computed_at=estimate.computed_at;metrics.method='amap_walking';
    const remaining=trip.route.stops.slice(trip.route.stops.indexOf(next));
    const legs=remaining.slice(1).map((s,i)=>trip.route.legs.find(l=>l.fromStopId===remaining[i].stop_id&&l.toStopId===s.stop_id));
    // Skipping a stop creates a gap for which a fixed leg sum is not valid. Do not invent an ETA.
    if(remaining.every(s=>s.status==='pending')&&legs.every(l=>l&&Number.isFinite(l.walkingSeconds)&&l.walkingSeconds>=0)&&remaining.every(s=>Number.isFinite(s.planned_stay_seconds)&&s.planned_stay_seconds>=0)){
      if(legs.every(l=>Number.isFinite(l.distanceMeters)&&l.distanceMeters>=0))metrics.remaining_distance_m=estimate.distance_m+legs.reduce((n,l)=>n+l.distanceMeters,0);
      metrics.remaining_walk_seconds=estimate.walk_seconds+legs.reduce((n,l)=>n+l.walkingSeconds,0);
      metrics.remaining_stay_seconds=remaining.reduce((n,s)=>n+s.planned_stay_seconds,0);
      metrics.remaining_total_seconds=metrics.remaining_walk_seconds+metrics.remaining_stay_seconds;
      metrics.estimated_finish_at=new Date(now+metrics.remaining_total_seconds*1000).toISOString();
    }
  }
  const result={schema_version:'1.0',trip_id:trip.id,state_version:trip.version,status:trip.status,route:{route_id:trip.route.route_id,revision:trip.route.revision,exit_id:trip.route.exit_id},location:sample?{coordinate_system:'GCJ02',longitude:sample.location[0],latitude:sample.location[1],accuracy_m:sample.accuracy_m,captured_at:sample.captured_at,received_at:sample.received_at,freshness,address}:{freshness,address},current_place:current,next_stop:next,estimate:metrics,reminders:(trip.reminders||[]).filter(r=>r.status==='pending'&&r.experience_id===TEMPLE_EXPERIENCE.id),off_route:{status:trip.status==='active'&&freshness==='fresh'&&Number.isFinite(sample.route_distance_m)?(sample.route_distance_m>Math.max(70,sample.accuracy_m*2)?(sample.off_route_count>=3&&Date.parse(sample.captured_at)-sample.off_route_since>=20000?'suspected':'checking'):'not_detected'):'unknown',distance_m:trip.status==='active'&&freshness==='fresh'?sample.route_distance_m:null},progress:{confirmed_stop_count:trip.visits.length,skipped_stop_count:trip.route.stops.filter(s=>s.status==='skipped').length,pending_stop_count:trip.route.stops.filter(s=>s.status==='pending').length,total_stop_count:trip.route.stops.length},server_time:new Date(now).toISOString()};
  result.immersive_hint=immersiveQueryHint(trip,result);
  result.guidance=Object.fromEntries(['status','next_stop','next_leg','remaining','finish_time','off_route','location','progress'].map(intent=>[intent,navigationReply(result,intent)+(result.immersive_hint&&['location','next_stop','next_leg'].includes(intent)?' '+result.immersive_hint:'')]));
  return result;
}
export function createNavigationService({store,convertLocation,walkingLeg,reverseGeocode,onProximity=()=>{}}) {
  const context=(session,id)=>navigationContext(store.getTrip(session,id),store.location(session,id),store.clock());
  async function update(session,id,input) {
    object(input,['client_seq','captured_at','coordinate_system','location','accuracy_m']);
    check(session.kind==='web','FORBIDDEN','位置须由已绑定的网页会话提供。',403);
    const trip=store.getTrip(session,id);check(trip.status==='active','INVALID_STATE','只有游览中才更新位置。',409);
    check(Number.isSafeInteger(input.client_seq)&&input.client_seq>=0,'INVALID_INPUT','定位序号无效。');
    check(input.coordinate_system==='WGS84','INVALID_INPUT','请上传原始 WGS84 坐标。');
    check(Array.isArray(input.location)&&input.location.length===2&&input.location.every(Number.isFinite)&&Math.abs(input.location[0])<=180&&Math.abs(input.location[1])<=90,'INVALID_INPUT','坐标格式不正确。');
    check(Number.isFinite(input.accuracy_m)&&input.accuracy_m>0&&input.accuracy_m<=10000,'INVALID_INPUT','定位精度无效。');
    const time=Date.parse(input.captured_at);check(Number.isFinite(time)&&store.clock()-time<=120000&&time-store.clock()<=30000,'STALE_LOCATION','定位时间无效或过期。');
    check(convertLocation,'LOCATION_UNAVAILABLE','坐标转换服务未配置。',503);
    const last=store.location(session,id);
    check(!last||input.client_seq>last.client_seq,'STALE_LOCATION','此定位已处理或过期。',409);
    const location=await convertLocation(input.location);
    check(Array.isArray(location)&&location.length===2&&location.every(Number.isFinite),'LOCATION_UNAVAILABLE','坐标转换失败。',502);
    const sample={client_seq:input.client_seq,source_session_id:session.id,raw_location:input.location,location,coordinate_system:'GCJ02',accuracy_m:input.accuracy_m,captured_at:new Date(time).toISOString(),received_at:new Date(store.clock()).toISOString(),estimate:null,nearby_candidate:null,off_route_count:0,route_distance_m:distanceToLine(location,trip.route.geometry)};
    const next=trip.route.stops.find(s=>s.status==='pending');
    const resolveAddress=async()=>{
      sample.address={status:'unavailable'};
      if(!reverseGeocode||input.accuracy_m>60||store.clock()-time>90000)return;
      const previous=last?.address;
      // Reuse only this trip's lookup, near its original coordinate, for at most one minute.
      const ttl=previous?.status==='resolved'?60000:15000;
      if(previous?.query_location&&store.clock()-Date.parse(previous.queried_at)<ttl&&distance(location,previous.query_location)<=20){sample.address=previous;return;}
      sample.address={status:'unavailable',queried_at:new Date(store.clock()).toISOString(),query_location:location};
      try {const result=await reverseGeocode(location);if(result?.formatted_address)sample.address={...sample.address,...result,status:'resolved'};}catch{/* Address failure must not discard a usable GPS fix. */}
    };
    const addressTask=resolveAddress();
    if(input.accuracy_m<=60&&store.clock()-time<=90000){
      const nearest=trip.route.stops.filter(s=>s.location).map(s=>({stop:s,distance:distance(location,s.location)})).sort((a,b)=>a.distance-b.distance||(a.stop.stop_id===next?.stop_id?-1:b.stop.stop_id===next?.stop_id?1:0))[0];
      const near=nearest&&nearest.distance<=45?nearest.stop:null;
      const consecutive=last&&last.nearby_stop_id===near?.stop_id&&time>=Date.parse(last.captured_at)&&time-Date.parse(last.captured_at)<=30000&&(!trip.location_required_after||Date.parse(last.received_at)>=Date.parse(trip.location_required_after));
      sample.nearby_stop_id=near?.stop_id||null;
      sample.nearby_since=sample.nearby_stop_id?(consecutive?last.nearby_since:time):null;
      if(near&&sample.nearby_since!==null&&time-sample.nearby_since>=10000)sample.nearby_candidate={stop_id:near.stop_id,attraction_id:near.attraction_id,name:near.name};
      if(sample.route_distance_m!==null&&sample.route_distance_m>Math.max(70,input.accuracy_m*2)){
        const continued=last?.off_route_count>0&&Number.isFinite(last.off_route_since)&&time-Date.parse(last.captured_at)>=5000&&time-Date.parse(last.captured_at)<=30000&&(!trip.location_required_after||Date.parse(last.received_at)>=Date.parse(trip.location_required_after));
        sample.off_route_count=continued?last.off_route_count+1:1;sample.off_route_since=continued?last.off_route_since:time;
      }
      if(walkingLeg&&next?.location){
        try {const leg=await walkingLeg(location,next.location);if(leg&&Number.isFinite(leg.distance_m)&&leg.distance_m>=0&&Number.isFinite(leg.walk_seconds)&&leg.walk_seconds>=0)sample.estimate={...leg,stop_id:next.stop_id,computed_at:new Date(store.clock()).toISOString()};}catch{/* Map failure leaves ETA unknown; position can still update. */}
      }
    }
    await addressTask;
    const current=store.getTrip(session,id);
    check(current.status==='active','INVALID_STATE','旅行已暂停或结束。',409);
    // Compare server lifecycle markers, not a phone timestamp against the server clock.
    check(current.location_required_after===trip.location_required_after,'STALE_LOCATION','请等待恢复游览后的新定位。',409);
    if(current.route.stops.find(s=>s.status==='pending')?.stop_id!==next?.stop_id)sample.estimate=null;
    store.saveLocation(session,id,sample);
    if(sample.nearby_candidate)onProximity(session,id,sample.nearby_candidate);
    return context(session,id);
  }
  return {context,update};
}
