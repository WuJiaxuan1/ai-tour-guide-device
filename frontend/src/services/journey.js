export function cleanIds(ids,known){return [...new Set(Array.isArray(ids)?ids:[])].filter(id=>known(id)?.navigationAvailable).slice(0,8);}
export function timeline(stops,legs=[],minutes={},start=''){
 let clock=start&&/^\d{2}:\d{2}$/.test(start)?Number(start.slice(0,2))*60+Number(start.slice(3)):null;
 return stops.map((p,i)=>{const leg=i?legs.find(l=>l.fromId===stops[i-1].id&&l.toId===p.id):null;if(i&&(!leg||clock===null))clock=null;else if(leg)clock+=Math.ceil(leg.walkingSeconds/60);const arrival=clock===null?null:`${Math.floor(clock/60)%24}`.padStart(2,'0')+':'+`${clock%60}`.padStart(2,'0');const stay=Math.max(0,Math.min(180,Number(minutes[p.id])||0));if(clock!==null)clock+=stay;return {place:p,leg,arrival,stay};});
}
export const readJourney=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
export const saveJourney=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
export function reportText(trip){return ['栖霞漫游 · 游览记录',`开始：${new Date(trip.startedAt).toLocaleString('zh-CN')}`,`结束：${trip.endedAt?new Date(trip.endedAt).toLocaleString('zh-CN'):'游览中'}`,`计划步行：${Math.round(trip.route.distanceMeters)} m（非实际轨迹里程）`,...trip.route.stops.map((p,i)=>`${i+1}. ${p.name} — ${trip.visited[p.id]?'已手动确认到访 '+new Date(trip.visited[p.id]).toLocaleTimeString('zh-CN'):'未确认到访'}`)].join('\n');}
