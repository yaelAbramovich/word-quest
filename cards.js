(function(){
// Flashcards: a round is EVERY word of the chosen selection (also removed words when the selection is "הכל").
// A "✗ לא ידעתי" card comes back later in the same round; its day/box are still stored (S.cards) and mark the word as "missed".
const GAPS=[0,1,2,4,7,14,30], MAX_PASSES=3;
const dayNum=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
let dir=store.get("wqCardDir","en"), queue=[], again=[], pass=1, cur=null, shown=false, okN=0, noN=0, retried=new Set();

const pool=()=>poolFor("cards");

function start(){ begin(shuffle(pool())); }
// keeps the "❌ לא ידעתי (n)" option up to date while you answer
function refreshMissedLabel(){
 const o=document.querySelector('#scopeSel option[value="missed"]'); if(o) o.textContent=scopeLabel("missed","cards");
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
  +(w.m?`<div class="mean">${w.m}</div>`:"")+(w.ex?exBlock(w):"")
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
 c.l=dn; S.cards[w.w]=c; save(); refreshMissedLabel();
 next();
}
function summary(){
 const missedSel=getScope("cards")==="missed", left=missedSel?pool().length:0;
 $("cdBody").innerHTML=`<div class="win">🎉 סיימת סבב! ✓ ${okN} ידעת · ✗ ${noN} לא ידעת</div>
 ${missedSel?`<p class="sub">${left?`נשארו עוד ${left} כרטיסים ב״לא ידעתי״.`:"אין יותר כרטיסים ב״לא ידעתי״ 🎉"}</p>`:""}
 <button class="next top" id="cdMore">▶ סבב נוסף</button>`;
 $("cdMore").onclick=()=>pool().length?start():intro();
}
function intro(){
 const list=pool();
 if(!list.length){ $("cdBody").innerHTML=`<div class="gwarn">${getScope("cards")==="missed"?"אין כרטיסים שסימנת ״לא ידעתי״ 🎉":"אין מילים בבחירה הזו"}</div>`; return; }
 const gone=list.filter(w=>hidden.has(w.w)).length;
 $("cdBody").innerHTML=`<p class="sub">${list.length} כרטיסים בסבב${gone?` (כולל ${gone} מילים שהסרת כי למדת)`:""}.</p>
  <button class="next top" id="cdStart">▶ התחלת סבב</button>`;
 $("cdStart").onclick=start;
}

HELP.cards=`<h3>🃏 כרטיסיות</h3><p>רואים מילה, מנסים להיזכר בתרגום, ואז לוחצים ״הצגת תשובה״ ומסמנים אם ידעתם. מילה שלא ידעתם תחזור בהמשך הסבב.</p><p>🔁 הכפתור למעלה מחליף כיוון (אנגלית ← עברית או להפך).</p><p>למעלה בוחרים אילו מילים לתרגל: <b>הכל</b> (גם מילים שהסרתם), <b>לא ידעתי</b> (מילים שבפעם האחרונה סימנתם ״לא ידעתי״ — הן יוצאות מהרשימה כשתסמנו ״ידעתי״), <b>חדשות</b>, <b>חלשות</b>, <b>חזקות</b> והקבוצה שלי.</p>`;
games.cards={render(c){
 c.innerHTML=gameBar("cards")+`<div class="tools top"><button id="cdDir"></button></div><div id="cdBody"></div>`;
 const mark=()=>$("cdDir").textContent=dir==="en"?"🔁 אנגלית ← עברית":"🔁 עברית ← אנגלית";
 mark();
 $("cdDir").onclick=()=>{ dir=dir==="en"?"he":"en"; store.set("wqCardDir",dir); mark(); if(cur&&!$("cdBody").querySelector(".win")) card(); else intro(); };
 cur=null; intro();
}};
})();
