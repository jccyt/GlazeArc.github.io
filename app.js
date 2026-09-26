/* GLAZE ARC — Outdo Mode v1.1.0. Mobile-first. 4 pillars. Vanilla JS. */
const KEY = 'glazeArc_v1';
const CATS = ['MONEY','BODY','HEALTH','PRODUCTIVITY'];
const PILLAR_META = {
  MONEY:{emoji:'💰',short:'MON',codes:['m','mon','money']},
  BODY:{emoji:'🏋️',short:'BODY',codes:['b','body']},
  HEALTH:{emoji:'🍏',short:'HLTH',codes:['h','hlth','health']},
  PRODUCTIVITY:{emoji:'⚡',short:'PROD',codes:['p','prod','productivity']}
};
const OUTDO_MAX_PER_CAT = 2;

const FILLER_WORDS = ['email','inbox','clean','tidy','organize','organise','browse','scroll','netflix','meeting','laundry','dishes','watch','youtube','tiktok','instagram','news','chat','admin','file','sort'];
const NEEDLE_WORDS = ['client','$','revenue','sales','close','deal','offer','ship','publish','launch','outreach','proposal','lift','run','pushup','pullup','squat','workout','gym','deep','code','build','write','read','meditat','cold','fast','protein','sleep','portfolio','interview','exam','study'];

const QUOTES = [
  '"Discipline is choosing what you want most over what you want now."',
  '"Your animal brain wants comfort. Starve it."',
  '"Nobody is coming. You are the rescue."',
  '"Small ice cracks sink big ships. No zero days."',
  '"Comfort lied to you yesterday too."',
  '"Goldilocks or nothing. Not too easy. Not chaos."'
];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function uid(){ return Math.random().toString(36).slice(2,9); }
function dayStr(d=new Date()){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function addDays(base, n){ const d=new Date(base); d.setDate(d.getDate()+n); return d; }
function diffDays(a,b){ // a,b YYYY-MM-DD
  const da=new Date(a+'T00:00:00'), db=new Date(b+'T00:00:00');
  return Math.round((db-da)/86400000);
}
function last7Days(){
  const out=[]; const today=new Date();
  for(let i=6;i>=0;i--) out.push(addDays(today,-i));
  return out;
}
function weekdayShort(d){ return ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]; }

/* ---------- STORE ---------- */
function defaultState(){
  return {
    streak:{current:0,longest:0,lastCheckIn:null},
    xp:{MONEY:0,BODY:0,HEALTH:0,PRODUCTIVITY:0},
    tasks:[],
    habits:[],
    logs:{}, // date -> {tasksDone:[ids], habitsDone:[ids]}
    session:{active:false,endsAt:0,taskId:null,remaining:25*60},
    overloadSeen:{}
  };
}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(!raw){
      const s=defaultState();
      // seed for first run so matrix/top3 aren't empty
      const t1=uid(),t2=uid();
      s.tasks=[
        {id:t1,title:'Close 1 revenue action — outreach / sell / ship',cat:'MONEY',impact:10,done:false,createdAt:Date.now(),date:dayStr()},
        {id:t2,title:'40 min deep work — no phone',cat:'PRODUCTIVITY',impact:9,done:false,createdAt:Date.now(),date:dayStr()}
      ];
      s.habits=[
        {id:uid(),name:'Pushups',cat:'BODY',target:20,unit:'reps',phase:1,completions:[],createdAt:Date.now()},
        {id:uid(),name:'Read',cat:'PRODUCTIVITY',target:10,unit:'pages',phase:1,completions:[],createdAt:Date.now()},
        {id:uid(),name:'No sugar',cat:'HEALTH',target:1,unit:'day',phase:1,completions:[],createdAt:Date.now()}
      ];
      save(s); return s;
    }
    const s={...defaultState(),...JSON.parse(raw)};
    // migrate legacy MIND pillar into PRODUCTIVITY (Outdo = 4 pillars)
    if(s.xp && s.xp.MIND){ s.xp.PRODUCTIVITY=(s.xp.PRODUCTIVITY||0)+s.xp.MIND; delete s.xp.MIND; }
    s.tasks=(s.tasks||[]).map(t=>({...t,cat:t.cat==='MIND'?'PRODUCTIVITY':t.cat}));
    s.habits=(s.habits||[]).map(h=>({...h,cat:h.cat==='MIND'?'PRODUCTIVITY':h.cat}));
    return s;
  }catch{ return defaultState(); }
}
function save(s){ localStorage.setItem(KEY, JSON.stringify(s)); }
let S = load();

