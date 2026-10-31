import readline from 'node:readline';
import {createToolDispatcher,tools,callResponse,responseBytes,MAX_CALL_BYTES,safeToolError} from './mcp-tools.mjs';
const dispatch=createToolDispatcher({apiBase:process.env.QIXIA_API_BASE_URL});
const write=value=>process.stdout.write(JSON.stringify(value)+'\n');
const error=(id,code,message)=>write({jsonrpc:'2.0',id,error:{code,message}});
const audit=(event,details={})=>console.error(JSON.stringify({event,...details}));
let pending=0;
async function handle(message){
  const id=message?.id;
  if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')return error(null,-32600,'请求格式不正确。');
  if(id===undefined)return;
  if(!((typeof id==='string'&&id.length<=80)||(typeof id==='number'&&Number.isSafeInteger(id))))return error(null,-32600,'请求ID格式不正确。');
  if(message.method==='initialize'){
    audit('initialize');
    return write({jsonrpc:'2.0',id,result:{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'qixia-mcp',version:'0.5.1'}}});
  }
  if(message.method==='ping')return write({jsonrpc:'2.0',id,result:{}});
  if(message.method==='tools/list'){audit('tools_list',{count:tools.length});return write({jsonrpc:'2.0',id,result:{tools}});}
  if(message.method!=='tools/call')return error(id,-32601,'不支持的方法。');
  const name=message.params?.name,started=Date.now();let payload;
  try{
    payload=await dispatch(name,message.params?.arguments??{});
    if(responseBytes(id,payload)>MAX_CALL_BYTES)payload={ok:false,code:'result_too_large',error:'请求标识或结果过长。'};
  }catch(e){payload=safeToolError(e);}
  audit('tool_call',{tool:tools.some(t=>t.name===name)?name:'unknown',outcome:payload.ok===false?'failure':'success',code:payload.code||null,elapsedMs:Date.now()-started});
  write(callResponse(id,payload));
}
const rl=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
rl.on('line',line=>{
  if(!line.trim())return;
  if(Buffer.byteLength(line)>32768)return error(null,-32600,'请求过长。');
  let message;try{message=JSON.parse(line);}catch{return error(null,-32700,'无法解析请求。');}
  if(pending>=8)return error(null,-32000,'请求较多，请稍后重试。');
  pending++;handle(message).catch(()=>error(null,-32603,'工具服务错误。')).finally(()=>{pending--;});
});
// Let pending fetches and stdout drain naturally after stdin EOF.
