import {ServiceError,mergeLegs} from './amap.mjs';
import {randomUUID} from 'node:crypto';

// Fixed endpoints. Exact directed distance optimization for up to eight intermediate stops.
export function fixedEndpointOrder(matrix){
 const n=matrix.length-2;if(n<0||n>8)throw new ServiceError('精确排序范围不正确。',400);
 if(!n)return [0,1];
 const size=1<<n,dp=Array.from({length:size},()=>Array(n).fill(Infinity)),prev=Array.from({length:size},()=>Array(n).fill(-1));
 for(let i=0;i<n;i++)dp[1<<i][i]=matrix[0][i+1];
 for(let mask=1;mask<size;mask++)for(let i=0;i<n;i++)if(Number.isFinite(dp[mask][i]))for(let j=0;j<n;j++)if(!(mask&(1<<j))){const next=mask|(1<<j),cost=dp[mask][i]+matrix[i+1][j+1];if(cost<dp[next][j]){dp[next][j]=cost;prev[next][j]=i;}}
 let end=-1,best=Infinity;for(let i=0;i<n;i++){const cost=dp[size-1][i]+matrix[i+1][n+1];if(cost<best){best=cost;end=i;}}
 if(end<0)throw new ServiceError('所选地点之间没有完整的步行连接，请调整地点。',422);
 const out=[];let mask=size-1;while(end>=0){out.push(end+1);const p=prev[mask][end];mask^=1<<end;end=p;}return [0,...out.reverse(),n+1];
}
export function createRoadPlanner({catalog,data,walkingLeg}){
 const known=new Map([...data.nodes,...catalog].map(p=>[p.id,p]));
 const point=id=>{const p=known.get(id);if(!p)throw new ServiceError('有地点无法识别，请重新选择。',400);if(!Array.isArray(p.location))throw new ServiceError(`${p.name}的准确位置仍待确认，请移除此点后重新规划，或选择其他路线。`,422);return {...p,id,placeId:id};};
 return async function plan(input,{key,signal}={}){
  let stops,preset;
  if(input.presetId){
   preset=data.routes.find(r=>r.routeId===input.presetId);if(!preset)throw new ServiceError('没有找到这条官方路线。',400);
   if(preset.completeness==='missing_exit')throw new ServiceError('这条官方路线尚未注明出口，请先在专属路线中选择出口后规划。',422);
   if(preset.roadPlan)return preset.roadPlan;
   stops=preset.stops.map(s=>({...point(s.placeId),...s,id:s.placeId}));
  }else{
   const {stopIds,entryId,exitId}=input;
   if(!Array.isArray(stopIds)||!stopIds.length||stopIds.length>known.size||stopIds.some(id=>typeof id!=='string')||!data.gateIds.includes(entryId)||!data.gateIds.includes(exitId))throw new ServiceError('请选择有效的出入口和途经地点。',400);
   stops=[entryId,...[...new Set(stopIds)].filter(id=>id!==entryId&&id!==exitId).sort(),exitId].map(point);
   if(stops.length<3)throw new ServiceError('请至少选择一个途经地点。',400);
  }
  const paths=new Map();
  const get=async(i,j)=>{signal?.throwIfAborted();const k=i+'>'+j;if(!paths.has(k))paths.set(k,await walkingLeg(stops[i],stops[j],key,signal));return paths.get(k);};
  const cost=async(i,j)=>{const p=await get(i,j);return p&&Number.isFinite(Number(p.distance))?Number(p.distance):Infinity;};
  let order=stops.map((_,i)=>i),mode='preset';
  if(!preset&&stops.length<=10){
   const n=stops.length,m=Array.from({length:n},()=>Array(n).fill(Infinity));
   for(let i=0;i<n-1;i++)for(let j=1;j<n;j++)if(i!==j)m[i][j]=await cost(i,j);
   order=fixedEndpointOrder(m);mode='exact';
  }else if(!preset){
   // Larger selections: bounded road-based search, never claim a global shortest proof.
   const pending=order.slice(1,-1);order=[0];
   while(pending.length){const from=order.at(-1),a=stops[from].location;const shortlist=[...pending].sort((i,j)=>Math.hypot(stops[i].location[0]-a[0],stops[i].location[1]-a[1])-Math.hypot(stops[j].location[0]-a[0],stops[j].location[1]-a[1])).slice(0,3);let best=-1,min=Infinity;for(const j of shortlist){const d=await cost(from,j);if(d<min){best=j;min=d;}}if(best<0){for(const j of pending){const d=await cost(from,j);if(d<min){best=j;min=d;}}}if(best<0)throw new ServiceError('部分地点暂未找到步行道路，请调整地点。',422);order.push(best);pending.splice(pending.indexOf(best),1);}order.push(stops.length-1);mode='road-heuristic';
  }
  const selectedPaths=[];for(let i=1;i<order.length;i++){const p=await get(order[i-1],order[i]);if(!p)throw new ServiceError('部分地点暂未找到步行道路，请调整地点。',422);selectedPaths.push(p);}
  const routeId=preset?.routeId||'personal-'+randomUUID();
  const ordered=order.map((index,i)=>({...stops[index],stopId:preset?stops[index].stopId:`${routeId}-${i}`,stayMinutes:stops[index].stayMinutes??20}));
  const result=mergeLegs(selectedPaths,ordered,routeId);
  return {...result,name:preset?.name||'我的专属路线',navigationReady:true,optimization:{mode},legs:result.legs.map((l,i)=>({...l,fromStopId:ordered[i].stopId,toStopId:ordered[i+1].stopId}))};
 };
}
