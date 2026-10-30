// Optional team service adapters. They are inactive until a real endpoint is configured.
// Endpoint credentials belong to the same-origin backend session, never the browser bundle.
const safeEndpoint=value=>{if(typeof value!=='string'||!value.startsWith('/api/')||value.includes('..'))throw Error('请使用同源团队接口地址。');return value;};
export async function syncRoute({endpoint,deviceId,route,signal,fetcher=fetch}){
 if(!deviceId||!route?.routeId||!route.geometry)throw Error('设备或路线信息不完整。');
 const r=await fetcher(safeEndpoint(endpoint),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({deviceId,route})});
 if(!r.ok)throw Error('路线发送失败，请重试。');const d=await r.json();
 if(d.routeId!==route.routeId||d.revision!==route.revision||!['queued','received'].includes(d.status))throw Error('设备回执与本次路线不一致。');
 // queued is never presented as received; the team must provide an acknowledgement/status stream.
 return d;
}
export async function uploadJournalPhoto({endpoint,tripId,placeId,blob,signal,fetcher=fetch}){
 const body=new FormData();body.set('tripId',tripId);body.set('placeId',placeId);body.set('image',blob,'photo.jpg');
 const r=await fetcher(safeEndpoint(endpoint),{method:'POST',credentials:'same-origin',body,signal});if(!r.ok)throw Error('照片上传失败，请重试。');const d=await r.json();if(typeof d.photoId!=='string')throw Error('照片服务返回格式不完整。');return d;
}
