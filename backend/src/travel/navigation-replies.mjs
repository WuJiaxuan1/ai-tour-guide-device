import {currentLocationReply} from './location-address.mjs';
const finite=n=>Number.isFinite(n)&&n>=0;
const meters=n=>n>=1000?`${(n/1000).toFixed(1)}公里`:`${Math.round(n)}米`;
const minutes=n=>`${Math.ceil(n/60)}分钟`;
export function navigationIntent(question) {
  if(/偏离|走偏|走错路|迷路|在.*路线上/.test(question))return 'off_route';
  if(/(?:行程|游览).*(?:状态|暂停|结束了|开始了)|(?:暂停|结束|开始)了吗/.test(question))return 'status';
  if(/(?:还剩|还有).*(?:站|景点)|(?:已经|已|共).*(?:几|多少).*(?:站|景点)/.test(question))return 'progress';
  const metric=/多远|多少米|几公里|多少公里|距离|多久|多长时间|多少时间|几小时|多少小时|几分钟|多少分钟|几点/;
  if(metric.test(question)&&/下一站|下个景点|还|剩|出山|逛完|结束|全程|走完|到/.test(question)){
    if(/全程|结束|出山|逛完|走完.*路线/.test(question))return /几点/.test(question)?'finish_time':'remaining';
    return 'next_leg';
  }
  if(/下一站|下(?:一)?个景点|下一处|接下来去(?:哪|哪里|什么地方)/.test(question))return 'next_stop';
  if(/(?:我|我们|咱们).*在哪|(?:现在|当前|我的).*位置|(?:这里|这儿|这是).*哪|(?:我|我们).*什么地方|(?:现在|我们|我).*到哪/.test(question))return 'location';
  return null;
}
const inactive=nav=>nav.status==='completed'?'这次行程已结束，导航已停止。可以在网页查看旅行回忆。':nav.status==='planned'?'路线已选好，但尚未开始游览，请在网页点击“开始游览”。':null;
const positionProblem=nav=>({stale:'手机位置已过期，请把网页切回前台重新定位。',low_accuracy:'手机定位精度不足，请到信号较好的地方重新定位。',awaiting_update:'刚恢复游览，正在等待新的手机定位，请保持网页在前台。',unavailable:'还没有手机定位，请允许网页访问位置并保持前台。'}[nav.location?.freshness]);
export function navigationReply(nav,intent) {
  if(!nav)return '请先在网页选择路线并开始游览；使用小智时还需连接本次行程。';
  if(inactive(nav))return inactive(nav);
  const next=nav.next_stop;
  if(intent==='status')return nav.status==='paused'?'行程已暂停，位置更新和导航估算已暂停；请在网页点击“恢复游览”。':'当前行程正在游览中。';
  if(intent==='progress')return `已手动确认${nav.progress.confirmed_stop_count}个停靠，跳过${nav.progress.skipped_stop_count||0}个，还剩${nav.progress.pending_stop_count??0}个待处理停靠。停靠包括景点和出入口。`;
  if(intent==='next_stop')return nav.status==='paused'?`行程已暂停。${next?`恢复后计划下一站是${next.name}。`:'当前没有待完成的停靠。'}`:next?`下一站是${next.name}。`:'当前没有待完成的停靠；这不等于所有景点都已到访，可在网页结束行程。';
  if(nav.status==='paused')return '行程已暂停，位置更新和导航估算已暂停。请在网页恢复游览后再查询。';
  if(intent==='location')return currentLocationReply(nav);
  if(intent==='off_route'){
    if(positionProblem(nav))return positionProblem(nav)+'暂不能判断是否偏离路线。';
    if(nav.off_route.status==='suspected')return `连续定位显示你可能偏离推荐路线，距路线最近处直线约${meters(nav.off_route.distance_m)}。这不是步行距离，请查看网页地图和现场指引；路线不会自动重规划。`;
    if(nav.off_route.status==='checking')return '位置可能离推荐路线较远，正在等待连续定位确认，请查看网页地图。';
    if(nav.off_route.status==='not_detected')return '当前定位暂未发现明显偏离推荐路线；这不代表已确认你所在的道路，请结合网页地图和现场指引。';
    return '当前缺少可用的路线几何信息，暂不能判断是否偏离。';
  }
  if(!next)return '当前没有待完成的停靠，不再估算下一站或剩余时间；可在网页结束行程。';
  if(positionProblem(nav))return positionProblem(nav)+'暂不能给出可靠的道路距离和时间。';
  const e=nav.estimate;
  if(!finite(e.to_next_walk_seconds)||!finite(e.to_next_distance_m))return `到${next.name}的道路距离和时间暂不可用，可能仍在更新定位或查询道路，请稍后再问。`;
  if(intent==='next_leg')return `到下一站${next.name}，预计步行约${meters(e.to_next_distance_m)}、${minutes(e.to_next_walk_seconds)}，不含景点停留。`;
  if(!finite(e.remaining_total_seconds))return '当前剩余路线存在跳过的停靠或缺少道路资料，暂不能完整估算全程剩余时间。仍可查询到下一站的距离和时间。';
  const detail=`按当前预设路线，预计还需${minutes(e.remaining_total_seconds)}，含步行${minutes(e.remaining_walk_seconds)}及计划停留${minutes(e.remaining_stay_seconds)}${finite(e.remaining_distance_m)?`；剩余步行约${meters(e.remaining_distance_m)}`:''}。`;
  if(intent==='finish_time')return detail+`预计北京时间${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(e.estimated_finish_at))}结束，仅供参考。`;
  return detail+'实际用时会随步速和停留变化。';
}
