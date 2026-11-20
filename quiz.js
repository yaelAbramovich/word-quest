(function(){
let mode=store.get("wqQuizMode","meaning"), current;
const recent=recentWords(3);
const recentOpts=[];   // wrong options of the last rounds: they are not used again right away   // the same word never comes back within the next 3 questions

const STEMS={strike:"struck",tumble:"tumbled","doze off":"dozed off"};
const blankRe=w=>{ const x=(STEMS[w.w]||w.w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); return new RegExp(w.custom?"\\b\\w*"+x+"\\w*":x,'i'); };
function options(prop){
 const others=words.filter(x=>x!==current);
 const used=new Set(recentOpts.flat());
 // wrong options come from words that were not options in the last 3 rounds (if there are not enough, the rest fill in)
 const fresh=shuffle(others.filter(x=>!used.has(x.w))), old=shuffle(others.filter(x=>used.has(x.w)));
 const wrong=[...fresh,...old].slice(0,3);
 recentOpts.push(wrong.map(x=>x.w)); if(recentOpts.length>3) recentOpts.shift();
 return shuffle([current,...wrong]).map(x=>x[prop]);
}
function newRound(){
 current=pickWeighted(1,mode==="context"?(w=>w.exs.some(x=>blankRe(w).test(x))):null,recent.list)[0];
 recent.add(current);
 rotateSentence(current,mode==="context"?(x=>blankRe(current).test(x)):null);
 let prompt,answers,correct,showWord=true,audioFirst=false;
 if(mode==="meaning"){
  prompt=`מה המשמעות המדויקת ביותר של <b dir="ltr">${current.w}</b>?`;
  correct=current.he; answers=options("he");
 } else if(mode==="context"){
  const blank=current.ex.replace(blankRe(current),"_____");
  prompt=`איזו מילה משלימה בצורה הטובה ביותר את המשפט?${exBlock(current,{text:`"${blank}"`,blank:true})}`;
  correct=current.w; answers=options("w"); showWord=false;
 } else if(mode==="reverse"){
  prompt=`איזו מילה באנגלית מתאימה להסבר הבא?<br><br><b>${current.m||current.he}</b>`;
  correct=current.w; answers=options("w"); showWord=false;
 } else {
  prompt=`הקשיבי למילה ואז בחרי את המשמעות שלה. אפשר לשמוע שוב כמה פעמים שתרצי.`;
  correct=current.he; answers=options("he"); showWord=false; audioFirst=true;
 }
 $("qgame").innerHTML=`
 <button class="next top" id="next" disabled>לאתגר הבא ←</button>
 ${showWord?`<div class="word" id="wordBtn" data-say="${current.w}">${current.w}</div><div class="hint">לחצי כדי לשמוע את ההגייה</div>`:""}
 <button class="sound" data-say="${current.w}" aria-label="השמעת מילה">🔊</button>
 <div class="prompt">${prompt}</div>
 <div class="answers">${answers.map(a=>`<button class="answer">${a}</button>`).join("")}</div>
 <div class="feedback" id="feedback"></div>
`;
 document.querySelectorAll(".answer").forEach(b=>b.onclick=()=>answer(b,correct));
 $("next").onclick=newRound;
 if(audioFirst) setTimeout(()=>speak(current.w),300);
}
function answer(button,correct){
 document.querySelectorAll(".answer").forEach(b=>b.disabled=true);
 const ok=button.textContent.trim()===correct;
 if(ok) button.classList.add("correct");
 else{
  button.classList.add("wrong");
  [...document.querySelectorAll(".answer")].find(b=>b.textContent.trim()===correct)?.classList.add("correct");
 }
 const fb=$("feedback"); fb.className="feedback show "+(ok?"good":"bad");
 record(current,ok?"ok":"miss");
 if(ok){
  good(current);
  fb.innerHTML=`<b>✓ יפה!</b><br><b dir="ltr">${current.w}</b> = ${current.he}${current.m?`<br>${current.m}`:""}${current.ex?exBlock(current):""}`;
 } else {
  bad(current);
  fb.innerHTML=`<b>לא נורא — זו בדיוק הסיבה שאנחנו מתרגלים.</b><br><br><b dir="ltr">${current.w}</b> = ${current.he}${current.m?`<br>${current.m}`:""}${current.ex?exBlock(current):""}`;
 }
 say([current.w,current.ex]);
 $("next").disabled=false;
}

HELP.quiz=`<h3>🧠 חידון</h3><p>בוחרים סוג חידון ועונים על השאלה. אחרי כל תשובה רואים את התרגום והמשפט, ואפשר לעבור לאתגר הבא.</p>
<p><b>משמעות</b> — מה פירוש המילה. <b>הקשר</b> — איזו מילה משלימה את המשפט. <b>שליפה</b> — איזו מילה באנגלית מתאימה להסבר. <b>האזנה</b> — שומעים מילה ובוחרים את המשמעות.</p>`;
// the sentence was edited while a "context" question is open: show the new one with the word hidden again
document.addEventListener("sentenceedited",()=>{
 const el=document.querySelector("#qgame [data-blank]");
 if(el&&current&&mode==="context") el.textContent=`"${current.ex.replace(blankRe(current),"_____")}"`;
});
games.quiz={render(c){
 c.innerHTML=gameBar("quiz")+`<nav class="modes">
  <button class="mode" data-mode="meaning">🧠 משמעות</button>
  <button class="mode" data-mode="context">📖 הקשר</button>
  <button class="mode" data-mode="reverse">🎯 שליפה</button>
  <button class="mode" data-mode="listen">🔊 האזנה</button></nav><div id="qgame"></div>`;
 const mark=()=>c.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));
 c.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;store.set("wqQuizMode",mode);mark();newRound()});
 mark(); newRound();
}};
})();
