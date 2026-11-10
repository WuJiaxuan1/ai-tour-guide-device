import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')).href);
const out=fileURLToPath(new URL('../',import.meta.url)).replace(/\\/g,'/').replace(/\/$/,'');
const work=fileURLToPath(new URL('../../../../.local-work/survey-figures/',import.meta.url)).replace(/\\/g,'/').replace(/\/$/,'');
const target=`${out}/枫叶精灵-76份模拟答卷.xlsx`;
const verify=process.argv.includes('--verify');
if(!verify){
  let exists=false;try{await fs.access(target);exists=true;}catch{}
  if(exists)throw new Error('Output already exists. Preserve the approved workbook; use --verify to compare generated records.');
  await fs.mkdir(work,{recursive:true});
}
const {questions}=JSON.parse(await fs.readFile(`${out}/questionnaire.json`,'utf8'));
let seed=20261031;
const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0; return seed/4294967296;};
const pick=xs=>xs[Math.floor(random()*xs.length)];
const weighted=weights=>{let r=random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return 'ABCD'[i];}return 'D';};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const pool=(a,b,c,d)=>shuffle([...Array(a).fill('A'),...Array(b).fill('B'),...Array(c).fill('C'),...Array(d).fill('D')]);
const q1s=pool(40,22,9,5), q2s=pool(16,30,26,4);
const archetypes=shuffle(Array.from({length:76},(_,i)=>i%6));
// Synthetic scenario parameters, not estimates from visitors. Six equally sampled profiles.
const profiles=[
  {name:'实用信息兴趣',route:.70,photo:.30,social:.25,culture:.45,sticker:.25,carry:[.17,.23,.32,.28]},
  {name:'摄影兴趣',route:.45,photo:.78,social:.35,culture:.30,sticker:.70,carry:[.28,.32,.18,.22]},
  {name:'文化探索兴趣',route:.45,photo:.25,social:.30,culture:.78,sticker:.30,carry:[.18,.27,.25,.30]},
  {name:'玩偶互动兴趣',route:.40,photo:.55,social:.80,culture:.50,sticker:.65,carry:[.48,.28,.08,.16]},
  {name:'谨慎体验',route:.42,photo:.30,social:.25,culture:.38,sticker:.25,carry:[.08,.20,.22,.50]},
  {name:'低需求',route:.15,photo:.12,social:.08,culture:.17,sticker:.10,carry:[.03,.10,.65,.22]},
];
const multi=probs=>{const a=['A','B','C'].filter((_,i)=>random()<probs[i]);return a.length?a.join(';'):'D';};
const rows=[], records=[];
for(let i=0;i<76;i++){
  const p=profiles[archetypes[i]], q=Array(14).fill(null);
  q[0]=q1s[i];q[1]=q2s[i];
  let relation='';
  if(q[1]!=='A'){
    if(q[1]==='D')q[2]='D';
    else if(q[1]==='B')q[2]=weighted([.35,.35,.15,.15]);
    else {q[2]=weighted([.15,.4,.3,.15]);if(random()<.18){q[2]=[...new Set([q[2],pick(['A','B','C','D'])])].sort().join(';');}}
    if(q[2].includes('D') && random()<.7)relation=q[1]==='D'?pick(['同行安排还没确定','还没有确定和谁一起']):pick(['父母','兄弟姐妹','其他亲属','旅行团成员']);
  }
  const experienced=['A','B'].includes(q[0]), solo=q[1]==='A';
  if(experienced){
    q[3]=multi([p.route*.7,p.route*.65,p.route*.75]);
    q[4]=multi([p.photo*.75,p.photo*.8,p.photo*(solo?.7:.65)]);
    q[5]=multi([p.culture*.7,solo?0:p.social*.7,p.social*.65]);
  }
  const pain=(idx,letter)=>q[idx]?.includes(letter)?.15:0;
  q[6]=multi([p.route+pain(3,'B'),p.route+pain(3,'A'),p.route+pain(3,'C')]);
  q[7]=multi([p.photo+pain(4,'A'),p.photo+pain(4,'B'),p.photo*.7+pain(4,'C')]);
  q[8]=multi([Math.max(p.culture,p.route)*.75,p.social,solo?0:p.social*.8]);
  q[9]=multi([p.culture,p.culture*.6,solo?p.culture*.45:Math.max(p.social,p.culture)*.6]);
  q[10]=multi([p.sticker,p.sticker*.65,p.sticker*.8]);
  q[11]=weighted(p.carry);
  q[12]=multi([p.sticker*.65,p.social,solo?0:p.social*.7]);
  if(q[11]==='A' && q[12]==='D')q[12]=pick(['A','B']);
  q[13]=multi([.35+(q[11]==='C'?.2:0),.45+(q[11]==='D'?.15:0),.3+(q[8]==='D'?.15:0)]);
  let scene='';
  if(q[11]==='B' && random()<.8){
    scene=solo?pick(['独自慢慢逛、想听讲解时','主题活动或拍纪念照时']):q[2]?.includes('C')?pick(['带孩子参加观察活动时','亲子周末游、行程不赶时']):q[2]?.includes('A')?pick(['和伴侣轻松出游、拍合影时','情侣主题活动时']):pick(['和朋友拍照打卡时','朋友一起体验互动活动时','不赶时间、可以慢慢逛的时候']);
  }
  records.push({id:`SIM-${String(i+1).padStart(3,'0')}`,q,relation,scene,profile:p.name});
  rows.push([i+1,records.at(-1).id,'模拟数据',new Date('2026-10-31T00:00:00Z'),...q,relation||null,scene||null]);
}
assert.equal(rows.length,76);
assert.equal(new Set(records.map(r=>r.id)).size,76);
for(const r of records){
  const q=r.q;
  assert.equal(q[2]===null,q[1]==='A');
  for(const idx of [3,4,5])assert.equal(q[idx]===null,['C','D'].includes(q[0]));
  for(let i=0;i<14;i++)if(q[i]!==null){
    const choices=q[i].split(';');assert(choices.every(x=>'ABCD'.includes(x)));assert.equal(new Set(choices).size,choices.length);
    if([0,1,11].includes(i))assert.equal(choices.length,1);
    if(i!==2 && choices.includes('D'))assert.equal(choices.length,1);
  }
  if(r.relation)assert(q[2]?.includes('D'));
  if(r.scene)assert.equal(q[11],'B');
}