function logDone(date, kind, id){
  if(!S.logs[date]) S.logs[date]= {tasksDone:[],habitsDone:[]};
  const arr = kind==='task'? S.logs[date].tasksDone : S.logs[date].habitsDone;
  if(!arr.includes(id)) arr.push(id);
}
function completionsFor(date, cat){
  const L=S.logs[date]; if(!L) return 0;
  let n=0;
  for(const id of L.tasksDone){ const t=S.tasks.find(x=>x.id===id); if(t&&t.cat===cat) n++; }
  for(const id of L.habitsDone){ const h=S.habits.find(x=>x.id===id); if(h&&h.cat===cat) n++; }
  return n;
}

/* ---------- STREAK ---------- */
function touchStreak(){
  const today=dayStr();
  const last=S.streak.lastCheckIn;
  if(last===today) return;
  const d = last? diffDays(last,today): 99;
  if(d===1) S.streak.current+=1;
  else S.streak.current=1;
  S.streak.longest=Math.max(S.streak.longest,S.streak.current);
  S.streak.lastCheckIn=today;
  save(S);
}

/* ---------- SCORING (Productive Redirection) ---------- */
function scoreTask(t){
  let score = Number(t.impact||5);
  const low=t.title.toLowerCase();
  for(const w of FILLER_WORDS) if(low.includes(w)) score-=3;
  for(const w of NEEDLE_WORDS) if(low.includes(w)) score+=2.5;
  if(t.title.length<12) score-=1; // vague = filler
  if(/\d/.test(t.title)) score+=1; // measurable = needle
  return Math.max(1,Math.min(12,score));
}
function top3(){
  return S.tasks.filter(t=>!t.done)
    .map(t=>({...t,score:scoreTask(t)}))
    .sort((a,b)=>b.score-a.score).slice(0,3);
}
function fillerCount(list){
  return list.filter(t=>scoreTask(t)<5).length;
}

/* ---------- OVERLOAD ---------- */
function habitStreak(h){
  // consecutive days ending today or yesterday
  let s=0; let cursor=new Date();
  const set=new Set(h.completions);
  // allow starting from yesterday if today not yet done
  if(!set.has(dayStr(cursor))) cursor=addDays(cursor,-1);
  while(set.has(dayStr(cursor))){ s++; cursor=addDays(cursor,-1); }
  return s;
}
let pendingOverload=null;
function checkOverload(h){
  const st=habitStreak(h);
  if(st>=3 && st%3===0){
    const key=h.id+'_'+st;
    if(!S.overloadSeen[key]){
      S.overloadSeen[key]=true; save(S);
      const oldT=h.target;
      const next=Math.max(oldT+1, Math.ceil(oldT*1.2));
      pendingOverload={habitId:h.id,oldT,next,streak:st};
      $('#overloadTitle').textContent=`${st}-DAY STREAK. WE ESCALATE.`;
      $('#overloadDesc').textContent=`${h.name} dominated ${st} days straight. Comfort adaptation detected. Phase ${h.phase} → ${h.phase+1}. No negotiation with mediocrity.`;
      $('#overloadOld').textContent=`${oldT} ${h.unit}`;
      $('#overloadNew').textContent=`${next} ${h.unit}`;
      openModal('#overloadModal');
    }
  }
}

