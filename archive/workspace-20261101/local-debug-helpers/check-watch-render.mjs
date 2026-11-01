import {readConfig} from '../backend/src/config.mjs';
import {createWatchMapRenderer} from '../backend/src/watch/map-renderer.mjs';
import {createRequire} from 'node:module'; const sharp=createRequire(new URL('../backend/package.json',import.meta.url))('sharp');
import {writeFileSync} from 'node:fs';
try{const rendered=await createWatchMapRenderer(process.cwd())([[118.954566,32.150215],[118.95965,32.15541]]);await sharp(rendered.rgb,{raw:{width:480,height:480,channels:3}}).png().toFile('.local-work/watch-map-render.png');writeFileSync('.local-work/watch-map-bounds.json',JSON.stringify(rendered.bounds));console.log('PASS official SDK map rendered, RGB bytes:',rendered.rgb.length);}catch(e){const cfg=readConfig(process.cwd());let safe=e.message;for(const value of Object.values(cfg)){if(value)safe=safe.split(value).join('[redacted]');}console.log(safe.slice(0,2200));console.log('FAIL map renderer:',e.name, e.message.includes('configured')?'configuration missing':e.message.includes('timeout')||e.message.includes('Timeout')?'render timeout':'browser launch or SDK load failed');process.exitCode=1;}

