import {randomUUID} from 'node:crypto';
const schema=(properties={},required=[])=>({type:'object',properties,required,additionalProperties:false});
const string={type:'string',minLength:1,maxLength:2000};
export const definitions=[
 {name:'qixia_trip_context',description:'读取绑定旅行的位置新鲜度、下一站、道路预计时间与待提醒体验；过期位置不得说成实时。',inputSchema:schema()},
 {name:'qixia_trip_ask',description:'游客询问景点、行程、枫叶或活动时调用。记录原始问题，依据同一知识库与旅行状态回答。讲这里时不能猜地点。',inputSchema:schema({question:string,place_id:{type:'string',maxLength:80}},['question'])},
 {name:'qixia_trip_note',description:'仅当游客明确要求记住一段旅行感受时保存原话。',inputSchema:schema({text:string,attraction_id:{type:'string',maxLength:80}},['text'])},
 {name:'qixia_trip_confirm_visit',description:'仅当游客明确表示已经到达此停靠时记录到访；停靠 ID 必须来自刚读取的旅行状态。',inputSchema:schema({stop_id:{type:'string',maxLength:100}},['stop_id'])}
];
export function createTripTools({baseUrl,token,tripId,fetcher=fetch}){
 const base=new URL(baseUrl);if(!(base.protocol==='https:'||(base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)))||base.username||base.password)throw Error('旅行 API 必须使用 HTTPS 或本机回环地址。');
 if(!/^[a-f0-9-]{36}$/.test(tripId)||!token)throw Error('请配置绑定旅行 ID 与设备凭证。');
 const request=async(path,method='GET',body)=>{let r;try{r=await fetcher(new URL('/api/v1'+path,base),{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000)});}catch{throw Error('旅行服务连接失败。');}const value=await r.json();if(!r.ok)throw Error(value.error?.message||'旅行服务暂不可用。');return value;};
 return {definitions,async call(name,args={}){
  const definition=definitions.find(d=>d.name===name);if(!definition)throw Error('未知旅行工具。');
  if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(definition.inputSchema.properties,k)))throw Error('工具参数无效。');
  for(const key of definition.inputSchema.required)if(typeof args[key]!=='string'||!args[key].trim())throw Error('缺少工具参数。');
  for(const [key,value] of Object.entries(args))if(typeof value!=='string'||!value.trim()||value.length>definition.inputSchema.properties[key].maxLength)throw Error('工具参数无效。');
  if(name==='qixia_trip_context')return request(`/trips/${tripId}/navigation-context`);
  if(name==='qixia_trip_ask')return request('/chat','POST',{...args,trip_id:tripId,conversation_id:'xiaozhi:'+tripId,client_event_id:randomUUID()});
  if(name==='qixia_trip_note')return request(`/trips/${tripId}/notes`,'POST',{...args,client_event_id:randomUUID()});
  const trip=await request(`/trips/${tripId}`);
  return request(`/trips/${tripId}/commands`,'POST',{client_event_id:randomUUID(),expected_version:trip.version,action:'confirm_visit',stop_id:args.stop_id});
 }};
}
