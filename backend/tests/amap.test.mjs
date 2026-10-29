import test from 'node:test';
import assert from 'node:assert/strict';
import {amapRequest,decodePolyline,mergeLegs} from '../src/amap.mjs';

test('provider failure cannot become a fabricated route',async()=>{
  await assert.rejects(()=>amapRequest('/v3/place/text',{},''),/尚未配置/);
  await assert.rejects(()=>amapRequest('/v3/place/text',{},'test-key',{fetcher:async()=>Response.json({status:'0',info:'INVALID_USER_KEY'})}),/未通过/);
  await assert.rejects(()=>amapRequest('/v3/place/text',{},'test-key',{fetcher:async()=>{throw Error('network');}}),/连接超时/);
});
test('polyline parser enforces coordinate order and finite points',()=>{
  assert.deepEqual(decodePolyline('118.96,32.15;118.961,32.151'),[[118.96,32.15],[118.961,32.151]]);
  for(const value of ['32.15,118.96','NaN,32.15','118.96',''])assert.throws(()=>decodePolyline(value));
});
test('route merger preserves real provider geometry, sums distance/time, and rejects incomplete results',()=>{
  const path={distance:'110',duration:'90',steps:[{distance:'110',duration:'90',instruction:'沿步行道前行',polyline:'118.96,32.15;118.961,32.151'}]};
  const result=mergeLegs([path,path],[{id:'test'}],'test-route');
  assert.equal(result.distanceMeters,220);assert.equal(result.walkingSeconds,180);assert.equal(result.source.provider,'amap');assert.equal(result.coordinateSystem,'GCJ02');
  assert.throws(()=>mergeLegs([{distance:100,duration:50,steps:[]}],[],'invalid'),/不完整/);
});
