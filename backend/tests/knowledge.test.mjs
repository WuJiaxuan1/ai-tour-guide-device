import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadKnowledge,createKnowledgeService} from '../src/knowledge.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const catalog=[...read('../../frontend/src/content/places.json'),...read('../../frontend/src/content/facilities.json')];
const kb=loadKnowledge(root), service=createKnowledgeService(root,catalog);
test('public knowledge projection contains 29 POIs without inventing navigation availability or exposing source paths',()=>{
 assert.equal(kb.pois.length,29);assert.equal(new Set(kb.pois.map(p=>p.id)).size,29);
 for(const p of kb.pois){assert.equal(p.narration,kb.records.find(x=>x.library_id==='KB02'&&kb.canonical(x.id)===p.id).content);assert.ok(p.narration.trim());}
 assert.equal(kb.canonical('west-gate'),'gate');assert.equal(kb.canonical('tea-house'),'tea');assert.equal(kb.canonical('spring-rain-bridge'),'spring-bridge');
 assert.equal(kb.records.length,213);assert.equal(kb.retrieval.length,159);assert.equal(kb.version,'qixia-deepseek-v2.1');
 assert.equal(/sourceRefs|verificationStatus|\/Users\/|verification_backlog|双人/.test(JSON.stringify(service.catalog)),false);
});
test('alias questions return grounded narration, dynamic information is never answered as confirmed',()=>{
 const p=service.publicPoi('mirror-lake');const a=service.chat('给我讲讲彩虹明镜的故事');assert.ok(a.reply.includes(p.narration));assert.ok(a.placeIds.includes('mirror-lake'));assert.equal(a.mode,'knowledge');
 assert.match(service.chat('明镜湖今天开放吗').reply,/当日公告/);
 assert.match(service.chat('现在能看到红叶吗').reply,/没有已确认/);
 assert.deepEqual(service.chat('总统是谁').placeIds,[]);
});
test('facility ranking requires a valid location and returns only concrete existing destinations',()=>{
 for(const loc of [undefined,[118.96,32.15],[999,32],['x',1]]){
  const result=service.facilitiesNearby({location:loc,type:'厕所'});assert.ok(result.length>0);
  assert.ok(result.every(p=>catalog.some(c=>c.id===p.id&&c.kind==='facility')));
  if(loc?.[0]===118.96){assert.ok(result.every(p=>Number.isFinite(p.distanceMeters)));assert.deepEqual(result.map(p=>p.distanceMeters),result.map(p=>p.distanceMeters).sort((a,b)=>a-b));}
  else assert.ok(result.every(p=>p.distanceMeters===null));
 }
 assert.doesNotMatch(service.chat('附近厕所',{location:[999,32]}).reply,/已按直线距离/);
});
test('preference recommendations select known POIs without silently activating candidate routes',()=>{
 const culture=service.recommend({interests:'历史文化',availableMinutes:180});assert.ok(culture.placeIds.includes('mingzheng-stele'));assert.equal(culture.routeReady,false);assert.equal('geometry' in culture,false);
 const easy=service.recommend({interests:'秋天',effort:'low'});assert.ok(easy.placeIds.includes('bell-drum-tower'));assert.ok(!easy.placeIds.includes('autumn'));assert.ok(!easy.placeIds.includes('taixu'));
});

test('visitor-service and ticket queries resolve actual facility categories and entrances include west gate',()=>{assert.ok(service.facilitiesNearby({type:'游客中心'}).length);assert.ok(service.facilitiesNearby({type:'售票处'}).length);assert.ok(service.facilitiesNearby({type:'出入口'}).some(p=>p.id==='gate'));});

test('new content corrects pagoda material and resolves complete facility names before scenic aliases',()=>{
 assert.match(service.publicPoi('pagoda').narration,/石/);
 assert.doesNotMatch(service.publicPoi('pagoda').narration,/木制/);
 const restroom=service.chat('千佛崖卫生间在哪');assert.match(restroom.reply,/卫生间/);assert.doesNotMatch(restroom.reply,/佛像|石窟/);assert.equal(restroom.placeIds.includes('buddha'),false);
 assert.match(service.chat('陆羽是谁').reply,/陆羽/);
 const hotel=service.chat('附近有哪些酒店');assert.match(hotel.reply,/2026-10-27/);assert.match(hotel.reply,/不保证当前/);
 assert.match(service.chat('观光车末班几点').reply,/没有已确认/);
});
test('model receives the complete new pack once, and public cards do not gain unverified navigation',()=>{
 const evidence=service.modelEvidence({question:'介绍舍利塔'});
 assert.equal(evidence.context,kb.fullContext);assert.equal(evidence.instructions,kb.instructions);
 assert.deepEqual(evidence.sourceIds,['knowledge-pack:qixia-deepseek-v2.1']);
 assert.ok(evidence.context.includes('陆羽'));assert.ok(evidence.context.includes('千佛崖卫生间'));
 assert.ok(service.publicPoi('shamao-peak'));assert.equal('location' in service.publicPoi('shamao-peak'),false);
 assert.ok(evidence.placeIds.every(id=>catalog.some(c=>c.id===id)));
});
