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
 stats:parse("wqStats","{}"),   // per word: last 10 results (1 = knew it, 0 = didn't), only from crossword + quiz
 keyHandler:null
};
// words the user added (from an image or by hand) are stored on the device and merged into the word list
parse("wqCustom","[]").forEach(c=>{ if(!words.some(x=>x.w===c.w)) words.push(c); });
// words you know well can be hidden: they are removed from `words`, which every game uses
const allWords=[...words];
const hidden=new Set(parse("wqHidden","[]"));
const MIN_WORDS=8;
function applyHidden(){ words.length=0; words.push(...allWords.filter(w=>!hidden.has(w.w))); }
function saveHidden(){ store.set("wqHidden",JSON.stringify([...hidden])); }
function hideWord(w){
 if(words.length<=MIN_WORDS){ toast(`צריך לפחות ${MIN_WORDS} מילים פעילות כדי שהמשחקים יעבדו`); return false; }
 hidden.add(w.w); saveHidden(); applyHidden(); return true;
}
function restoreWord(name){ hidden.delete(name); saveHidden(); applyHidden(); }
applyHidden();
const games={};
let currentTab=null;

const letters=w=>w.w.replace(/[^a-z]/gi,"").toUpperCase();
function shuffle(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}
// random distinct words; words with more mistakes are more likely to be picked
// ---- per-word knowledge, measured only in crossword + quiz ----
// stats[word] = last 10 attempts as [1|0, "YYYY-MM-DD"]. A percentage is shown only after 10 attempts;
// it is the share of correct attempts, capped at 90% unless the successes fall on at least 3 different days.
const WINDOW=10, DAYS_FOR_100=3;
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
Object.keys(S.stats).forEach(k=>{S.stats[k]=S.stats[k].slice(-WINDOW).map(x=>Array.isArray(x)?x:[x,""])});   // old format had no dates
function wstat(w){
 const a=S.stats[w.w]||[], n=a.length, c=a.filter(x=>x[0]).length;
 const days=new Set(a.filter(x=>x[0]&&x[1]).map(x=>x[1])).size;
 const raw=n?c/n*100:0;
 const pct=n>=WINDOW?Math.round(Math.min(raw,days>=DAYS_FOR_100?100:90)):null;
 return {a,n,c,days,raw,pct,capped:n>=WINDOW&&raw>90&&days<DAYS_FOR_100,mastered:n>=WINDOW&&c>=9&&days>=DAYS_FOR_100};
}
function record(w,ok){
 const a=S.stats[w.w]||(S.stats[w.w]=[]);
 a.push([ok?1:0,today()]); if(a.length>WINDOW) a.shift();
 save();
}
// words that are new, in learning, or weak are drawn more often
function weightOf(w){
 const t=wstat(w), rate=t.pct!==null?t.pct/100:(t.n?t.c/t.n:0);
 return Math.max(t.pct===null?2:1,1+4*(1-rate))+(S.mistakes[w.w]||0);
}
function pickWeighted(n,filter){
 return words.filter(filter||(()=>true))
  .map(w=>({w,k:Math.pow(Math.random(),1/weightOf(w))}))
  .sort((a,b)=>b.k-a.k).slice(0,n).map(x=>x.w);
}

function renderStats(){
}
function save(){
 store.set("wqScore",S.score); store.set("wqStreak",S.streak);
 store.set("wqStats",JSON.stringify(S.stats)); store.set("wqLearned",JSON.stringify([...S.learned])); store.set("wqMistakes",JSON.stringify(S.mistakes));
 renderStats();
}
function good(w,pts=10){S.score+=pts;S.streak++;S.learned.add(w.w);S.mistakes[w.w]=Math.max(0,(S.mistakes[w.w]||0)-1);save()}
function bad(w){S.streak=0;S.mistakes[w.w]=(S.mistakes[w.w]||0)+1;save()}

let muted=store.get("wqMuted","0")==="1";
function renderMute(){
 const b=$("mute"); b.textContent=muted?"🔇":"🔊"; b.setAttribute("aria-pressed",muted);
 b.setAttribute("aria-label",muted?"הפעלת קול":"השתקה");
}
function toast(t){
 document.querySelectorAll(".toast").forEach(x=>x.remove());
 const d=document.createElement("div"); d.className="toast"; d.textContent=t;
 document.body.appendChild(d); setTimeout(()=>d.remove(),1600);
}
function say(texts,notify){
 if(muted){ if(notify) toast("🔇 הקול כבוי — אפשר להדליק למעלה"); return; }
 if(!("speechSynthesis" in window)) return;
 try{
  speechSynthesis.cancel();
  // one utterance (word, pause, sentence): iOS Safari tends to drop a second queued utterance
  const u=new SpeechSynthesisUtterance(texts.filter(Boolean).join(". ... ")); u.lang="en-US"; u.rate=.78;
  speechSynthesis.speak(u);
 }catch(e){}
}
function speak(text,notify){ say([text],notify); }
// the word, then its full example sentence (if it has one)
function speakWithSentence(w,notify){ say([w.w,w.ex],notify); }
document.addEventListener("click",e=>{
 const m=e.target.closest("#mute");
 if(m){ muted=!muted; store.set("wqMuted",muted?"1":"0"); if(muted){try{speechSynthesis.cancel()}catch(x){}} renderMute(); return; }
 const k=e.target.closest("[data-known]");
 if(k){ const w=allWords.find(x=>x.w===k.dataset.known); if(w&&hideWord(w)){ k.textContent="✓ הוסרה. אפשר להחזיר בלשונית מילים"; k.disabled=true; } return; }
 const f=e.target.closest("[data-sw]");
 if(f){ const w=words.find(x=>x.w===f.dataset.sw); if(w) speakWithSentence(w,true); return; }
 const b=e.target.closest("[data-say]"); if(b) speak(b.dataset.say,true);
});

// the card shown after a word is used: sound button + translation + meaning + example
function wordCard(w,title){
 return `<div class="wcard">
  <button class="sound sm" data-sw="${w.w}" aria-label="השמעה">🔊</button>
  <div>${title?`<div class="wtitle">${title}</div>`:""}
   <b class="en" dir="ltr">${w.w}</b> — ${w.he}
   <button class="known" data-known="${w.w}">✓ מכירה טוב — להסיר מהמשחקים</button>
   ${w.m?`<div class="mean">${w.m}</div>`:""}${w.ex?`<div class="example">${w.ex}</div>`:""}</div></div>`;
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

function showTab(name){
 currentTab=name; store.set("wqTab",name); S.keyHandler=null;
 document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
 games[name].render($("view"));
}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$("reset").onclick=()=>{
 if(confirm("לאפס את כל הנקודות וההתקדמות?")){
  S.score=0;S.streak=0;S.learned=new Set();S.mistakes={};S.stats={};save();showTab(currentTab);
 }
};
window.addEventListener("load",()=>{
 renderStats(); renderMute();
 const t=store.get("wqTab","crossword"); showTab(games[t]?t:"crossword");
});
