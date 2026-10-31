import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {check,object} from './errors.mjs';
export function createImmersiveService({root,store}){
 const {experiences}=JSON.parse(readFileSync(resolve(root,'backend/data/immersive-experiences.v1.json'),'utf8'));
 const get=id=>{const e=experiences.find(x=>x.id===id&&x.enabled!==false);check(e,'NOT_FOUND','体验不存在。',404);return structuredClone(e);};
 const command=(session,id,input)=>{
  check(session.kind==='web','FORBIDDEN','请在网页进行沉浸式体验。',403);
  object(input,['client_event_id','expected_version','experience_id','choice_id','action']);const e=get(input.experience_id);
  check(!input.action||input.action==='restart','INVALID_ACTION','体验操作无效。');
  return store.mutate(session,id,input,trip=>{
    let state=trip.immersive_sessions.find(s=>s.experience_id===e.id);
    for(const r of trip.reminders)if(r.experience_id===e.id&&r.status==='pending')r.status='opened_on_web';
    if(input.action==='restart'){check(state?.completed_at&&!input.choice_id,'INVALID_STATE','完成体验后才可重新开始。',409);const runs=[...(state.previous_runs||[]),{started_at:state.started_at,completed_at:state.completed_at,choices:state.choices}].slice(-5);Object.assign(state,{current_scene:e.start_scene,started_at:new Date(store.clock()).toISOString(),completed_at:null,choices:[],previous_runs:runs});return [{type:'immersive_restarted',payload:{experience_id:e.id}}];}
    if(!input.choice_id){if(!state){state={experience_id:e.id,title:e.title,attraction_id:e.attraction_id,version:e.version,current_scene:e.start_scene,started_at:new Date(store.clock()).toISOString(),choices:[]};trip.immersive_sessions.push(state);}return [{type:'immersive_opened',payload:{experience_id:e.id,attraction_id:e.attraction_id}}];}
    check(state&&!state.completed_at,'INVALID_STATE','请先打开体验，或此体验已经结束。',409);
    const scene=e.scenes.find(s=>s.id===state.current_scene),choice=scene.choices.find(c=>c.id===input.choice_id);check(choice,'INVALID_CHOICE','此场景没有这个选项。');
    state.choices.push({scene_id:scene.id,choice_id:choice.id,label:choice.label,at:new Date(store.clock()).toISOString()});state.current_scene=choice.next_scene;
    if(!e.scenes.find(s=>s.id===state.current_scene).choices.length)state.completed_at=new Date(store.clock()).toISOString();
    return [{type:state.completed_at?'immersive_completed':'immersive_choice',payload:{experience_id:e.id,scene_id:state.current_scene}}];
  });
 };
 const onProximity=(session,id,place)=>{
  const e=experiences.find(e=>e.enabled!==false&&e.attraction_id===place.attraction_id);if(!e)return;
  const trip=store.getTrip(session,id);if(trip.status!=='active'||!trip.route.stops.some(s=>s.stop_id===place.stop_id&&s.attraction_id===e.attraction_id)||trip.immersive_sessions.some(s=>s.experience_id===e.id))return;
  const reminderId=`${e.id}:${e.version}`;if(trip.reminders.some(r=>r.experience_id===e.id))return;
  store.mutate(session,id,{client_event_id:'reminder:'+reminderId},t=>{t.reminders.push({id:reminderId,stop_id:place.stop_id,experience_id:e.id,status:'pending',voice_delivery:'not_connected',speech_text:`附近的栖霞寺有沉浸式体验《${e.title}》，请查看网页弹窗，或点击“沉浸式体验”标签进入。`,created_at:new Date(store.clock()).toISOString()});return [{type:'immersive_available',payload:{experience_id:e.id,stop_id:place.stop_id}}];});
 };
 const dismiss=(session,id,input)=>{
  check(session.kind==='web','FORBIDDEN','请从网页处理提醒。',403);object(input,['client_event_id','expected_version','reminder_id','action']);check(!input.action||input.action==='open','INVALID_ACTION','提醒操作无效。');
  return store.mutate(session,id,input,t=>{const r=t.reminders.find(r=>r.id===input.reminder_id);check(r,'NOT_FOUND','提醒不存在。',404);if(r.status==='pending')r.status=input.action==='open'?'opened_on_web':'dismissed_on_web';return [{type:'immersive_reminder_acknowledged',payload:{reminder_id:r.id,status:r.status}}];});
 };
 return {list:()=>experiences.filter(e=>e.enabled!==false).map(e=>({id:e.id,version:e.version,attraction_id:e.attraction_id,title:e.title,entry_path:e.entry_path})),get,command,onProximity,dismiss};
}
