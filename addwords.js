(function(){
const TESS="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let rows=[];

const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const customWords=()=>allWords.filter(w=>w.custom);
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
let sortBy=store.get("wqSort","weak");
function statLine(w){
 const t=wstat(w);
 if(!t.n) return `<div class="st2"><span>חדשה — עוד לא תורגלה בתשבץ או בחידון</span></div>`;
 const dots=Array.from({length:WINDOW},(_,i)=>t.a[i]?`<i class="d ${t.a[i][0]?"ok":"no"}"></i>`:`<i class="d"></i>`).join("");
 let label;
 if(t.pct===null) label=`<span>בלמידה ${t.n}/${WINDOW}</span>`;
 else{
  const col=t.pct>=80?"#1f9d62":t.pct>=50?"#e6a100":"#d64c57";
  label=`<b style="color:${col}">${t.pct}%</b>${t.capped?`<span>(עד 90% — צריך הצלחות ב-${DAYS_FOR_100} ימים שונים)</span>`:""}`;
 }
 return `<div class="st2"><span class="dots" dir="ltr">${dots}</span>${label}${t.mastered?`<span class="rec">💡 אפשר להסיר</span>`:""}</div>`;
}
function drawCustom(){
 const gone=allWords.filter(w=>hidden.has(w.w));
 const val=w=>{const t=wstat(w); return !t.n?2:t.pct!==null?t.pct/100:t.c/t.n};   // untested words go last
 const act=[...words].sort(sortBy==="alpha"?(a,b)=>a.w.localeCompare(b.w):sortBy==="strong"?(a,b)=>{const ua=val(a)>1,ub=val(b)>1; return ua!==ub?(ua?1:-1):val(b)-val(a)}:(a,b)=>val(a)-val(b));
 const st=words.map(wstat), withPct=st.filter(t=>t.pct!==null);
 const learning=st.filter(t=>t.n&&t.pct===null).length, fresh=st.filter(t=>!t.n).length;
 const avg=withPct.length?Math.round(withPct.reduce((x,t)=>x+t.pct,0)/withPct.length):null;
 const row=(w,btns,extra)=>`<li><span><b dir="ltr">${esc(w.w)}</b> — ${esc(w.he)}</span>${btns}${extra||""}</li>`;
 const sb=(k,t)=>`<button data-sort="${k}" class="${sortBy===k?"on":""}">${t}</button>`;
 $("awList").innerHTML=`<h4>המילים במשחקים (${words.length})</h4>
 <p class="sub">האחוז נמדד רק בתשבץ ובחידון, ומופיע אחרי ${WINDOW} ניסיונות (הנקודות מראות את התוצאות: ירוק = ידעת). הוא מבוסס על ${WINDOW} הניסיונות האחרונים. 100% = כל הניסיונות נכונים, עם הצלחות ב-${DAYS_FOR_100} ימים שונים. בפחות ימים — המקסימום 90%. רמז או "גלי מילה" נחשבים כאילו לא ידעת. מילים חדשות וחלשות יופיעו יותר.</p>
 <div class="sum">${withPct.length} מילים עם אחוז${avg===null?"":` (ממוצע ${avg}%)`} · ${learning} בלמידה · ${fresh} חדשות</div>
 <div class="tools sorts">${sb("weak","הכי חלשות")}${sb("strong","הכי חזקות")}${sb("alpha","א-ב")}</div>
 <ul class="cl">${act.map(w=>row(w,`<button data-say="${esc(w.w)}" aria-label="השמעה">🔊</button><button data-hide="${esc(w.w)}" aria-label="מכירה טוב" title="מכירה טוב">✓</button>${w.custom?`<button data-rm="${esc(w.w)}" aria-label="מחיקה">✕</button>`:""}`,statLine(w))).join("")}</ul>`+
 (gone.length?`<h4>מילים שהוסרו (${gone.length})</h4><ul class="cl">${gone.map(w=>row(w,`<button data-restore="${esc(w.w)}" class="wide" aria-label="החזרה">↩ החזרה</button>`)).join("")}</ul>`:"");
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
  if(!en||!he||!/[a-z]/.test(en)||allWords.some(w=>w.w===en)){ skipped++; keep.push(r); continue; }
  allWords.push({w:en,he,m:"",ex:"",custom:1}); added++;
 }
 rows=keep; saveCustom(); applyHidden(); renderStats();
 drawRows(); drawCustom();
 $("awSt").textContent=added?`✅ נוספו ${added} מילים למשחקים!${skipped?` (${skipped} שורות דולגו: חסר תרגום, או שהמילה כבר קיימת)`:""}`:"לא נוספו מילים — צריך גם מילה באנגלית וגם תרגום בכל שורה.";
 if(added) celebrate(`נוספו ${added} מילים! 🎉`);
}

games.addwords={render(c){
 c.innerHTML=`<span class="tag">📊 סטטיסטיקה וניהול מילים</span>
 <details class="adder"><summary>➕ הוספת מילים חדשות (מתמונה או ידנית)</summary>
 <p class="sub">העלי תמונה עם מילים (למשל צילום של רשימה), ואני אזהה את הטקסט. אחר כך אפשר לתקן ולהוסיף את התרגום. התמונה נשארת במכשיר שלך.</p>
 <label class="up">📷 העלאת תמונה<input type="file" accept="image/*" id="awFile"></label>
 <img class="pv" id="awPv" alt="" style="display:none">
 <div class="st" id="awSt"></div>
 <div id="awRows"></div>
 <div class="tools"><button id="awRow">＋ הוספת שורה ידנית</button></div>
 <button class="next" id="awSave" style="display:none">💾 הוספה למשחקים</button>
 </details>
 <div id="awList"></div>`;
 $("awFile").onchange=e=>{onImage(e.target.files[0]); e.target.value=""};
 $("awRow").onclick=()=>{rows.push({en:"",he:""}); drawRows(); $("awRows").querySelector(".wr:last-child input")?.focus()};
 $("awSave").onclick=add;
 $("awRows").addEventListener("input",e=>{const i=e.target.dataset.i; if(i!=null) rows[+i][e.target.dataset.f]=e.target.value});
 $("awRows").addEventListener("click",e=>{const d=e.target.closest("[data-del]"); if(d){rows.splice(+d.dataset.del,1); drawRows()}});
 $("awList").addEventListener("click",e=>{
  const so=e.target.closest("[data-sort]");
  if(so){ sortBy=so.dataset.sort; store.set("wqSort",sortBy); drawCustom(); return; }
  const h=e.target.closest("[data-hide]");
  if(h){ const w=allWords.find(x=>x.w===h.dataset.hide); if(w&&hideWord(w)) drawCustom(); return; }
  const r=e.target.closest("[data-restore]");
  if(r){ restoreWord(r.dataset.restore); drawCustom(); return; }
  const d=e.target.closest("[data-rm]"); if(!d) return;
  const i=allWords.findIndex(w=>w.custom&&w.w===d.dataset.rm); if(i>=0) allWords.splice(i,1);
  hidden.delete(d.dataset.rm); saveHidden(); saveCustom(); applyHidden(); renderStats(); drawCustom();
 });
 drawRows(); drawCustom();
}};
})();
