import {inflateSync} from 'node:zlib';
import {check} from './errors.mjs';
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;};
export function inspectTransparentPNG(bytes) {
  check(Buffer.isBuffer(bytes)&&bytes.length>33&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'INVALID_IMAGE','贴纸必须是 PNG。',422);
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  check(bytes.toString('ascii',12,16)==='IHDR'&&width>0&&height>0&&width*height<=4194304&&bytes[24]===8&&bytes[25]===6&&bytes[26]===0&&bytes[27]===0&&bytes[28]===0,'INVALID_IMAGE','贴纸须为不超过 4M 像素的非交错 RGBA PNG。',422);
  let offset=8,ended=false;const data=[];
  while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset);check(length<=bytes.length-offset-12,'INVALID_IMAGE','PNG 文件损坏。',422);const type=bytes.toString('ascii',offset+4,offset+8);check(crc32(bytes.subarray(offset+4,offset+8+length))===bytes.readUInt32BE(offset+8+length),'INVALID_IMAGE','PNG 校验失败。',422);if(type==='IHDR')check(offset===8&&length===13,'INVALID_IMAGE','PNG 头部无效。',422);if(type==='IDAT')data.push(bytes.subarray(offset+8,offset+8+length));if(type==='IEND'){check(length===0&&offset+12===bytes.length,'INVALID_IMAGE','PNG 结尾无效。',422);ended=true;break;}offset+=length+12;}
  check(ended&&data.length,'INVALID_IMAGE','PNG 缺少图像数据。',422);
  const stride=width*4;let raw;try{raw=inflateSync(Buffer.concat(data),{maxOutputLength:(stride+1)*height});}catch{check(false,'INVALID_IMAGE','PNG 像素数据无效。',422);}
  check(raw.length===(stride+1)*height,'INVALID_IMAGE','PNG 像素长度无效。',422);
  let previous=Buffer.alloc(stride),transparent=0,opaque=0;const corners=[];
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++){const filter=raw[y*(stride+1)],row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));check(filter<=4,'INVALID_IMAGE','PNG 过滤器无效。',422);for(let x=0;x<stride;x++){const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;row[x]=(row[x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;}for(let x=0;x<width;x++){const alpha=row[x*4+3];if(alpha===0)transparent++;if(alpha===255)opaque++;if((y===0||y===height-1)&&(x===0||x===width-1))corners.push(alpha);}previous=row;}
  check(corners.every(a=>a===0)&&transparent>0&&opaque>0,'INVALID_TRANSPARENCY','贴纸背景须真实透明，且包含非空不透明主体。',422);
  return {width,height,mode:'RGBA',corner_alpha:corners,transparent_pixels:transparent,opaque_pixels:opaque};
}
