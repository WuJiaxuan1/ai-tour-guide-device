import test from 'node:test';
import assert from 'node:assert/strict';
import {tourPresentation} from '../src/services/tour-presentation.mjs';

test('missing GPS shows one actionable explanation instead of repeated metric errors',()=>{
 const nav={location:{freshness:'unavailable'},next_stop:{name:'栖霞寺'},guidance:{location:'需要定位',next_leg:'需要定位，无法估算',remaining:'需要定位，无法估算',off_route:'需要定位，无法判断'}};
 assert.deepEqual(tourPresentation(nav,'active','请开启定位权限'),{location:'请开启定位权限',messages:[],paused:false});
});
test('pause hides old estimates and shows one pause notice',()=>{
 const nav={location:{freshness:'fresh'},next_stop:{},guidance:{location:'旧位置',next_leg:'旧距离',remaining:'旧时间'},off_route:{status:'suspected'}};
 const result=tourPresentation(nav,'paused');assert.equal(result.paused,true);assert.deepEqual(result.messages,[]);assert.match(result.location,/恢复/);
});
test('fresh navigation deduplicates unavailable estimates and retains actionable off-route notice',()=>{
 const nav={location:{freshness:'fresh'},next_stop:{},guidance:{location:'当前位置',next_leg:'道路查询中',remaining:'道路查询中',off_route:'可能走偏'},off_route:{status:'suspected'}};
 assert.deepEqual(tourPresentation(nav,'active').messages,['道路查询中','可能走偏']);
 nav.off_route.status='not_detected';assert.deepEqual(tourPresentation(nav,'active').messages,['道路查询中']);
});