/* ---------- RENDER ---------- */
let taskFilter='all';
function render(){
  renderStreak(); renderCats(); renderMatrix(); renderTasks(); renderTop3(); renderHabits(); renderSession(); renderZone(); renderOutdo();
}
function renderStreak(){
  $('#streakNum').textContent=S.streak.current;
  const doneToday = todayDoneCount();
  const totalToday = S.tasks.filter(t=>t.date===dayStr()).length + S.habits.length;
  const pct = totalToday? Math.round(doneToday/totalToday*100):0;
  $('#statToday').textContent=pct+'%';
  $('#statDone').textContent=totalDoneCount();
  $('#statBest').textContent=S.streak.longest;
  const totalXp=Object.values(S.xp).reduce((a,b)=>a+b,0);
  $('#statLevel').textContent='LV.'+(Math.floor(totalXp/300)+1);
  $('#xpTotalLabel').textContent=totalXp+' XP';
  $('#xpTotalFill').style.width=Math.min(100,(totalXp%300)/3)+'%';
}
function todayDoneCount(){
  const L=S.logs[dayStr()]; if(!L) return 0;
  return L.tasksDone.length+L.habitsDone.length;
}
function totalDoneCount(){
  return Object.values(S.logs).reduce((a,l)=>a+l.tasksDone.length+l.habitsDone.length,0);
}
function renderCats(){
  const grid=$('#catGrid'); grid.innerHTML='';
  for(const c of CATS){
    const xp=S.xp[c]||0;
    const lvl=Math.floor(xp/100)+1;
    const pct=xp%100;
    const today=completionsFor(dayStr(),c);
    const el=document.createElement('div');
    el.className='cat';
    el.innerHTML=`<div class="cat-top"><span class="cat-name">${c}</span><span class="cat-lvl">LV.${lvl}</span></div>
      <span class="cat-xp">${xp} <small style="font-size:11px;color:var(--mut)">XP</small></span>
      <div class="cat-bar"><div class="cat-fill" style="width:${pct}%"></div></div>
      <div class="cat-sub">${today? '◆ '+today+' proof today':'○ no proof today'}</div>
      <button class="btn ghost small cat-btn" data-cat="${c}">+ LOG PROOF</button>`;
    grid.appendChild(el);
  }
  grid.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{
    const c=b.dataset.cat;
    S.xp[c]=(S.xp[c]||0)+10;
    const id='manual_'+c+'_'+dayStr();
    logDone(dayStr(),'task',id); touchStreak(); save(S); render();
    toast(`+10 XP → ${c}. Proof logged.`);
  });
}
function renderMatrix(){
  const m=$('#matrix'); m.innerHTML='';
  const days=last7Days(); const today=dayStr();
  m.appendChild(cell('',true));
  for(const d of days){
    const ds=dayStr(d);
    const div=document.createElement('div');
    div.className='mx-head'+(ds===today?' today':'');
    div.textContent=weekdayShort(d);
    m.appendChild(div);
  }
  for(const c of CATS){
    const r=document.createElement('div'); r.className='mx-row'; r.textContent=c.slice(0,5); m.appendChild(r);
    for(const d of days){
      const ds=dayStr(d);
      const n=completionsFor(ds,c);
      const cellEl=document.createElement('div');
      cellEl.className='mx-cell '+(n>=2?'full':n===1?'part':'');
      cellEl.textContent=n>=2?'◆':n===1?'·':'';
      cellEl.title=`${c} ${ds}: ${n}`;
      m.appendChild(cellEl);
    }
  }
  function cell(t){ const d=document.createElement('div'); d.textContent=t; return d; }
}
function renderTop3(){
  const list=top3(); const box=$('#top3List'); box.innerHTML='';
  if(!list.length){ box.innerHTML='<div class="top3-empty">NO ACTIVE KILLS. ADD ONE. NOW.</div>'; }
  list.forEach((t,i)=>{
    const el=document.createElement('div'); el.className='kill-card';
    el.innerHTML=`<div class="kill-rank">0${i+1}</div>
      <div><div class="kill-title">${escapeHtml(t.title)}</div>
      <div class="kill-meta">${t.cat} · SCORE ${t.score.toFixed(1)} · IMPACT ${t.impact}</div></div>
      <div style="display:flex;gap:6px"><button class="kill-done" data-done="${t.id}">✓</button><button class="kill-skip" data-skip="${t.id}">SKIP</button></div>`;
    box.appendChild(el);
  });
  box.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>completeTask(b.dataset.done));
  box.querySelectorAll('[data-skip]').forEach(b=>b.onclick=()=>requestSkip('task',b.dataset.skip));
  // session select
  const sel=$('#sessionTask'); sel.innerHTML='';
  const actives=S.tasks.filter(t=>!t.done);
  if(!actives.length) sel.innerHTML='<option value="">No active kills</option>';
  actives.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.title.slice(0,40); sel.appendChild(o); });
}
function renderTasks(){
  const box=$('#taskList'); box.innerHTML='';
  let list=[...S.tasks].sort((a,b)=>b.createdAt-a.createdAt);
  if(taskFilter==='active') list=list.filter(t=>!t.done);
  if(taskFilter==='done') list=list.filter(t=>t.done);
  if(!list.length){ box.innerHTML='<div class="top3-empty">EMPTY. WEAK.</div>'; return; }
  list.slice(0,30).forEach((t,idx)=>{
    const el=document.createElement('div'); el.className='task'+(t.done?' done':'');
    el.innerHTML=`<button class="t-check" data-c="${t.id}">${t.done?'✓':(idx<5?(idx+1):'○')}</button>
      <div><div class="t-title">${escapeHtml(t.title)}</div><div class="t-meta">${t.cat} · SCORE ${scoreTask(t).toFixed(1)} · ${t.date}</div></div>
      <div class="t-actions">${t.done?'':`<button class="icon-btn" data-s="${t.id}">SKIP</button>`}<button class="icon-btn" data-del="${t.id}">✕</button></div>`;
    box.appendChild(el);
  });
  box.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>completeTask(b.dataset.c));
  box.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>requestSkip('task',b.dataset.s));
  box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    S.tasks=S.tasks.filter(t=>t.id!==b.dataset.del); save(S); render();
  });
}
function renderHabits(){
  const box=$('#habitList'); box.innerHTML='';
  if(!S.habits.length){ box.innerHTML='<div class="top3-empty">NO HABITS. ADD ONE ABOVE.</div>'; return; }
  const today=dayStr();
  for(const h of S.habits){
    const done=h.completions.includes(today);
    const st=habitStreak(h);
    const el=document.createElement('div'); el.className='habit';
    el.innerHTML=`<div class="habit-top"><span class="habit-name">${escapeHtml(h.name)} — ${h.target} ${escapeHtml(h.unit)}</span><span class="habit-phase">PHASE ${h.phase} · 🔥${st}</span></div>
      <div class="habit-bar"><div class="habit-fill" style="width:${Math.min(100,st/3*100)}%"></div></div>
      <div class="habit-meta">${h.cat} · ${h.completions.length} total proofs · ${done?'DOMINATED TODAY':'PENDING TODAY'}</div>
      <div class="habit-actions">
        <button class="btn ${done?'ghost':'primary'} small" data-hdone="${h.id}" ${done?'disabled':''}>${done?'✓ DONE':'✓ COMPLETE'}</button>
        <button class="icon-btn" data-hskip="${h.id}">SKIP</button>
        <button class="icon-btn" data-hdel="${h.id}">✕</button>
      </div>`;
    box.appendChild(el);
  }
  box.querySelectorAll('[data-hdone]').forEach(b=>b.onclick=()=>completeHabit(b.dataset.hdone));
  box.querySelectorAll('[data-hskip]').forEach(b=>b.onclick=()=>requestSkip('habit',b.dataset.hskip));
  box.querySelectorAll('[data-hdel]').forEach(b=>b.onclick=()=>{
    S.habits=S.habits.filter(h=>h.id!==b.dataset.hdel); save(S); render();
  });
}
function renderZone(){
  const active=S.tasks.filter(t=>!t.done).length + S.habits.filter(h=>!h.completions.includes(dayStr())).length;
  let zone='goldilocks',label='GOLDILOCKS // GROWTH',hint='Locked in. 3–5 active kills. This is where you mutate.';
  if(active<=2){ zone='comfort'; label='COMFORT // TOO EASY'; hint='Too easy. Add 1–2 lethal kills. Comfort = decay.'; }
  if(active>=6){ zone='panic'; label='PANIC // OVERLOAD'; hint='Too much. Kill filler, keep top 3. Chaos = quit.'; }
  $$('.zone-seg').forEach(el=>{
    el.classList.toggle('active', el.dataset.zone===zone);
  });
  $('#zoneLabel').textContent=label;
  $('#zoneHint').textContent=`${active} open fronts. `+hint;
}

