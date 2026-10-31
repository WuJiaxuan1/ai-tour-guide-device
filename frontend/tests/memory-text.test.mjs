import test from 'node:test';
import assert from 'node:assert/strict';
import {memoryDuration,memoryText} from '../src/services/memory-text.mjs';
test('memory durations keep sub-minute and pause distinctions',()=>{
 assert.equal(memoryDuration(45),'不足1分钟');assert.equal(memoryDuration(61),'1分钟1秒');assert.equal(memoryDuration(0),'0分钟');
 assert.match(memoryText({facts:{elapsed_seconds:3600,active_seconds:3000}}),/暂停：10分钟/);
});
test('download includes source facts, raw notes, immersive choices and snapshot staleness',()=>{
 const value=memoryText({facts:{planned_route_name:'湖边路线',confirmed_attraction_count:1,confirmed_attraction_names:['明镜湖'],elapsed_seconds:120,paused_seconds:60,active_seconds:60,interaction_count:2,interaction_channels:{web:1,device:1},immersive_experiences:[{title:'山中一生',completed:true,choices:['安置书卷']}]},summary:'游览明镜湖。',notes:[{source:'device',text:'我最喜欢明镜湖'}],summary_stale:true});
 assert.match(value,/总用时：2分钟；活动用时：1分钟；暂停：1分钟/);assert.match(value,/小智：我最喜欢明镜湖/);assert.match(value,/选择：安置书卷/);assert.match(value,/尚未更新/);assert.match(value,/不等于实地到访/);
});
