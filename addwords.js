(function(){
const TESS="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let rows=[];

const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const customWords=()=>words.filter(w=>w.custom);
const saveCustom=()=>store.set("wqCustom",JSON.stringify(customWords()));

function loadTesseract(){
 return new Promise((ok,fail)=>{
  if(window.Tesseract) return ok();
  const s=document.createElement("script"); s.src=TESS; s.onload=ok; s.onerror=()=>fail(new Error("load"));
  document.head.appendChild(s);
 });
}
// split each OCR line into its English part and its Hebrew part
function parseText(text){
 return text.split(/\n+/).map(l=>l.trim()).filter(Boolean).map(l=>({
  en:(l.match(/[A-Za-z][A-Za-z' -]*/g)||[]).join(" ").replace(/\s+/g," ").trim().toLowerCase(),
  he:(l.match(/[֐-׿][֐-׿ ,'"()-]*/g)||[]).join(" ").trim()
 })).filter(r=>r.en||r.he);
}

function drawRows(){
 $("awRows").innerHTML=rows.map((r,i)=>`<div class="wr"><input class="en" dir="ltr" data-i="${i}" data-f="en" placeholder="English" value="${esc(r.en)}" autocapitalize="none" autocorrect="off"><input data-i="${i}" data-f="he" placeholder="תרגום" value="${esc(r.he)}"><button data-del="${i}" aria-label="מחיקה">✕</button></div>`).join("");
 $("awSave").style.display=rows.length?"block":"none";
}
function drawCustom(){
 const c=customWords();
 $("awList").innerHTML=c.length?`<h4>המילים שהוספת (${c.length})</h4><ul class="cl">${c.map(w=>`<li><span><b dir="ltr">${esc(w.w)}</b> — ${esc(w.he)}</span><button data-sw="${esc(w.w)}" aria-label="השמעה">🔊</button><button data-rm="${esc(w.w)}" aria-label="מחיקה">✕</button></li>`).join("")}</ul>`:"";
}

async function onImage(file){
 if(!file) return;
 $("awPv").src=URL.createObjectURL(file); $("awPv").style.display="block";
 $("awSt").textContent="טוענת מנוע זיהוי טקסט (בפעם הראשונה זה לוקח כמה שניות)…";
 try{
  await loadTesseract();
  const worker=await Tesseract.createWorker(["eng","heb"],1,{
   logger:m=>{ if(m.status==="recognizing text") $("awSt").textContent=`קוראת את התמונה… ${Math.round(m.progress*100)}%`; }
  });
  const {data}=await worker.recognize(file);
  await worker.terminate();
  const found=parseText(data.text);
  if(!found.length){ $("awSt").textContent="לא זיהיתי מילים. אפשר להוסיף ידנית למטה."; return; }
  rows=rows.filter(r=>r.en||r.he).concat(found);
  $("awSt").textContent=`זוהו ${found.length} שורות. בדקי ותקני לפני ההוספה — זיהוי עברית לא תמיד מדויק.`;
  drawRows();
 }catch(e){
  $("awSt").textContent="לא הצלחתי לקרוא את התמונה (צריך חיבור לאינטרנט). אפשר להוסיף מילים ידנית.";
 }
}

function add(){
 let added=0, skipped=0; const keep=[];
 for(const r of rows){
  const en=r.en.trim().toLowerCase(), he=r.he.trim();
  if(!en||!he||!/[a-z]/.test(en)||words.some(w=>w.w===en)){ skipped++; keep.push(r); continue; }
  words.push({w:en,he,m:"",ex:"",custom:1}); added++;
 }
 rows=keep; saveCustom(); renderStats();
 drawRows(); drawCustom();
 $("awSt").textContent=added?`✅ נוספו ${added} מילים למשחקים!${skipped?` (${skipped} שורות דולגו: חסר תרגום, או שהמילה כבר קיימת)`:""}`:"לא נוספו מילים — צריך גם מילה באנגלית וגם תרגום בכל שורה.";
 if(added) celebrate(`נוספו ${added} מילים! 🎉`);
}

games.addwords={render(c){
 c.innerHTML=`<span class="tag">➕ הוספת מילים</span>
 <p class="sub">העלי תמונה עם מילים (למשל צילום של רשימה), ואני אזהה את הטקסט. אחר כך אפשר לתקן ולהוסיף את התרגום. התמונה נשארת במכשיר שלך.</p>
 <label class="up">📷 העלאת תמונה<input type="file" accept="image/*" id="awFile"></label>
 <img class="pv" id="awPv" alt="" style="display:none">
 <div class="st" id="awSt"></div>
 <div id="awRows"></div>
 <div class="tools"><button id="awRow">＋ הוספת שורה ידנית</button></div>
 <button class="next" id="awSave" style="display:none">💾 הוספה למשחקים</button>
 <div id="awList"></div>`;
 $("awFile").onchange=e=>{onImage(e.target.files[0]); e.target.value=""};
 $("awRow").onclick=()=>{rows.push({en:"",he:""}); drawRows(); $("awRows").querySelector(".wr:last-child input")?.focus()};
 $("awSave").onclick=add;
 $("awRows").addEventListener("input",e=>{const i=e.target.dataset.i; if(i!=null) rows[+i][e.target.dataset.f]=e.target.value});
 $("awRows").addEventListener("click",e=>{const d=e.target.closest("[data-del]"); if(d){rows.splice(+d.dataset.del,1); drawRows()}});
 $("awList").addEventListener("click",e=>{
  const d=e.target.closest("[data-rm]"); if(!d) return;
  const i=words.findIndex(w=>w.custom&&w.w===d.dataset.rm); if(i>=0) words.splice(i,1);
  saveCustom(); renderStats(); drawCustom();
 });
 drawRows(); drawCustom();
}};
})();
