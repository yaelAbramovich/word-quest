(function(){
let mode=store.get("wqQuizMode","meaning"), current;

function options(prop){
 return shuffle([current,...shuffle(words.filter(x=>x!==current)).slice(0,3)]).map(x=>x[prop]);
}
function newRound(){
 current=pickWeighted(1,mode==="context"?(w=>w.ex):null)[0];
 let prompt,answers,correct,showWord=true,audioFirst=false;
 if(mode==="meaning"){
  prompt=`מה המשמעות המדויקת ביותר של <b dir="ltr">${current.w}</b>?`;
  correct=current.he; answers=options("he");
 } else if(mode==="context"){
  const stem={strike:"struck",tumble:"tumbled","doze off":"dozed off"}[current.w]||current.w;
  const blank=current.ex.replace(new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),"_____");
  prompt=`איזו מילה משלימה בצורה הטובה ביותר את המשפט?<div class="example">"${blank}"</div>`;
  correct=current.w; answers=options("w"); showWord=false;
 } else if(mode==="reverse"){
  prompt=`איזו מילה באנגלית מתאימה להסבר הבא?<br><br><b>${current.m||current.he}</b>`;
  correct=current.w; answers=options("w"); showWord=false;
 } else {
  prompt=`הקשיבי למילה ואז בחרי את המשמעות שלה. אפשר לשמוע שוב כמה פעמים שתרצי.`;
  correct=current.he; answers=options("he"); showWord=false; audioFirst=true;
 }
 $("qgame").innerHTML=`
 <span class="tag">${{meaning:"🧠 הבנת משמעות",context:"📖 מילה בהקשר",reverse:"🎯 שליפה מהזיכרון",listen:"🔊 האזנה"}[mode]}</span>
 ${showWord?`<div class="word" id="wordBtn" data-say="${current.w}">${current.w}</div><div class="hint">לחצי כדי לשמוע את ההגייה</div>`:""}
 <button class="sound" data-say="${current.w}" aria-label="השמעת מילה">🔊</button>
 <div class="prompt">${prompt}</div>
 <div class="answers">${answers.map(a=>`<button class="answer">${a}</button>`).join("")}</div>
 <div class="feedback" id="feedback"></div>
 <button class="next" id="next">לאתגר הבא ←</button>`;
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
 record(current,ok);
 if(ok){
  good(current);
  fb.innerHTML=`<b>✓ יפה!</b><br><b dir="ltr">${current.w}</b> = ${current.he}${current.m?`<br>${current.m}`:""}${current.ex?`<br><br><span class="example">${current.ex}</span>`:""}`;
 } else {
  bad(current);
  fb.innerHTML=`<b>לא נורא — זו בדיוק הסיבה שאנחנו מתרגלים.</b><br><br><b dir="ltr">${current.w}</b> = ${current.he}${current.m?`<br>${current.m}`:""}${current.ex?`<br><br><span class="example">${current.ex}</span>`:""}`;
 }
 speakWithSentence(current);
 $("next").style.display="block";
}

games.quiz={render(c){
 c.innerHTML=`<nav class="modes">
  <button class="mode" data-mode="meaning">🧠 משמעות</button>
  <button class="mode" data-mode="context">📖 הקשר</button>
  <button class="mode" data-mode="reverse">🎯 שליפה</button>
  <button class="mode" data-mode="listen">🔊 האזנה</button></nav><div id="qgame"></div>`;
 const mark=()=>c.querySelectorAll(".mode").forEach(x=>x.classList.toggle("active",x.dataset.mode===mode));
 c.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;store.set("wqQuizMode",mode);mark();newRound()});
 mark(); newRound();
}};
})();
