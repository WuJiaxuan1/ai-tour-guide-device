import {ServiceError} from './amap.mjs';
export function parseMinutes(text){
 const digits={'半':0.5,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
 const number=s=>/^\d/.test(s)?Number(s):s.includes('十')?(digits[s.split('十')[0]]||1)*10+(digits[s.split('十')[1]]||0):digits[s];
 const matches=[...text.matchAll(/(\d+(?:\.\d+)?|[一二两三四五六七八九]?十[一二三四五六七八九]?|半|[一二两三四五六七八九])\s*(小时|分钟)/g)];
 return matches.length?Math.min(1440,matches.reduce((sum,m)=>sum+number(m[1])*(m[2]==='小时'?60:1),0)+(/小时半/.test(text)?30:0)):null;
}
export function createConversationService(knowledge,presets,catalog){
 const pois=knowledge.catalog;
 const mention=text=>pois.filter(p=>[p.name,p.id,...p.aliases].some(n=>text.includes(n)));
 // Client history is the bounded source of conversation state. No unauthenticated shared session store.
 return async function answer(input,{signal}={}){
  if(!input||!Array.isArray(input.messages)||!input.messages.length||input.messages.length>30||input.messages.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>6000)||input.messages.at(-1).role!=='user'||input.messages.at(-1).content.length>2000)throw new ServiceError('对话格式不正确，请重新提问。',400);
  const messages=input.messages.slice(-20),text=messages.at(-1).content.trim();if(!text)throw new ServiceError('请输入有效的问题。',400);
  const context=input.context&&typeof input.context==='object'?input.context:{};
  let hits=mention(text),current=null;
  if(hits.length===1)current=hits[0];
  if(!hits.length&&/它|这里|那里|这个|那个|还有|再讲|继续|多久|特点/.test(text)){
   let foundHistory=false;
   for(const m of messages.slice(0,-1).reverse()){const found=mention(m.content);if(found.length){foundHistory=true;if(found.length===1)current=found[0];break;}}
   if(!foundHistory)current=pois.find(p=>p.id===context.currentPlaceId)||null;
   if(current)hits=[current];
   else return {reply:'你想继续了解哪个景点？告诉我名字，我会接着讲。',placeIds:[],mode:'knowledge',unknown:true,sourceIds:[],context:{currentPlaceId:null}};
  }
  const userText=messages.filter(m=>m.role==='user').map(m=>m.content).join(' ');
  const supplied=context.preferences&&typeof context.preferences==='object'&&!Array.isArray(context.preferences)?context.preferences:{};
  const prefs={};
  if(Number.isFinite(supplied.availableMinutes))prefs.availableMinutes=Math.max(0,Math.min(1440,supplied.availableMinutes));
  if(['low','normal'].includes(supplied.effort))prefs.effort=supplied.effort;
  if(typeof supplied.interests==='string')prefs.interests=supplied.interests.slice(0,200);
  for(const m of messages.filter(m=>m.role==='user')){const n=parseMinutes(m.content);if(n!==null)prefs.availableMinutes=Math.min(1440,n);if(/轻松|少走|少台阶/.test(m.content))prefs.effort='low';const interests=m.content.match(/历史|文化|拍照|茶|赏秋|红叶|湖景/g);if(interests)prefs.interests=[...new Set(interests)].join('、');}
  const minutes=parseMinutes(text);if(minutes!==null)prefs.availableMinutes=minutes;
  if(/轻松|少走|不想太累|少台阶/.test(text))prefs.effort='low';
  if(/正常游览|能量无限/.test(text))prefs.effort='normal';
  const out=(reply,placeIds=[],sourceIds=[],unknown=false,extra={})=>({reply,placeIds,sourceIds,unknown,mode:'knowledge',knowledgeVersion:knowledge.version,context:{currentPlaceId:current?.id||null,preferences:prefs},...extra});
  if(/小智/.test(text))return out('计划复用小智，但网页文字接口尚未打通。目前这里使用知识库规则检索，可承接景点追问和路线筛选条件，不是大模型自由对话。');
  if(/手表|同步|Android|安卓/.test(text))return out('可以在“我的路线”规划行程，开始游览后按站点打开导航。');
  if(/接驳|观光车|班车/.test(text)){
   const lines=presets.shuttles.lines.filter(l=>text.includes('景区外')?l.scope==='external':text.includes('虎山')?l.name==='虎山线':text.includes('龙山')?l.name==='龙山线':text.includes('南山')?l.name==='南山景区':l.scope==='internal');
   return out(lines.map(l=>`${l.name}（${l.direction}）：${l.stops.map(s=>s.name).join(' → ')}。资料列示 ${l.hours}，${l.fareYuan} 元/人/单程。`).join('\n')+'\n以上依据 2026-10-30 整理资料，班次与当日运营请咨询 025-83784726；可在“我的路线 → 接驳车”查看。',[],lines.map(l=>l.lineId));
  }
  const previous=messages.slice(0,-1).findLast(m=>m.role==='assistant');
  const routeFollowup=(supplied.routePending===true||/请补充从西门|符合这组条件的官方路线|这组条件/.test(previous?.content||''))&&/西门|南门|半日|全天|轻松|正常|能量|老人|儿童|孩子|未选择|不带|没有/.test(text);
  if(/路线|怎么逛|规划|半日|全天/.test(text)||routeFollowup){
   const filters={gate:/南门/.test(userText)?'south':/西门/.test(userText)?'west':null,duration:/全天/.test(userText)?'full':/半日/.test(userText)?'half':null,intensity:/能量无限/.test(userText)?'energetic':/正常游览/.test(userText)?'normal':/轻松/.test(userText)?'easy':null,companions:/老人/.test(userText)?'senior':/儿童|孩子/.test(userText)?'child':'none'};
   // Newer explicit choices override older messages; hours do not silently equal half/full day.
   for(const [key,options]of Object.entries(presets.data.options))if(options.some(o=>o.value===supplied.routeFilters?.[key]))filters[key]=supplied.routeFilters[key];
   for(const m of messages.filter(m=>m.role==='user')){
    for(const [key,options]of Object.entries(presets.data.options)){const found=options.map(o=>({...o,at:m.content.lastIndexOf(o.label.replace(/（.*）/,''))})).filter(o=>o.at>=0).sort((a,b)=>a.at-b.at).at(-1);if(found)filters[key]=found.value;}
    if(/轻松|少走|少台阶/.test(m.content))filters.intensity='easy';
    if(/老人/.test(m.content))filters.companions='senior';
    if(/儿童|孩子/.test(m.content))filters.companions='child';
    if(/不带老人|不带孩子|没有老人|没有孩子|未选择|独自|一个人/.test(m.content))filters.companions='none';
   }
   prefs.routeFilters=filters;prefs.routePending=true;
   if(Object.values(filters).some(v=>v===null))return out('可以按官方路线筛选。请补充从西门还是南门进入、半日还是全天，以及轻松休闲／正常游览／能量无限；也可以直接打开“我的路线”选择。已记录你提供的时间与偏好。',[],[],false,{routeFilters:filters});
   const result=presets.match(filters);return out(result.status==='matched'?`符合这组条件的官方路线：${result.routes.map(r=>r.name).join('、')}。可在“我的路线”查看顺序和接驳信息；道路与返程资料未齐全的路线暂不能开始导航。`:result.status==='no_match'?'这组条件在已整理的官方资料中没有匹配路线。可以调整筛选条件。':'这组条件还没有核对到官方推荐结果。可以在“我的路线”调整或跳过部分条件。',[],result.routes.map(r=>r.routeId),result.status!=='matched',{routeFilters:filters,routeIds:result.routes.map(r=>r.routeId)});
  }
  if(hits.length&&!/厕所|卫生间|吃饭|餐饮|停车|游客中心|票价|开放|几点|今天|现在|封路/.test(text)){
   const selected=hits.slice(0,2);const evidence=selected.map(p=>({id:p.id,name:p.name,text:/特点|特色/.test(text)?p.explanation||p.narration:p.narration+'\n'+p.explanation}));
   const fallback=evidence.map(p=>`${p.name}\n${p.text}`).join('\n\n');
   // Xiaozhi web transport is pending; this endpoint stays explicit, bounded retrieval.
   return out(fallback,selected.map(p=>p.id),selected.map(p=>p.id));
  }
  if(/推荐|拍照|茶|历史|文化|轻松/.test(text)&&!hits.length&&!/票价|开放|几点|今天|现在|封路/.test(text)){const r=knowledge.recommend({interests:prefs.interests||text,availableMinutes:prefs.availableMinutes||120,effort:prefs.effort});return out(r.reason+'这些是候选地点；正式行程请在“我的路线”按官方条件筛选。',r.placeIds,r.placeIds);}
  // Existing curated stories are a bounded fallback for places outside the 12-POI knowledge pack.
  const place=catalog.find(p=>text.includes(p.name));
  if(place?.story&&/讲|故事|介绍/.test(text)&&!/票价|开放|几点|今天|现在|封路/.test(text))return out(place.name+'\n'+place.story,[place.id],['catalog:'+place.id]);
  const result=knowledge.chat(current?current.name+' '+text:text,context);
  return {...out(result.reply,result.placeIds,result.placeIds,/没有.*确认|没有找到/.test(result.reply)),knowledgeVersion:result.knowledgeVersion};
 };
}
