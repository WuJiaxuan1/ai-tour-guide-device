import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';

const base='http://127.0.0.1:5174';
const checks=[];
let token,trip;
async function request(path,method='GET',body,auth=true) {
  const res=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth&&token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await res.json();
  assert.ok(res.ok,`${method} ${path}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}
try {
  const html=await fetch(base).then(r=>r.text());assert.ok(html.includes('root'));checks.push('Vite page');
  const health=await request('/api/health');assert.equal(health.ok,true);assert.equal(typeof health.mapConfigured,'boolean');checks.push('same-origin backend proxy, map configuration status reported');
  const session=await request('/api/v1/sessions','POST',{});token=session.token;assert.ok(token);checks.push('private local session');
  const capabilities=await request('/api/v1/capabilities');assert.equal(capabilities.knowledge.version,'qixia-deepseek-v2.1');assert.equal(capabilities.text_model_configured,false);checks.push('knowledge v2.1, model honestly unconfigured');
  const preferences={entrance_id:'west',exit_id:'west',duration:'half_day',intensity:'easy',has_elderly:false,has_children:false};
  const recommendation=await request('/api/v1/planner/recommend','POST',preferences);
  const route=recommendation.routes.find(r=>r.route_id==='R02');assert.ok(route);checks.push('preset recommendation');
  trip=await request('/api/v1/trips','POST',{client_event_id:randomUUID(),preferences,route_id:route.route_id,revision:route.revision});assert.equal(trip.status,'planned');checks.push('create and persist planned trip');
  for(const [action,status] of [['start','active'],['pause','paused'],['resume','active'],['complete','completed']]) {
    trip=await request(`/api/v1/trips/${trip.id}/commands`,'POST',{client_event_id:randomUUID(),expected_version:trip.version,action});
    assert.equal(trip.status,status);checks.push(`trip ${action}`);
  }
  const events=await request(`/api/v1/trips/${trip.id}/events`);assert.ok(events.events.length>=5);checks.push('ordered persistent trip events');
  const answer=await request('/api/v1/chat','POST',{client_event_id:randomUUID(),conversation_id:'local-smoke',question:'舍利塔是木塔还是石塔'});
  assert.ok(JSON.stringify(answer).includes('石'));checks.push('bounded knowledge answer without model key');
  const history=await request('/api/v1/trips');assert.ok(history.trips.some(t=>t.id===trip.id));checks.push('local trip history');
} finally {
  if(trip?.id) {await request(`/api/v1/trips/${trip.id}`,'DELETE',{expected_version:trip.version});checks.push('only this synthetic test trip cleaned up');}
}
writeFileSync(new URL('./smoke-results.json',import.meta.url),JSON.stringify({passed:checks.length,checks},null,2)+'\n');
console.log(`PASS: ${checks.length} local HTTP checks through Vite`);
for(const check of checks)console.log(`- ${check}`);
