import {places,allPlaces} from './data.js';
export const endpoint=import.meta.env?.VITE_AGENT_CHAT_URL?.trim()||'/api/knowledge/chat';
export const agentMode=endpoint==='/api/knowledge/chat'?'knowledge':endpoint?'live':'local';
export function localResponse(message){
 const exact=places.filter(p=>message.includes(p.name));
 if(exact.length&&/讲|介绍|故事/.test(message))return{reply:exact.map(p=>`${p.name}：${p.story}`).join('\n\n'),placeIds:exact.map(p=>p.id),mode:'local'};
 let placeIds=['autumn','mirror-lake','spring-bridge'],reply='可以从湖边、红叶与古桥开始认识栖霞，把山林、溪水与文学故事放在同一趟旅行里。下面的景点可以点开，也可以加入你的路线。';
 if(/红叶|秋|枫/.test(message)){placeIds=['autumn','tea','temple'];reply='想看秋色，可以先了解红叶谷。栖霞的红叶有枫香、三角枫、鸡爪槭等不同植物，不妨比较叶形和颜色。也可以把泉水茶事加入备选。红叶状态随天气变化，这里没有实时叶色情报。';}
 else if(/茶|泉|慢|休息|轻松/.test(message)){placeIds=['tea','temple'];reply='可以从泉水与题刻了解栖霞。可以先认识白乳泉试茶亭的泉水、题刻与茶文化，再选择一处人文点位了解。下面是内容推荐，并非经过验证的低强度或无障碍导航路线。';}
 else if(/孩子|亲子|儿童/.test(message)){placeIds=['autumn','pagoda','tea'];reply='可以把旅行变成三个小观察：找不同形状的红叶，看看石塔的层次，再听一个泉水与茶的故事。让孩子先说看到什么，再一起追问为什么。';}
 else if(/天气|门票|开放|营业|几点|拥挤|厕所|卫生间/.test(message)){placeIds=[];reply='这类信息需要实时景区数据。我不能确认今天的天气、开放时间、票价或设施状态，请查看景区官方公告或咨询现场工作人员。';}
 else if(!/历史|建筑|路线|规划|推荐|栖霞|故事|怎么|游|逛/.test(message)){placeIds=[];reply='我收到了你的问题。这里目前可以查询红叶、人文、茶事，以及景点路线建议。自由问答服务尚未连接，你可以先从这些主题开始。';}
 placeIds=placeIds.filter(id=>places.some(p=>p.id===id));
 return{reply,placeIds,mode:'local',...(/路线|规划/.test(message)&&placeIds.length>1?{routeDraft:placeIds}: {})};
}
export async function askAgent({messages,sessionId,routeIds,location,currentPlaceId,preferences,signal,serviceUrl=endpoint,fetcher=globalThis.fetch}){
 if(!serviceUrl){await new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return}const t=setTimeout(resolve,500);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'))},{once:true})});return localResponse(messages.at(-1).content);}
 const r=await fetcher(serviceUrl,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal,body:JSON.stringify({sessionId,messages:messages.map(({role,content})=>({role,content})),context:{parkId:'qixia-mountain',routeIds,...(location?{location}: {}),...(currentPlaceId?{currentPlaceId}:{}),...(preferences?{preferences}:{})}})});
 if(!r.ok)throw Error(`智能体服务暂不可用（${r.status}），请稍后重试。`);
 const d=await r.json();if(typeof d.reply!=='string'||!d.reply.trim())throw Error('智能体回复格式不符合接口约定。');
 const routeDraft=[...new Set(Array.isArray(d.routeDraft)?d.routeDraft:[])].filter(id=>allPlaces.some(p=>p.id===id&&p.navigationAvailable));
 return{...(routeDraft.length>1?{routeDraft}:{}),reply:d.reply,placeIds:Array.isArray(d.placeIds)?[...new Set(d.placeIds)].filter(id=>allPlaces.some(p=>p.id===id)):[],mode:['knowledge','grounded-model'].includes(d.mode)?d.mode:'live',...(d.context?{context:d.context}:{}),...(Array.isArray(d.sourceIds)?{sourceIds:d.sourceIds}:{}),...(typeof d.unknown==='boolean'?{unknown:d.unknown}:{}),...(d.routeFilters?{routeFilters:d.routeFilters}:{})};
}
