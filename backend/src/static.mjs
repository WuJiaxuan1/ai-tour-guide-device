import {existsSync,statSync,createReadStream} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createGzip} from 'node:zlib';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.wav':'audio/wav','.txt':'text/plain; charset=utf-8'};
export function serveStatic(root,req,res,url){
 const base=resolve(root,'frontend/dist/client');let file;
 try{file=resolve(base,'.'+decodeURIComponent(url.pathname));}catch{res.writeHead(400);res.end();return;}
 if(file!==base&&!file.startsWith(base+sep)){res.writeHead(404);res.end();return;}
 if(!existsSync(file)||!statSync(file).isFile()){if(extname(url.pathname)){res.writeHead(404);res.end();return;}file=resolve(base,'index.html');}
 if(!existsSync(file)){res.writeHead(404);res.end('请先构建前端。');return;}
 const info=statSync(file),extension=extname(file),etag=`W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
 const immutable=/\/assets\/(?:responsive\/[a-f0-9]{16}-\d+\.webp|[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2|webp))$/.test(url.pathname);
 const headers={'Content-Type':mime[extension]||'application/octet-stream','Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache',ETag:etag,'Last-Modified':info.mtime.toUTCString(),'Accept-Ranges':'bytes','Vary':'Accept-Encoding'};
 if(req.headers['if-none-match']?.split(/,\s*/).includes(etag)||(!req.headers['if-none-match']&&Date.parse(req.headers['if-modified-since'])>=Math.floor(info.mtimeMs/1000)*1000)){res.writeHead(304,headers);res.end();return;}
 let start=0,end=info.size-1,status=200;
 if(req.headers.range&&(!req.headers['if-range']||Date.parse(req.headers['if-range'])>=Math.floor(info.mtimeMs/1000)*1000)){
  const m=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
  if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
  start=m[1]?Number(m[1]):Math.max(0,info.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),info.size-1):info.size-1;
  if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});res.end();return;}
  status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 }
 const gzip=status===200&&info.size>1024&&['.html','.js','.css','.json','.svg','.txt'].includes(extension)&&String(req.headers['accept-encoding']||'').split(',').some(part=>{const [name,...params]=part.trim().split(';');return name==='gzip'&&!params.some(p=>/^\s*q=0(?:\.0*)?\s*$/.test(p));});
 if(gzip)headers['Content-Encoding']='gzip';else headers['Content-Length']=end-start+1;
 res.writeHead(status,headers);if(req.method==='HEAD'){res.end();return;}
 if(info.size===0){res.end();return;}
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());
 if(gzip){const compress=createGzip();compress.on('error',()=>res.destroy());stream.pipe(compress).pipe(res);}else stream.pipe(res);
}
