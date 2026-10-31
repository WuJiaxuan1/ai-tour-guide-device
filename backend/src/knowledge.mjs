import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export const KNOWLEDGE_VERSION='qixia-deepseek-v2.1';
const validLocation=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function loadKnowledge(root){
 const dir=resolve(root,'backend/knowledge',KNOWLEDGE_VERSION);
 const text=file=>readFileSync(resolve(dir,file),'utf8').replace(/^\uFEFF/,'');
 const records=text('06_结构化知识条目.jsonl').trim().split(/\r?\n/).map(JSON.parse);
 const retrieval=text('07_可检索正文片段.jsonl').trim().split(/\r?\n/).map(JSON.parse);
 const aliases=new Map([['west-gate','gate'],['tea-house','tea'],['spring-rain-bridge','spring-bridge']]);
 for(const p of records.filter(p=>p.library_id==='KB02'))for(const a of [p.id,p.name,...p.aliases||[]])aliases.set(a,aliases.get(p.id)||p.id);
 const canonical=id=>aliases.get(id)||id;
 const pois=records.filter(p=>p.library_id==='KB02').map(p=>({id:canonical(p.id),name:p.name,aliases:[p.id,p.name,...p.aliases||[]],themes:p.keywords||[],intro:p.content.split(/[。\n]/)[0]+'。',narration:p.content,explanation:p.plain_explanation||'',stayMinutes:p.recommended_stay_minutes,effort:p.effort_estimate,warnings:[]}));
 return {version:KNOWLEDGE_VERSION,records,retrieval,pois,canonical,instructions:text('01_问枫枫系统提示词.txt'),fullContext:text('02_全量知识上下文.md')};
}
export function createKnowledgeService(root,catalog){
 const kb=loadKnowledge(root),known=new Map(catalog.map(p=>[p.id,p]));
 const publicPoi=id=>kb.pois.find(p=>p.id===kb.canonical(id))||null;
 const knownIds=ids=>[...new Set(ids.map(kb.canonical))].filter(id=>known.has(id));
 const recommend=({interests='',availableMinutes=120,effort='',personaId=''}={})=>{
  const text=String(interests),minutes=Number(availableMinutes),low=effort==='low'||minutes<=75;
  // These are card suggestions, never a newly activated/navigation-ready route.
  const candidates=kb.records.filter(p=>p.library_id==='KB06');
  const route=candidates.find(p=>/茶|泉/.test(text)?/茶/.test(p.name):/历史|碑|文化|建筑/.test(text)?/人文/.test(p.name):/轻松/.test(p.name))||candidates[0];
  const preferred=/历史|碑|文化|建筑/.test(text)?['mingzheng-stele',...(route?.waypoint_ids||[])]:low?['mirror-lake','bell-drum-tower','temple','pagoda']:(route?.waypoint_ids||[]);
  const ids=knownIds(preferred).filter(id=>id!=='gate'&&(!low||!['autumn','taixu'].includes(id))).slice(0,minutes<=75?3:6);
  return {placeIds:ids,reason:/茶|泉/.test(text)?'从泉水与茶事认识栖霞。':/历史|碑|文化|建筑/.test(text)?'从建筑、碑刻与遗址认识栖霞。':'从湖景、山林与拍照视角开始探索。',routeReady:false,timing:{dwellMinutes:ids.reduce((sum,id)=>{const stay=publicPoi(id)?.stayMinutes;return sum+(Array.isArray(stay)?Math.round((stay[0]+stay[1])/2):0);},0),walkingMinutes:null,totalMinutes:null,exitReserveMinutes:15}};
 };
 const facilitiesNearby=({location,type}={})=>{const filterType=['游客中心','咨询点'].includes(type)?'游客服务':type;const items=catalog.filter(p=>(p.kind==='facility'||p.tags?.includes('出入口'))&&p.navigationAvailable&&p.location&&(!filterType||p.facilityType===filterType||p.tags.includes(filterType)||p.name.includes(filterType)));
  const valid=validLocation(location);
  const distance=p=>{if(!valid)return null;const rad=Math.PI/180,lat=(p[1]-location[1])*rad,lng=(p[0]-location[0])*rad;const h=Math.sin(lat/2)**2+Math.cos(p[1]*rad)*Math.cos(location[1]*rad)*Math.sin(lng/2)**2;return Math.round(6371008.8*2*Math.asin(Math.min(1,Math.sqrt(h))));};
  return items.map(p=>({id:p.id,name:p.name,location:p.location,distanceMeters:distance(p.location)})).sort((a,b)=>valid?a.distanceMeters-b.distanceMeters:0).slice(0,6);
 };
 const selectRecords=message=>{
  const text=String(message||'');
  const matches=kb.records.filter(p=>p.library_id!=='KB08').map(p=>{
   const names=[p.name,...p.aliases||[]].filter(n=>n.length>1);
   const exact=names.filter(n=>text.includes(n)).sort((a,b)=>b.length-a.length)[0];
   return {p,exact:exact?.length||0,score:exact?100+exact.length:(p.keywords||[]).filter(k=>k.length>1&&text.includes(k)).length};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  // A complete facility name must not degrade into an attraction substring.
  const specific=matches[0]?.exact>=4?matches.filter(x=>x.exact===matches[0].exact):matches;
  return specific.slice(0,3).map(x=>x.p);
 };
 const chat=(message,context={})=>{
  const text=String(message||'').trim().slice(0,2000),records=selectRecords(text);
  const answer=(reply,ids=[],unknown=false)=>({reply,placeIds:knownIds(ids),sourceIds:records.map(p=>p.id),unknown,mode:'knowledge',knowledgeVersion:kb.version});
  if(/票价|门票|营业|开放|几点|封路|拥挤|末班|班次/.test(text)||(/红叶|枫情/.test(text)&&/现在|今天|最佳|红了吗/.test(text)&&!/为什么|为何|原理|机制/.test(text)))return answer('目前没有已确认的实时信息，票价、开放和通行状态请查看景区当日公告或咨询游客中心。',[],true);
  if(records.length){
   const usable=records.filter(p=>!['current_data_required','rule_only'].includes(p.answer_mode));
   if(usable.length)return answer(usable.map(p=>`${p.name}\n${p.answer_mode==='dated_snapshot_only'?`以下为${p.captured_at||'采集日期未确认'}的资料快照，不保证当前营业或可用。\n`:p.answer_mode==='candidate_only'?'仅为候选参考，尚未验证为本次可导航行程。\n':p.answer_mode==='experience_only'?'以下为经验建议。\n':p.answer_mode==='map_reference_only'?'以下为历史地图参考，不代表当前道路状态。\n':''}${p.content}`).join('\n\n'),usable.filter(p=>p.library_id==='KB02').map(p=>p.id));
  }
  return answer('这项信息目前还没有在导览资料中确认。你可以问我景点故事、人物、茶事和设施；需要现场核实的信息可咨询游客中心。',[],true);
 };
 const modelEvidence=({question,placeId}={})=>{
  const records=selectRecords(question),poi=placeId?publicPoi(placeId):null;
  return {instructions:kb.instructions,context:kb.fullContext,sourceIds:['knowledge-pack:'+kb.version],placeIds:knownIds(poi?[poi.id]:records.filter(p=>p.library_id==='KB02').map(p=>p.id)),selectedPlace:poi?{id:poi.id,name:poi.name}:null};
 };
 return {catalog:kb.pois,version:kb.version,counts:{records:kb.records.length,retrieval:kb.retrieval.length,pois:kb.pois.length},publicPoi,recommend,facilitiesNearby,chat,modelEvidence};
}
