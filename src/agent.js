import {places} from './data.js';
export const endpoint=import.meta.env?.VITE_AGENT_CHAT_URL?.trim()||'';
export const agentMode=endpoint?'live':'local';
export function localResponse(message){
 const exact=places.filter(p=>message.includes(p.name));
 if(exact.length&&/讲|介绍|故事/.test(message))return{reply:exact.map(p=>`${p.name}：${p.story}`).join('\n\n'),placeIds:exact.map(p=>p.id),mode:'local'};
 let placeIds=['temple','pagoda','buddha'],reply='可以从山门与古迹开始认识栖霞：看看栖霞寺，再把目光放到舍利塔的建筑细节与千佛岩的山体空间。下面的景点可以点开，也可以加入你的路线。';
 if(/情侣|两个人|约会|一起|彼此/.test(message)){placeIds=['autumn','tea','pagoda'];reply='两个人来栖霞，可以把一起赏秋、读题刻、看石塔作为这趟旅行的小主题。比较不同的叶形，在白乳泉试茶亭题刻前读一段茶事，再找找舍利塔的雕刻细节。先把喜欢的地方加入路线，按现场通行条件安排顺序，不必赶完所有景点。';}
 else if(/红叶|秋|枫/.test(message)){placeIds=['autumn','tea','temple'];reply='想看秋色，可以先了解红叶谷。栖霞的红叶有枫香、三角枫、鸡爪槭等不同植物，不妨比较叶形和颜色。想慢一点，也可以把泉水茶事加入备选。红叶状态随天气变化，这里没有实时叶色情报。';}
 else if(/茶|泉|慢|休息|轻松/.test(message)){placeIds=['tea','temple'];reply='那就把节奏交给山水吧。可以先认识白乳泉试茶亭的泉水、题刻与茶文化，再选择一处人文点位慢慢看。下面是内容推荐，并非经过验证的低强度或无障碍导航路线。';}
 else if(/孩子|亲子|儿童/.test(message)){placeIds=['autumn','pagoda','tea'];reply='可以把旅行变成三个小观察：找不同形状的红叶，看看石塔的层次，再听一个泉水与茶的故事。让孩子先说看到什么，再一起追问为什么。';}
 else if(/天气|门票|开放|营业|几点|拥挤|厕所|卫生间/.test(message)){placeIds=[];reply='这类信息需要实时景区数据。我不能确认今天的天气、开放时间、票价或设施状态，请查看景区官方公告或咨询现场工作人员。';}
 else if(!/历史|建筑|路线|规划|推荐|栖霞|故事|怎么|游|逛/.test(message)){placeIds=[];reply='我收到了你的问题。这里目前可以查询红叶、人文、茶事，以及两个人慢游的景点建议。自由问答服务尚未连接，你可以先从这些主题开始。';}
 return{reply,placeIds,mode:'local'};
}
export async function askAgent({messages,sessionId,routeIds,signal,serviceUrl=endpoint,fetcher=globalThis.fetch}){
 if(!serviceUrl){await new Promise((resolve,reject)=>{if(signal?.aborted){reject(new DOMException('Aborted','AbortError'));return}const t=setTimeout(resolve,500);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'))},{once:true})});return localResponse(messages.at(-1).content);}
 const r=await fetcher(serviceUrl,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',signal,body:JSON.stringify({sessionId,messages:messages.map(({role,content})=>({role,content})),context:{parkId:'qixia-mountain',routeIds}})});
 if(!r.ok)throw Error(`智能体服务暂不可用（${r.status}），请稍后重试。`);
 const d=await r.json();if(typeof d.reply!=='string'||!d.reply.trim())throw Error('智能体回复格式不符合接口约定。');
 return{reply:d.reply,placeIds:Array.isArray(d.placeIds)?d.placeIds.filter(id=>places.some(p=>p.id===id)):[],mode:'live'};
}
