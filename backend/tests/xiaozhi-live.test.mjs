import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once,EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {readFileSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createToolDispatcher,responseBytes,safeToolError} from '../integrations/xiaozhi/mcp-tools.mjs';
import {loadBridgeEnv,decodeFrame,runBridge} from '../integrations/xiaozhi/mcp_pipe.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const delay=ms=>new Promise(r=>setTimeout(r,ms));

test('real API and stdio preserve all routes, narration, unknowns and gate filtering',{timeout:20000},async t=>{
  let base=process.env.QIXIA_TEST_API_BASE;
  if(!base){
    const server=spawn(process.execPath,[resolve(root,'backend/src/server.mjs')],{env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
    t.after(()=>server.kill());
    base=await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('API startup timeout')),5000);server.stdout.on('data',d=>{const m=String(d).match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);res('http://127.0.0.1:'+m[1]);}});server.on('error',rej);});
  }
  const dispatch=createToolDispatcher({apiBase:base});
  async function all(name,args,key){let page=0,values=[];for(let i=0;i<30;i++){const p=await dispatch(name,{...args,page});assert.ok(responseBytes('test-id',p)<=1024);values.push(p[key]);if(p.nextPage===null)return values;assert.ok(p.nextPage>page);page=p.nextPage;}throw Error('pagination did not terminate');}
  const catalog=(await all('qixia.get_route_catalog',{},'routes')).flat();
  assert.equal(catalog.length,8);assert.equal(new Set(catalog.map(r=>r.routeId)).size,8);assert.ok(catalog.find(r=>r.routeId==='R02').navigationReady);
  const west=(await all('qixia.recommend_routes',{entryGate:'west',duration:'half',intensity:'easy',companions:'none'},'routes')).flat();
  const south=(await all('qixia.recommend_routes',{entryGate:'south',duration:'half',intensity:'easy',companions:'none'},'routes')).flat();
  assert.deepEqual(west.map(r=>r.routeId),['R01','R02']);assert.deepEqual(south.map(r=>r.routeId),['R04']);
  assert.equal((await dispatch('qixia.recommend_routes',{entryGate:'west',duration:'full',intensity:'normal'})).status,'unverified');
  const full=await (await fetch(base+'/api/knowledge/pois/mirror-lake')).json();
  assert.equal((await all('qixia.explain_current_place',{placeId:'mirror-lake'},'narration')).join(''),full.narration);
  assert.equal((await dispatch('qixia.search_knowledge',{query:'火星基地密码是什么'})).unknown,true);
  const facilities=(await all('qixia.get_facilities_nearby',{type:'厕所'},'facilities')).flat();assert.equal(facilities.length,6);assert.ok(facilities.every(p=>p.distanceMeters===null));
  await assert.rejects(dispatch('qixia.explain_current_place',{placeId:'missing-place'}),{code:'not_found'});
  const child=spawn(process.execPath,[resolve(root,'backend/integrations/xiaozhi/mcp-stdio-server.mjs')],{env:{...process.env,QIXIA_API_BASE_URL:base},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
  child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'qixia.explain_current_place',arguments:{placeId:'mirror-lake'}}})+'\n');
  const [code]=await once(child,'close');assert.equal(code,0);const reply=JSON.parse(stdout.trim());assert.equal(reply.result.isError,false);assert.equal(reply.result.structuredContent,undefined);assert.ok(Buffer.byteLength(stdout.trim())<=1024);assert.match(stderr,/tool_call/);assert.doesNotMatch(stderr,/mirror-lake/);
});

test('strict inputs and errors do not expose upstream messages',async()=>{
  const d=createToolDispatcher({fetcher:()=>{throw Error('token=SECRET');}});
  for(const args of [null,[],{query:5},{query:'x',location:[1]},{query:'x',location:[200,90]},{query:'x',page:-1},{query:'x',privateToken:'SECRET'}])await assert.rejects(d('qixia.search_knowledge',args),{code:'invalid_arguments'});
  try{await d('qixia.search_knowledge',{query:'x'});assert.fail();}catch(e){assert.doesNotMatch(JSON.stringify(safeToolError(e)),/SECRET/);}
  const invalid=createToolDispatcher({fetcher:async()=>new Response('not json')});await assert.rejects(invalid('qixia.get_route_catalog',{}),{code:'invalid_upstream'});
  const slow=createToolDispatcher({timeoutMs:10,fetcher:async(_url,{signal})=>{await once(signal,'abort');throw signal.reason;}});
  const keepAlive=setTimeout(()=>{},100);try{await assert.rejects(slow('qixia.get_route_catalog',{}),{code:'upstream_unavailable'});}finally{clearTimeout(keepAlive);}
});

test('environment file propagates API address with runtime precedence; WSS framing validates',()=>{
  const folder=resolve(root,'.local-work/mcp-env-test-'+process.pid);mkdirSync(folder,{recursive:true});
  try{writeFileSync(resolve(folder,'.env.local'),'MCP_ENDPOINT=wss://example.invalid/?token=test\nQIXIA_API_BASE_URL=http://127.0.0.1:19999\nAMAP_SERVER_KEY=not-inherited\n');const env=loadBridgeEnv({},folder);assert.equal(env.QIXIA_API_BASE_URL,'http://127.0.0.1:19999');assert.equal(env.AMAP_SERVER_KEY,undefined);assert.equal(loadBridgeEnv({QIXIA_API_BASE_URL:'http://127.0.0.1:18787'},folder).QIXIA_API_BASE_URL,'http://127.0.0.1:18787');}finally{rmSync(folder,{recursive:true,force:true});}
  const frame=JSON.stringify({jsonrpc:'2.0',id:1,method:'ping'});assert.equal(decodeFrame(new TextEncoder().encode(frame)),frame+'\n');for(const bad of ['not json','[]','{}'])assert.throws(()=>decodeFrame(bad));
});

test('bridge disconnect exits for supervisor recovery and kills subprocess',{timeout:5000},async()=>{
  let socket,childEnv,exitCode;
  class Socket extends EventTarget {constructor(){super();socket=this;this.readyState=1;}send(){}close(){}}
  const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.exitCode=null;child.kill=()=>{child.exitCode=0;queueMicrotask(()=>child.emit('exit',0));};
  runBridge({env:{MCP_ENDPOINT:'wss://example.invalid/?token=test',QIXIA_API_BASE_URL:'http://127.0.0.1:18787'},command:['node','test'],WebSocketClass:Socket,spawnChild:(_c,_a,o)=>{childEnv=o.env;return child;},exit:code=>exitCode=code});
  socket.dispatchEvent(new Event('open'));socket.dispatchEvent(new Event('close'));await delay(10);assert.equal(exitCode,1);assert.equal(childEnv.MCP_ENDPOINT,undefined);assert.equal(childEnv.QIXIA_API_BASE_URL,'http://127.0.0.1:18787');
});
