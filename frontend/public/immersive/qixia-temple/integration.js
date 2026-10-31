'use strict';
(() => {
 const embedded=parent!==window,channel=new URLSearchParams(location.hash.slice(1)).get('channel');
 let resolveReady;const pending=new Map();
 const ready=embedded?new Promise(resolve=>resolveReady=resolve):Promise.resolve(null);
 const send=data=>parent.postMessage({app:'qixia-immersive',channel,...data},location.origin);
 addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==location.origin||event.data?.app!=='qixia-immersive'||event.data.channel!==channel)return;
  const data=event.data;
  if(data.type==='init'){resolveReady?.(data.state);resolveReady=null;}
  if(data.type==='result'){const entry=pending.get(data.id);if(!entry)return;clearTimeout(entry.timer);pending.delete(data.id);data.error?entry.reject(Error(data.error)):entry.resolve(data.state);}
 });
 window.travelBridge={embedded,ready,act:(action,choice)=>!embedded?Promise.resolve(null):new Promise((resolve,reject)=>{
  const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('保存等待超时，请重试；已保存的进度可关闭后重新打开查看。'));},20000);
  pending.set(id,{resolve,reject,timer});send({type:'action',id,action,choice});
 })};
 if(embedded)send({type:'ready'});
})();
