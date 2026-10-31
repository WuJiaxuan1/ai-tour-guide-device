'use strict';
const $=s=>document.querySelector(s), main=$('#main'), memory=$('#memory');
let stage=0, enabled=false, volume=.55, ambience=null, busy=false, holdTimer=null, holdStarted=0;
const state={departure:null,home:null,wish:null};
const sounds={};for(const n of ['wind','stream','night','fire','paper','door','stone','bell']){sounds[n]=new Audio(`assets/audio/${n}.wav`);sounds[n].preload='none'}
const effects=new Set();let mix=[];
let sceneName='',sceneFront=0;
const mobileScenes=matchMedia('(max-width:700px)').matches;
const sceneAsset=name=>'assets/'+(mobileScenes?window.travelMobileScenes[name]||name:name);
const loadedScenes=new Map();
function prepareScene(name){
 const url=sceneAsset(name);
 if(!loadedScenes.has(url)){const img=new Image();img.decoding='async';img.src=url;loadedScenes.set(url,img.decode().catch(()=>{}));}
 return loadedScenes.get(url);
}
const sceneFiles=['plain-home.webp','plain-home.webp','plain-home.webp','plain-fadu.webp','plain-legacy.webp','qixia-today.webp'];
const sceneCaptions=['摄山 · 山居','山居 · 辞诏','初来摄山 · 安家','灯下 · 与法度夜谈','暮年 · 父子托付','今日 · 栖霞寺实景'];
async function showScene(){
 const name=sceneFiles[stage];document.querySelector('footer > span').textContent=stage===5?'栖霞寺 · 今日':'摄山 · 南齐';$('#scene-caption').textContent=sceneCaptions[stage];
 if(sceneName===name)return;
 await prepareScene(name);
 if(sceneFiles[stage]!==name||sceneName===name)return;
 const nodes=[$('#sceneA'),$('#sceneB')];
 const incoming=nodes[sceneName?1-sceneFront:0];
 incoming.style.backgroundImage=`url('${sceneAsset(name)}')`;
 if(sceneName){incoming.classList.add('active');nodes[sceneFront].classList.remove('active');sceneFront=1-sceneFront;}
 sceneName=name;
}

