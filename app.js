/* OUTDO MODE v1.1.0 — mobile-first. 4 pillars. Offline. */
const KEY = 'glazeArc_v2';
const ORDER = ['BODY','MONEY','HEALTH','PRODUCTIVITY'];
const META = {
  BODY:{emoji:'🏋️',dot:'#f43f5e',codes:['b','body']},
  MONEY:{emoji:'💰',dot:'#818cf8',codes:['m','mon','money']},
  HEALTH:{emoji:'🍏',dot:'#34d399',codes:['h','hlth','health']},
  PRODUCTIVITY:{emoji:'⚡',dot:'#fbbf24',codes:['p','prod','productivity']}
};
const MAX_PER = 2, ACC = '#8b7cf6';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2,9);
const ds = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let S = load();
let selDate = ds();           // selected day
let weekOffset = 0;           // week nav
let pendingOnly = false;
let detailId = null, pendingSkip = null;

function def(){ return {streak:{c:0,best:0,last:null}, xp:{BODY:0,MONEY:0,HEALTH:0,PRODUCTIVITY:0}, tasks:[]}; }
function load(){
  try{
    const r = localStorage.getItem(KEY);
    if(!r){
      const s = def(), t = ds();
      s.tasks = [
        {id:uid(),pillar:'BODY',title:'Gym',sub:'6 exercises',mode:'percent',pct:86,done:false,date:t,next:''},
        {id:uid(),pillar:'BODY',title:'Stretching',sub:'Toggle',mode:'toggle',done:true,date:t,next:''},
        {id:uid(),pillar:'MONEY',title:'Marketing',sub:'4 hours',mode:'count',cur:3,total:4,done:false,date:t,next:''},
        {id:uid(),pillar:'HEALTH',title:'Sleep 8h',sub:'Recovery',mode:'toggle',done:false,date:t,next:''},
        {id:uid(),pillar:'PRODUCTIVITY',title:'Deep-work block',sub:'No scrolling',mode:'toggle',done:false,date:t,next:''}
      ];
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return {...def(), ...JSON.parse(r)};
  }catch{ return def(); }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }

/* ----- helpers ----- */
function dayTasks(d){ return S.tasks.filter(t=>t.date===d); }
function pct(t){
  if(t.mode==='toggle') return t.done?100:0;
  if(t.mode==='count') return Math.min(100,Math.round((t.cur||0)/(t.total||1)*100));
  return t.done?100:(t.pct||0);
}
function isDone(t){ return t.mode==='toggle'?!!t.done : t.mode==='count'?(t.cur||0)>=(t.total||1) : !!t.done; }
function touch(){
  if(S.streak.last===selDate) return;
  const d = S.streak.last ? Math.round((new Date(selDate)-new Date(S.streak.last))/864e5) : 99;
  S.streak.c = (d===1)? S.streak.c+1 : 1;
  S.streak.best = Math.max(S.streak.best,S.streak.c);
  S.streak.last = selDate;
}
function toggle(t){
  if(t.mode==='toggle') t.done=!t.done;
  else if(t.mode==='count'){ t.cur=Math.min(t.total,(t.cur||0)+1); if(t.cur>=t.total) t.done=true; }
  else t.done=!t.done;
  if(isDone(t)){ S.xp[t.pillar]+=10; touch(); }
  save(); render();
}
function codeCat(c){ c=c.toLowerCase(); return ORDER.find(p=>META[p].codes.includes(c))||null; }
function parseQL(raw){
  const out=[];
  for(const p of raw.toLowerCase().split(/[\s,;]+/).filter(Boolean)){
    let m=p.match(/^([mbhp])([01])$/);
    if(m){ out.push({cat:{m:'MONEY',b:'BODY',h:'HEALTH',p:'PRODUCTIVITY'}[m[1]],done:m[2]==='1'}); continue; }
    m=p.match(/^([+-])([a-z]+)$/);
    if(m){ const c=codeCat(m[2]); if(c) out.push({cat:c,done:m[1]==='+'}); continue; }
    const c=codeCat(p); if(c) out.push({cat:c,done:true});
  }
  return out;
}
function quickLog(){
  const el=$('#quickLog'), raw=el.value.trim();
  if(!raw) return;
  const acts=parseQL(raw);
  if(!acts.length) return;
  for(const a of acts){
    const cands=S.tasks.filter(t=>t.pillar===a.cat&&t.date===selDate&&!isDone(t));
    if(a.done){
      if(cands[0]){ if(!isDone(cands[0])){ toggleSilent(cands[0]); } }
      else if(S.tasks.filter(t=>t.pillar===a.cat&&t.date===selDate).length<MAX_PER){
        S.tasks.push({id:uid(),pillar:a.cat,title:'Outdo proof',sub:'rapid log',mode:'toggle',done:true,date:selDate,next:''});
        S.xp[a.cat]+=10;
      }
    } else if(cands[0]) askFriction(cands[0]);
  }
  touch(); save(); el.value=''; render();
}
function toggleSilent(t){
  if(t.mode==='toggle') t.done=true;
  else if(t.mode==='count'){ t.cur=t.total; t.done=true; }
  else t.done=true;
  S.xp[t.pillar]+=10;
}

/* ----- week ----- */
function monday(){ const d=new Date(); d.setDate(d.getDate()-((d.getDay()+6)%7)+weekOffset*7); return d; }
function renderWeek(){
  const m=monday(), box=$('#weekStrip'); box.innerHTML='';
  $('#monthLabel').textContent = MON[new Date(selDate+'T12:00').getMonth()];
  const letters=['M','T','W','T','F','S','S'];
  for(let i=0;i<7;i++){
    const d=new Date(m); d.setDate(m.getDate()+i);
    const iso=ds(d), el=document.createElement('div');
    el.className='wday'+(iso===selDate?' sel':'')+(iso===ds()?' today':'');
    el.innerHTML=`<span class="wl">${letters[i]}</span><span class="wn">${d.getDate()}</span>`;
    el.onclick=()=>{ selDate=iso; render(); };
    box.appendChild(el);
  }
}

/* ----- rings ----- */
function ringSVG(p, done){
  const C=2*Math.PI*24, off=C*(1-p/100);
  return `<svg width="56" height="56"><circle cx="28" cy="28" r="24" fill="none" stroke="#23232e" stroke-width="3.5"/>
    <circle cx="28" cy="28" r="24" fill="none" stroke="${ACC}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"/></svg>`;
}
function centerLabel(t){
  if(t.mode==='toggle') return isDone(t)?'✓':'';
  if(t.mode==='count') return `${Math.min(t.cur||0,t.total)}/${t.total}`;
  return isDone(t)?'✓':(t.pct||0)+'%';
}

/* ----- render ----- */
function render(){
  renderWeek();
  const tasks=dayTasks(selDate);
  const done=tasks.filter(isDone).length;
  const pc=tasks.length?Math.round(done/tasks.length*100):0;
  $('#dayFill').style.width=pc+'%'; $('#dayPct').textContent=pc+'%';
  $('#streakLine').textContent=`⚡ STREAK: ${S.streak.c} Days`;
  // task list
  const sc=$('#taskScroll'); sc.innerHTML='';
  for(const p of ORDER){
    let list=tasks.filter(t=>t.pillar===p);
    if(pendingOnly) list=list.filter(t=>!isDone(t));
    if(!list.length&&pendingOnly) continue;
    const lab=document.createElement('div');
    lab.className='pillar-label';
    lab.innerHTML=`<span class="dot" style="background:${META[p].dot}"></span>${p}`;
    sc.appendChild(lab);
    if(!list.length){ const e=document.createElement('div'); e.className='empty'; e.textContent='— empty. + to add (max 2).'; sc.appendChild(e); continue; }
    for(const t of list){
      const row=document.createElement('div');
      row.className='taskrow';
      row.innerHTML=`<div class="ring ${isDone(t)?'done':''}">${ringSVG(pct(t))}<span class="rc">${centerLabel(t)}</span></div>
        <div><div class="ttitle">${esc(t.title)}</div><div class="tsub">${esc(t.sub||'')}</div></div><span class="chev">›</span>`;
      row.querySelector('.ring').onclick=e=>{e.stopPropagation();toggle(t);};
      row.onclick=()=>openDetail(t.id);
      sc.appendChild(row);
    }
  }
  renderDash(tasks); renderCores();
}
function renderDash(tasks){
  $('#dashStreak').textContent=`⚡ STREAK: ${S.streak.c} Days`;
  const done=tasks.filter(isDone).length;
  $('#dToday').textContent=(tasks.length?Math.round(done/tasks.length*100):0)+'%';
  $('#dDone').textContent=S.tasks.filter(isDone).length;
  $('#dBest').textContent=S.streak.best;
  const tb=$('#dashBody'); tb.innerHTML='';
  for(const p of ORDER){
    const t=tasks.find(x=>x.pillar===p);
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><strong>${META[p].emoji} ${p==='HEALTH'?'HLTH':p==='PRODUCTIVITY'?'PROD':p==='MONEY'?'MON':p}</strong></td>
      <td>${t?esc(t.title):'—'}</td><td>${t?(isDone(t)?'[✔] Done':'[ ] Pending'):'[ ] Empty'}</td>`;
    tb.appendChild(tr);
  }
}
function renderCores(){
  const box=$('#coresList'); if(!box) return; box.innerHTML='';
  for(const p of ORDER){
    const xp=S.xp[p]||0, lvl=Math.floor(xp/100)+1;
    const el=document.createElement('div'); el.className='core';
    el.innerHTML=`<div class="core-top"><span>${META[p].emoji} ${p}</span><span>LV.${lvl} · ${xp} XP</span></div>
      <div class="core-bar"><div style="width:${xp%100}%"></div></div>`;
    box.appendChild(el);
  }
}
function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ----- detail + friction ----- */
function openDetail(id){
  detailId=id;
  const t=S.tasks.find(x=>x.id===id); if(!t) return;
  $('#dtTitle').textContent=t.title; $('#dtSub').textContent=`${t.pillar} · ${t.sub||''}${t.next?' · → '+t.next:''}`;
  $('#dtMicro').hidden=true; $('#dtMicro').value=t.next||'';
  $('#detailSheet').hidden=false;
}
function askFriction(t){
  pendingSkip=t.id;
  $('#fBody').textContent=`Skip "${String(t.title).slice(0,40)}"? Do 1 micro-step first.`;
  $('#weakInput').value=''; $('#friction').hidden=false;
  let left=10; $('#fCount').textContent=left;
  clearInterval(window._ft);
  window._ft=setInterval(()=>{ left--; $('#fCount').textContent=Math.max(0,left); if(left<=0)clearInterval(window._ft); },1000);
}
function closeFriction(stayed){
  $('#friction').hidden=true; clearInterval(window._ft);
  if(stayed) pendingSkip=null;
}

/* ----- events ----- */
function bind(){
  $$('.tab').forEach(b=>b.onclick=()=>{
    $$('.tab').forEach(x=>x.classList.remove('active')); b.classList.add('active');
    $$('.view').forEach(v=>v.classList.remove('active'));
    $('#view-'+b.dataset.view).classList.add('active');
  });
  $('#weekPrev').onclick=()=>{weekOffset--; render();};
  $('#weekNext').onclick=()=>{weekOffset++; render();};
  $('#addBtn').onclick=()=>{ $('#taskSheet').hidden=false; setTimeout(()=>$('#ntTitle').focus(),50); };
  $('#filterBtn').onclick=e=>{ pendingOnly=!pendingOnly; e.currentTarget.style.color=pendingOnly?ACC:''; render(); };
  $('#quickLog').onkeydown=e=>{ if(e.key==='Enter') quickLog(); };
  $('#ntSave').onclick=()=>{
    const title=$('#ntTitle').value.trim(); if(!title) return;
    const pillar=$('#ntPillar').value;
    if(S.tasks.filter(t=>t.pillar===pillar&&t.date===selDate).length>=MAX_PER) return;
    const mode=$('#ntMode').value;
    S.tasks.push({id:uid(),pillar,title,sub:$('#ntSub').value.trim(),mode,pct:0,cur:0,total:Number($('#ntTotal').value)||4,done:false,date:selDate,next:''});
    $('#ntTitle').value=''; $('#ntSub').value='';
    $('#taskSheet').hidden=true; save(); render();
  };
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{ $('#taskSheet').hidden=true; $('#detailSheet').hidden=true; });
  $('#dtDone').onclick=()=>{ const t=S.tasks.find(x=>x.id===detailId); if(t){ if(!isDone(t)) toggle(t); $('#detailSheet').hidden=true; } };
  $('#dtStep').onclick=()=>{ const i=$('#dtMicro'); i.hidden=!i.hidden; if(!i.hidden) i.focus(); };
  $('#dtMicro').onchange=e=>{ const t=S.tasks.find(x=>x.id===detailId); if(t){ t.next=e.target.value.trim(); save(); render(); openDetail(detailId); } };
  $('#dtBack').onclick=()=>{ const t=S.tasks.find(x=>x.id===detailId); if(!t) return;
    if(t.mode==='count'){ t.cur=Math.max(0,(t.cur||0)-1); t.done=false; }
    else if(t.mode==='percent'){ t.pct=Math.max(0,(t.pct||0)-10); t.done=false; }
    else t.done=false; save(); render(); openDetail(detailId); };
  $('#dtFwd').onclick=()=>{ const t=S.tasks.find(x=>x.id===detailId); if(!t) return;
    if(t.mode==='count'){ t.cur=Math.min(t.total,(t.cur||0)+1); if(t.cur>=t.total){t.done=true;S.xp[t.pillar]+=10;touch();} }
    else if(t.mode==='percent'){ t.pct=Math.min(100,(t.pct||0)+10); if(t.pct>=100)t.done=true; }
    else if(!t.done) return toggle(t);
    save(); render(); openDetail(detailId); };
  $('#dtSkip').onclick=()=>{ const t=S.tasks.find(x=>x.id===detailId); $('#detailSheet').hidden=true; if(t) askFriction(t); };
  // friction hold
  const hb=$('#holdQuit'), fill=$('#holdFill');
  let ht=null;
  hb.onpointerdown=()=>{ const st=Date.now(); ht=setInterval(()=>{ const p=(Date.now()-st)/3000;
    fill.style.width=Math.min(100,p*100)+'%';
    if(p>=1){ clearInterval(ht); fill.style.width='0%'; doSkip(); } },50); };
  ['pointerup','pointerleave'].forEach(e=>hb.addEventListener(e,()=>{clearInterval(ht);fill.style.width='0%';}));
  $('#weakInput').oninput=e=>{ if(e.target.value.trim()==='I CHOOSE WEAKNESS') doSkip(); };
  $('#fightBack').onclick=()=>closeFriction(true);
  $('#resetDay').onclick=()=>{ S.tasks=S.tasks.filter(t=>t.date!==selDate); save(); render(); };
  $('#wipeAll').onclick=()=>{ if(confirm('Wipe everything?')){ S=def(); save(); render(); } };
  document.addEventListener('keydown',e=>{
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
    if(e.key==='Escape'){ $('#taskSheet').hidden=true; $('#detailSheet').hidden=true; if(!$('#friction').hidden)closeFriction(true); return; }
    if(typing) return;
    const k=e.key.toLowerCase();
    if(k==='n') $('#addBtn').click();
    if(k==='d') document.querySelector('[data-view="tasks"]').click();
    if(['1','2','3','4'].includes(k)){
      const p=ORDER[Number(k)-1];
      const t=S.tasks.find(x=>x.pillar===p&&x.date===selDate&&!isDone(x));
      if(t) toggle(t);
    }
  });
}
function doSkip(){
  const t=S.tasks.find(x=>x.id===pendingSkip);
  if(t) S.tasks=S.tasks.filter(x=>x.id!==pendingSkip);
  pendingSkip=null; $('#friction').hidden=true; save(); render();
}

bind(); render();

// Median.co / standalone: offline service worker (https only)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}
