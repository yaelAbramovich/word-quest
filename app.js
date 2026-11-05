const words = [
{w:"bank",he:"גדה של נהר או גוף מים",m:"היבשה שבצד הנהר. בהקשר הזה bank אינו מוסד כספי.",ex:"They sat on the bank of the river."},
{w:"antipathy",he:"סלידה או חוסר חיבה עמוק",m:"תחושה חזקה ומתמשכת של סלידה כלפי אדם, רעיון או דבר.",ex:"She felt a strong antipathy toward dishonesty."},
{w:"earnestly",he:"בכנות וברצינות רבה",m:"בצורה כנה, רצינית ומלאת כוונה.",ex:"He earnestly asked for another chance."},
{w:"doze off",he:"לנמנם או להירדם לרגע",m:"להירדם קלות, בדרך כלל בלי להתכוון ולזמן קצר.",ex:"I dozed off during the movie."},
{w:"ignorant",he:"חסר ידע בנושא מסוים",m:"מי שאינו יודע או אינו מודע למידע מסוים. זה לא בהכרח אומר שהוא טיפש.",ex:"She was ignorant of the new rules."},
{w:"tumble",he:"ליפול או להתגלגל בצורה לא מבוקרת",m:"תנועה פתאומית של נפילה או התגלגלות.",ex:"The child tumbled down the hill."},
{w:"hedge",he:"משוכת שיחים",m:"שורה צפופה של שיחים, לעיתים משמשת כגדר טבעית.",ex:"A tall hedge surrounded the garden."},
{w:"latitude",he:"קו רוחב",m:"מדד גאוגרפי למיקום צפון או דרום מקו המשווה.",ex:"The city lies at a northern latitude."},
{w:"longitude",he:"קו אורך",m:"מדד גאוגרפי למיקום מזרח או מערב.",ex:"The navigator checked the longitude."},
{w:"daisy chain",he:"שרשרת חינניות; חיבור טורי",m:"דברים המחוברים אחד אחרי השני ברצף.",ex:"The children made a daisy chain."},
{w:"thump",he:"מכה או צליל עמום וחזק",m:"צליל של מכה כבדה, או פעולה של מכה כזו.",ex:"We heard a thump from upstairs."},
{w:"strike",he:"להכות או לפגוע",m:"לפגוע במשהו בכוח; למילה יש משמעויות נוספות לפי ההקשר.",ex:"Lightning struck the tree."},
{w:"fender",he:"כנף או מגן סביב גלגל רכב",m:"חלק בגוף הרכב שמגן על האזור סביב הגלגל.",ex:"The car's front fender was damaged."},
{w:"peg",he:"יתד או וו קטן",m:"חפץ קטן המשמש לקיבוע או לתלייה.",ex:"Hang your coat on the peg."},
{w:"saucer",he:"צלוחית מתחת לכוס",m:"צלחת קטנה שעליה מניחים כוס.",ex:"The cup rested on its saucer."},
{w:"curtsey",he:"קידה קטנה כמחווה של כבוד",m:"מחווה מסורתית של כבוד באמצעות כיפוף הברכיים.",ex:"She gave a curtsey to the queen."},
{w:"custard",he:"קרם מתוק המבוסס על חלב וביצים",m:"קינוח או רוטב סמיך ומתוק.",ex:"She served warm custard with the pie."},
{w:"presently",he:"כרגע או בקרוב, לפי ההקשר",m:"מילה מעניינת שמשמעותה משתנה לפי ההקשר והניב.",ex:"She'll be here presently."}
];

const store={
 get(k,d){try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}},
 set(k,v){try{localStorage.setItem(k,v)}catch(e){}}
};
function parse(k,d){try{return JSON.parse(store.get(k,d))}catch(e){return JSON.parse(d)}}
let mode="meaning", current, score=+store.get("wqScore",0)||0, streak=+store.get("wqStreak",0)||0;
let learned=new Set(parse("wqLearned","[]"));
let mistakes=parse("wqMistakes","{}");

