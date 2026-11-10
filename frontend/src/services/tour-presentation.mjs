// Keep unavailable location explanations in one place, not in every metric.
export function tourPresentation(navigation,status,locationError='') {
 const paused=status==='paused',fresh=navigation?.location?.freshness==='fresh';
 const guidance=navigation?.guidance||{};
 const location=paused?'游览已暂停，恢复后继续更新位置。':locationError||guidance.location||'正在等待手机定位，请保持网页在前台。';
 const seen=new Set([location]);
 const messages=[];
 if(!paused&&fresh&&navigation?.next_stop){
  for(const key of ['next_leg','remaining']){
   const value=guidance[key]?.trim();
   if(value&&!seen.has(value)){seen.add(value);messages.push(value);}
  }
 }
 const offRoute=!paused&&fresh&&['checking','suspected'].includes(navigation?.off_route?.status)?guidance.off_route:null;
 if(offRoute&&!seen.has(offRoute))messages.push(offRoute);
 return {location,messages,paused};
}
