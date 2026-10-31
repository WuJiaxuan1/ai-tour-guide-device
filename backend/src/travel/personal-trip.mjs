import {createHash} from 'node:crypto';
import {check,object,idempotency,TravelError} from './errors.mjs';
import {snapshot} from './planner.mjs';

// Only selections enter this boundary. Geometry, names and stop ordering come
// from the existing server road planner, never from a browser route snapshot.
export function createPersonalTripService({store,data,planRoads}) {
  const pending=new Map();
  return async function create(session,input,{signal}={}) {
    check(session.kind==='web','FORBIDDEN','请在网页选择行程。',403);
    object(input,['client_event_id','selection','stay_minutes']);
    idempotency(input.client_event_id);
    object(input.selection,['presetId','stopIds','entryId','exitId']);
    const selection=input.selection;
    if(selection.presetId) check(typeof selection.presetId==='string'&&Object.keys(selection).length===1,'INVALID_INPUT','预设路线不能混入自选参数。');
    else check(Array.isArray(selection.stopIds)&&selection.stopIds.length>0&&selection.stopIds.length<=100&&selection.stopIds.every(id=>typeof id==='string'&&id.length<100)&&typeof selection.entryId==='string'&&typeof selection.exitId==='string','INVALID_INPUT','请选择出入口和途经地点。');
    const minutes=input.stay_minutes||{};
    check(minutes&&typeof minutes==='object'&&!Array.isArray(minutes)&&Object.keys(minutes).length<=100&&Object.values(minutes).every(v=>Number.isInteger(v)&&v>=0&&v<=360),'INVALID_INPUT','停留时间应为0到360分钟。');
    const scope='owner:'+session.owner_id,digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const prior=store.db.prepare('SELECT digest,response FROM receipts WHERE scope=? AND request_id=?').get(scope,input.client_event_id);
    if(prior){
      check(prior.digest===digest,'IDEMPOTENCY_CONFLICT','同一请求标识不能用于不同操作。',409);
      const saved=JSON.parse(prior.response);check(!saved.deleted,'TRIP_DELETED','这次行程已删除，请新建行程。',410);
      return store.getTrip(session,saved.id);
    }
    const key=scope+':'+input.client_event_id;
    if(pending.has(key)){
      const old=pending.get(key);check(old.digest===digest,'IDEMPOTENCY_CONFLICT','同一请求标识不能用于不同操作。',409);return old.promise;
    }
    const noActive=()=>check(!store.db.prepare('SELECT body FROM trips WHERE owner_id=?').all(session.owner_id).some(row=>['active','paused'].includes(JSON.parse(row.body).status)),'ACTIVE_TRIP_EXISTS','请先结束当前游览，再开始新行程。',409);
    noActive();check(planRoads,'PLANNER_UNAVAILABLE','路线服务暂不可用。',503);
    const promise=(async()=>{
      let planned;
      try{planned=await planRoads(selection,{signal});}
      catch(e){if(e instanceof TravelError)throw e;throw new TravelError('ROAD_PLAN_FAILED',e.status&&e.status<500?e.message:'道路暂时无法查询，请稍后重试。',e.status||503);}
      signal?.throwIfAborted();
      check(planned?.navigationReady&&planned.coordinateSystem==='GCJ02'&&planned.stops?.length>=2&&planned.geometry?.coordinates?.length>=2,'NOT_NAVIGABLE','道路资料尚未齐备。',422);
      const ids=new Set(planned.stops.map(s=>s.placeId));
      check(Object.keys(minutes).every(id=>ids.has(id)),'INVALID_INPUT','停留设置包含路线以外的地点。');
      const gate=id=>data.gates.find(g=>g.placeId===id)?.id;
      const route=snapshot({...planned,entryGateId:gate(planned.stops[0].placeId),exitGateId:gate(planned.stops.at(-1).placeId),
        officialDurationMinutes:undefined,description:selection.presetId?'沿用官方预设顺序':'按所选地点的实际步行道路规划',
        stops:planned.stops.map(s=>({...s,stayMinutes:minutes[s.placeId]??s.stayMinutes??20}))});
      route.estimated_total_seconds=planned.walkingSeconds+route.stops.reduce((n,s)=>n+s.planned_stay_seconds,0);
      return store.createTrip(session,input,()=>{
        noActive();
        return {status:'planned',preferences:{selection},route,started_at:null,ended_at:null,paused_at:null,paused_ms:0,visits:[],interactions:[],notes:[],location:null,reminders:[],immersive_sessions:[],media:[]};
      });
    })();
    pending.set(key,{digest,promise});
    try{return await promise;}finally{pending.delete(key);}
  };
}
