(function(){
const TESS="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let rows=[];

const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const customWords=()=>allWords.filter(w=>w.custom);

function loadTesseract(){
 return new Promise((ok,fail)=>{
  if(window.Tesseract) return ok();
  const s=document.createElement("script"); s.src=TESS; s.onload=ok; s.onerror=()=>fail(new Error("load"));
  document.head.appendChild(s);
 });
}
// split each OCR line into its English part and its Hebrew part; fix the layouts we know
const HE=/[\u0590-\u05FF][\u0590-\u05FF ,'"()\-]*/g;
function parseText(text){
 const rows=text.split(/\n+/).map(l=>l.trim()).filter(Boolean).map(l=>({
  en:(l.match(/[A-Za-z][A-Za-z' \-]*/g)||[]).join(" ").replace(/\s+/g," ").trim().toLowerCase(),
  he:(l.match(HE)||[]).join(" ").trim(), ex:""
 })).filter(r=>r.en||r.he);
 // a label repeated after every English word (e.g. the book name "Alice's Adventu…") is not part of the word
 const toks=rows.map(r=>r.en.split(" ").filter(Boolean));
 const enRows=toks.filter(t=>t.length>1).length;
 let cut=null;
 for(let k=4;k>=1&&!cut;k--){
  const cnt={}; toks.forEach(t=>{ if(t.length>k){ const x=t.slice(-k).join(" "); cnt[x]=(cnt[x]||0)+1; } });
  const best=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
  if(best&&best[1]>=4&&best[1]>=enRows*0.5) cut=best[0];
 }
 rows.forEach((r,i)=>{
  let t=toks[i];
  const ai=t.findIndex(x=>/^alice/.test(x)); if(ai>0) t=t.slice(0,ai);
  if(cut){ const c=cut.split(" "); if(t.length>c.length&&t.slice(-c.length).join(" ")===cut) t=t.slice(0,-c.length); }
  while(t.length>1&&t[t.length-1].replace(/[^a-z]/g,"").length<=1&&!/^(a|i)$/.test(t[t.length-1])) t.pop();  // stray icon glyphs
  r.en=t.join(" ").replace(/[-' ]+$/,"").trim();
 });
 // layout where the translation sits on the line below the English word
 const out=[];
 for(let i=0;i<rows.length;i++){
  const r=rows[i], n=rows[i+1];
  if(r.en&&!r.he&&n&&n.he&&!n.en){ out.push({en:r.en,he:n.he,ex:""}); i++; }
  else out.push(r);
 }
 return out;
}

function drawRows(){
 $("awRows").innerHTML=rows.map((r,i)=>`<div class="wr"><input class="en" dir="ltr" data-i="${i}" data-f="en" placeholder="English" value="${esc(r.en)}" autocapitalize="none" autocorrect="off"><input data-i="${i}" data-f="he" placeholder="תרגום" value="${esc(r.he)}"><button data-del="${i}" aria-label="מחיקה">✕</button><input class="ex" dir="ltr" data-i="${i}" data-f="ex" placeholder="משפט באנגלית (לא חובה — אם ריק אחפש לבד)" value="${esc(r.ex||"")}" autocapitalize="none"></div>`).join("");
 $("awSave").style.display=rows.length?"block":"none";
}
let editing=null;
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
 const tt=S.totals[w.w]||{s:0,m:0,h:0};
 return `<div class="st2"><span class="dots" dir="ltr">${dots}</span>${label}${t.mastered?`<span class="rec">💡 אפשר להסיר</span>`:""}</div>
 <div class="st2 tot"><span class="g">✓ הצלחות: ${tt.s}</span><span class="r">✗ טעויות: ${tt.m}</span><span class="y">💡 עזרות: ${tt.h}</span></div>`;
}
function drawCustom(){
 const gone=allWords.filter(w=>hidden.has(w.w));
 const val=w=>{const t=wstat(w); return !t.n?2:t.pct!==null?t.pct/100:t.c/t.n};   // untested words go last
 const act=[...words].sort(sortBy==="alpha"?(a,b)=>a.w.localeCompare(b.w):sortBy==="strong"?(a,b)=>{const ua=val(a)>1,ub=val(b)>1; return ua!==ub?(ua?1:-1):val(b)-val(a)}:(a,b)=>val(a)-val(b));
 const st=words.map(wstat), withPct=st.filter(t=>t.pct!==null);
 const learning=st.filter(t=>t.n&&t.pct===null).length, fresh=st.filter(t=>!t.n).length;
 const avg=withPct.length?Math.round(withPct.reduce((x,t)=>x+t.pct,0)/withPct.length):null;
 const row=(w,btns,extra)=>`<li><span><b dir="ltr">${esc(w.w)}</b> — ${esc(w.he)}</span>${btns}${extra||""}</li>`;
 const copyIcon=`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`;
 const exLine=w=>w.exs.length?w.exs.map(x=>`<div class="st2 ex-line"><span class="sent">${esc(x)}</span><button data-copy="${esc(x)}" aria-label="העתקת משפט">${copyIcon}</button></div>`).join(""):(w.custom?`<div class="st2 ex-line"><span class="sent">אין עדיין משפט</span></div>`:"");
 const editBox=w=>`<div class="editbox"><label>משמעות (מה שמוצג במשחקים)</label><input id="edHe" value="${esc(w.he)}"><label>הסבר מורחב (לא חובה)</label><input id="edM" value="${esc(w.m||"")}"><label>משפטים באנגלית — כל משפט בשורה נפרדת. במשחקים נבחר משפט אקראי, בלי לחזור על אותו משפט פעמיים ברציפות.</label><textarea id="edEx" dir="ltr" rows="4" autocapitalize="none">${esc(w.exs.join("\n"))}</textarea><div class="tools"><button class="wide" data-edsave="${esc(w.w)}">💾 שמירה</button><button class="wide" data-edfind="${esc(w.w)}">🔍 הוספת משפט</button><button class="wide" data-edcancel>ביטול</button></div></div>`;
 const rec=words.filter(w=>wstat(w).mastered);
 const missing=customWords().filter(w=>!w.ex&&!hidden.has(w.w)).length;
 const sb=(k,t)=>`<button data-sort="${k}" class="${sortBy===k?"on":""}">${t}</button>`;
 $("awList").innerHTML=`<h4>המילים במשחקים (${words.length})</h4>
 <p class="sub">האחוז נמדד רק בתשבץ ובחידון, ומופיע אחרי ${WINDOW} ניסיונות. הוא מבוסס על ${WINDOW} הניסיונות האחרונים. 100% = כל הניסיונות נכונים, עם הצלחות ב-${DAYS_FOR_100} ימים שונים. בפחות ימים — המקסימום 90%. רמז או "גלי מילה" נחשבים כאילו לא ידעת. מילים חדשות וחלשות יופיעו יותר. בנוסף, מתחת לכל מילה מוצגת הספירה הכוללת מאז ומעולם: הצלחות, טעויות וכמה פעמים נעזרת ברמז.</p>
 ${missing?`<button class="next" style="display:block;margin:8px 0" data-fillall>🔍 חיפוש משפטים ל-${missing} מילים שחסר להן</button>`:""}
 <div class="sum">${withPct.length} מילים עם אחוז${avg===null?"":` (ממוצע ${avg}%)`} · ${learning} בלמידה · ${fresh} חדשות${rec.length?` · 💡 ${rec.length} מומלצות להסרה`:""}</div>
 ${rec.length?`<button class="next" style="display:block;margin:8px 0;background:var(--green)" data-removerec>💡 הסרת ${rec.length} המילים המומלצות להסרה</button>`:""}
 <div class="tools sorts">${sb("weak","הכי חלשות")}${sb("strong","הכי חזקות")}${sb("alpha","א-ב")}</div>
 <ul class="cl">${act.map(w=>row(w,`<button data-copy="${esc(w.w)}" aria-label="העתקת מילה"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg></button><button data-say="${esc(w.w)}" aria-label="השמעה">🔊</button><button data-edit="${esc(w.w)}" aria-label="עריכת משמעות ומשפטים">✏️</button><button data-hide="${esc(w.w)}" aria-label="מכירה טוב" title="מכירה טוב">✓</button>${w.custom?`<button data-rm="${esc(w.w)}" aria-label="מחיקה">✕</button>`:""}`,editing===w.w?editBox(w):statLine(w)+exLine(w))).join("")}</ul>`+
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

async function add(){
 let added=0, skipped=0; const keep=[], fresh=[];
 for(const r of rows){
  const en=r.en.trim().toLowerCase(), he=r.he.trim();
  if(!en||!he||!/[a-z]/.test(en)||allWords.some(w=>w.w===en)){ skipped++; keep.push(r); continue; }
  const ex=(r.ex||"").trim(), w={w:en,he,m:"",ex,exs:ex?[ex]:[],custom:1}; allWords.push(w); fresh.push(w); added++;
 }
 rows=keep; saveCustom(); applyHidden(); renderStats();
 drawRows(); drawCustom();
 $("awSt").textContent=added?`✅ נוספו ${added} מילים למשחקים!${skipped?` (${skipped} שורות דולגו: חסר תרגום, או שהמילה כבר קיימת)`:""}`:"לא נוספו מילים — צריך גם מילה באנגלית וגם תרגום בכל שורה.";
 if(added) celebrate(`נוספו ${added} מילים! 🎉`);
 const todo=fresh.filter(w=>!w.ex);
 if(todo.length) await fillSentences(todo);
}
async function fillSentences(list){
 let got=0;
 for(let i=0;i<list.length;i++){
  $("awSt").textContent=`מחפשת משפטים… ${i+1}/${list.length}`;
  const x=await findSentence(list[i].w);
  if(x){ setSentences(list[i],[x]); got++; }
 }
 drawCustom();
 $("awSt").textContent=`נמצאו משפטים ל-${got} מתוך ${list.length} מילים.${got<list.length?" לשאר אפשר לכתוב משפט ידנית עם ✏️ ברשימה למטה.":""}`;
 if(!$("awSt").isConnected) toast(`נמצאו משפטים ל-${got} מתוך ${list.length}`);
}

// ---- voice settings ----
function fillVoices(){
 const sel=$("vSel"); if(!sel) return;
 const cur=store.get("wqVoice","");
 sel.innerHTML=`<option value="">אוטומטי — הקול הטבעי ביותר שיש במכשיר</option>`+sortedVoices().map(v=>`<option value="${esc(v.voiceURI)}"${v.voiceURI===cur?" selected":""}>${esc(v.name)} (${esc(v.lang)})</option>`).join("");
 const pv=pickVoice(); $("vNow").textContent=pv?`הקול הנוכחי: ${pv.name}`:"לא נמצאו קולות באנגלית במכשיר";
}
function markRate(){ document.querySelectorAll("[data-rate]").forEach(b=>b.classList.toggle("on",+b.dataset.rate===getRate())); }

games.addwords={render(c){
 c.innerHTML=`
 <details class="adder vbox"><summary>🗣️ קול והגייה</summary>
 <div class="st" id="vNow"></div>
 <select id="vSel" aria-label="בחירת קול"></select>
 <div class="tools" id="vRate"><button data-rate="0.7">🐢 איטי</button><button data-rate="0.85">רגיל</button><button data-rate="1">🐇 מהיר</button></div>
 <div class="tools"><button id="vTry">🔊 נסי את הקול</button></div>
 <p class="tip">לקול טבעי יותר באייפון: הגדרות ← נגישות ← תוכן מדובר ← קולות ← English, והורידי קול שכתוב לידו Enhanced או Premium (למשל Ava או Samantha). אחרי ההורדה הוא ייבחר אוטומטית, או שאפשר לבחור אותו כאן.</p>
 </details>
 <details class="adder"><summary>➕ הוספת מילים חדשות (מתמונה או ידנית)</summary>
 <p class="sub">העלי תמונה עם מילים (למשל צילום של רשימה), ואני אזהה את הטקסט. אפשר לתקן, ולהוסיף משפט באנגלית בכל שורה — אם משאירים ריק, אחפש משפט אוטומטית. התמונה נשארת במכשיר שלך.</p>
 <label class="up">📷 העלאת תמונה<input type="file" accept="image/*" id="awFile"></label>
 <img class="pv" id="awPv" alt="" style="display:none">
 <div class="st" id="awSt"></div>
 <div id="awRows"></div>
 <div class="tools"><button id="awRow">＋ הוספת שורה ידנית</button></div>
 <button class="next" id="awSave" style="display:none">💾 הוספה למשחקים</button>
 </details>
 <div id="awList"></div>`;
 fillVoices(); markRate();
 try{ speechSynthesis.onvoiceschanged=fillVoices; }catch(e){}
 $("vSel").onchange=e=>{ store.set("wqVoice",e.target.value); fillVoices(); speak("She picked a daisy in the garden.",true); };
 $("vRate").onclick=e=>{ const b=e.target.closest("[data-rate]"); if(!b) return; store.set("wqRate",b.dataset.rate); markRate(); speak("She picked a daisy in the garden.",true); };
 $("vTry").onclick=()=>speak("She picked a daisy in the garden.",true);
 $("awFile").onchange=e=>{onImage(e.target.files[0]); e.target.value=""};
 $("awRow").onclick=()=>{rows.push({en:"",he:"",ex:""}); drawRows(); $("awRows").querySelector(".wr:last-child input")?.focus()};
 $("awSave").onclick=add;
 $("awRows").addEventListener("input",e=>{const i=e.target.dataset.i; if(i!=null) rows[+i][e.target.dataset.f]=e.target.value});
 $("awRows").addEventListener("click",e=>{const d=e.target.closest("[data-del]"); if(d){rows.splice(+d.dataset.del,1); drawRows()}});
 $("awList").addEventListener("click",e=>{
  const ed=e.target.closest("[data-edit]");
  if(ed){ editing=editing===ed.dataset.edit?null:ed.dataset.edit; drawCustom(); return; }
  if(e.target.closest("[data-edcancel]")){ editing=null; drawCustom(); return; }
  const sv=e.target.closest("[data-edsave]");
  if(sv){
   const w=allWords.find(x=>x.w===sv.dataset.edsave); if(!w) return;
   const he=$("edHe").value.trim(); if(!he){ toast("צריך לכתוב משמעות"); return; }
   w.he=he; w.m=$("edM").value.trim(); setSentences(w,$("edEx").value.split("\n"));
   editing=null; drawCustom(); toast("נשמר ✓"); return; }
  const fd=e.target.closest("[data-edfind]");
  if(fd){
   const w=allWords.find(x=>x.w===fd.dataset.edfind); if(!w) return;
   fd.disabled=true; fd.textContent="מחפשת…";
   const have=$("edEx").value.split("\n").map(x=>x.trim());
   sentenceCandidates(w.w).then(c=>{
    fd.disabled=false; fd.textContent="🔍 הוספת משפט";
    const n=c.find(x=>!have.includes(x));
    if(!n){ toast("לא מצאתי עוד משפטים. אפשר לכתוב ידנית"); return; }
    $("edEx").value=($("edEx").value.trim()?$("edEx").value.trim()+"\n":"")+n;
   });
   return; }
  const cp=e.target.closest("[data-copy]"); if(cp){ copyText(cp.dataset.copy); return; }
  if(e.target.closest("[data-removerec]")){
   const rec=words.filter(w=>wstat(w).mastered);
   if(confirm(`להסיר ${rec.length} מילים שאת מכירה היטב מהמשחקים? אפשר להחזיר אותן בהמשך.`)){ for(const w of rec) if(!hideWord(w)) break; drawCustom(); }
   return; }
  if(e.target.closest("[data-fillall]")){ fillSentences(customWords().filter(w=>!w.ex&&!hidden.has(w.w))); return; }
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
 document.addEventListener("sentencechanged",()=>{ if($("awList")) drawCustom(); },{once:false});
 drawRows(); drawCustom();
}};
})();
