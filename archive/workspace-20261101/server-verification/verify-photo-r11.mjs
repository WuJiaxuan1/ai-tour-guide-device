import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {inspectTransparentPNG} from '../backend/src/travel/png.mjs';
const sharp=createRequire(new URL('../backend/package.json',import.meta.url))('sharp');
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788',checks=[];
const check=name=>checks.push(name);
const page=await fetch(base+'/');assert.equal(page.status,200);assert.ok((await page.text()).includes('index-DwVh9WWD.js'));check('new_frontend_bundle');
assert.equal((await(await fetch(base+'/api/health')).json()).ok,true);check('backend_health');
const session=await(await fetch(base+'/api/v1/sessions',{method:'POST'})).json(),foreign=await(await fetch(base+'/api/v1/sessions',{method:'POST'})).json();
const call=async(path,{method='GET',body,bytes,token=session.token,event}={})=>{const r=await fetch(base+'/api/v1'+path,{method,headers:{Authorization:'Bearer '+token,...(bytes?{'Content-Type':'image/jpeg','X-Client-Event-Id':event}:body?{'Content-Type':'application/json'}:{})},body:bytes||body&&JSON.stringify(body)});return{status:r.status,value:await r.json()};};
const getAsset=async(id,kind)=>{const r=await fetch(`${base}/api/v1/photos/${id}/assets/${kind}`,{headers:{Authorization:'Bearer '+session.token}});assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/private.*no-store/);return Buffer.from(await r.arrayBuffer());};
const cap=(await call('/capabilities')).value;assert.equal(cap.photo_craft_independent,true);assert.equal(cap.photo_craft_mode,'photo_layout');check('independent_capability');
assert.deepEqual((await call('/photos')).value.photos,[]);check('empty_independent_gallery');
assert.equal((await call('/photos',{method:'POST',bytes:Buffer.from('invalid'),event:randomUUID()})).status,422);check('corrupt_upload_rejected');
const creations=[];let scenic;
try{
 const a=await sharp('frontend/dist/client/assets/temple.jpg').resize({width:600}).jpeg().toBuffer();scenic=a;
 const b=await sharp({create:{width:8192,height:5464,channels:3,background:'#387fa6'}}).jpeg().toBuffer();
 for(const bytes of [a,b]){const event=randomUUID(),p=await call('/photos',{method:'POST',bytes,event});assert.equal(p.status,201);creations.push(p.value.id);assert.equal((await call('/photos',{method:'POST',bytes,event})).value.id,p.value.id);}
 check('two_real_uploads_and_idempotency');
 assert.equal((await call('/photos/'+creations[1])).value.source.width,8192);assert.equal((await call('/photos/'+creations[1])).value.source.height,5464);check('camera_45MP_upload_accepted');
 assert.equal((await call('/photos/'+creations[0],{token:foreign.token})).status,404);const denied=await fetch(`${base}/api/v1/photos/${creations[0]}/assets/original`,{headers:{Authorization:'Bearer '+foreign.token}});assert.equal(denied.status,404);check('owner_isolation');
 for(const id of creations){const input={title:'栖霞 · 照片验收',caption:'山林与古寺，把这一刻带回家。'};assert.equal((await call(`/photos/${id}/generate`,{method:'POST',body:input})).status,202);assert.equal((await call(`/photos/${id}/generate`,{method:'POST',body:input})).status,202);}
 for(let i=0;i<120;i++){const ps=await Promise.all(creations.map(id=>call('/photos/'+id)));assert.ok(ps.every(p=>p.value.status!=='failed'),JSON.stringify(ps.map(p=>p.value.error)));if(ps.every(p=>p.value.status==='succeeded'))break;assert.ok(i<119,'Generation timed out');await new Promise(r=>setTimeout(r,500));}check('async_generation_completed');
 const outputs=await Promise.all(creations.map(async id=>({card:await getAsset(id,'memory_card'),sticker:await getAsset(id,'transparent_stickers')})));
 assert.notEqual(createHash('sha256').update(outputs[0].card).digest('hex'),createHash('sha256').update(outputs[1].card).digest('hex'));assert.notDeepEqual(outputs[0].sticker,outputs[1].sticker);check('input_dependent_outputs');
 for(const o of outputs){assert.deepEqual(inspectTransparentPNG(o.sticker).corner_alpha,[0,0,0,0]);const meta=await sharp(o.card).metadata();assert.equal(meta.width,1200);assert.equal(meta.exif,undefined);}check('valid_png_alpha_and_metadata');
 writeFileSync('.local-work/photo-linux-card.png',outputs[0].card);writeFileSync('.local-work/photo-linux-sticker.png',outputs[0].sticker);
 assert.equal((await call('/photos')).value.photos.length,2);check('gallery_reopening');
 assert.deepEqual((await call('/trips')).value.trips,[]);check('no_trip_required_or_created');
}finally{
 for(const id of creations){const p=(await call('/photos/'+id)).value;assert.ok(!['running','queued'].includes(p.status));assert.equal((await call('/photos/'+id,{method:'DELETE',body:{expected_version:p.version}})).value.deleted,true);}
}
assert.deepEqual((await call('/photos')).value.photos,[]);check('delete_works');
for(const id of creations)assert.equal((await call('/photos/'+id)).status,404);check('deleted_files_inaccessible');
assert.equal(checks.length,15);const receipt={at:new Date().toISOString(),base,checks};writeFileSync('.local-work/photo-acceptance.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));

