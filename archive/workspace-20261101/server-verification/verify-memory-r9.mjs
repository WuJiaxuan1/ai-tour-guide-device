import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.VERIFY_BASE||'http://127.0.0.1:18788';
const page=await fetch(base+'/');assert.equal(page.status,200);assert.ok((await page.text()).includes('index-DToqtQ6O.js'));
const asset=await fetch(base+'/assets/index-DToqtQ6O.js');assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/immutable/);assert.ok((await asset.text()).includes('下载本次真实记录'));
const health=await(await fetch(base+'/api/health')).json();assert.equal(health.ok,true);
const media=await fetch(base+'/immersive/qixia-temple/assets/plain-home-mobile-083185d802d1.webp');assert.equal(media.status,200);assert.match(media.headers.get('cache-control'),/immutable/);
const result={at:new Date().toISOString(),base,checks:['final_frontend_bundle','memory_export_bundle_and_cache','backend_health','immersive_mobile_asset_preserved'],backend_changed:false};
writeFileSync('.local-work/memory-acceptance.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
