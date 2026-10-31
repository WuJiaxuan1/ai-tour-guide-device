import {useCallback,useEffect,useRef,useState} from 'react';
export default function useVisitorLocation(enabled=false){
 const [position,setPosition]=useState(null),[status,setStatus]=useState('idle'),[error,setError]=useState('');
 const generation=useRef(0),watch=useRef(null),last=useRef(0),conversion=useRef(null),requested=useRef(false);
 const stop=useCallback(()=>{generation.current++;if(watch.current!==null)navigator.geolocation?.clearWatch(watch.current);watch.current=null;conversion.current?.abort();conversion.current=null;},[]);
 const locate=useCallback(()=>{
  if(!window.isSecureContext){setError('请通过 HTTPS 网址打开后使用定位。');setStatus('error');return;}
  if(!navigator.geolocation){setError('这个浏览器无法获取位置，请换用手机自带浏览器。');setStatus('error');return;}
  stop();requested.current=true;const token=generation.current;last.current=0;setStatus('loading');setError('');
  watch.current=navigator.geolocation.watchPosition(async p=>{
   if(token!==generation.current||document.hidden||Date.now()-last.current<10000)return;last.current=Date.now();
   conversion.current?.abort();const controller=new AbortController();conversion.current=controller;const timeout=setTimeout(()=>controller.abort(),12000);
   try{
    const r=await fetch('/api/location/convert',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({coordinateSystem:'WGS84',location:[p.coords.longitude,p.coords.latitude]})});
    const data=await r.json();if(!r.ok||data.coordinateSystem!=='GCJ02'||!Array.isArray(data.location)||data.location.length!==2||!data.location.every(Number.isFinite))throw Error('已获取手机位置，但地图坐标转换失败，请重试。');
    if(token!==generation.current)return;setPosition({location:data.location,rawLocation:[p.coords.longitude,p.coords.latitude],accuracy:p.coords.accuracy,at:p.timestamp,coordinateSystem:'GCJ02'});setStatus('ready');setError('');
   }catch(e){if(token===generation.current&&conversion.current===controller){setStatus('error');setError(e.name==='AbortError'?'位置转换等待超时，请重试。':e instanceof TypeError?'暂时无法连接位置服务，请检查网络后重试。':e.message);}}finally{clearTimeout(timeout);}
  },e=>{if(token!==generation.current)return;setStatus('error');setError(e.code===1?'定位权限未开启，请在浏览器的网站设置中允许访问位置。':e.code===3?'获取手机位置超时，请到信号较好的地方重试。':'暂时无法获取手机位置，请检查系统定位设置。');},{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
 },[stop]);
 useEffect(()=>{if(!enabled){stop();return;}if(!requested.current)locate();else if(status!=='error'&&watch.current===null)locate();return stop;},[enabled,locate,stop]);
 useEffect(()=>{const visibility=()=>{if(document.hidden)stop();else if(enabled&&status!=='error')locate();};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[enabled,status,stop,locate]);
 return {position,status,error,locate};
}
