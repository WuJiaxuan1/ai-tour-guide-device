const DEFAULT_API_BASE='http://127.0.0.1:8787';
export const MAX_CALL_BYTES=1024;
const page={type:'integer',minimum:0,maximum:100,description:'从0开始的分页；按结果 nextPage 继续'};
const location={type:'array',items:{type:'number'},minItems:2,maxItems:2,description:'可选 GCJ02 [经度,纬度]，仅作直线距离排序'};
const tool=(name,description,properties,required=[])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
export const tools=[
  tool('qixia.explain_current_place','按显式placeId读取项目景点资料，不知道游客当前位置；不编造实时票价或开放状态。',{placeId:{type:'string',minLength:1,maxLength:80},page},['placeId']),
  tool('qixia.search_knowledge','检索项目景点和设施资料；unknown表示未确认，不能证明到访。',{query:{type:'string',minLength:1,maxLength:500},location,page},['query']),
  tool('qixia.recommend_routes','按正式资料筛选路线；matched/no_match/unverified只针对已应用条件。不支持出口与指定景点筛选，会明确返回未应用字段。',{entryGate:{type:'string',enum:['west','south']},exitGate:{type:'string',enum:['west','south']},duration:{type:'string',enum:['half','full']},intensity:{type:'string',enum:['easy','normal','energetic']},companions:{type:'string',enum:['none','senior','child']},preferredPlaceIds:{type:'array',items:{type:'string',minLength:1,maxLength:80},maxItems:20},page}),
  tool('qixia.get_route_catalog','分页读取官方路线ID、名称、版本和navigationReady；资料不完整时不能开始导航。',{page}),
  tool('qixia.get_facilities_nearby','分页读取设施候选；有坐标时按直线距离排序，无位置不能声称最近。',{type:{type:'string',minLength:1,maxLength:40},location,page})
];
export class ToolError extends Error { constructor(code,message){super(message);this.code=code;} }
export function safeToolError(error){return error instanceof ToolError?{ok:false,code:error.code,error:error.message}:{ok:false,code:'upstream_unavailable',error:'项目服务暂不可用，请稍后重试。'};}
function validate(value,schema,key){
  const fail=()=>{throw new ToolError('invalid_arguments',`参数 ${key} 格式不正确。`);};
  if(schema.type==='string'&&(typeof value!=='string'||value.trim().length<(schema.minLength||0)||value.length>(schema.maxLength||Infinity)))fail();
  if(schema.enum&&!schema.enum.includes(value))fail();
  if(schema.type==='integer'&&(!Number.isInteger(value)||value<schema.minimum||value>schema.maximum))fail();
  if(schema.type==='number'&&!Number.isFinite(value))fail();
  if(schema.type==='array'){
    if(!Array.isArray(value)||value.length<(schema.minItems||0)||value.length>(schema.maxItems||Infinity))fail();
    for(const item of value)validate(item,schema.items,key);
    if(key==='location'&&(Math.abs(value[0])>180||Math.abs(value[1])>90))fail();
  }
}
export function validateArguments(name,args){
  const definition=tools.find(t=>t.name===name);
  if(!definition)throw new ToolError('unknown_tool','未知工具。');
  if(!args||typeof args!=='object'||Array.isArray(args))throw new ToolError('invalid_arguments','工具参数必须是对象。');
  const schema=definition.inputSchema;
  if(Object.keys(args).some(key=>!Object.hasOwn(schema.properties,key)))throw new ToolError('invalid_arguments','包含未支持的参数。');
  for(const key of schema.required)if(!Object.hasOwn(args,key))throw new ToolError('invalid_arguments',`缺少参数 ${key}。`);
  for(const [key,value]of Object.entries(args))if(key!=='page')validate(value,schema.properties[key],key);
  if(Object.hasOwn(args,'page'))validate(args.page,page,'page');
}
export const callResponse=(id,payload)=>({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(payload)}],isError:payload.ok===false}});
export const responseBytes=(id,payload)=>Buffer.byteLength(JSON.stringify(callResponse(id,payload)),'utf8');
export function paginate(payload,{page:pageIndex=0,id=0,listKey,textKey}={}){
  const budget=850,metadata={...payload};
  const values=listKey?metadata[listKey]:textKey?Array.from(metadata[textKey]||''):[];
  if(listKey)delete metadata[listKey];
  if(textKey)delete metadata[textKey];
  const make=(chunk,index,next)=>({...metadata,...(listKey?{[listKey]:chunk}:{[textKey]:chunk.join('')}),page:index,nextPage:next});
  const pages=[];if(!values.length)pages.push(make([],0,null));let offset=0;
  while(offset<values.length){const chunk=[];while(offset<values.length){const candidate=[...chunk,values[offset]];if(responseBytes(0,make(candidate,pages.length,pages.length+1))>budget)break;chunk.push(values[offset++]);}if(!chunk.length)throw new ToolError('result_too_large','单项资料过长，请缩小查询范围。');pages.push(make(chunk,pages.length,offset<values.length?pages.length+1:null));}
  if(pageIndex>=pages.length)throw new ToolError('invalid_page','该页不存在，请从第0页开始。');
  const out=pages[pageIndex];if(responseBytes(id,out)>MAX_CALL_BYTES)throw new ToolError('result_too_large','请求标识或结果过长。');return out;
}
async function request(base,path,options={},fetcher=fetch,timeoutMs=12000){
  let response;try{response=await fetcher(new URL(path,base),{...options,headers:{Accept:'application/json','Content-Type':'application/json'},signal:AbortSignal.timeout(timeoutMs)});}catch{throw new ToolError('upstream_unavailable','项目服务暂不可用，请稍后重试。');}
  if(response.status===404)throw new ToolError('not_found','项目资料中没有找到该内容。');
  if(!response.ok)throw new ToolError('upstream_error','项目服务暂时无法完成查询，请稍后重试。');
  let data;try{data=await response.json();}catch{throw new ToolError('invalid_upstream','项目服务返回格式不正确。');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new ToolError('invalid_upstream','项目服务返回格式不正确。');return data;
}
const routeSummary=route=>({routeId:route.routeId,revision:route.revision,name:route.name,navigationReady:route.navigationReady===true});
export function createToolDispatcher({apiBase=DEFAULT_API_BASE,fetcher=fetch,timeoutMs=12000}={}){
  const base=new URL(apiBase||DEFAULT_API_BASE);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)throw new Error('Invalid project API configuration');
  const get=(path,options)=>request(base,path,options,fetcher,timeoutMs);
  return async(name,args={})=>{
    validateArguments(name,args);const pageIndex=args.page||0;
    if(name==='qixia.explain_current_place'){const data=await get(`/api/knowledge/pois/${encodeURIComponent(args.placeId.trim())}`);return paginate({ok:true,source:'qixia-kb-mvp-v1',sourceIds:[data.id],unknown:false,place:{id:data.id,name:data.name},narration:data.narration||data.explanation||data.intro||''},{page:pageIndex,textKey:'narration'});}
    if(name==='qixia.search_knowledge'){const data=await get('/api/knowledge/chat',{method:'POST',body:JSON.stringify({messages:[{role:'user',content:args.query.trim()}],context:args.location?{location:args.location}:{}})});return paginate({ok:true,source:data.knowledgeVersion||'project-api',sourceIds:data.sourceIds||[],unknown:Boolean(data.unknown),reply:data.reply||''},{page:pageIndex,textKey:'reply'});}
    if(name==='qixia.recommend_routes'){const input={},unsupportedFilters=[];if(args.entryGate)input.gate=args.entryGate;for(const key of ['duration','intensity','companions'])if(args[key])input[key]=args[key];if(args.exitGate)unsupportedFilters.push('exitGate');if(args.preferredPlaceIds?.length)unsupportedFilters.push('preferredPlaceIds');const data=await get('/api/routes/match',{method:'POST',body:JSON.stringify(input)});const effective=data.effective||input;const appliedFilters={...input};if(effective.intensity)appliedFilters.intensity=effective.intensity;return paginate({ok:true,source:'official-presets',status:data.status,appliedFilters,unsupportedFilters,routes:(data.routes||[]).map(routeSummary)},{page:pageIndex,listKey:'routes'});}
    if(name==='qixia.get_route_catalog'){const data=await get('/api/routes/presets');return paginate({ok:true,source:'official-presets',version:data.version||null,total:(data.routes||[]).length,routes:(data.routes||[]).map(routeSummary)},{page:pageIndex,listKey:'routes'});}
    const query=new URLSearchParams();if(args.type)query.set('type',args.type);if(args.location)query.set('location',args.location.join(','));const data=await get(`/api/facilities/nearby?${query}`);return paginate({ok:true,source:'project-facility-catalog',distanceType:args.location?'straight-line':'unavailable',coordinateSystem:'GCJ02',facilities:(data.places||[]).map(p=>({id:p.id,name:p.name,location:p.location,distanceMeters:p.distanceMeters??null}))},{page:pageIndex,listKey:'facilities'});
  };
}
