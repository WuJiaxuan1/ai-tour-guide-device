export function memoryDuration(seconds){
 const n=Math.max(0,Math.floor(Number(seconds)||0));
 if(n===0)return '0分钟';
 if(n<60)return '不足1分钟';
 return `${Math.floor(n/60)}分钟${n%60?`${n%60}秒`:''}`;
}
export function memoryText({facts={},summary='',notes=[],generated_at,summary_stale=false}){
 const paused=facts.paused_seconds??Math.max(0,(facts.elapsed_seconds||0)-(facts.active_seconds||0));
 const lines=['栖霞旅行回忆',facts.planned_route_name||'',
  `确认游览：${facts.confirmed_attraction_count||0}个景点`,
  `景点：${facts.confirmed_attraction_names?.join('、')||'尚无手动确认的景点记录'}`,
  `总用时：${memoryDuration(facts.elapsed_seconds)}；活动用时：${memoryDuration(facts.active_seconds)}；暂停：${memoryDuration(paused)}`,
  `问答：${facts.interaction_count||0}次（网页${facts.interaction_channels?.web??'未统计'}，小智${facts.interaction_channels?.device??'未统计'}）`,
  '小智仅记录经过旅行工具的问答和笔记，不包含全部闲聊。'];
 if(facts.unconfirmed_stops?.length)lines.push(`尚未确认的计划停靠：${facts.unconfirmed_stops.join('、')}`);
 if(facts.skipped_stops?.length)lines.push(`主动跳过：${facts.skipped_stops.join('、')}`);
 if(summary){lines.push('','AI回忆摘要',summary);if(generated_at)lines.push(`生成时间：${generated_at}`);lines.push('以下事实与感受来自这份摘要生成时的记录。');}
 if(summary_stale)lines.push('此后有新记录，这份摘要尚未更新。');
 if(notes.length)lines.push('','旅行感受（原话）',...notes.map(n=>`${n.source==='device'?'小智':'网页'}：${n.text}`));
 if(facts.interests?.length)lines.push('','明确表达的喜好（原话）',...facts.interests.map(i=>i.text));
 if(facts.immersive_experiences?.length)lines.push('','网页沉浸式体验',...facts.immersive_experiences.flatMap(e=>[`${e.title||e.experience_id}：${e.completed?'已完成':'进行中'}`,`选择：${e.choices?.join(' → ')||'尚无选择'}`]),'沉浸式体验不等于实地到访。');
 return lines.filter(x=>x!==undefined).join('\n');
}
