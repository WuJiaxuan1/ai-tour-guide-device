import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createKnowledgeService} from '../src/knowledge.mjs';
import {createPresetService} from '../src/presets.mjs';
import {createConversationService,parseMinutes} from '../src/conversation.mjs';
import {customRoute,matchPresets} from '../../shared/routes.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const catalog=[...read('../../frontend/src/content/places.json'),...read('../../frontend/src/content/facilities.json')];
const presets=createPresetService(root,catalog),knowledge=createKnowledgeService(root,catalog),answer=createConversationService(knowledge,presets,catalog);
const user=content=>({role:'user',content});
test('official data preserves eight routes, eleven observed filter cases and eight directional shuttles',()=>{
 assert.equal(presets.data.routes.length,8);assert.equal(presets.data.rules.length,11);
 assert.equal(presets.shuttles.lines.filter(l=>l.scope==='internal').length,6);assert.equal(presets.shuttles.lines.filter(l=>l.scope==='external').length,2);
 for(const r of presets.data.routes){if(r.navigationReady)assert.ok(r.geometry.coordinates.length>2);assert.equal(new Set(r.stops.map(s=>s.stopId)).size,r.stops.length);}
 const r5=presets.data.routes.find(r=>r.routeId==='R05'),r6=presets.data.routes.find(r=>r.routeId==='R06');
 assert.equal(r5.officialNodeCount,7);assert.equal(r5.uniqueNodeCount,6);assert.equal(r5.countDiscrepancy,true);assert.equal(r6.completeness,'missing_exit');
});
test('companion effort override uses approved easy rules while unknown combinations stay unknown',()=>{
 assert.deepEqual(presets.match({gate:'west',duration:'half',intensity:'normal',companions:'senior'}).routes.map(r=>r.routeId),['R01','R02']);
 assert.deepEqual(presets.match({gate:'west',duration:'half',intensity:'energetic',companions:['senior','child']}).routes.map(r=>r.routeId),['R01','R02']);
 assert.deepEqual(presets.match({gate:null,duration:null,intensity:null,companions:null}).routes.map(r=>r.routeId),['R03','R05','R06']);
 assert.deepEqual(presets.match({gate:'south',duration:'half',intensity:'easy',companions:['none']}).routes.map(r=>r.routeId),['R04']);
 assert.deepEqual(presets.match({gate:'south',duration:null,intensity:null,companions:null}).routes.map(r=>r.routeId),['R05','R06']);
 assert.equal(presets.match({gate:'west',duration:'full',intensity:'normal',companions:'senior'}).status,'unverified');
 assert.equal(matchPresets(null,presets.data).status,'invalid');
});
test('chat resolves pronouns, retains sources and never claims a generative model',async()=>{
 const a=await answer({messages:[user('讲讲彩虹明镜')]});
 const b=await answer({messages:[user('讲讲彩虹明镜'),{role:'assistant',content:a.reply},user('它还有什么历史故事')],context:a.context});
 assert.deepEqual(b.placeIds,['mirror-lake']);assert.deepEqual(b.sourceIds,['mirror-lake']);assert.equal(b.mode,'knowledge');
 assert.match(b.reply,/明镜/);
});
test('latest topic wins over stale metadata and ambiguous references ask for clarification',async()=>{
 const b=await answer({messages:[user('讲讲明镜湖'),user('讲讲栖霞寺'),user('它有什么特点')],context:{currentPlaceId:'mirror-lake'}});
 assert.deepEqual(b.placeIds,['temple']);
 const c=await answer({messages:[user('讲讲明镜湖和栖霞寺'),user('它有什么特点')]});
 assert.equal(c.unknown,true);assert.deepEqual(c.placeIds,[]);
});
test('route filters can be completed and changed over multiple turns',async()=>{
 const messages=[user('帮我规划路线')];const a=await answer({messages});messages.push({role:'assistant',content:a.reply},user('西门，半日'));
 const b=await answer({messages,context:a.context});messages.push({role:'assistant',content:b.reply},user('轻松休闲'));
 const c=await answer({messages,context:b.context});assert.deepEqual(c.routeIds,['R01','R02']);
 messages.push({role:'assistant',content:c.reply},user('改成南门'));const d=await answer({messages,context:c.context});assert.deepEqual(d.routeIds,['R04']);
});
test('time and preferences survive history; dynamic facts and Xiaozhi remain bounded',async()=>{
 assert.equal(parseMinutes('两小时'),120);assert.equal(parseMinutes('半小时'),30);assert.equal(parseMinutes('2小时半'),150);
 assert.equal(parseMinutes('二十五分钟'),25);assert.equal(parseMinutes('一小时三十分钟'),90);assert.equal(parseMinutes('0分钟'),0);
 const a=await answer({messages:[user('只有两小时，想轻松拍照'),user('推荐几个地方')]});assert.equal(a.context.preferences.availableMinutes,120);assert.equal(a.context.preferences.effort,'low');assert.match(a.context.preferences.interests,/拍照/);
 assert.match((await answer({messages:[user('今天红叶红了吗')]})).reply,/没有已确认/);
 assert.match((await answer({messages:[user('小智接通了吗')]})).reply,/尚未打通/);
 assert.match((await answer({messages:[user('同步到手表')]})).reply,/我的路线/);
 for(const input of [null,{}, {messages:[null]},{messages:[{role:'system',content:'x'}]},{messages:[user(' ')]}])await assert.rejects(answer(input),{status:400});
});
test('custom ordering is deterministic, directed, occurrence-based and requires verified geometry',()=>{
 const nodes=['g','a','b'].map((id,i)=>({id,name:id,location:[118.96+i*.001,32.15]}));
 const edges=nodes.flatMap(a=>nodes.filter(b=>a!==b).map(b=>({fromId:a.id,toId:b.id,verified:true,walkable:true,distanceMeters:100,walkingSeconds:120,geometry:{type:'LineString',coordinates:[a.location,b.location]}})));
 const matrix={version:'test',coordinateSystem:'GCJ02',coordinateOrder:'lng,lat',edges};
 const a=customRoute({stopIds:['b','a'],entryId:'g',exitId:'g'},nodes,matrix),b=customRoute({stopIds:['a','b'],entryId:'g',exitId:'g'},nodes,matrix);
 assert.deepEqual(a,b);assert.equal(a.status,'ready');assert.deepEqual(a.route.stops.map(s=>s.id),['g','a','b','g']);assert.equal(new Set(a.route.stops.map(s=>s.stopId)).size,4);
 assert.equal(customRoute({stopIds:['a'],entryId:'g',exitId:'g'},nodes,{...matrix,edges:edges.slice(1)}).status,'missing_matrix');
 assert.equal(customRoute({stopIds:['a'],entryId:'g',exitId:'g'},nodes,{...matrix,coordinateSystem:'WGS84'}).status,'missing_matrix');
 assert.equal(customRoute(null,nodes,matrix).status,'invalid');
});
