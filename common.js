"use strict";
const $=id=>document.getElementById(id);
const store={
 get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},
 set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
};
function parse(k,d){try{return JSON.parse(store.get(k,d))}catch(e){return JSON.parse(d)}}

// shared progress: learned words, mistakes (mistakes make a word come back more often)
const S={
 learned:new Set(parse("wqLearned","[]")),
 mistakes:parse("wqMistakes","{}"),
 totals:parse("wqTotals","{}"), // per word, all time: s = successes, m = mistakes, h = needed help (hint / reveal)
 stats:parse("wqStats","{}"),   // per word: last 10 results (1 = knew it, 0 = didn't), only from crossword + quiz
 cards:parse("wqCards","{}"),   // flashcards (spaced repetition): per word {b: box, d: next due day, l: last seen day}
 keyHandler:null
};
// words the user added (from an image or by hand) are stored on the device and merged into the word list
parse("wqCustom","[]").forEach(c=>{ if(!words.some(x=>x.w===c.w)) words.push(c); });
// every word has a list of example sentences (`exs`); `ex` is the one currently in use.
// meanings and sentences of the built-in words that you edited are kept in wqEdits
const edits=parse("wqEdits","{}");
words.forEach(w=>{
 const o=edits[w.w];
 if(o){ if(o.he) w.he=o.he; if(o.m!==undefined) w.m=o.m; if(o.exs) w.exs=o.exs; }
 if(!w.exs) w.exs=w.ex?[w.ex]:[];
 w.ex=w.exs[0]||"";
});
// words you know well can be hidden: they are removed from `words`, which every game uses
const allWords=[...words];
const hidden=new Set(parse("wqHidden","[]"));
// "my group": one small named set of words you chose to work on (word names are stored; only active words count)
let group=parse("wqGroup","null");
const GROUP_MIN=4;
function saveGroup(){ store.set("wqGroup",JSON.stringify(group)); }
const MIN_WORDS=8;
function applyHidden(){ words.length=0; words.push(...allWords.filter(w=>!hidden.has(w.w))); }
function saveHidden(){ store.set("wqHidden",JSON.stringify([...hidden])); }
function hideWord(w){
 if(words.length<=MIN_WORDS){ toast(`צריך לפחות ${MIN_WORDS} מילים פעילות כדי שהמשחקים יעבדו`); return false; }
 hidden.add(w.w); saveHidden(); applyHidden();
 if(group){ group.words=group.words.filter(n=>n!==w.w); if(!group.words.length) group=null; saveGroup(); }   // a removed word leaves the group; an empty group is gone
 return true;
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
// words practiced before totals existed: seed them from their recent attempts
Object.keys(S.stats).forEach(k=>{ if(!S.totals[k]){ const a=S.stats[k]; S.totals[k]={s:a.filter(x=>(Array.isArray(x)?x[0]:x)).length,m:a.filter(x=>!(Array.isArray(x)?x[0]:x)).length,h:0}; } });
function wstat(w){
 const a=S.stats[w.w]||[], n=a.length, c=a.filter(x=>x[0]).length;
 const days=new Set(a.filter(x=>x[0]&&x[1]).map(x=>x[1])).size;
 const raw=n?c/n*100:0;
 const pct=n>=WINDOW?Math.round(Math.min(raw,days>=DAYS_FOR_100?100:90)):null;
 return {a,n,c,days,raw,pct,capped:n>=WINDOW&&raw>90&&days<DAYS_FOR_100,mastered:n>=WINDOW&&c>=9&&days>=DAYS_FOR_100};
}
// kind: "ok" (knew it), "miss" (wrong answer) or "help" (used a hint / revealed the word)
function record(w,kind){
 const ok=kind==="ok";
 const t=S.totals[w.w]||(S.totals[w.w]={s:0,m:0,h:0});
 t[ok?"s":kind==="help"?"h":"m"]++;
 const a=S.stats[w.w]||(S.stats[w.w]=[]);
 a.push([ok?1:0,today()]); if(a.length>WINDOW) a.shift();
 save();
}
// words that are new, in learning, or weak are drawn more often
function weightOf(w){
 const t=wstat(w), rate=t.pct!==null?t.pct/100:(t.n?t.c/t.n:0);
 return Math.max(t.pct===null?2:1,1+4*(1-rate))+(S.mistakes[w.w]||0);
}
// ---- scope: every game can use all words, or only the weak ones (new, or under 80% correct) ----
// ---- categories: every active word is in exactly one ----
const CAT_NAME={new:"חדשות",weak:"חלשות",strong:"חזקות"};
function category(w){
 const t=wstat(w);
 if(!t.n) return "new";
 return t.pct!==null&&t.pct>=80?"strong":"weak";   // strong only when a percentage is shown (10 attempts) and it is 80%+
}
// ---- which words a game plays: the choice (all / new / weak / strong / group) decides the pool ----
const SCOPES=["all","new","weak","strong","group"];
const isShared=()=>store.get("wqScopeShared","0")==="1";
function getScope(g){
 let s=isShared()?store.get("wqScopeSharedValue","all"):store.get("wqScope_"+g,"all");
 if(!SCOPES.includes(s)||(s==="group"&&!group)) s="all";
 return s;
}
function groupWords(){ return group?words.filter(w=>group.words.includes(w.w)):[]; }
// the flashcards' "all" also includes the words you removed (they keep being reviewed)
function poolOf(scope,game){
 if(scope==="group") return groupWords();
 if(scope==="all") return game==="cards"?allWords:words;
 return words.filter(w=>category(w)===scope);
}
const poolFor=g=>poolOf(getScope(g),g);
// up to n words from the game's pool (never from outside it); `avoid` = recent word names, skipped while enough others remain
function pickSet(game,n,filter,avoid){
 let base=poolFor(game).filter(filter||(()=>true));
 if(avoid&&avoid.length){ const f=base.filter(w=>!avoid.includes(w.w)); if(f.length>=n) base=f; }
 return drawWeighted(base,n);
}
function drawWeighted(list,n){
 return list.map(w=>({w,k:Math.pow(Math.random(),1/weightOf(w))}))
  .sort((a,b)=>b.k-a.k).slice(0,n).map(x=>x.w);
}
// remembers the last few words of a game so the same word does not come back right away
function recentWords(size){
 const a=[];
 return {list:a,add(w){ a.push(w.w); while(a.length>size) a.shift(); }};
}

// ---- compact game bar: scope switch + a small "?" that opens the instructions (no space taken from the game) ----
const HELP={};
const escHtml=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function scopeLabel(s,game){
 const n=poolOf(s,game).length;
 if(s==="group") return `🎯 ${escHtml(group.name)} (${n})`;
 if(s==="all"){
  const gone=game==="cards"?allWords.length-words.length:0;
  return `הכל (${n}${gone?`, מתוכן ${gone} שהוסרו`:""})`;
 }
 return `${CAT_NAME[s]} (${n})`;
}
// compact game bar: which words to play + a small "?" that opens the instructions
function gameBar(game){
 const sc=getScope(game);
 const pick=isShared()
  ?`<div class="scopelock">🔗 בחירה משותפת: <b>${scopeLabel(sc,game)}</b><small>לשינוי: לשונית מילים</small></div>`
  :`<select class="scopesel" id="scopeSel" aria-label="אילו מילים לשחק">${SCOPES.filter(s=>s!=="group"||group).map(s=>`<option value="${s}"${s===sc?" selected":""}>${scopeLabel(s,game)}</option>`).join("")}</select>`;
 return `<div class="gbar">${pick}<button class="helpbtn" data-help="${game}" aria-label="הוראות" aria-haspopup="dialog">?</button></div><div id="gMsg"></div>`;
}
// true = the game may run. With a message: show it (instead of the game) and hide the game body `#gBody`
function gateGame(msg){
 const m=$("gMsg"), b=$("gBody");
 if(m) m.innerHTML=msg?`<div class="gwarn">${msg}</div>`:"";
 if(b) b.hidden=!!msg;
 return !msg;
}

function showHelp(html){
 document.querySelectorAll(".helpov").forEach(x=>x.remove());
 const d=document.createElement("div"); d.className="helpov";
 d.innerHTML=`<div class="helpsheet" role="dialog" aria-modal="true">${html}<button class="next top helpclose">הבנתי</button></div>`;
 d.onclick=e=>{ if(e.target===d||e.target.closest(".helpclose")) d.remove(); };
 document.body.appendChild(d);
}

function renderStats(){
}
function save(){
 store.set("wqStats",JSON.stringify(S.stats)); store.set("wqTotals",JSON.stringify(S.totals)); store.set("wqCards",JSON.stringify(S.cards)); store.set("wqLearned",JSON.stringify([...S.learned])); store.set("wqMistakes",JSON.stringify(S.mistakes));
 renderStats();
}
function good(w){S.learned.add(w.w);S.mistakes[w.w]=Math.max(0,(S.mistakes[w.w]||0)-1);save()}
function bad(w){S.mistakes[w.w]=(S.mistakes[w.w]||0)+1;save()}

try{ speechSynthesis.getVoices(); }catch(e){}
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
// ---- voice: pick the most natural English voice the device has (Premium/Enhanced first), or the one the user chose ----
const BAD_VOICES=/^(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Kathy|Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)/;
const PREFERRED_VOICES=["Ava","Samantha","Zoe","Evan","Nicky","Allison","Susan","Tom","Karen","Daniel","Moira","Serena","Aaron"];
function enVoices(){
 try{ return speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang)&&!BAD_VOICES.test(v.name)); }catch(e){ return []; }
}
function voiceScore(v){
 let sc=0; const id=v.name+" "+v.voiceURI;
 if(/premium/i.test(id)) sc+=100;
 if(/enhanced/i.test(id)) sc+=60;
 const i=PREFERRED_VOICES.findIndex(n=>v.name.startsWith(n)); if(i>=0) sc+=30-i;
 if(/en[-_]US/i.test(v.lang)) sc+=5;
 return sc;
}
function sortedVoices(){ return enVoices().sort((a,b)=>voiceScore(b)-voiceScore(a)); }
function pickVoice(){
 const list=sortedVoices(), saved=store.get("wqVoice","");
 return (saved&&list.find(v=>v.voiceURI===saved))||list[0]||null;
}
const getRate=()=>+store.get("wqRate",0.85)||0.85;
function say(texts,notify){
 if(muted){ if(notify) toast("🔇 הקול כבוי — אפשר להדליק למעלה"); return; }
 if(!("speechSynthesis" in window)) return;
 try{
  speechSynthesis.cancel();
  // one utterance (word, pause, sentence): iOS Safari tends to drop a second queued utterance
  const u=new SpeechSynthesisUtterance(texts.filter(Boolean).join(". ... ")); u.lang="en-US"; u.rate=getRate();
  const v=pickVoice(); if(v){ u.voice=v; u.lang=v.lang; }
  speechSynthesis.speak(u);
 }catch(e){}
}
function speak(text,notify){ say([text],notify); }
// the word, then its full example sentence (if it has one)
// smart random: all sentences are used before any repeats, and never the same one twice in a row
const bags=new Map();
function rotateSentence(w,ok){
 const all=ok?w.exs.filter(ok):w.exs;
 if(!all.length) return w.ex;
 if(all.length===1) return w.ex=all[0];
 let bag=(bags.get(w.w)||[]).filter(x=>all.includes(x)&&x!==w.ex);
 if(!bag.length) bag=shuffle(all.filter(x=>x!==w.ex));
 w.ex=bag.shift(); bags.set(w.w,bag); return w.ex;
}
function speakWithSentence(w,notify){ rotateSentence(w); say([w.w,w.ex],notify); }
document.addEventListener("click",e=>{
 const xe=e.target.closest("[data-exedit]");
 if(xe){ const w=allWords.find(x=>x.w===xe.dataset.exedit); if(w&&w.ex) editSentence(w); return; }
 const hp=e.target.closest("[data-help]");
 if(hp){ showHelp(HELP[hp.dataset.help]||""); return; }
 const m=e.target.closest("#mute");
 if(m){ muted=!muted; store.set("wqMuted",muted?"1":"0"); if(muted){try{speechSynthesis.cancel()}catch(x){}} renderMute(); return; }
 const an=e.target.closest("[data-another]");
 if(an){
  const w=allWords.find(x=>x.w===an.dataset.another); if(!w) return;
  an.disabled=true; an.textContent="מחפשת…";
  anotherSentence(w).then(x=>{
   an.disabled=false; an.textContent="➕ עוד משפט";
   const ex=an.closest(".wcard")?.querySelector(".example");
   if(x&&ex){ ex.textContent=x; const wr=ex.closest(".exwrap"); if(wr) wr.style.display=""; say([w.w,w.ex]); }
  });
  return;
 }
 const k=e.target.closest("[data-known]");
 if(k){ const w=allWords.find(x=>x.w===k.dataset.known); if(w&&hideWord(w)){ k.textContent="✓ הוסרה. אפשר להחזיר בלשונית מילים"; k.disabled=true; } return; }
 const f=e.target.closest("[data-sw]");
 if(f){ const w=allWords.find(x=>x.w===f.dataset.sw); if(w) say([w.w,w.ex],true); return; }
 const b=e.target.closest("[data-say]"); if(b) speak(b.dataset.say,true);
});

