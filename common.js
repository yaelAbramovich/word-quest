"use strict";
const $=id=>document.getElementById(id);
const store={
 get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},
 set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
};
function parse(k,d){try{return JSON.parse(store.get(k,d))}catch(e){return JSON.parse(d)}}

// shared progress: score, streak, learned words, mistakes (mistakes make a word come back more often)
const S={
 score:+store.get("wqScore",0)||0,
 streak:+store.get("wqStreak",0)||0,
 learned:new Set(parse("wqLearned","[]")),
 mistakes:parse("wqMistakes","{}"),
 keyHandler:null
};
const games={};
let currentTab=null;

const letters=w=>w.w.replace(/[^a-z]/gi,"").toUpperCase();
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
// random distinct words; words with more mistakes are more likely to be picked
function pickWeighted(n,filter){
 return words.filter(filter||(()=>true))
  .map(w=>({w,k:Math.pow(Math.random(),1/(1+(S.mistakes[w.w]||0)*2))}))
  .sort((a,b)=>b.k-a.k).slice(0,n).map(x=>x.w);
}

function renderStats(){
 $("score").textContent=S.score; $("streak").textContent=S.streak; $("learned").textContent=S.learned.size;
 $("progressText").textContent=`${S.learned.size} / ${words.length}`;
 $("progressBar").style.width=`${S.learned.size/words.length*100}%`;
}
function save(){
 store.set("wqScore",S.score); store.set("wqStreak",S.streak);
 store.set("wqLearned",JSON.stringify([...S.learned])); store.set("wqMistakes",JSON.stringify(S.mistakes));
 renderStats();
}
function good(w,pts=10){S.score+=pts;S.streak++;S.learned.add(w.w);S.mistakes[w.w]=Math.max(0,(S.mistakes[w.w]||0)-1);save()}
function bad(w){S.streak=0;S.mistakes[w.w]=(S.mistakes[w.w]||0)+1;save()}

function speak(text){
 if(!("speechSynthesis" in window)){return}
 try{
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang="en-US"; u.rate=.78;
  speechSynthesis.speak(u);
 }catch(e){}
}
document.addEventListener("click",e=>{
 const b=e.target.closest("[data-say]"); if(b) speak(b.dataset.say);
});

// the card shown after a word is used: sound button + translation + meaning + example
function wordCard(w,title){
 return `<div class="wcard">
  <button class="sound sm" data-say="${w.w}" aria-label="השמעה">🔊</button>
  <div>${title?`<div class="wtitle">${title}</div>`:""}
   <b class="en" dir="ltr">${w.w}</b> — ${w.he}
   <div class="mean">${w.m}</div><div class="example">${w.ex}</div></div></div>`;
}

function celebrate(msg){
 const d=document.createElement("div"); d.className="cele";
 d.innerHTML=`<div class="rain">${Array.from({length:14},(_,i)=>`<span style="left:${Math.random()*92}%;animation-delay:${(Math.random()*.5).toFixed(2)}s">${["🎉","⭐","✨","🎊"][i%4]}</span>`).join("")}</div><div class="msg">${msg}</div>`;
 document.body.appendChild(d); setTimeout(()=>d.remove(),2000);
}

// on-screen English keyboard (works on iPhone even when the phone keyboard is Hebrew)
function keyboardHTML(back){
 const rows=["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];
 return `<div class="kb" dir="ltr">${rows.map((r,i)=>`<div class="kr">${[...r].map(k=>`<button class="key" data-k="${k}">${k}</button>`).join("")}${back&&i===2?`<button class="key wide" data-k="⌫" aria-label="מחיקה">⌫</button>`:""}</div>`).join("")}</div>`;
}
function bindKeyboard(root,fn){
 root.onclick=e=>{const k=e.target.closest(".key"); if(k&&!k.disabled) fn(k.dataset.k)};
 S.keyHandler=fn;
}
document.addEventListener("keydown",e=>{
 if(!S.keyHandler||e.metaKey||e.ctrlKey||e.altKey) return;
 if(/^[a-z]$/i.test(e.key)) S.keyHandler(e.key.toUpperCase());
 else if(e.key==="Backspace") S.keyHandler("⌫");
});

// ---- daily 10-minute goal ----
const GOAL=600;
const dstr=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
let day=parse("wqDay",'{"d":"","sec":0}');
let dayStreak=+store.get("wqDayStreak",0)||0, lastGoal=store.get("wqLastGoal","");
let lastAct=Date.now();
["pointerdown","keydown"].forEach(ev=>addEventListener(ev,()=>{lastAct=Date.now()},{passive:true}));
function renderDay(){
 const s=Math.min(day.sec,99*60),m=Math.floor(s/60);
 $("dayTime").textContent=`${m}:${String(s%60).padStart(2,"0")}`;
 $("dayBar").style.width=Math.min(100,day.sec/GOAL*100)+"%";
 const y=new Date(); y.setDate(y.getDate()-1);
 const alive=lastGoal===dstr(new Date())||lastGoal===dstr(y);
 $("dayStreak").textContent=alive&&dayStreak?`🗓️ ${dayStreak} ימים ברצף`:"";
 $("dayDone").style.display=day.sec>=GOAL?"inline":"none";
}
function tick(){
 if(day.d!==dstr(new Date())) day={d:dstr(new Date()),sec:0};
 if(!document.hidden&&Date.now()-lastAct<45000){
  day.sec++;
  if(day.sec===GOAL){
   const y=new Date(); y.setDate(y.getDate()-1);
   dayStreak=lastGoal===dstr(y)?dayStreak+1:1; lastGoal=dstr(new Date());
   store.set("wqDayStreak",dayStreak); store.set("wqLastGoal",lastGoal);
   celebrate("10 דקות להיום! כל הכבוד 🎉");
  }
 }
 store.set("wqDay",JSON.stringify(day)); renderDay();
}

function showTab(name){
 currentTab=name; store.set("wqTab",name); S.keyHandler=null;
 document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 games[name].render($("view"));
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$("reset").onclick=()=>{
 if(confirm("לאפס את כל הנקודות וההתקדמות?")){
  S.score=0;S.streak=0;S.learned=new Set();S.mistakes={};save();showTab(currentTab);
 }
};
window.addEventListener("load",()=>{
 renderStats(); tick(); setInterval(tick,1000);
 const t=store.get("wqTab","crossword"); showTab(games[t]?t:"crossword");
});
