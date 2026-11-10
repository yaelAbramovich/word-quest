(function(){
// Flashcards over ALL words, including the ones you removed as "known", so they are not forgotten.
// Spaced repetition: a correct answer moves the card to a longer interval, a wrong one brings it back today.
const GAPS=[0,1,2,4,7,14,30], MAX_PASSES=3;
const dayNum=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
let dir=store.get("wqCardDir","en"), queue=[], again=[], pass=1, cur=null, shown=false, okN=0, noN=0, retried=new Set();

const isDue=w=>{const c=S.cards[w.w]; return !c||c.d<=dayNum()};
function dueList(){
 const dn=dayNum();
 const seen=allWords.filter(w=>S.cards[w.w]&&S.cards[w.w].d<=dn).sort((a,b)=>S.cards[a.w].d-S.cards[b.w].d);
 return [...seen,...shuffle(allWords.filter(w=>!S.cards[w.w]))];
}
function dueCount(){ return allWords.filter(isDue).length; }
window.updateCardsBadge=()=>{
 const b=document.querySelector('.tabs [data-tab="cards"]'); if(!b) return;
 const n=dueCount(); let i=b.querySelector(".bdg");
 if(!n){ i&&i.remove(); return; }
 if(!i){ i=document.createElement("i"); i.className="bdg"; b.appendChild(i); }
 i.textContent=n;
};

function start(){
 begin(dueList());
}
function begin(list){ queue=list; again=[]; pass=1; okN=noN=0; retried=new Set(); next(); }
// cards you missed are not shown again right away: they come back in another round after all the other cards
function next(){
 if(!queue.length&&again.length&&pass<MAX_PASSES){
  const last=cur; queue=shuffle(again); again=[]; pass++;
  if(queue.length>1&&queue[0]===last) queue.push(queue.shift());
 }
 cur=queue.shift(); shown=false;
 cur?card():summary();
}
function front(w){ return dir==="en"?`<div class="word" dir="ltr">${w.w}</div>`:`<div class="word he">${w.he}</div>`; }
function card(){
 const w=cur;
 $("cdBody").innerHTML=`<div class="cdleft">${pass>1?"סבב חוזר — מילים שלא ידעת · ":""}נשארו ${queue.length+1} כרטיסים</div>
 <div class="cdcard" id="cdTap">${front(w)}
  ${dir==="en"?`<button class="sound" data-say="${w.w}" aria-label="השמעת מילה">🔊</button>`:""}
  <div class="cdback" id="cdBack" hidden></div></div>
 <button class="next top" id="cdShow">הצגת תשובה</button>
 <div class="cdans" id="cdAns" hidden><button class="cdno" id="cdNo">✗ לא ידעתי</button><button class="cdok" id="cdOk">✓ ידעתי</button></div>`;
 $("cdShow").onclick=$("cdTap").onclick=e=>{ if(e.target.closest(".sound")) return; reveal(); };
 $("cdOk").onclick=()=>grade(true); $("cdNo").onclick=()=>grade(false);
 if(dir==="en") speak(w.w);
}
function reveal(){
 if(shown) return; shown=true; const w=cur;
 rotateSentence(w);
 $("cdBack").hidden=false;
 $("cdBack").innerHTML=(dir==="en"?`<div class="ans">${w.he}</div>`:`<div class="ans" dir="ltr">${w.w}</div>`)
  +(w.m?`<div class="mean">${w.m}</div>`:"")+(w.ex?`<div class="example">${w.ex}</div>`:"")
  +`<button class="sound sm" data-sw="${w.w}" aria-label="השמעה">🔊</button>`;
 $("cdShow").hidden=true; $("cdAns").hidden=false;
 say(dir==="en"?[w.ex]:[w.w,w.ex]);
}
function grade(ok){
 const w=cur, c=S.cards[w.w]||{b:0,d:0,l:0}, dn=dayNum();
 if(ok){
  // a card that was missed earlier in this session does not climb
  if(!retried.has(w.w)) c.b=Math.min(c.b+1,GAPS.length-1);
  c.d=dn+(retried.has(w.w)?Math.max(1,GAPS[c.b]):GAPS[c.b]); okN++;
 } else {
  c.b=Math.max(0,c.b-2); c.d=dn; noN++;
  retried.add(w.w); again.push(w);
 }
 c.l=dn; S.cards[w.w]=c; save(); updateCardsBadge();
 next();
}
function summary(){
 const left=dueCount();
 const later=allWords.map(w=>S.cards[w.w]).filter(c=>c&&c.d>dayNum()).map(c=>c.d);
 const nd=later.length?Math.min(...later)-dayNum():0;
 $("cdBody").innerHTML=`<div class="win">🎉 סיימת סבב! ✓ ${okN} ידעת · ✗ ${noN} לא ידעת</div>
 <p class="sub">${left?`נשארו עוד ${left} כרטיסים לתרגול היום.`:`אין עוד כרטיסים להיום. ${nd?`הכרטיסים הבאים יחכו לך בעוד ${nd===1?"יום":nd+" ימים"}.`:""} מומלץ לחזור פעם ביום.`}</p>
 ${left?`<button class="next top" id="cdMore">לסבב הבא ←</button>`:""}`;
 if($("cdMore")) $("cdMore").onclick=start;
}
function intro(){
 const n=dueCount(), total=allWords.length, gone=allWords.filter(w=>hidden.has(w.w)).length;
 $("cdBody").innerHTML=n?`<p class="sub">${n} כרטיסים מחכים לך היום (מתוך ${total} מילים${gone?`, כולל ${gone} שהסרת כי למדת`:""}). כל המילים נכללות בסבב.</p>
  <button class="next top" id="cdStart">▶ התחלת סבב</button>`
  :`<div class="win">✓ סיימת הכל להיום!</div><p class="sub">הכרטיסים הבאים יחכו לך בהמשך. אפשר לתרגל שוב כבר עכשיו:</p><button class="next top" id="cdAll">▶ סבב נוסף על כל המילים</button>`;
 if($("cdStart")) $("cdStart").onclick=start;
 if($("cdAll")) $("cdAll").onclick=()=>{ begin(shuffle(allWords)); };
}

games.cards={render(c){
 c.innerHTML=`<div class="tools top"><button id="cdDir"></button></div><div id="cdBody"></div>`;
 const mark=()=>$("cdDir").textContent=dir==="en"?"🔁 אנגלית ← עברית":"🔁 עברית ← אנגלית";
 mark();
 $("cdDir").onclick=()=>{ dir=dir==="en"?"he":"en"; store.set("wqCardDir",dir); mark(); if(cur&&!$("cdBody").querySelector(".win")) card(); else intro(); };
 cur=null; intro();
}};
window.addEventListener("load",updateCardsBadge);
})();
