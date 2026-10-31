import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {runBridge} from '../integrations/xiaozhi/mcp_pipe.mjs';
test('bridge keeps idle connection alive, consumes its own ping response and forwards platform requests',async()=>{
 let socket,exited;const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.exitCode=null;child.kill=()=>{child.exitCode=0;child.emit('exit',0);};let input='';child.stdin.on('data',d=>input+=d);
 class FakeSocket{constructor(){socket=this;this.readyState=1;this.events={};this.sent=[];}addEventListener(name,fn){this.events[name]=fn;}send(data){this.sent.push(data);}close(){}}
 const bridge=runBridge({env:{MCP_ENDPOINT:'wss://example.test/?token=private-test'},command:['node','test'],WebSocketClass:FakeSocket,spawnChild:()=>child,exit:c=>exited=c,heartbeatMs:10});
 try{socket.events.open();await new Promise(r=>setTimeout(r,25));const ping=socket.sent.map(s=>JSON.parse(s)).find(s=>s.method==='ping');assert.ok(ping);socket.events.message({data:JSON.stringify({jsonrpc:'2.0',id:ping.id,result:{}})});assert.equal(input,'');socket.events.message({data:JSON.stringify({jsonrpc:'2.0',id:'cloud-ping',method:'ping'})});assert.match(input,/cloud-ping/);}finally{bridge.stop();child.stdout.end();child.stdin.end();}assert.equal(exited,0);
});
