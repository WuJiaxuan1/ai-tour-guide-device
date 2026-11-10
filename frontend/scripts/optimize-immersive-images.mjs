import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir='public/immersive/qixia-temple/';const map={};
for(const name of ['plain-home','plain-fadu','plain-legacy','qixia-today']){
 const source=await readFile(dir+'assets/'+name+'.webp');
 const data=await sharp(source).resize({width:800,withoutEnlargement:true}).webp({quality:72,effort:5}).toBuffer();
 const filename=name+'-mobile-'+createHash('sha256').update(data).digest('hex').slice(0,12)+'.webp';
 await writeFile(dir+'assets/'+filename,data);map[name+'.webp']=filename;
 console.log(JSON.stringify({name,original:source.length,mobile:data.length,filename}));
}
await writeFile(dir+'scene-assets.js',"'use strict';\nwindow.travelMobileScenes="+JSON.stringify(map)+";\n");