if(verify){console.log(JSON.stringify(rows));process.exit(0);}
const wb=Workbook.create();
const raw=wb.worksheets.add('模拟答卷76份');
const dict=wb.worksheets.add('题目与模拟说明');
const headers=['序号','模拟记录ID','数据性质','生成日期',...questions.map(q=>`Q${q.n} ${['近期经历','同行人数','同行关系','行程问题','拍照问题','游玩想法','网页功能','拍照参考','语音互动','景点体验','纪念贴纸','携带意愿','额外吸引力','使用顾虑'][q.n-1]}`),'Q3其他关系补充（模拟）','Q12限定场景补充（模拟）'];
raw.getRange('A1:T77').values=[headers,...rows];
raw.showGridLines=false;raw.tabColor='#8D482C';
raw.getRange('A1:T77').format.font={name:'Microsoft YaHei',size:10,color:'#202020'};
raw.getRange('A1:T77').format.rowHeight=23;
raw.getRange('A1:T77').format.verticalAlignment='center';
raw.getRange('A1:T1').format={fill:'#613D30',font:{name:'Microsoft YaHei',size:10,color:'#FFFFFF',bold:true},wrapText:true,rowHeight:43};
raw.getRange('A1:A77').format.columnWidth=7;
raw.getRange('B1:B77').format.columnWidth=15;
raw.getRange('C1:C77').format.columnWidth=13;
raw.getRange('D1:D77').format.columnWidth=14;
raw.getRange('E1:R77').format.columnWidth=15;
raw.getRange('S1:T77').format.columnWidth=38;
raw.getRange('E2:R77').format.horizontalAlignment='center';
raw.getRange('D2:D77').setNumberFormat('yyyy-mm-dd');
for(let r=3;r<=77;r+=2)raw.getRange(`A${r}:T${r}`).format.fill='#F7F3EF';
raw.tables.add('A1:T77',true,'SyntheticResponses');
raw.freezePanes.freezeRows(1);raw.freezePanes.freezeColumns(3);

