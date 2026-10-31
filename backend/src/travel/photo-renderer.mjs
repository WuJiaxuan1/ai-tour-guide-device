import sharp from 'sharp';
import {resolve} from 'node:path';
import {check,TravelError} from './errors.mjs';

sharp.cache({memory:32,files:0,items:20});
const MAX_PIXELS=60000000;
const options={limitInputPixels:MAX_PIXELS,failOn:'error'};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const svg=body=>Buffer.from(body);
export async function preparePhoto(bytes,mime){
 check(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=8*1024*1024,'INVALID_IMAGE','请选择不超过8 MB的JPEG或PNG照片。',413);
 try{
  // Read only the header first so oversized images get a specific size error.
  // The decoder below still enforces the pixel ceiling before allocating pixels.
  const meta=await sharp(bytes,{...options,limitInputPixels:false}).metadata();
  check((mime==='image/jpeg'&&meta.format==='jpeg')||(mime==='image/png'&&meta.format==='png'),'INVALID_IMAGE','请选择JPEG或PNG照片，不支持其他格式。',415);
  check((meta.pages||1)===1,'INVALID_IMAGE','请选择静态JPEG或PNG照片，不支持动图。',422);
  check(meta.width*meta.height<=MAX_PIXELS,'PHOTO_PIXEL_LIMIT',`照片尺寸为${meta.width}×${meta.height}（约${Math.ceil(meta.width*meta.height/10000)}万像素），超过6000万像素上限。请缩小尺寸后重试。`,422);
  // Decode before accepting the upload. Auto-orient derivatives and omit EXIF from outputs.
  const {data,info}=await sharp(bytes,options).rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).toColourspace('srgb').ensureAlpha().png().toBuffer({resolveWithObject:true});
  return {image:data,source:{mime_type:mime,width:meta.width,height:meta.height,bytes:bytes.length},width:info.width,height:info.height};
 }catch(e){if(e instanceof TravelError)throw e;throw new TravelError('INVALID_IMAGE','照片数据无法解码，请重新导出为JPEG或PNG后再上传。',422);}
}
export async function renderPhoto({bytes,mime,title,caption,created_at,root}){
 const photo=await preparePhoto(bytes,mime),fontfile=resolve(root,'backend/assets/fonts/NotoSansSC.ttf');
 const text=async(value,size,width)=>sharp({text:{text:escape(value),font:`Noto Sans SC ${size}`,fontfile,width,rgba:true,wrap:'word-char',spacing:8}}).png().toBuffer();
 const cardWidth=1200,cardHeight=1600;
 const picture=await sharp(photo.image).flatten({background:'#f4efe8'}).resize(988,940,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
 const cardBase=svg(`<svg width="1200" height="1600"><rect width="1200" height="1600" fill="#f7f1e7"/><rect x="34" y="34" width="1132" height="1532" rx="26" fill="none" stroke="#d4c3aa" stroke-width="2"/><path d="M84 74h98" stroke="#a85243" stroke-width="7"/><rect x="74" y="246" width="1052" height="1000" rx="22" fill="#e5d7c5"/><rect x="64" y="234" width="1052" height="1000" rx="22" fill="white"/><path d="M84 1444h1032" stroke="#d4c3aa" stroke-width="2"/><circle cx="1090" cy="1494" r="24" fill="#a85243"/></svg>`);
 const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(created_at));
 const memoryCard=await sharp(cardBase).composite([
  {input:await text(title,52,1032),left:84,top:104},
  {input:await text('QIXIA / A MOMENT TO KEEP',21,1032),left:84,top:188},
  {input:picture.data,left:64+Math.round((1052-picture.info.width)/2),top:234+Math.round((1000-picture.info.height)/2)},
  {input:await text(caption,32,1032),left:84,top:1300},
  {input:await text(date+'  ·  照片记忆',23,900),left:84,top:1480}
 ]).ensureAlpha().png({compressionLevel:8}).toBuffer();
 const cut=await sharp(photo.image).flatten({background:'white'}).resize(800,800,{fit:'inside'}).png().toBuffer({resolveWithObject:true});
 const frameW=cut.info.width+48,frameH=cut.info.height+48,left=Math.round((1000-frameW)/2),top=Math.round((1000-frameH)/2);
 const mask=svg(`<svg width="${cut.info.width}" height="${cut.info.height}"><rect width="100%" height="100%" rx="20" fill="white"/></svg>`);
 const rounded=await sharp(cut.data).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 const whiteFrame=svg(`<svg width="1000" height="1000"><rect x="${left}" y="${top}" width="${frameW}" height="${frameH}" rx="40" fill="white"/></svg>`);
 const sticker=await sharp(whiteFrame).composite([{input:rounded,left:left+24,top:top+24}]).ensureAlpha().png({compressionLevel:8,palette:false}).toBuffer();
 return {memory_card:memoryCard,transparent_stickers:sticker};
}