// ---- edit the sentence you are looking at, right where you see it (a small ✏️ next to every sentence) ----
// opts.text: what to display instead of the sentence (the quiz hides the word); opts.blank: this display is not overwritten on save
function exBlock(w,opts){
 const o=opts||{};
 return `<div class="exwrap"${w.ex?"":' style="display:none"'}><div class="example" data-exfor="${w.w}"${o.blank?" data-blank":""}>${o.text!==undefined?o.text:w.ex}</div><button class="exedit" data-exedit="${w.w}" aria-label="עריכת המשפט" title="עריכת המשפט">✏️</button></div>`;
}
function editSentence(w){
 document.querySelectorAll(".helpov").forEach(x=>x.remove());
 const d=document.createElement("div"); d.className="helpov";
 d.innerHTML=`<div class="helpsheet" role="dialog" aria-modal="true"><h3>✏️ עריכת המשפט</h3><div class="editbox">
  <b dir="ltr">${w.w}</b><textarea id="exEdit" dir="ltr" rows="4" autocapitalize="none"></textarea>
  <div class="tools"><button class="wide" id="exSave">💾 שמירה</button><button class="wide" id="exCancel">ביטול</button></div></div></div>`;
 document.body.appendChild(d);
 const ta=d.querySelector("#exEdit"); ta.value=w.ex; ta.focus();
 d.onclick=e=>{ if(e.target===d||e.target.closest("#exCancel")) d.remove(); };
 d.querySelector("#exSave").onclick=()=>{
  const t=ta.value.replace(/\s+/g," ").trim();
  if(!t){ toast("המשפט לא יכול להיות ריק"); return; }
  const old=w.ex; w.ex=t;
  setSentences(w,w.exs.map(x=>x===old?t:x));
  document.querySelectorAll("[data-exfor]").forEach(el=>{ if(el.dataset.exfor===w.w&&!("blank" in el.dataset)) el.textContent=t; });
  document.dispatchEvent(new CustomEvent("sentenceedited",{detail:w}));
  d.remove(); toast("המשפט נשמר ✓");
 };
}

