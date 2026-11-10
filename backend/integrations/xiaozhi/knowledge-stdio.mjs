// Local read-only KB tools, independent of trip binding and backend HTTP.
import readline from 'node:readline';
import {createKnowledgeTools} from './knowledge-tools.mjs';
const tools=createKnowledgeTools();
const write=value=>process.stdout.write(JSON.stringify(value)+'\n');
const lines=readline.createInterface({input:process.stdin,crlfDelay:Infinity});
lines.on('line',line=>{
 if(!line.trim())return;
 let m;
 try{if(Buffer.byteLength(line)>65536)throw Error();m=JSON.parse(line);if(!m||m.jsonrpc!=='2.0')throw Error();}
 catch{write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON-RPC'}});return;}
 if(!Object.hasOwn(m,'id'))return;
 if(!m.method)return; // Responses to a peer ping are not requests.
 let result,error;
 if(m.method==='initialize'){
  result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'qixia-local-knowledge',version:'1.0.0'}};
  console.error(JSON.stringify({event:'initialize',knowledgeVersion:'qixia-deepseek-v2.1'}));
 }else if(m.method==='ping')result={};
 else if(m.method==='tools/list'){
  result={tools:tools.definitions};console.error(JSON.stringify({event:'tools_list',count:tools.definitions.length}));
 }else if(m.method==='tools/call'){
  try{result={content:[{type:'text',text:JSON.stringify(tools.call(m.params?.name,m.params?.arguments))}],isError:false};}
  catch(e){result={content:[{type:'text',text:e.message}],isError:true};}
  console.error(JSON.stringify({event:'tool_call',tool:tools.definitions.some(t=>t.name===m.params?.name)?m.params.name:'unknown',ok:!result.isError}));
 }else error={code:-32601,message:'Method not found'};
 write({jsonrpc:'2.0',id:m.id,...(error?{error}:{result})});
});
