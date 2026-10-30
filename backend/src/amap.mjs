export class ServiceError extends Error{constructor(message,status=502){super(message);this.status=status;}}
export async function amapRequest(path,params,key,{signal,fetcher=fetch}={}){
  if(!key)throw new ServiceError('地图服务尚未配置，请稍后再试。',503);
  const url=new URL(path,'https://restapi.amap.com');for(const [k,v]of Object.entries(params))url.searchParams.set(k,String(v));url.searchParams.set('key',key);
  let response;try{response=await fetcher(url,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}catch{throw new ServiceError('地图服务连接超时，请稍后再试。',504);}
  if(!response.ok)throw new ServiceError('地图服务暂不可用。');
  const data=await response.json();if(data.status!=='1')throw new ServiceError('高德调用未通过，请检查服务权限和本地配置。',502);
  return data;
}
export function decodePolyline(value){
  if(typeof value!=='string')throw new ServiceError('路线几何信息缺失。');
  const points=value.split(';').filter(Boolean).map(part=>part.split(',').map(Number));
  if(!points.length||points.some(p=>p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>85))throw new ServiceError('路线坐标格式不正确。');
  return points;
}
export function mergeLegs(paths,stops,routeId){
  let distanceMeters=0,walkingSeconds=0;const coordinates=[],steps=[],legs=[];
  for(const [legIndex,path] of paths.entries()){
    const d=Number(path.distance),t=Number(path.duration);
    if(!Number.isFinite(d)||d<0||!Number.isFinite(t)||t<0||!Array.isArray(path.steps)||(!path.steps.length&&d!==0))throw new ServiceError('步行路线信息不完整。');
    distanceMeters+=d;walkingSeconds+=t;
    legs.push({fromId:stops[legIndex % stops.length].id,toId:stops[(legIndex+1)%stops.length].id,distanceMeters:d,walkingSeconds:t,hasStairs:path.steps.some(v=>String(v.walk_type)==='20'),hasSlope:path.steps.some(v=>String(v.walk_type)==='21')});
    for(const step of path.steps){
      const points=decodePolyline(step.polyline);
      for(const p of points){const last=coordinates.at(-1);if(!last||last[0]!==p[0]||last[1]!==p[1])coordinates.push(p);}
      const sd=Number(step.distance),st=Number(step.duration);
      if(!Number.isFinite(sd)||sd<0||!Number.isFinite(st)||st<0)throw new ServiceError('步行指引信息不完整。');
      steps.push({instruction:String(step.instruction||'沿当前步行道路前行'),location:points[0],distanceMeters:sd,walkingSeconds:st});
    }
  }
  if(coordinates.length<2||coordinates.length>20000)throw new ServiceError('这条路线超出当前可显示范围。');
  return {schemaVersion:'1.0',routeId,revision:1,travelMode:'walking',coordinateSystem:'GCJ02',coordinateOrder:'lng,lat',source:{provider:'amap',generatedAt:new Date().toISOString()},stops,geometry:{type:'LineString',coordinates},distanceMeters,walkingSeconds,steps,legs};
}