// the card shown after a word is used: sound button + translation + meaning + example
function wordCard(w,title,noKnown){
 return `<div class="wcard">
  <button class="sound sm" data-sw="${w.w}" aria-label="השמעה">🔊</button>
  <div>${title?`<div class="wtitle">${title}</div>`:""}
   <b class="en" dir="ltr">${w.w}</b> — ${w.he}
   ${noKnown?"":`<button class="known" data-known="${w.w}">✓ מכירה טוב — להסיר מהמשחקים</button>`}
   ${w.m?`<div class="mean">${w.m}</div>`:""}${w.ex||w.custom?exBlock(w):""}
   ${w.custom?`<button class="known" data-another="${w.w}">➕ עוד משפט</button>`:""}</div></div>`;
}

function celebrate(msg){
 const d=document.createElement("div"); d.className="cele";
 d.innerHTML=`<div class="rain">${Array.from({length:14},(_,i)=>`<span style="left:${Math.random()*92}%;animation-delay:${(Math.random()*.5).toFixed(2)}s">${["🎉","⭐","✨","🎊"][i%4]}</span>`).join("")}</div><div class="msg">${msg}</div>`;
 document.body.appendChild(d); setTimeout(()=>d.remove(),2000);
}


// ---- copy to clipboard ----
async function copyText(t){
 try{ await navigator.clipboard.writeText(t); }
 catch(e){
  const a=document.createElement("textarea"); a.value=t; a.style.position="fixed"; a.style.opacity="0";
  document.body.appendChild(a); a.select(); try{ document.execCommand("copy"); }catch(x){} a.remove();
 }
 toast("הועתק ✓");
}