/* ---------- OUTDO MODE (skill v1.1.0) ---------- */
function codeToCat(code){
  code=code.toLowerCase();
  for(const c of CATS) if(PILLAR_META[c].codes.includes(code)) return c;
  return null;
}
function activeCountForCat(cat){
  return S.tasks.filter(t=>!t.done&&t.cat===cat&&t.date===dayStr()).length;
}
function outdoRowFor(cat){
  // top active task today in cat, else latest active, else habit, else empty
  const today=dayStr();
  let t=S.tasks.filter(x=>!x.done&&x.cat===cat&&(x.date===today)).sort((a,b)=>scoreTask(b)-scoreTask(a))[0]
    || S.tasks.filter(x=>!x.done&&x.cat===cat).sort((a,b)=>scoreTask(b)-scoreTask(a))[0];
  if(t) return {kind:'task',ref:t,title:t.title,done:false,id:t.id};
  const h=S.habits.find(x=>x.cat===cat);
  if(h){
    const done=h.completions.includes(today);
    return {kind:'habit',ref:h,title:`${h.name} — ${h.target} ${h.unit}`,done,id:h.id};
  }
  return {kind:'none',title:'— no kill set',done:false,id:null};
}
function renderOutdo(){
  const s=$('#outdoStreak'); if(s) s.textContent=`⚡ STREAK: ${S.streak.current} Days`;
  const body=$('#outdoBody'); if(!body) return;
  body.innerHTML='';
  for(const c of CATS){
    const m=PILLAR_META[c]; const row=outdoRowFor(c);
    const tr=document.createElement('tr');
    const status=row.done?'<span class="outdo-done">[✔] Done</span>':row.kind==='none'?'<span class="outdo-pend">[ ] Empty</span>':'<span class="outdo-pend">[ ] Pending</span>';
    tr.innerHTML=`<td><strong>${m.emoji} ${m.short}</strong></td><td>${escapeHtml(row.title.slice(0,60))}${!row.done&&row.kind!=='none'?`<button class="outdo-act" data-micro="${row.id}" data-kind="${row.kind}">→?</button>`:''}</td><td>${status} ${!row.done&&row.kind!=='none'?`<button class="outdo-act" data-d="${row.id}" data-k="${row.kind}">✓</button>`:''}</td>`;
    body.appendChild(tr);
  }
  body.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{
    if(b.dataset.k==='habit') completeHabit(b.dataset.d);
    else completeTask(b.dataset.d);
  });
  body.querySelectorAll('[data-micro]').forEach(b=>b.onclick=()=>askMicroStep(b.dataset.kind,b.dataset.micro));
}
function askMicroStep(kind,id){
  const box=$('#microStepBox');
  const item = kind==='habit'? S.habits.find(h=>h.id===id) : S.tasks.find(t=>t.id===id);
  if(!item) return;
  const name=item.title||item.name;
  box.innerHTML=`<strong>NEXT MICRO-STEP → "${escapeHtml(String(name).slice(0,50))}":</strong><br><span style="color:var(--mut)">1 tiny move you can do from your phone right now?</span><div class="input-row" style="margin-top:6px"><input id="microInput" placeholder="e.g. open gym bag, text 1 client…" /><button class="btn primary small" id="microSave">SET</button></div>`;
  $('#microSave').onclick=()=>{
    const v=$('#microInput').value.trim(); if(!v) return;
    item.next=v; save(S); render();
    toast('Friction cut. Do that micro-step now.');
  };
  $('#microInput').focus();
}
// shorthand: "m1 b0 h1 p1" | "+money -body" | "+mon"
function parseQuickLog(raw){
  const actions=[]; // {cat, done:boolean}
  const parts=raw.toLowerCase().split(/[\s,;]+/).filter(Boolean);
  for(const p of parts){
    let m=p.match(/^([mbhp])([01])$/); // m1 b0
    if(m){ actions.push({cat:codeToCat({m:'MONEY',b:'BODY',h:'HEALTH',p:'PRODUCTIVITY'}[m[1]]),done:m[2]==='1'}); continue; }
    m=p.match(/^([+-])([a-z]+)$/); // +money -body +mon
    if(m){ const c=codeToCat(m[2]); if(c) actions.push({cat:c,done:m[1]==='+'}); continue; }
    const c=codeToCat(p); if(c) actions.push({cat:c,done:true});
  }
  return actions;
}
function applyQuickLog(){
  const el=$('#quickLog'); const raw=el.value.trim();
  if(!raw){ toast('Type: m1 b0 h1 p1'); return; }
  const actions=parseQuickLog(raw);
  if(!actions.length){ toast('No code. Try +mon / m1 b0'); return; }
  let done=0, blocked=0;
  for(const a of actions){
    // find today's top active task in cat
    const cand=S.tasks.filter(t=>!t.done&&t.cat===a.cat).sort((x,y)=>scoreTask(y)-scoreTask(x))[0];
    if(a.done){
      if(cand){ completeTaskSilent(cand.id); done++; }
      else {
        if(activeCountForCat(a.cat)>=OUTDO_MAX_PER_CAT){ blocked++; continue; }
        S.tasks.push({id:uid(),title:`Outdo proof — ${a.cat}`,cat:a.cat,impact:7,done:true,createdAt:Date.now(),date:dayStr()});
        const nt=S.tasks[S.tasks.length-1];
        S.xp[a.cat]=(S.xp[a.cat]||0)+14; logDone(dayStr(),'task',nt.id); done++;
      }
    } else {
      if(cand) requestSkip('task',cand.id);
      else done++;
    }
  }
  touchStreak(); save(S); el.value=''; render();
  toast(blocked?`${done} logged. ${blocked} blocked: max 2/pillar.`:`${done} logged. Only what matters.`);
}
function completeTaskSilent(id){
  const t=S.tasks.find(x=>x.id===id); if(!t||t.done) return;
  t.done=true; S.xp[t.cat]=(S.xp[t.cat]||0)+Number(t.impact||5)*2;
  logDone(dayStr(),'task',id);
}
function enforceMaxPerCat(cat){
  if(activeCountForCat(cat)>=OUTDO_MAX_PER_CAT){
    toast(`${cat}: max ${OUTDO_MAX_PER_CAT}. Finish one first.`);
    return false;
  }
  return true;
}

