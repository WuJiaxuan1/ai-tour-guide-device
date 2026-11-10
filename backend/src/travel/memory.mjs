import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {check,object} from './errors.mjs';
import {inspectTransparentPNG} from './png.mjs';

// Only affirmative first-person statements count as explicit interests; questions and negations do not.
export function explicitInterest(value){
 const text=String(value||'').trim().replace(/^请(?:帮我)?(?:记住|记录)(?:这条旅行感受|这段感受)?[：:，,\s]*/, '');
 return /^(?:(?:今天|这次(?:旅行)?)[，,\s]*)?(?:我|我们|本人)(?:这次|今天|真的|确实|还是|个人|觉得|感觉|也|很|非常|特别|最|比较|更|都|很是|尤其|仍然|现在|一直|\s)*?(?:最喜欢|特别喜欢|最感兴趣|喜欢)/.test(text)
  && !/[?？]|吗|么|是否|哪|什么|不|没|并非|以前|曾经|过去|以前|如果|假如/.test(text);
}
export function memoryFacts(trip,chats,scenicIds,now=Date.now()){
  const confirmed=[...new Set(trip.visits.map(v=>v.attraction_id).filter(id=>scenicIds.has(id)))];
  const end=trip.ended_at?Date.parse(trip.ended_at):now,start=Date.parse(trip.started_at);
  const elapsed=Number.isFinite(start)?Math.max(0,Math.floor((end-start)/1000)):0;
  const paused=Math.min(elapsed,Math.max(0,Math.floor(((trip.paused_ms||0)+(trip.paused_at?Math.max(0,end-Date.parse(trip.paused_at)):0))/1000)));
  const statements=[...chats.filter(c=>c.status==='completed').map(c=>({text:c.question,attraction_id:c.place_id||null,record_id:c.message_id,source:c.channel})),...(trip.notes||[]).map(n=>({text:n.text,attraction_id:n.attraction_id||null,record_id:n.id,source:n.source}))];
  const interests=statements.filter(c=>explicitInterest(c.text)).map(c=>({...c,basis:'explicit_statement'}));
  return {confirmed_attraction_count:confirmed.length,confirmed_attraction_ids:confirmed,confirmed_attraction_names:confirmed.map(id=>trip.route.stops.find(s=>s.attraction_id===id)?.name||id),confirmed_stop_count:trip.visits.length,
    elapsed_seconds:elapsed,paused_seconds:paused,active_seconds:elapsed-paused,started_at:trip.started_at||null,ended_at:trip.ended_at||null,
    immersive_experiences:(trip.immersive_sessions||[]).map(s=>({experience_id:s.experience_id,title:s.title,started_at:s.started_at||null,completed_at:s.completed_at||null,completed:Boolean(s.completed_at),choices:(s.choices||[]).map(c=>c.label||c.choice_id),note:'网页中的艺术演绎体验，不等于实地到访。'})),
    planned_route_name:trip.route.name,unconfirmed_stops:trip.route.stops.filter(s=>s.status==='pending').map(s=>s.name),skipped_stops:trip.route.stops.filter(s=>s.status==='skipped').map(s=>s.name),
    repeated_stop_note:'同一景点可能经过多次；某次停靠未确认，不等于从未到访此景点。',interests,
    voice_capture_scope:'only_business_tool_calls',interaction_count:chats.length,note_count:(trip.notes||[]).length,
    interaction_channels:{web:chats.filter(c=>c.channel==='web').length,device:chats.filter(c=>c.channel==='device').length},
    note_channels:{web:(trip.notes||[]).filter(n=>n.source==='web').length,device:(trip.notes||[]).filter(n=>n.source==='device').length}};
}
export function createMemoryService({store,root,model,scenicIds,config,fetcher=fetch}){
 const mediaDir=resolve(root,'.local-work/travel-media');mkdirSync(mediaDir,{recursive:true,mode:0o700});
 let running=false,closed=false,activeDrain=null;
 const readJob=(session,tripId,id)=>{store.getTrip(session,tripId);const row=store.db.prepare('SELECT body,status FROM jobs WHERE id=? AND trip_id=?').get(id,tripId);check(row,'NOT_FOUND','生成任务不存在。',404);return {...JSON.parse(row.body),status:row.status};};
 const publicJob=j=>{const {input,owner_id,...safe}=j;return safe;};
 const saveJob=(job,status)=>store.db.prepare('UPDATE jobs SET status=?,body=? WHERE id=?').run(status,JSON.stringify({...job,status,updated_at:new Date(store.clock()).toISOString()}),job.id);
 const list=(session,id)=>{store.getTrip(session,id);const fingerprint=snapshot(session,id).source_fingerprint;return store.db.prepare('SELECT body,status FROM jobs WHERE trip_id=? ORDER BY rowid DESC LIMIT 30').all(id).map(r=>publicJob({...JSON.parse(r.body),status:r.status,summary_stale:r.status==='succeeded'&&JSON.parse(r.body).kind==='memory_summary'?(JSON.parse(r.body).result?.source_fingerprint?JSON.parse(r.body).result.source_fingerprint!==fingerprint:null):false}));};
 const facts=(session,id)=>{const trip=store.getTrip(session,id),chats=store.chatHistory(session,{tripId:id});const counts=store.db.prepare("SELECT json_extract(body, '$.channel') AS channel, COUNT(*) AS n FROM chats WHERE owner_id=? AND trip_id=? GROUP BY channel").all(session.owner_id,id);const channels={web:0,device:0};for(const row of counts)if(row.channel in channels)channels[row.channel]=row.n;return {...memoryFacts(trip,chats,scenicIds,store.clock()),interaction_count:counts.reduce((n,r)=>n+r.n,0),interaction_channels:channels,summary_context_count:chats.length,summary_note_count:Math.min(100,(trip.notes||[]).length)};};
 const snapshot=(session,id)=>{
  const trip=store.getTrip(session,id),chats=store.chatHistory(session,{tripId:id});
  const data={facts:facts(session,id),notes:(trip.notes||[]).slice(-100),chats:chats.map(c=>({message_id:c.message_id,question:c.question.slice(0,500),answer:c.status==='completed'?c.answer?.reply?.slice(0,500)||null:null,status:c.status,channel:c.channel})),source_record_ids:[...trip.visits.map(v=>v.stop_id),...(trip.notes||[]).slice(-100).map(n=>n.id),...chats.map(c=>c.message_id)],immersive_records:trip.immersive_sessions||[]};
  return {...data,source_fingerprint:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
 };
 async function processQueue(){
  if(running||closed)return;running=true;
  try{while(!closed){
   const row=store.db.prepare("SELECT body FROM jobs WHERE status='queued' ORDER BY rowid LIMIT 1").get();if(!row)break;
   let job=JSON.parse(row.body);saveJob(job,'running');
   try{
    if(job.kind==='memory_summary'){
      const response=await model.generate({purpose:'summary',question:'请用简洁中文为这次旅行写一份有依据的回忆摘要。',context:job.input});
      job.result={facts:job.input.facts,summary:response.text,model:response.model,source_record_ids:job.input.source_record_ids,source_fingerprint:job.input.source_fingerprint,notes:job.input.notes,generated_at:new Date(store.clock()).toISOString()};
    }else{
      const c=config();check(c.imageEndpoint,'IMAGE_UNCONFIGURED','图像生成服务尚未配置。',503);
      const endpoint=new URL(c.imageEndpoint);check(endpoint.protocol==='https:'&&!endpoint.username&&!endpoint.password,'IMAGE_UNCONFIGURED','图像服务须使用 HTTPS。',503);
      const original=readFileSync(resolve(mediaDir,job.input.media_id));
      const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(c.imageKey?{Authorization:'Bearer '+c.imageKey}:{})},body:JSON.stringify({task:'travel_memory_duo',source:{image_base64:original.toString('base64'),mime_type:job.input.mime_type},outputs:['memory_card','transparent_stickers'],requirements:{preserve_source_identity:true,stickers_must_match_card:true,transparent_png:true}}),signal:AbortSignal.timeout(120000)});
      check(response.ok,'IMAGE_UNAVAILABLE','图片生成服务暂不可用。',503);
      let length=0;const chunks=[];for await(const chunk of response.body){length+=chunk.length;check(length<=24000000,'IMAGE_INVALID','图片响应过大。',502);chunks.push(Buffer.from(chunk));}const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const assets=[];
      for(const kind of ['memory_card','transparent_stickers']){
        const item=result[kind];check(item&&item.mime_type==='image/png'&&typeof item.image_base64==='string'&&item.image_base64.length<=12000000&&/^[A-Za-z0-9+/]+={0,2}$/.test(item.image_base64),'IMAGE_INVALID','图像服务必须分别返回两张 PNG。',502);
        const bytes=Buffer.from(item.image_base64,'base64');check(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'IMAGE_INVALID','图像内容不是 PNG。',502);
        const validation=kind==='transparent_stickers'?inspectTransparentPNG(bytes):null;
        const id=randomUUID();writeFileSync(resolve(mediaDir,id),bytes,{mode:0o600});assets.push({asset_id:id,kind,mime_type:'image/png',validation});
      }
      job.result={assets};
    }
    saveJob(job,'succeeded');store.appendEvent(job.trip_id,job.kind==='memory_summary'?'memory_ready':'sticker_ready',{job_id:job.id});
   }catch(e){job.error={code:e.code||'GENERATION_FAILED',message:e.code?e.message:'生成失败，请稍后重试。'};saveJob(job,'failed');store.appendEvent(job.trip_id,'generation_failed',{job_id:job.id,code:job.error.code});}
  }}finally{running=false;}
 }
 function drain(){if(activeDrain)return activeDrain;activeDrain=processQueue().finally(()=>{activeDrain=null;});return activeDrain;}
 function generate(session,id,input){
  object(input,['client_event_id','kind','media_id']);const trip=store.getTrip(session,id);
  check(['memory_summary','sticker'].includes(input.kind),'INVALID_INPUT','生成类型无效。');
  if(input.kind==='memory_summary'){check(trip.status==='completed','INVALID_STATE','请先结束旅行再生成回忆。',409);check(model.configured(),'MODEL_UNCONFIGURED','文本模型尚未配置。',503);}
  else {check(session.kind==='web','FORBIDDEN','请从网页选择照片。',403);check(config().imageEndpoint,'IMAGE_UNCONFIGURED','真实图像生成服务尚未配置；当前不会返回固定图冒充结果。',503);}
  const result=store.transaction(()=>store.receipt('jobs:'+id,input.client_event_id,input,()=>{
    let data;
    if(input.kind==='memory_summary'){
      const pending=store.db.prepare("SELECT body,status FROM jobs WHERE trip_id=? AND status IN ('queued','running') AND json_extract(body, '$.kind')='memory_summary' ORDER BY rowid DESC LIMIT 1").get(id);
      if(pending)return publicJob({...JSON.parse(pending.body),status:pending.status});
      data=snapshot(session,id);
    }
    else {const media=trip.media.find(m=>m.media_id===input.media_id);check(media,'NOT_FOUND','照片不存在。',404);data=media;}
    const job={id:randomUUID(),trip_id:id,kind:input.kind,status:'queued',input:data,created_at:new Date(store.clock()).toISOString()};
    store.db.prepare('INSERT INTO jobs VALUES (?,?,?,?)').run(job.id,id,'queued',JSON.stringify(job));return publicJob(job);
  }));
  queueMicrotask(()=>drain());return result;
 }
 function upload(session,id,bytes,mimeType,attractionId){
  check(session.kind==='web','FORBIDDEN','照片请从网页上传。',403);const trip=store.getTrip(session,id);
  check(bytes.length>0&&bytes.length<=8*1024*1024,'INVALID_IMAGE','请选择不超过 8 MB 的 PNG 或 JPEG。',413);
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
  check((mimeType==='image/png'&&png)||(mimeType==='image/jpeg'&&jpeg),'INVALID_IMAGE','照片格式无效。',415);
  check(!attractionId||trip.route.stops.some(s=>s.attraction_id===attractionId),'INVALID_INPUT','照片景点不在本次路线中。');
  check(trip.media.length<20,'MEDIA_LIMIT','每次旅行最多保存 20 张照片。',429);
  const media={media_id:randomUUID(),mime_type:mimeType,attraction_id:attractionId||null,created_at:new Date(store.clock()).toISOString()};
  writeFileSync(resolve(mediaDir,media.media_id),bytes,{mode:0o600});store.mutate(session,id,{client_event_id:'media-'+media.media_id},t=>{t.media.push(media);return [{type:'media_uploaded',payload:{media_id:media.media_id}}];});return media;
 }
 function asset(session,id,assetId){store.getTrip(session,id);for(const job of list(session,id)){const asset=job.result?.assets?.find(a=>a.asset_id===assetId);if(asset)return {bytes:readFileSync(resolve(mediaDir,assetId)),mime_type:asset.mime_type,filename:asset.kind+'.png'};}check(false,'NOT_FOUND','生成资产不存在。',404);}
 return {generate,upload,list,asset,get:(s,t,j)=>publicJob(readJob(s,t,j)),drain,close:()=>{closed=true;return activeDrain||Promise.resolve();},facts};
}
