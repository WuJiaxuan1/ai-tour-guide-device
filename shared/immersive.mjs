export const TEMPLE_EXPERIENCE={id:'temple-ming-life',attraction_id:'temple',title:'我把家，留给了这座山',entry_path:'/immersive/qixia-temple/index.html'};
export const hasTempleExperience=route=>(route?.stops||[]).some(s=>(s.attraction_id||s.placeId)==='temple');
export function immersiveQueryHint(trip,navigation){
 if(trip?.status!=='active'||navigation?.location?.freshness!=='fresh'||navigation.current_place?.attraction_id!=='temple'||!hasTempleExperience(trip.route)||trip.immersive_sessions?.some(s=>s.experience_id===TEMPLE_EXPERIENCE.id&&s.completed_at))return null;
 return '你附近的栖霞寺有沉浸式体验，可以点击网页上的“沉浸式体验”标签进入。';
}
export function eligibleImmersiveReminder(trip,navigation){
 if(trip?.status!=='active'||navigation?.trip_id!==trip.id||navigation.location?.freshness!=='fresh'||navigation.current_place?.attraction_id!=='temple')return null;
 return trip.reminders?.find(r=>r.experience_id===TEMPLE_EXPERIENCE.id&&r.status==='pending')||null;
}
