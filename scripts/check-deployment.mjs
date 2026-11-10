// Read-only smoke check. Never prints configuration values or creates/binds trips.
import assert from 'node:assert/strict';
const base=new URL(process.argv[2]||'http://127.0.0.1:8787');
if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw Error('Use a plain HTTP(S) server origin');
async function request(path){const r=await fetch(new URL(path,base),{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200,`Unexpected status for ${path}`);return r;}
try{
 await (await request('/api/health')).json();console.log('PASS API health');
 const html=await (await request('/')).text();assert.match(html,/<div[^>]+id=["']root["']/);console.log('PASS built webpage');
 const script=html.match(/<script[^>]+src=["']([^"']+)["']/)?.[1];assert.ok(script,'Missing built JS');const js=await (await request(script)).text();assert.ok(js.length>1000);console.log('PASS built JavaScript');
 const config=await (await request('/api/config')).json();const text=JSON.stringify(config);assert.ok(!/securityJsCode|AMAP_SERVER_KEY|MCP_ENDPOINT|DEEPSEEK_API_KEY/i.test(text),'Unexpected private config field');console.log('PASS public config shape (values hidden)');
 console.log('HTTP smoke passed. Map rendering, phone GPS, voice tools and physical watch still require acceptance.');
}catch(e){console.error('FAIL deployment smoke:',e.code||e.name);process.exitCode=1;}
