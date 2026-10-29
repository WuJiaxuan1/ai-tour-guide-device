import AMapLoader from '@amap/amap-jsapi-loader';
let loading;
export async function loadAMap(){
 if(!loading)loading=(async()=>{
  let webKey=import.meta.env.VITE_AMAP_KEY?.trim(),serviceHost=import.meta.env.VITE_AMAP_SERVICE_HOST?.trim();
  if(!webKey||!serviceHost){let r;try{r=await fetch('/api/config',{signal:AbortSignal.timeout(8000)});}catch{throw Error('MAP_NOT_CONFIGURED');}if(!r.ok)throw Error('MAP_NOT_CONFIGURED');const config=await r.json();if(!config.map?.configured)throw Error('MAP_NOT_CONFIGURED');webKey=config.map.webKey;serviceHost=config.map.serviceHost;}
  const proxy=new URL(serviceHost,window.location.origin);if(!['http:','https:'].includes(proxy.protocol)||!proxy.pathname.endsWith('/_AMapService'))throw Error('MAP_PROXY_INVALID');
  window._AMapSecurityConfig={serviceHost:proxy.href};return AMapLoader.load({key:webKey,version:'2.0'});
 })();
 return loading;
}
