import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import sharp from 'sharp';
import {TravelStore} from '../src/travel/store.mjs';
import {createPhotoService} from '../src/travel/photos.mjs';
import {preparePhoto,renderPhoto} from '../src/travel/photo-renderer.mjs';
import {inspectTransparentPNG} from '../src/travel/png.mjs';
const project=fileURLToPath(new URL('../../',import.meta.url));
const input=colour=>sharp({create:{width:100,height:160,channels:3,background:colour}}).jpeg().toBuffer();
const drawing=async args=>renderPhoto({...args,root:project});
function setup(render=drawing,unlink){const root=mkdtempSync(join(tmpdir(),'qixia-photos-')),db=resolve(root,'photos.sqlite');const store=new TravelStore(db),session=store.authenticate(store.createSession().token);return{root,db,store,session,photos:createPhotoService({store,root,render,...(unlink?{unlink}:{})}),async close(){await this.photos.close();this.store.close();rmSync(root,{recursive:true,force:true});}};}
test('actual photos yield distinct cards and truly transparent stickers; Chinese text, markup and orientation render',async()=>{
 const red=await input('red'),blue=await input('blue'),args={mime:'image/jpeg',title:'栖霞寺 <秋> & 回忆',caption:'最喜欢这一刻的安静。'.repeat(5),created_at:'2026-10-31T09:00:00Z',root:project};
 const a=await renderPhoto({...args,bytes:red}),b=await renderPhoto({...args,bytes:blue});assert.notDeepEqual(a.memory_card,b.memory_card);assert.notDeepEqual(a.transparent_stickers,b.transparent_stickers);
 assert.deepEqual(inspectTransparentPNG(a.transparent_stickers).corner_alpha,[0,0,0,0]);const meta=await sharp(a.memory_card).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,1600);assert.equal(meta.exif,undefined);
 const oriented=await sharp(red).withMetadata({orientation:6}).jpeg().toBuffer(),p=await preparePhoto(oriented,'image/jpeg');assert.equal(p.width,160);assert.equal(p.height,100);
 const pixels=await sharp(a.transparent_stickers).raw().toBuffer();assert.equal(pixels[(500*1000+500)*4],254); // original red photo retained, JPEG quantization allowed
});
test('upload validates decoded pixels, MIME, corruption, limits and format',async()=>{
 await assert.rejects(preparePhoto(Buffer.from('bad'),'image/png'),{code:'INVALID_IMAGE'});
 await assert.rejects(preparePhoto(await input('red'),'image/png'),{code:'INVALID_IMAGE'});
 const gif=await sharp(await input('red')).gif().toBuffer();await assert.rejects(preparePhoto(gif,'image/gif'),{code:'INVALID_IMAGE'});
 await assert.rejects(preparePhoto(Buffer.alloc(8*1024*1024+1),'image/png'),{code:'INVALID_IMAGE'});
 const giant=await sharp({create:{width:8000,height:8000,channels:3,background:'white'}}).png().toBuffer();await assert.rejects(preparePhoto(giant,'image/png'),{code:'PHOTO_PIXEL_LIMIT'});
});
test('independent ownership, upload receipts, generation coalescing and deletion preserve trips and bindings',async()=>{
 const f=setup();try{const bytes=await input('red'),p=await f.photos.upload(f.session,bytes,'image/jpeg','upload-one');assert.equal(f.store.listTrips(f.session).length,0);assert.equal((await f.photos.upload(f.session,bytes,'image/jpeg','upload-one')).id,p.id);
 await assert.rejects(f.photos.upload(f.session,await input('blue'),'image/jpeg','upload-one'),{code:'IDEMPOTENCY_CONFLICT'});
 const other=f.store.authenticate(f.store.createSession().token),device={...f.session,kind:'device'};assert.throws(()=>f.photos.get(other,p.id),{code:'NOT_FOUND'});assert.throws(()=>f.photos.asset(other,p.id,'original'),{code:'NOT_FOUND'});assert.throws(()=>f.photos.list(device),{code:'FORBIDDEN'});await assert.rejects(f.photos.upload(device,bytes,'image/jpeg','device'),{code:'FORBIDDEN'});
 const text={title:'明镜湖',caption:'安静的栖霞山'};f.photos.generate(f.session,p.id,text);assert.equal(f.photos.generate(f.session,p.id,text).id,p.id);assert.throws(()=>f.photos.generate(f.session,p.id,{...text,title:'另一张'}),{code:'PHOTO_BUSY'});await f.photos.drain();
 const done=f.photos.get(f.session,p.id);assert.equal(done.status,'succeeded');assert.equal(done.outputs.length,2);assert.equal('files' in done,false);assert.ok(f.photos.asset(f.session,p.id,'memory_card').bytes.length>100);assert.equal(f.store.listTrips(f.session).length,0);
 assert.throws(()=>f.photos.remove(other,p.id,{expected_version:done.version}),{code:'NOT_FOUND'});assert.throws(()=>f.photos.remove(f.session,p.id,{expected_version:1}),{code:'VERSION_CONFLICT'});f.photos.remove(f.session,p.id,{expected_version:done.version});assert.equal(f.photos.list(f.session).length,0);assert.equal(readdirSync(resolve(f.root,'.local-work/photo-creations')).length,0);await assert.rejects(f.photos.upload(f.session,bytes,'image/jpeg','upload-one'),{code:'PHOTO_DELETED'});
 }finally{await f.close();}
});
test('failed creation is retryable and successful files survive restart',async()=>{
 let fail=true;const f=setup(async args=>{if(fail)throw Error('offline');return drawing(args);});try{
 const p=await f.photos.upload(f.session,await input('blue'),'image/jpeg','restart');const text={title:'旅行记忆',caption:'照片独立保存'};f.photos.generate(f.session,p.id,text);await f.photos.drain();assert.equal(f.photos.get(f.session,p.id).status,'failed');fail=false;f.photos.generate(f.session,p.id,text);await f.photos.drain();assert.equal(f.photos.get(f.session,p.id).status,'succeeded');
 await f.photos.close();f.store.close();f.store=new TravelStore(f.db);f.photos=createPhotoService({store:f.store,root:f.root,render:drawing});assert.equal(f.photos.list(f.session)[0].id,p.id);assert.ok(f.photos.asset(f.session,p.id,'transparent_stickers').bytes.length);assert.throws(()=>f.photos.generate(f.session,p.id,{title:'bad\ntext',caption:'a'}),{code:'INVALID_INPUT'});
 }finally{await f.close();}
});
test('interrupted generation is requeued and busy work cannot be deleted; cleanup retries after restart',async()=>{
 const f=setup();try{const p=await f.photos.upload(f.session,await input('blue'),'image/jpeg','interrupted');await f.photos.close();f.store.db.prepare("UPDATE photo_creations SET status='running' WHERE id=?").run(p.id);let release;const gate=new Promise(r=>release=r);f.photos=createPhotoService({store:f.store,root:f.root,render:async args=>{await gate;return drawing(args);}});const work=f.photos.drain();const busy=f.photos.get(f.session,p.id);assert.throws(()=>f.photos.remove(f.session,p.id,{expected_version:busy.version}),{code:'PHOTO_BUSY'});release();await work;assert.equal(f.photos.get(f.session,p.id).status,'succeeded');await f.photos.close();
 f.photos=createPhotoService({store:f.store,root:f.root,unlink:()=>{throw Error('busy file');}});const done=f.photos.get(f.session,p.id);assert.equal(f.photos.remove(f.session,p.id,{expected_version:done.version}).cleanup_pending,true);assert.equal(f.photos.list(f.session).length,0);await f.photos.close();f.photos=createPhotoService({store:f.store,root:f.root});assert.equal(readdirSync(resolve(f.root,'.local-work/photo-creations')).length,0);
 }finally{await f.close();}
});

test('45MP camera JPEG is normalized without cropping while retaining original dimensions',async()=>{
 const bytes=await sharp({create:{width:8192,height:5464,channels:3,background:'#7199ac'}}).jpeg().toBuffer();
 const p=await preparePhoto(bytes,'image/jpeg');assert.equal(p.source.width,8192);assert.equal(p.source.height,5464);assert.equal(p.width,1600);assert.equal(p.height,1067);
 const output=await renderPhoto({bytes,mime:'image/jpeg',title:'大尺寸照片',caption:'完整画面',created_at:'2026-10-31T00:00:00Z',root:project});
 assert.equal((await sharp(output.memory_card).metadata()).width,1200);assert.deepEqual(inspectTransparentPNG(output.transparent_stickers).corner_alpha,[0,0,0,0]);
});
