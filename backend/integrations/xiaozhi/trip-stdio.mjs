// JSON-line stdio server for the existing Xiaozhi MCP pipe. Diagnostics never go to stdout.
import readline from 'node:readline';
import {createTripTools} from './trip-tools.mjs';
import {createBridgeTools} from './bridge-tools.mjs';
const tools=process.env.QIXIA_MCP_SECRET?createBridgeTools({baseUrl:process.env.QIXIA_API_BASE||'http://127.0.0.1:8787',secret:process.env.QIXIA_MCP_SECRET}):createTripTools({baseUrl:process.env.QIXIA_API_BASE||'http://127.0.0.1:8787',token:process.env.QIXIA_DEVICE_TOKEN,tripId:process.env.QIXIA_TRIP_ID});
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
let pending=0;
const write=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function handle(line){
 let message;try{if(Buffer.byteLength(line)>65536)throw Error();message=JSON.parse(line);if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string')throw Error();}catch{write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON-RPC'}});return;}
 if(!Object.hasOwn(message,'id'))return;
 if(message.method==='tools/call'&&pending>=4){write({jsonrpc:'2.0',id:message.id,error:{code:-32000,message:'Too many pending tool calls'}});return;}
 const isCall=message.method==='tools/call',started=Date.now();if(isCall)pending++;
 let result,error;try{
  if(message.method==='initialize'){console.error(JSON.stringify({event:'initialize'}));result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'qixia-trip',version:'1.0.0'}};}
  else if(message.method==='ping')result={};
  else if(message.method==='tools/list'){console.error(JSON.stringify({event:'tools_list',count:tools.definitions.length}));result={tools:tools.definitions};}
  else if(message.method==='tools/call'){try{const value=await tools.call(message.params?.name,message.params?.arguments);result={content:[{type:'text',text:JSON.stringify(value)}],isError:false};}catch(e){result={content:[{type:'text',text:e.message}],isError:true};}}
  else error={code:-32601,message:'Method not found'};
 }catch{error={code:-32603,message:'Internal error'};}
 if(isCall){pending--;console.error(JSON.stringify({event:'tool_call',tool:tools.definitions.some(t=>t.name===message.params?.name)?message.params.name:'unknown',ok:!error&&!result?.isError,elapsed_ms:Date.now()-started}));}
 write({jsonrpc:'2.0',id:message.id,...(error?{error}:{result})});
}
lines.on('line',line=>{if(line.trim())handle(line).catch(()=>write({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Internal error'}}));});
