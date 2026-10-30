import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadKnowledge,createKnowledgeService} from '../src/knowledge.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const catalog=[...read('../../frontend/src/content/places.json'),...read('../../frontend/src/content/facilities.json')];
const kb=loadKnowledge(root), service=createKnowledgeService(root,catalog);
test('public knowledge projection contains twelve mapped POIs without source paths or maintenance metadata',()=>{
 assert.equal(kb.pois.length,12);assert.equal(new Set(kb.pois.map(p=>p.id)).size,12);
 for(const p of kb.pois){assert.ok(catalog.find(c=>c.id===p.id&&c.navigationAvailable));assert.ok(p.narration.length>20);}
 assert.equal(kb.canonical('west-gate'),'gate');
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
