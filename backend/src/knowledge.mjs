import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=(root,file)=>JSON.parse(readFileSync(resolve(root,'backend/knowledge/qixia-kb-mvp-v1',file),'utf8').replace(/^\uFEFF/,''));
const lines=(root,file)=>readFileSync(resolve(root,'backend/knowledge/qixia-kb-mvp-v1',file),'utf8').trim().split(/\r?\n/).map(JSON.parse);
const validLocation=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const clean=s=>String(s||'').replace(/赛方资料(?:记载|指出)[，：,]?/g,'').replace(/双人/g,'人物').replace(/情侣|闺蜜/g,'游客');
export function loadKnowledge(root){
 const registry=read(root,'07_id_registry.json'),pois=lines(root,'01_pois_12.jsonl'),rules=lines(root,'04_faq_rules.jsonl');
 const aliases=new Map();for(const p of [...registry.places,...registry.facilities])if(p.canonicalId)for(const a of [p.canonicalId,p.displayName,...p.aliases||[]])aliases.set(a,p.canonicalId);
 const publicPois=pois.map(p=>({id:aliases.get(p.id)||p.id,name:p.name,aliases:[...new Set([p.name,p.canonicalName,...p.aliases||[]].filter(Boolean))],themes:p.themes||[],intro:clean(p.oneLineIntro),narration: p.id==='bell-drum-tower'?'钟楼与鼓楼是两个相邻建筑点位，地图导航到钟楼。可结合现场标识，观察周边的建筑与空间关系。':clean(p.narration30s),explanation:clean(p.plainExplanation),stayMinutes:p.recommendedStayMinutes,effort:p.effort,warnings:(p.warnings||[]).filter(s=>!(/核验|待|冲突|知识库|资料|小程序/.test(s))).map(clean)}));
 const profiles=read(root,'03_persona_preferences.json').personas.map(p=>({id:p.id,placeIds:p.preferredPoiIds.map(x=>aliases.get(x)||x)}));
 const timing=read(root,'09_time_budget_rules.json');
 return {version:'qixia-kb-mvp-v1',pois:publicPois,rules,profiles,timing,canonical:id=>aliases.get(id)||id};
}
export function createKnowledgeService(root,catalog){
 const kb=loadKnowledge(root),known=new Map(catalog.map(p=>[p.id,p]));
 const publicPoi=id=>kb.pois.find(p=>p.id===kb.canonical(id))||null;
 const knownIds=ids=>[...new Set(ids.map(kb.canonical))].filter(id=>known.has(id));
 const recommend=({interests='',availableMinutes=120,effort='',personaId=''}={})=>{
  const text=String(interests),minutes=Number(availableMinutes);const rule=kb.timing.selection.find(p=>minutes>=p.availableMinutes[0]&&minutes<=p.availableMinutes[1]);const limit=Math.min(6,rule?.recommendedPoiCount[1]||5);const low=effort==='low'||minutes<=75;
  let profile=kb.profiles.find(p=>p.id===personaId);
  if(!profile)profile=kb.profiles.find(p=>p.id===(/茶|泉/.test(text)?'tea-leisure':/历史|碑|文化|建筑/.test(text)?'solo-culture':low?'easy-visit':/枫|秋/.test(text)?'maple-photo':low?'easy-visit':'besties-photo'));
  const ids=knownIds(profile?.placeIds||[]).filter(id=>!low||!['autumn','taixu'].includes(id)).slice(0,limit);
  return {placeIds:ids,reason:/茶|泉/.test(text)?'从泉水与茶事认识栖霞。':/历史|碑|文化|建筑/.test(text)?'从建筑、碑刻与遗址认识栖霞。':'从湖景、山林与拍照视角开始探索。',routeReady:false,timing:{dwellMinutes:ids.reduce((sum,id)=>{const stay=publicPoi(id)?.stayMinutes;return sum+(Array.isArray(stay)?Math.round((stay[0]+stay[1])/2):0);},0),walkingMinutes:null,totalMinutes:null,exitReserveMinutes:15}};
 };
 const facilitiesNearby=({location,type}={})=>{const filterType=['游客中心','咨询点'].includes(type)?'游客服务':type;const items=catalog.filter(p=>(p.kind==='facility'||p.tags?.includes('出入口'))&&p.navigationAvailable&&p.location&&(!filterType||p.facilityType===filterType||p.tags.includes(filterType)||p.name.includes(filterType)));
  const valid=validLocation(location);
  const distance=p=>{if(!valid)return null;const rad=Math.PI/180,lat=(p[1]-location[1])*rad,lng=(p[0]-location[0])*rad;const h=Math.sin(lat/2)**2+Math.cos(p[1]*rad)*Math.cos(location[1]*rad)*Math.sin(lng/2)**2;return Math.round(6371008.8*2*Math.asin(Math.min(1,Math.sqrt(h))));};
  return items.map(p=>({id:p.id,name:p.name,location:p.location,distanceMeters:distance(p.location)})).sort((a,b)=>valid?a.distanceMeters-b.distanceMeters:0).slice(0,6);
 };
 const chat=(message,context={})=>{
  const text=String(message||'').trim().slice(0,2000);const answer=(reply,ids=[])=>({reply,placeIds:knownIds(ids),mode:'knowledge',knowledgeVersion:kb.version});
  const hit=kb.pois.filter(p=>[p.id,...p.aliases].some(a=>text.includes(a))).sort((a,b)=>b.name.length-a.name.length);
  if(/厕所|卫生间|餐饮|吃饭|咖啡|停车|游客中心|游客服务中心|售票|咨询点|出入口/.test(text)){
   const type=/厕所|卫生间/.test(text)?'厕所':/停车/.test(text)?'停车场':/游客中心|游客服务中心/.test(text)?'游客中心':/售票/.test(text)?'售票处':/出入口/.test(text)?'出入口':/咨询点/.test(text)?'游客中心':'餐饮';const list=facilitiesNearby({location:context.location,type});return answer(list.length?`${type==='厕所'?'可查看这些公共厕所':type==='餐饮'?'可以看看这些餐饮地点':`可查看这些${type}`}${validLocation(context.location)?'，已按直线距离排列':''}。${type==='餐饮'?'营业情况以店铺现场信息为准。':'请结合现场标识前往。'}`:'暂时没有找到对应地点，可以向游客服务中心咨询。',list.map(p=>p.id));
  }
  if(hit.length&&!/推荐|怎么逛|规划路线|现在|今天|票价|开放|几点|封路/.test(text)){const selected=hit.slice(0,2);return answer(selected.map(p=>`${p.name}\n${p.narration}${p.explanation?'\n'+p.explanation:''}`).join('\n\n'),selected.map(p=>p.id));}
  if(/红叶|枫情/.test(text)&&/现在|今天|最佳|红了吗/.test(text))return answer('红叶会随当年气温和天气变化。目前没有已确认的实时枫情，建议查看景区近期公告与实景。可以先了解这些赏秋地点。',['autumn','peach-lake','mirror-lake']);
  if(/票价|门票|营业|开放|几点|封路|拥挤/.test(text))return answer('开放时间、票价和通行状态可能变化，请查看景区当日公告或咨询游客中心。',['facility-b00190z2ds']);
  const faq=kb.rules.find(p=>p.question.replace(/[？?]/g,'')===text.replace(/[？?]/g,''));
  if(faq&&!['rule-replan','rule-default-gate','rule-poi-count'].includes(faq.id))return answer(clean(faq.answer).replace(/比赛版/g,''));
  if(/推荐|游|逛|拍照|茶|历史|文化|规划|路线|闺蜜|情侣|台阶|体力|轻松/.test(text)){
   const m=text.match(/(\d+)\s*(?:分钟|小时)/),availableMinutes=m?Number(m[1])*(/小时/.test(m[0])?60:1):120;
   const result=recommend({interests:text,availableMinutes,effort:/少走|体力有限|台阶少|少台阶|轻松|不想太累/.test(text)?'low':''});
   return answer(result.reason+'下面是可选择的地点。你更想看风景、听故事，还是安排茶歇？也可以告诉我可游览的时间。',result.placeIds);
  }
  return answer('这部分信息目前没有在导览资料中确认。你可以问我景点故事、拍照建议、茶事和附近设施；需要现场核实的信息可咨询游客中心。');
 };
 return {catalog:kb.pois,version:kb.version,publicPoi,recommend,facilitiesNearby,chat};
}