function play(n,gain=.5){if(!enabled||document.hidden)return;const a=sounds[n].cloneNode();a.volume=gain*volume;effects.add(a);a.onended=()=>effects.delete(a);a.play().catch(()=>effects.delete(a))}
function setAmbient(names){mix=names;for(const [n,a] of Object.entries(sounds)){if(['wind','stream','night','fire'].includes(n)){if(names.includes(n)&&enabled&&!document.hidden){a.loop=true;a.volume=volume*(n==='fire'?.32:.5);if(a.paused)a.play().catch(()=>{})}else a.pause();}}}
function setSound(on){enabled=on;$('#sound').textContent=`声音 · ${on?'开':'关'}`;$('#sound').setAttribute('aria-pressed',on);if(!on)for(const a of effects)a.pause();setAmbient(mix)}
$('#sound').onclick=()=>setSound(!enabled);$('#volume').oninput=e=>{volume=Number(e.target.value)/100;setAmbient(mix)};
document.addEventListener('visibilitychange',()=>{for(const a of effects)a.pause();setAmbient(mix)});
$('#about').onclick=()=>$('#info').showModal();$('#closeInfo').onclick=()=>$('#info').close();
function frame(k,title,body,extra=''){document.body.dataset.stage=stage;document.body.classList.toggle('ending',stage===5);showScene();main.innerHTML=`<section class="panel"><div class="eyebrow">${k}</div><h2 tabindex="-1">${title}</h2><p class="story">${body}</p>${extra}</section>`;$('#chapters').innerHTML=['辞诏','安家','夜谈','托付'].map((s,i)=>`<span class="dot ${stage===i+1?'current':stage>i+1?'done':''}"><i></i>${s}</span>`).join('');if(stage)main.querySelector('h2').focus({preventScroll:true});busy=false}
function buttons(items,fn){const box=document.createElement('div');box.className='choices';items.forEach((item,i)=>{const b=document.createElement('button');b.className='choice';b.innerHTML=`<small>0${i+1}</small><span><strong>${item[0]}</strong><span>${item[1]}</span></span>`;b.onclick=()=>perform('choice',({1:['departure-face','departure-letter'],2:['home-roof','home-books','home-path'],3:['wish-peace','wish-friend','wish-traveler']})[stage][i],()=>{play('paper',.5);fn(i)});box.appendChild(b)});main.querySelector('.panel').appendChild(box)}
function nextButton(label,fn){const b=document.createElement('button');b.className='primary';b.innerHTML=label+'<span class="arrow">→</span>';b.onclick=fn;main.querySelector('.panel').appendChild(b)}
const homes=[['修补屋顶','先让这间屋子，挡得住山里的雨。'],['安置书卷','漂泊一路，终于能让书卷安放。'],['打通山径','让取水的路，也让来时的路更好走。']];
const wishes=[['独处的归所','在山中，守住一份自己的安宁。'],['与知己相聚之处','有一盏灯，也有可以长谈的人。'],['为行路人歇脚之处','让疲惫的人，也能在这里坐一坐。']];
function intro(){stage=0;memory.textContent='';setAmbient([]);frame('一段可以亲历的人生 · 南齐','', '');main.querySelector('h2').outerHTML='<h1>我把家，<br>留给了这座山<span class="seal">栖霞</span></h1>';main.querySelector('.story').textContent='你是明僧绍。\n乱世之中，你将走进摄山，安顿一个家，\n再亲手决定，留给后来的人什么。';nextButton('走进这一生',()=>{setSound(true);setAmbient(['wind']);perform('open',null,departure)});main.querySelector('.panel').insertAdjacentHTML('beforeend','<p class="hint">三次选择 · 一次托付 · 约三分钟<br>建议戴上耳机，听一听山里的声音。</p>')}
function departure(){stage=1;setAmbient(['wind']);frame('第一幕 / 辞诏 · 约三十秒','山外，又来了一封诏书。','使者候在门外，许你仕途与俸禄。\n可乱世朝堂，容得下你想守住的生活吗？\n你已决意归山，要怎样与山外告别？');buttons([['当面谢绝','向使者说明心意，郑重辞别。'],['留书辞行','将未尽的话，写在一纸信笺上。']],i=>{state.departure=i;frame('第一幕 / 你的选择',i===0?'“我的心意，已在山中。”':'落笔，亦是告别。',i===0?'使者问：“先生，当真不再考虑？”\n你拱手道：“愿守此志，还望见谅。”':'你写下：“心有所归，恕难应召。”\n墨迹渐干。此去，愿寻一处安身之地。','<div class="result">山外的声音渐远。你转身，走向摄山。</div>');nextButton('循水入山',home)})}
function home(){prepareScene('plain-fadu.webp');stage=2;setAmbient(['wind','stream']);memory.textContent='摄山深处\n有一处可以安身的地方';frame('第二幕 / 安家 · 约五十秒','天色将晚，先安顿什么？','山岩旁，几间朴素的茅舍等你收拾。\n今天只来得及做一件事。\n不求周全，先让这里像个家。');buttons(homes,i=>{state.home=i;play(i===0?'door':i===1?'paper':'stone',.6);memory.textContent=['新补的屋檐\n接住了第一场雨','窗边的书卷\n终于不必随我漂泊','门前的小径\n通向山涧，也通向来客'][i];frame('第二幕 / 家有了你的痕迹',['你将最后一片茅草压好。','一卷一卷，安放旧日。','荒草退去，小径渐明。'][i],['夜里下起了雨。你坐在干燥的屋檐下，听雨水沿着檐角落下。','书卷在桌案上摆齐。窗边还有漏风的缝隙，明日再修也不迟。','你提水归来，脚下不再被枝蔓绊住。有人沿着这条路，来到了门前。'][i],'<div class="result">“往后，这里就是我的家了。”</div>');nextButton('灯下，有客来访',talk)})}
function talk(){prepareScene('plain-legacy.webp');stage=3;setAmbient(['night','fire']);memory.textContent='一盏灯\n两个人的长谈';frame('第三幕 / 夜谈 · 约四十秒','这里，将成为什么？','你们谈山外的纷乱，也谈人心的归处。\n灯火轻动。法度望向门外：\n“先生既得安居，往后作何打算？”');buttons(wishes,i=>{state.wish=i;frame('第三幕 / 他听见了你的心意',['安宁，值得好好守住。','此山，从此有了知己。','门外的人，也需要一处屋檐。'][i],['法度轻声说：“守得住内心，也是难得。”\n你望着灯火，想起自己漫长的来路。','法度将茶碗放下：“那便容我，再坐片刻。”\n窗外夜深，一席话仍未说尽。','法度点头：“一间屋舍，也可结下许多善缘。”\n你看向门口，心中有了一个尚未说出的念头。'][i],'<div class="result">许多年过去，这一夜的话，仍留在心里。</div>');nextButton('岁月，来到托付之时',legacy)})}
const sonHome=['这片屋檐是您修好的。往后上山的人，也能在这里避雨。','这些书卷是您安放的。往后灯下读书的人，会替您继续翻开。','这条山径是您打通的。往后来到这里的人，都能循路入山。'];
const sonWish=['您珍惜的安宁，我会好好留下。','您留给知己的灯，往后也会为来客亮着。','您想留给行路人的歇脚处，我记住了。'];
function legacy(){prepareScene('qixia-today.webp');stage=4;setAmbient(['wind']);memory.textContent=['修过的屋檐，仍在','安放的书卷，仍在','走过的山径，仍在'][state.home];frame('第四幕 / 托付 · 约一分钟','这个家，我想留下。','年华老去，你将次子明仲璋唤至身旁。\n“我离去后，将这片屋舍山地交给法度，\n供他修行弘法。莫让这份安宁，就此散去。”',`<div class="result">你望了一眼${['亲手修好的屋檐','窗边安放的书卷','门前开出的山径'][state.home]}。<br>这一次，你要留下的，是整个家。</div><p class="hint">按住交付约两秒，松开可停下。也可用键盘空格或回车。</p>`);const b=document.createElement('button');b.className='primary hold';b.innerHTML='<span>按住 · 将家托付</span>';main.querySelector('.panel').appendChild(b);
const cancel=()=>{cancelAnimationFrame(holdTimer);holdTimer=null;b.style.setProperty('--hold',0)};
const begin=()=>{if(holdTimer||busy)return;holdStarted=performance.now();const tick=()=>{const p=Math.min(1,(performance.now()-holdStarted)/1800);b.style.setProperty('--hold',p);if(p>=1){cancel();perform('choice','give-home',()=>{play('paper');promise()})}else holdTimer=requestAnimationFrame(tick);};holdTimer=requestAnimationFrame(tick);};
b.addEventListener('pointerdown',e=>{if(e.button!==0)return;b.setPointerCapture(e.pointerId);begin()});for(const e of ['pointerup','pointercancel','lostpointercapture','blur'])b.addEventListener(e,cancel);b.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();begin()}});b.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();cancel()}});document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()},{once:true});}
function promise(){stage=4;setAmbient(['wind']);memory.textContent='家宅有了新的归处';frame('第四幕 / 明仲璋的回应','“父亲，我记住了。”',sonHome[state.home]+'\n'+sonWish[state.wish],'<div class="result">图卷交到儿子手中。你轻轻松开了手。</div>');nextButton('看看这座山的后来',()=>perform('choice','see-today',ending))}
function ending(){stage=5;setAmbient(['wind']);play('bell',.6);memory.textContent='';frame('尾声 / 千年回响','后来，这里成了栖霞寺。','明仲璋依父亲遗愿，将家宅供养法度。\n山居成为寺院，山崖间渐有佛影。\n如今，你可以看看今日的栖霞寺。',`<div class="ending-view" aria-label="旧日山居与今日栖霞寺对比"><div class="today-photo" role="img" aria-label="今日栖霞寺实拍：银杏树下的殿宇"></div><div class="then-photo" role="img" aria-label="艺术演绎的旧日山居"></div><div class="time-line"></div><span class="photo-label">今日 · 栖霞寺实拍</span></div><label class="time-control">拖动时间，看看这一方天地的变化<input id="time" type="range" min="0" max="100" value="100" aria-label="从旧日山居到今日栖霞寺"><span><small>旧日山居 · 艺术演绎</small><small>今日寺院 · 实拍</small></span></label><div><span class="token">${['亲口辞诏','留书归山'][state.departure]}</span><span class="token">${homes[state.home][0]}</span><span class="token">${wishes[state.wish][0]}</span></div><div class="result">“在成为一处景点以前，<br>这里曾是我的家。”</div><p class="hint">今日照片由项目团队提供；历史场景与对白为艺术演绎。</p>`);
 const comparison=$('.ending-view'),range=$('#time');
 range.oninput=()=>{const p=Number(range.value);comparison.style.setProperty('--now',p+'%');$('.photo-label').textContent=p===0?'旧日 · 山居艺术演绎':p===100?'今日 · 栖霞寺实拍':'旧日山居 / 今日栖霞寺';};
 nextButton('再过一次山中人生',()=>perform('restart',null,()=>{Object.keys(state).forEach(k=>state[k]=null);departure()}));}

async function perform(action,choice,done){
 if(busy)return;busy=true;document.querySelector('#save-error')?.remove();
 const buttons=[...main.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 const status=document.createElement('p');status.className='save-status';status.setAttribute('role','status');status.textContent='正在保存选择…';
 const timer=setTimeout(()=>main.querySelector('.panel')?.appendChild(status),180);
 try{await window.travelBridge.act(action,choice);done();}
 catch(e){const p=document.createElement('p');p.id='save-error';p.setAttribute('role','alert');p.textContent=e.message;main.querySelector('.panel')?.appendChild(p);}
 finally{clearTimeout(timer);status.remove();buttons.forEach(b=>b.disabled=false);busy=false;}
}
function restore(saved){
 if(!saved){intro();return;}
 const ids=(saved.choices||[]).map(c=>c.choice_id);
 state.departure=ids.includes('departure-letter')?1:0;
 state.home=ids.includes('home-books')?1:ids.includes('home-path')?2:0;
 state.wish=ids.includes('wish-friend')?1:ids.includes('wish-traveler')?2:0;
 ({departure,home,talk,legacy,promise,ending}[saved.current_scene]||intro)();
}
window.travelBridge.ready.then(restore);
