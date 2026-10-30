import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.QIXIA_SHARP_MODULE||'sharp');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),pub=resolve(root,'public');
const sources=new Set(['/assets/qixia-illustration.png','/assets/mascot-cutout.png','/assets/park-map.png','/assets/journal-result.png']);
for(const f of ['places','facilities'])for(const p of JSON.parse(await readFile(resolve(root,'src/content',f+'.json'),'utf8'))){if(p.image)sources.add(p.image);for(const src of p.images||[])sources.add(src);}
await mkdir(resolve(pub,'assets/responsive'),{recursive:true});
await sharp(resolve(pub,'assets/mascot-cutout.png')).resize({width:64}).webp({quality:76}).toFile(resolve(pub,'assets/favicon.webp'));
const manifest={};let outputBytes=0;
for(const src of sources){
 const input=await readFile(resolve(pub,'.'+src)),hash=createHash('sha256').update(input).update('responsive-v1-q76').digest('hex').slice(0,16),meta=await sharp(input).metadata();
 const widths=[160,640,1280,1500].filter(w=>w<meta.width);widths.push(Math.min(meta.width,1500));const variants=[];
 for(const w of [...new Set(widths)].sort((a,b)=>a-b)){
  const path='/assets/responsive/'+hash+'-'+w+'.webp',dest=resolve(pub,'.'+path);
  try{await stat(dest);}catch{await sharp(input).rotate().resize({width:w,withoutEnlargement:true}).webp({quality:76,effort:5}).toFile(dest);}
  const info=await sharp(dest).metadata(),bytes=(await stat(dest)).size;outputBytes+=bytes;variants.push({src:path,width:info.width,height:info.height,bytes});
 }
 manifest[src]={width:meta.width,height:meta.height,variants};
}
await writeFile(resolve(root,'src/content/image-variants.json'),JSON.stringify(manifest)+'\n');
console.log(JSON.stringify({images:sources.size,outputBytes,placeholder:manifest['/assets/qixia-illustration.png'].variants}));
