const key='qixia.server-session.v1',tripKey='qixia.server-trip.v1';
let pendingSession;
export const requestId=()=>crypto.randomUUID();
export function activeTripId(){try{return localStorage.getItem(tripKey)||null;}catch{return null;}}
export function setActiveTripId(id){try{id?localStorage.setItem(tripKey,id):localStorage.removeItem(tripKey);}catch{}}
async function session(){
 try{const stored=JSON.parse(localStorage.getItem(key)||'null');if(stored&&Date.parse(stored.expires_at)>Date.now())return stored;}catch{}
 if(!pendingSession)pendingSession=fetch('/api/v1/sessions',{method:'POST',credentials:'omit'}).then(async r=>{if(!r.ok)throw Error('暂时无法建立旅行会话。');const value=await r.json();if(typeof value.token!=='string')throw Error('会话响应无效。');localStorage.setItem(key,JSON.stringify(value));return value;}).finally(()=>{pendingSession=null;});
 return pendingSession;
}
export async function travelRequest(path,{method='GET',body,signal}={}){
 const auth=await session();
 const response=await fetch('/api/v1'+path,{method,credentials:'omit',headers:{Authorization:'Bearer '+auth.token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal});
 let value;try{value=await response.json();}catch{throw Error('旅行服务响应无效。');}
 if(!response.ok){const error=Error(value.error?.message||'旅行服务暂不可用。');error.code=value.error?.code;if(response.status===401){localStorage.removeItem(key);setActiveTripId(null);}throw error;}
 return value;
}
export async function subscribeTrip(id,after,onEvent,signal,onOpen=()=>{}){
 const auth=await session();
 const r=await fetch(`/api/v1/trips/${id}/events/stream?after=${after}`,{headers:{Authorization:'Bearer '+auth.token},credentials:'omit',signal});
 if(!r.ok||!r.body)throw Error('旅行同步暂时断开。');
 onOpen();
 const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='';
 try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let index;while((index=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,index);buffer=buffer.slice(index+2);const data=frame.split('\n').find(l=>l.startsWith('data: '));if(data)onEvent(JSON.parse(data.slice(6)));}}}finally{reader.releaseLock();}
}
export async function uploadTravelPhoto(tripId,file){
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024)throw Error('请选择不超过 8 MB 的 PNG 或 JPEG。');
 const auth=await session(),r=await fetch(`/api/v1/trips/${tripId}/media`,{method:'POST',credentials:'omit',headers:{Authorization:'Bearer '+auth.token,'Content-Type':file.type},body:file});
 const data=await r.json();if(!r.ok)throw Error(data.error?.message||'照片上传失败。');return data;
}
export async function fetchTravelAsset(tripId,asset){
 const auth=await session(),r=await fetch(`/api/v1/trips/${tripId}/assets/${asset.asset_id}`,{credentials:'omit',headers:{Authorization:'Bearer '+auth.token}});
 if(!r.ok)throw Error('图片读取失败，请稍后重试。');return r.blob();
}
export async function downloadTravelAsset(tripId,asset){saveDownload(await fetchTravelAsset(tripId,asset),asset.kind+'.png');}
export async function uploadPhoto(file,eventId){
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>8*1024*1024)throw Error('请选择不超过8 MB的PNG或JPEG。');
 const auth=await session(),r=await fetch('/api/v1/photos',{method:'POST',credentials:'omit',headers:{Authorization:'Bearer '+auth.token,'Content-Type':file.type,'X-Client-Event-Id':eventId},body:file});
 const data=await r.json();if(!r.ok)throw Error(data.error?.message||'照片上传失败。');return data;
}
export async function fetchPhotoAsset(id,kind,signal){
 const auth=await session(),r=await fetch(`/api/v1/photos/${id}/assets/${kind}`,{credentials:'omit',headers:{Authorization:'Bearer '+auth.token},signal});
 if(!r.ok)throw Error('图片读取失败，请刷新重试。');return r.blob();
}
export function saveDownload(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function askTravel({question,conversationId,placeId,signal}){
 return travelRequest('/chat',{method:'POST',signal,body:{client_event_id:requestId(),conversation_id:conversationId,question,...(activeTripId()?{trip_id:activeTripId()}:{}),...(placeId?{place_id:placeId}:{})}});
}