const $=id=>document.getElementById(id);
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function chooseWord(){
 const weighted=words.flatMap(w=>Array(1+(mistakes[w.w]||0)*2).fill(w));
 return weighted[Math.floor(Math.random()*weighted.length)];
}
function speak(text){
 if(!("speechSynthesis" in window)){alert("הדפדפן לא תומך בהשמעת קול.");return}
 try{speechSynthesis.cancel();}catch(e){}
 const u=new SpeechSynthesisUtterance(text); u.lang="en-US"; u.rate=.78;
 speechSynthesis.speak(u);
}
function save(){
 store.set("wqScore",score); store.set("wqStreak",streak);
 store.set("wqLearned",JSON.stringify([...learned])); store.set("wqMistakes",JSON.stringify(mistakes));
 $("score").textContent=score; $("streak").textContent=streak; $("learned").textContent=learned.size;
 $("progressText").textContent=`${learned.size} / ${words.length}`;
 $("progressBar").style.width=`${learned.size/words.length*100}%`;
}
function optionsFor(correct, prop){
 return shuffle([correct,...shuffle(words.filter(w=>w!==current)).slice(0,3).map(w=>w[prop])]);
}
function newRound(){
 current=chooseWord();
 let prompt, answers, correct, showWord=true, audioFirst=false;
 if(mode==="meaning"){
   prompt=`מה המשמעות המדויקת ביותר של <b dir="ltr">${current.w}</b>?`;
   correct=current.he; answers=shuffle([current,...shuffle(words.filter(x=>x!==current)).slice(0,3)]).map(x=>x.he);
 } else if(mode==="context"){
   const stem={strike:"struck",tumble:"tumbled","doze off":"dozed off"}[current.w]||current.w;
   const blank=current.ex.replace(new RegExp(stem.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),"_____");
   prompt=`איזו מילה משלימה בצורה הטובה ביותר את המשפט?<div class="example">"${blank}"</div>`;
   correct=current.w; answers=shuffle([current,...shuffle(words.filter(x=>x!==current)).slice(0,3)]).map(x=>x.w); showWord=false;
 } else if(mode==="reverse"){
   prompt=`איזו מילה באנגלית מתאימה להסבר הבא?<br><br><b>${current.m}</b>`;
   correct=current.w; answers=shuffle([current,...shuffle(words.filter(x=>x!==current)).slice(0,3)]).map(x=>x.w); showWord=false;
 } else {
   prompt=`הקשיבי למילה ואז בחרי את המשמעות שלה. אפשר לשמוע שוב כמה פעמים שתרצי.`;
   correct=current.he; answers=shuffle([current,...shuffle(words.filter(x=>x!==current)).slice(0,3)]).map(x=>x.he); showWord=false; audioFirst=true;
 }
 $("game").innerHTML=`
 <span class="tag">${mode==="meaning"?"🧠 הבנת משמעות":mode==="context"?"📖 מילה בהקשר":mode==="reverse"?"🎯 שליפה מהזיכרון":"🔊 האזנה"}</span>
 ${showWord?`<div class="word" id="wordBtn">${current.w}</div><div class="hint">לחצי כדי לשמוע את ההגייה</div>`:""}
 <button class="sound" id="soundBtn" aria-label="השמעת מילה">🔊</button>
 <div class="prompt">${prompt}</div>
 <div class="answers">${answers.map(a=>`<button class="answer">${a}</button>`).join("")}</div>
 <div class="feedback" id="feedback"></div>
 <button class="next" id="next">לאתגר הבא ←</button>`;
 $("soundBtn").onclick=()=>speak(current.w);
 if($("wordBtn")) $("wordBtn").onclick=()=>speak(current.w);
 document.querySelectorAll(".answer").forEach(b=>b.onclick=()=>answer(b,correct));
 $("next").onclick=newRound;
 if(audioFirst) setTimeout(()=>speak(current.w),300);
}
function answer(button,correct){
 document.querySelectorAll(".answer").forEach(b=>b.disabled=true);
 const ok=button.textContent.trim()===correct;
 if(ok) button.classList.add("correct");
 else {
   button.classList.add("wrong");
   [...document.querySelectorAll(".answer")].find(b=>b.textContent.trim()===correct)?.classList.add("correct");
 }
 const fb=$("feedback"); fb.className="feedback show "+(ok?"good":"bad");
 if(ok){
   score+=10; streak++; learned.add(current.w);
   mistakes[current.w]=Math.max(0,(mistakes[current.w]||0)-1);
   fb.innerHTML=`<b>✓ יפה!</b><br>${current.m}<br><br><span class="example">${current.ex}</span>`;
 } else {
   streak=0; mistakes[current.w]=(mistakes[current.w]||0)+1;
   fb.innerHTML=`<b>לא נורא — זו בדיוק הסיבה שאנחנו מתרגלים.</b><br><br><b dir="ltr">${current.w}</b> = ${current.he}<br>${current.m}<br><br><span class="example">${current.ex}</span>`;
 }
 save(); $("next").style.display="block";
}
document.querySelectorAll(".mode").forEach(b=>b.onclick=()=>{
 document.querySelectorAll(".mode").forEach(x=>x.classList.remove("active"));
 b.classList.add("active"); mode=b.dataset.mode; newRound();
});
$("reset").onclick=()=>{
 if(confirm("לאפס את כל הנקודות וההתקדמות?")){
  score=0;streak=0;learned=new Set();mistakes={};save();newRound();
 }
};
save();newRound();