// ---- example sentences for words you add (Wiktionary: works from a web page, but does not know every word) ----
const saveCustom=()=>store.set("wqCustom",JSON.stringify(allWords.filter(w=>w.custom)));
function persistWord(w){
 if(w.custom) return saveCustom();
 edits[w.w]={he:w.he,m:w.m||"",exs:w.exs}; store.set("wqEdits",JSON.stringify(edits));
}
function setSentences(w,list){
 w.exs=[...new Set(list.map(x=>x.trim()).filter(Boolean))];
 if(!w.exs.includes(w.ex)) w.ex=w.exs[0]||"";
 persistWord(w);
}
const exCache={};
function cleanEx(t){
 const d=document.createElement("textarea"); d.innerHTML=t.replace(/<[^>]+>/g,"");
 let x=d.value.replace(/\s+/g," ").trim();
 if(/^[A-Z]/.test(x)&&x.split(" ").length>=4&&!/[.!?"”]$/.test(x)) x+=".";
 return x;
}
async function sentenceCandidates(word){
 if(exCache[word]) return exCache[word];
 let good=[];
 try{
  const r=await fetch("https://en.wiktionary.org/api/rest_v1/page/definition/"+encodeURIComponent(word));
  if(r.ok){
   const j=await r.json(), ex=[];
   for(const sec of (j.en||[])) for(const d of sec.definitions) for(const e of (d.examples||[])) ex.push(cleanEx(e));
   const first=word.split(" ")[0], stem=first.length>4?first.replace(/(ing|ed|es|ly|s|e)$/,""):first;
   const re=new RegExp("\\b"+stem.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),"i");
   good=[...new Set(ex.filter(x=>x.length>=15&&x.length<=140&&re.test(x)))];
   good.sort((a,b)=>(/^[A-Z].*[.!?]$/.test(b)-/^[A-Z].*[.!?]$/.test(a))||Math.abs(a.length-60)-Math.abs(b.length-60));
  }
 }catch(e){}
 return exCache[word]=good;
}
async function findSentence(word){ return (await sentenceCandidates(word))[0]||null; }
// add one more sentence from Wiktionary (one the word does not have yet) and use it; returns it, or null when there is none
async function anotherSentence(w){
 const c=await sentenceCandidates(w.w);
 const next=c.find(x=>!w.exs.includes(x));
 if(!next){ toast(c.length?"אין עוד משפטים שמצאתי למילה הזו. אפשר לכתוב משפטים ב-✏️ בלשונית מילים":"לא מצאתי משפטים למילה הזו. אפשר לכתוב משפטים ב-✏️ בלשונית מילים"); return null; }
 setSentences(w,[...w.exs,next]); w.ex=next; document.dispatchEvent(new Event("sentencechanged"));
 return next;
}

document.addEventListener("change",e=>{
 if(e.target.id==="scopeSel"){ store.set("wqScope_"+currentTab,e.target.value); showTab(currentTab); }
});
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
 if(e.target.closest&&e.target.closest("input,textarea,select")) return;   // typing in the sentence editor
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
 if(confirm("לאפס את כל ההתקדמות (אחוזי ידיעה, ספירות וכרטיסיות)?")){
  S.learned=new Set();S.mistakes={};S.stats={};S.totals={};S.cards={};save();showTab(currentTab);
 }
};
window.addEventListener("load",()=>{
 renderStats(); renderMute();
 const t=store.get("wqTab","crossword"); showTab(games[t]?t:"crossword");
});
