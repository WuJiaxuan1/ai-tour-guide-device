import {memoryDuration} from '../../services/memory-text.mjs';
export default function MemoryFacts({facts}){
 if(!facts)return null;
 return <section className="server-memory-result" aria-label="本次旅行的真实记录">
  <h3>这一程的记录</h3>
  <p>确认游览 {facts.confirmed_attraction_count} 个景点 · 共确认 {facts.confirmed_stop_count} 次停靠</p>
  <p>{facts.confirmed_attraction_names?.join('、')||'尚无手动确认的景点记录'}</p>
  <p>总用时 {memoryDuration(facts.elapsed_seconds)} · 活动用时 {memoryDuration(facts.active_seconds)} · 暂停 {memoryDuration(facts.paused_seconds)}</p>
  <p>记录了 {facts.interaction_count} 次问答（网页 {facts.interaction_channels?.web||0}，小智 {facts.interaction_channels?.device||0}）和 {facts.note_count||0} 条感受。小智仅记录经过旅行工具的问答与笔记。</p>
  {(facts.unconfirmed_stops?.length>0||facts.skipped_stops?.length>0)&&<details><summary>尚未确认与跳过的停靠</summary>{facts.unconfirmed_stops?.length>0&&<p>尚未确认：{facts.unconfirmed_stops.join('、')}</p>}{facts.skipped_stops?.length>0&&<p>主动跳过：{facts.skipped_stops.join('、')}</p>}<small>同一景点可能多次经过；一个停靠未确认不代表从未到访。</small></details>}
  {facts.interests?.length>0&&<div><h4>你明确表达的喜好</h4>{facts.interests.map((i,n)=><p key={i.record_id||n}>{i.source==='device'?'小智':'网页'}记录：{i.text}</p>)}</div>}
  {facts.immersive_experiences?.map(e=><details key={e.experience_id}><summary>{e.title||e.experience_id} · {e.completed?'体验已完成':'体验进行中'}</summary><ol>{e.choices.map((c,i)=><li key={i}>{c}</li>)}</ol><small>网页体验不等于实地到访。</small></details>)}
  {(facts.interaction_count>facts.summary_context_count||facts.note_count>facts.summary_note_count)&&<p>摘要参考最近 {facts.summary_context_count} 条问答、{facts.summary_note_count} 条感受；总次数按完整记录统计。</p>}
 </section>;
}