/* ---------- ACTIONS ---------- */
function completeTask(id){
  const t=S.tasks.find(x=>x.id===id); if(!t||t.done) return;
  t.done=true;
  S.xp[t.cat]=(S.xp[t.cat]||0)+Number(t.impact||5)*2;
  logDone(dayStr(),'task',id); touchStreak(); save(S); render();
  toast(`KILL CONFIRMED +${Number(t.impact||5)*2} XP → ${t.cat} ⚡︎`);
}
function completeHabit(id){
  const h=S.habits.find(x=>x.id===id); if(!h) return;
  const today=dayStr();
  if(h.completions.includes(today)) return;
  h.completions.push(today);
  S.xp[h.cat]=(S.xp[h.cat]||0)+20;
  logDone(today,'habit',id); touchStreak(); save(S); render();
  toast(`HABIT DOMINATED +20 XP → ${h.cat}`);
  checkOverload(h);
}

/* ---------- FRICTION ---------- */
let pendingSkip=null, frictionTimer=null, frictionLeft=10, holdTimer=null, holdStart=0;
function requestSkip(type,id){
  pendingSkip={type,id};
  const item = type==='task'? S.tasks.find(t=>t.id===id) : S.habits.find(h=>h.id===id);
  $('#frictionTitle').innerHTML='YOU ARE ABOUT<br />TO QUIT.';
  $('#frictionBody').textContent=`Skip "${(item?.title||item?.name||'this').slice(0,60)}"? Your animal brain wants dopamine. Make it earn the quit.`;
  $('#frictionQuote').textContent=QUOTES[Math.floor(Math.random()*QUOTES.length)];
  $('#weaknessInput').value='';
  openFriction();
}
function openFriction(){
  $('#frictionScreen').hidden=false;
  document.body.style.overflow='hidden';
  frictionLeft=10; $('#frictionCount').textContent=frictionLeft;
  clearInterval(frictionTimer);
  frictionTimer=setInterval(()=>{
    frictionLeft--;
    $('#frictionCount').textContent=Math.max(0,frictionLeft);
    if(frictionLeft<=0){ clearInterval(frictionTimer); }
  },1000);
  // hold logic
  const btn=$('#holdToQuit'); const fill=$('#holdFill');
  const cancel=()=>{ clearInterval(holdTimer); fill.style.width='0%'; };
  btn.onpointerdown=()=>{ holdStart=Date.now(); holdTimer=setInterval(()=>{
    const p=(Date.now()-holdStart)/3000;
    fill.style.width=Math.min(100,p*100)+'%';
    if(p>=1){ clearInterval(holdTimer); fill.style.width='0%'; confirmSkip(); }
  },50); };
  ['pointerup','pointerleave'].forEach(e=>btn.addEventListener(e,cancel));
}
function closeFriction(stayed=true){
  $('#frictionScreen').hidden=true;
  document.body.style.overflow='';
  clearInterval(frictionTimer);
  if(stayed){ pendingSkip=null; toast('GOOD. YOU STAYED IN THE ARC ⚡︎'); }
  render();
}
function confirmSkip(){
  if(!pendingSkip){ closeFriction(false); return; }
  const {type,id}=pendingSkip;
  if(type==='task'){ S.tasks=S.tasks.filter(t=>t.id!==id); }
  if(type==='habit'){
    // log a miss: reset streak visually by removing nothing, just toast + XP penalty
    const h=S.habits.find(x=>x.id===id);
    if(h) S.xp[h.cat]=Math.max(0,(S.xp[h.cat]||0)-15);
  }
  if(type==='session'){ stopSession(true); }
  pendingSkip=null;
  $('#frictionScreen').hidden=true; document.body.style.overflow='';
  save(S); render();
  toast('WEAKNESS LOGGED. -15 XP. THE ICE REMEMBERS.');
}

