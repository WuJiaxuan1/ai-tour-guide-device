import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788';
const request=async(path,{method='GET',body,token}={})=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return{status:r.status,data:await r.json()};};
const session=(await request('/sessions',{method:'POST'})).data,token=session.token,foreign=(await request('/sessions',{method:'POST'})).data.token,preferences={entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false};
const create=()=>request('/trips',{method:'POST',token,body:{client_event_id:crypto.randomUUID(),preferences,route_id:'R02',revision:1}});
let a=(await create()).data,b=(await create()).data;
try{
 assert.equal((await request('/trips',{token})).data.trips.length,2);
 await request(`/trips/${a.id}/notes`,{method:'POST',token,body:{client_event_id:'note',text:'历史管理验收：一段测试感受'}});
 await request('/chat',{method:'POST',token,body:{client_event_id:'chat',conversation_id:'history-test',trip_id:a.id,question:'下一站去哪'}});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');const upload=await fetch(base+`/api/v1/trips/${a.id}/media`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'image/png'},body:png});assert.equal(upload.status,201);
 const memory=(await request(`/trips/${a.id}/memory`,{token})).data;assert.equal(memory.notes.length,1);assert.equal(memory.interactions.length,1);
 a=(await request(`/trips/${a.id}`,{token})).data;
 assert.equal((await request(`/trips/${a.id}`,{method:'DELETE',token:foreign,body:{expected_version:a.version}})).status,404);
 const deleted=await request(`/trips/${a.id}`,{method:'DELETE',token,body:{expected_version:a.version}});assert.equal(deleted.data.deleted,true);assert.equal(deleted.data.media_cleanup_pending,false);
 assert.equal((await request(`/trips/${a.id}`,{token})).status,404);const list=(await request('/trips',{token})).data.trips;assert.equal(list.length,1);assert.equal(list[0].id,b.id);
 const result={at:new Date().toISOString(),base,checks:['history_owner_scope','saved_notes','saved_interactions','synthetic_photo_upload','foreign_delete_denied','online_trip_and_photo_deletion','deleted_trip_404','other_trip_preserved'],user_device_binding_untouched:true};writeFileSync('.local-work/history-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{for(const trip of [a,b]){const current=await request(`/trips/${trip.id}`,{token});if(current.status===200)await request(`/trips/${trip.id}`,{method:'DELETE',token,body:{expected_version:current.data.version}});}}
