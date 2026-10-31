export function tripReport(trip,lookup) {
 const route=trip.route,knownStatus={planned:'尚未开始',active:'游览中',paused:'已暂停',completed:'已结束'};
 const stops=route.stops.map(stop=>({...lookup(stop.attraction_id),id:stop.attraction_id,reportKey:stop.stop_id,name:stop.name,
  intro:stop.status==='visited'?'已手动确认到访':stop.status==='skipped'?'已跳过':'尚未确认到访'}));
 return {title:route.name,subtitle:`${new Date(trip.created_at).toLocaleDateString('zh-CN')} · ${knownStatus[trip.status]||'行程记录'}`,
  distanceMeters:Number.isFinite(route.distance_m)?route.distance_m:null,
  plannedMinutes:Number.isFinite(route.estimated_total_seconds)?Math.ceil(route.estimated_total_seconds/60):null,
  stops,summary:'记录本次行程的途经地点与手动到访状态。路线里程为规划道路长度，计划游览时间含停留，均不代表实际行走里程或用时。'};
}