/* ---------- SESSION ---------- */
let tick=null;
function renderSession(){
  const r=S.session.remaining||25*60;
  $('#timerDisplay').textContent=fmt(r);
  $('#sessionState').textContent=S.session.active?'● LIVE':'IDLE';
}
function fmt(s){ s=Math.max(0,Math.round(s)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
function startSession(){
  const taskId=$('#sessionTask').value;
  if(!taskId){ toast('No active kills to focus on.'); return; }
  S.session={active:true,taskId,remaining:25*60,endsAt:Date.now()+25*60*1000};
  save(S); renderSession();
  clearInterval(tick);
  tick=setInterval(()=>{
    S.session.remaining-=1; save(S); renderSession();
    if(S.session.remaining<=0){
      clearInterval(tick);
      const t=S.tasks.find(x=>x.id===S.session.taskId);
      S.session={active:false,taskId:null,remaining:25*60};
      save(S); render();
      toast('SESSION COMPLETE. +30 XP. BEAST.');
      if(t){ S.xp[t.cat]+=30; save(S); render(); }
    }
  },1000);
  toast('KILL SESSION LIVE. 25:00. NO ESCAPE WITHOUT FRICTION.');
}
function stopSession(force){
  clearInterval(tick);
  S.session={active:false,taskId:null,remaining:25*60};
  save(S); renderSession();
  if(!force) render();
}

/* ---------- MODALS / TOAST / HELPERS ---------- */
function openModal(s){ $(s).hidden=false; }
function closeModals(){ $$('.modal-backdrop').forEach(m=>m.hidden=true); }
function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  $('#toasts').appendChild(t);
  setTimeout(()=>t.remove(),3200);
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ---------- EVENTS ---------- */
function bind(){
  $$('[data-goto]').forEach(b=>b.onclick=()=>{ document.getElementById(b.dataset.goto)?.scrollIntoView({behavior:'smooth'}); });
  $('#navNewBtn').onclick=openNew;
  $('#newTaskBtn').onclick=openNew;
  $('#createTaskBtn').onclick=createTask;
  $('#checkinBtn').onclick=()=>{ touchStreak(); save(S); render(); toast(`PROOF LOGGED. STREAK: ${S.streak.current} ⚡︎`); };
  $('#startSessionBtn').onclick=()=>{ document.getElementById('focus').scrollIntoView({behavior:'smooth'}); startSession(); };
  $('#sessionToggle').onclick=()=>{ S.session.active? stopSession() : startSession(); $('#sessionToggle').textContent=S.session.active?'PAUSE':'START'; };
  $('#sessionExit').onclick=()=>{ if(!S.session.active){toast('No live session.');return;} pendingSkip={type:'session'}; $('#frictionTitle').innerHTML='ABORT THE<br />SESSION?'; openFriction(); };
  $('#fightBackBtn').onclick=()=>closeFriction(true);
  $('#weaknessInput').oninput=(e)=>{ if(e.target.value.trim()==='I CHOOSE WEAKNESS') confirmSkip(); };
  $('#habitForm').onsubmit=(e)=>{
    e.preventDefault();
    const name=$('#habitName').value.trim(); if(!name) return;
    S.habits.push({id:uid(),name,cat:$('#habitCat').value,target:Number($('#habitTarget').value)||10,unit:$('#habitUnit').value||'reps',phase:1,completions:[],createdAt:Date.now()});
    $('#habitName').value=''; save(S); render(); toast('HABIT ARMED. 3 DAYS → OVERLOAD.');
  };
  $('#addTaskFromFocus').onclick=addFromFocus;
  $('#focusInput').onkeydown=(e)=>{ if(e.key==='Enter') addFromFocus(); };
  $('#quickLogBtn').onclick=applyQuickLog;
  $('#quickLog').onkeydown=(e)=>{ if(e.key==='Enter') applyQuickLog(); };
  $$('.chip').forEach(c=>c.onclick=()=>{ $$('.chip').forEach(x=>x.classList.remove('active')); c.classList.add('active'); taskFilter=c.dataset.filter; renderTasks(); });
  $$('[data-close]').forEach(b=>b.onclick=closeModals);
  $$('.modal-backdrop').forEach(m=>m.addEventListener('click',(e)=>{ if(e.target===m) closeModals(); }));
  $('#overloadAccept').onclick=()=>{
    if(pendingOverload){
      const h=S.habits.find(x=>x.id===pendingOverload.habitId);
      if(h){ h.target=pendingOverload.next; h.phase+=1; S.xp[h.cat]+=25; save(S); toast(`OVERLOAD ACCEPTED → ${h.target} ${h.unit}. +25 XP.`); }
    }
    pendingOverload=null; closeModals(); render();
  };
  $('#overloadDecline').onclick=()=>{ pendingOverload=null; closeModals(); toast('Overload declined. Comfort logged.'); render(); };

  // global shortcuts
  document.addEventListener('keydown',(e)=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
    if(e.key==='Escape'){
      if(!$('#frictionScreen').hidden){ closeFriction(true); return; }
      closeModals(); return;
    }
    if(typing){ if(e.key==='Enter'&&document.activeElement?.id==='newTaskTitle') createTask(); return; }
    const k=e.key.toLowerCase();
    if(k==='d'){ document.getElementById('dashboard').scrollIntoView({behavior:'smooth'}); }
    if(k==='n'){ openNew(); }
    if(k==='f'){ startSession(); }
    if(k==='o'){ document.querySelector('.outdo-panel')?.scrollIntoView({behavior:'smooth'}); }
    if(k==='?'){ openModal('#helpModal'); }
    if(['1','2','3','4'].includes(k)){
      const t=top3()[Number(k)-1]; if(t) completeTask(t.id);
    }
  });

  // calibrated friction on tab close during live session
  window.addEventListener('beforeunload',(e)=>{
    if(S.session.active){
      e.preventDefault(); e.returnValue='';
    }
  });
}
function openNew(){ openModal('#taskModal'); setTimeout(()=>$('#newTaskTitle').focus(),50); }
function createTask(){
  const title=$('#newTaskTitle').value.trim(); if(!title){ toast('Name the kill first.'); return; }
  const cat=$('#newTaskCat').value;
  if(!enforceMaxPerCat(cat)) return;
  S.tasks.push({id:uid(),title,cat,impact:Number($('#newTaskImpact').value)||6,done:false,createdAt:Date.now(),date:dayStr()});
  $('#newTaskTitle').value=''; closeModals(); save(S); render();
  const sc=scoreTask(S.tasks[S.tasks.length-1]);
  toast(sc<5?'FILTERED AS FILLER — do it only after top 3.':`KILL ADDED. SCORE ${sc.toFixed(1)}. TOP 3 UPDATED.`);
}
function addFromFocus(){
  const v=$('#focusInput').value.trim(); if(!v) return;
  // split by comma/newline into candidate tasks
  const parts=v.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).slice(0,6);
  let added=0;
  for(const p of parts){
    const probe={title:p,impact:6};
    if(scoreTask(probe)<4 && parts.length>1) continue; // filter filler when bulk dump
    const cat=guessCat(p);
    if(activeCountForCat(cat)>=OUTDO_MAX_PER_CAT) continue; // Outdo rule: max 2
    S.tasks.push({id:uid(),title:p[0].toUpperCase()+p.slice(1),cat,impact:Math.round(scoreTask(probe)),done:false,createdAt:Date.now(),date:dayStr()});
    added++;
  }
  $('#focusInput').value='';
  save(S); render();
  const kills=fillerCount(S.tasks.filter(t=>!t.done));
  $('#filterResult').textContent=`→ ${added} committed. ${kills} filler still in list — ignore them. Execute top 3 only.`;
  $('#filterResult').style.color='var(--frost)';
}
function guessCat(t){
  const l=t.toLowerCase();
  if(/\$|client|revenue|sales|money|deal|offer/.test(l)) return 'MONEY';
  if(/lift|run|push|gym|workout|protein|walk/.test(l)) return 'BODY';
  if(/sleep|sugar|fast|cold|water|health|doctor/.test(l)) return 'HEALTH';
  if(/deep|code|ship|study|exam|build|write|read|meditat|journal|mind|focus/.test(l)) return 'PRODUCTIVITY';
  return 'PRODUCTIVITY';
}

/* ---------- INIT ---------- */
bind();
render();