const notes=[
  ['数据性质','全部76条为程序生成的模拟答卷，无真实受访者，也未提交问卷星。'],
  ['用途','用于Excel筛选、统计流程和问卷跳题测试；不能作为真实游客调研证据。'],
  ['文件结构','按一行一份答卷、一列一道题组织；仅仿问卷明细结构，不是问卷星原生导出。'],
  ['题目来源','https://v.wjx.cn/vm/Y70F5Zn.aspx；依据2026-10-31已读取的公开页面。'],
  ['编码','A/B/C/D对应题目选项；多选以英文分号分隔，例如A;C。'],
  ['空白含义','题目按逻辑跳过时为空；附带填空为空表示未填写。D不是缺失值。'],
  ['模拟方法','固定种子20261031的LCG伪随机数，六类场景参数分别抽取回答，并执行显示与互斥规则。'],
  ['分布假设','Q1固定40/22/9/5条；Q2固定16/30/26/4条后打乱。仅用于覆盖分支，不代表游客比例。'],
  ['参数解释','六类场景均匀轮换后打乱；需求、兴趣和携带意愿参数为人为假设，未用真实数据校准。'],
  ['关联规则','Q2=A跳过Q3；Q1=C/D跳过Q4—Q6；Q7—Q14全部作答。'],
  ['互斥规则','Q4—Q11及Q13—Q14的D与A/B/C互斥；Q3的D不互斥。'],
  ['日期与身份','生成日期不是提交时间；SIM记录号是模拟标识。不编造IP、位置、姓名或设备信息。'],
];
dict.getRange('A1').values=[['枫叶精灵问卷模拟数据说明']];
dict.getRange('A3:B14').values=notes;
dict.getRange('A17:D17').values=[['题号','题型','题目或选项','显示／互斥规则']];
const dictionary=[];
for(const q of questions){
  const rule=q.n===3?'Q2≠A显示；D不互斥':[4,5,6].includes(q.n)?'Q1=A/B显示；D互斥':q.multi?'全部显示；D互斥':'全部显示；单选';
  dictionary.push([`Q${q.n}`,q.multi?'多选':'单选',q.title,rule]);
  for(const option of q.options)dictionary.push([null,null,option,null]);
}
dict.getRange(`A18:D${17+dictionary.length}`).values=dictionary;
const start=90;
dict.getRange(`A${start}:H${start}`).values=[['模拟场景参数','路线兴趣','拍照兴趣','交流兴趣','文化兴趣','贴纸兴趣','携带A/B/C/D权重','非真实人群参数']];
dict.getRange(`A${start+1}:H${start+6}`).values=profiles.map(p=>[p.name,p.route,p.photo,p.social,p.culture,p.sticker,p.carry.join('/'),'仅为生成假设']);
dict.showGridLines=false;
dict.getRange('A1:H96').format.font={name:'Microsoft YaHei',size:10,color:'#202020'};
dict.getRange('A1:H96').format.verticalAlignment='center';
dict.getRange('A1:H96').format.rowHeight=23;
dict.getRange('A1').format.font={name:'Microsoft YaHei',size:14,bold:true,color:'#613D30'};
dict.getRange('A1:A96').format.columnWidth=20;
dict.getRange('B1:B96').format.columnWidth=24;
dict.getRange('C1:C96').format.columnWidth=85;
dict.getRange('D1:D96').format.columnWidth=30;
dict.getRange('E90:H96').format.columnWidth=22;
// Long notes span empty cells with no merging; preserve a flat dictionary below.
dict.getRange('B3:B14').format.wrapText=false;
dict.getRange('C18:C87').format.wrapText=true;
dict.getRange('A18:D87').format.rowHeight=36;
dict.getRange('A17:D17').format={fill:'#613D30',font:{name:'Microsoft YaHei',size:10,color:'#FFFFFF',bold:true},rowHeight:28};
dict.getRange('A90:H90').format={fill:'#613D30',font:{name:'Microsoft YaHei',size:10,color:'#FFFFFF',bold:true},wrapText:true,rowHeight:40};
dict.getRange('B91:F96').setNumberFormat('0.00');

wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'模拟答卷76份!A1:H6',include:'values',tableMaxRows:6,tableMaxCols:8,maxChars:1800})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10},summary:'Error scan'})).ndjson);
for(const [name,range,file] of [['模拟答卷76份','A1:J12','raw-preview.png'],['题目与模拟说明','A1:D22','dictionary-preview.png']]){
  const blob=await wb.render({sheetName:name,range,scale:1.3,format:'png'});
  await fs.writeFile(`${work}/${file}`,new Uint8Array(await blob.arrayBuffer()));
}
const output=await SpreadsheetFile.exportXlsx(wb);
await output.save(target);
await fs.writeFile(`${work}/validation.json`,JSON.stringify({count:records.length,allSynthetic:true,skipChecks:'passed',mutualExclusionChecks:'passed',carryCounts:Object.fromEntries([... 'ABCD'].map(v=>[v,records.filter(r=>r.q[11]===v).length]))},null,2));
console.log(JSON.stringify({target,records:records.length,validated:true}));
