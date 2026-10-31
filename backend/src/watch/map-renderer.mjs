import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {existsSync} from 'node:fs';
import {readConfig} from '../config.mjs';

// Application rendering worker: AMap's official JS SDK, not scraped tile URLs.
// No user browser profile, no cookies, and no public endpoint exposing the security code.
export function createWatchMapRenderer(root){
 let queue=Promise.resolve();
 const executable=()=>process.env.WATCH_CHROMIUM_PATH||[
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
 ].find(existsSync);
 return points=>{
  const task=queue.then(async()=>{
   const config=readConfig(root);if(!config.webKey||!config.jscode||!executable())throw Error('Watch map renderer is not configured');
   const browser=await chromium.launch({executablePath:executable(),headless:true,chromiumSandbox:true,timeout:15000});
   try{
    const page=await browser.newPage({viewport:{width:480,height:480},deviceScaleFactor:1});page.setDefaultTimeout(30000);
    const renderUrl=new URL('/__watch_render__',process.env.WATCH_RENDER_ORIGIN||'http://127.0.0.1').href;
    await page.route(renderUrl,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"><style>html,body,#map{margin:0;width:480px;height:480px;overflow:hidden}</style></head><body><div id="map"></div></body></html>'}));
    await page.goto(renderUrl);
    await page.evaluate(jscode=>{window._AMapSecurityConfig={securityJsCode:jscode};},config.jscode);
    await page.addScriptTag({url:'https://webapi.amap.com/maps?v=2.0&key='+encodeURIComponent(config.webKey)});
    const bounds=await page.evaluate(points=>new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('Map rendering timeout')),25000);
     const ys=points.map(p=>Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))),xs=points.map(p=>p[0]),west=Math.min(...xs),east=Math.max(...xs),low=Math.min(...ys),high=Math.max(...ys);
     const center=[(west+east)/2,(2*Math.atan(Math.exp((low+high)/2))-Math.PI/2)*180/Math.PI];
     const map=new AMap.Map('map',{viewMode:'2D',center,zoom:14,pitch:0,rotation:0,features:['bg','road'],showLabel:false,showBuildingBlock:false,animateEnable:false,dragEnable:false,zoomEnable:false});
     let done=false;
     const capture=()=>{if(done)return;const radius=Math.max(...points.map(p=>{const pixel=map.lngLatToContainer(p);return Math.hypot(pixel.x-240,pixel.y-240);}));
      if(radius>198){if(map.getZoom()<=3){done=true;clearTimeout(timer);reject(Error('Route cannot fit display'));return;}map.setZoom(map.getZoom()-.5);return;}
      done=true;clearTimeout(timer);const nw=map.containerToLngLat(new AMap.Pixel(0,0)),se=map.containerToLngLat(new AMap.Pixel(480,480));
      // complete is the SDK signal that requested map resources have loaded.
      requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({north:nw.lat,west:nw.lng,south:se.lat,east:se.lng})));
     };
     map.on('complete',capture);
    }),points);
    await page.waitForTimeout(4000);
    const png=await page.screenshot({type:'png'}),rgb=await sharp(png).removeAlpha().raw().toBuffer();
    // SDK initialization can succeed even if tile authorization/network failed.
    // Reject its near-uniform empty grid rather than shipping it as a real map.
    const colors=new Set();for(let y=40;y<440;y+=4)for(let x=40;x<440;x+=4){const i=(y*480+x)*3;colors.add(((rgb[i]>>4)<<8)|((rgb[i+1]>>4)<<4)|(rgb[i+2]>>4));}
    if(colors.size<12)throw Error('Map tiles did not render');
    return {rgb,bounds};
   }finally{await browser.close();}
  });queue=task.catch(()=>{});return task;
 };
}
