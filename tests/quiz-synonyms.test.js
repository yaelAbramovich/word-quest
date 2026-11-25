const {openApp,check,done}=require("./helpers");
// a word with the same meaning as the right answer is never offered as a wrong option; the Words tab says how many attempts are missing for a percentage
const mk=(w,he)=>({w,he,m:"",ex:"",exs:[],custom:1});
(async()=>{
 const app=await openApp({storage:{wqCustom:[mk("quiver","לרעוד"),mk("trembling","רועד")]}}); const p=app.page;
 check("sameMeaning matches לרעוד / רועד and חלש, תשוש / חלש",await p.evaluate(()=>sameMeaning({he:"לרעוד"},{he:"רועד"})&&sameMeaning({he:"חלש, תשוש"},{he:"חלש"})));
 check("sameMeaning does not match unrelated meanings (חמוס / חרוט)",await p.evaluate(()=>!sameMeaning({he:"חמוס"},{he:"חרוט"})));
 await p.click("[data-tab=quiz]");
 let seen=0,bad=[];
 for(let i=0;i<400;i++){
  const r=await p.evaluate(()=>({w:document.querySelector("#qgame .word")?.dataset.say,a:[...document.querySelectorAll(".answer")].map(b=>b.textContent.trim())}));
  if(r.w==="quiver"){ seen++; if(r.a.includes("רועד")) bad.push("quiver+רועד"); }
  if(r.w==="trembling"){ seen++; if(r.a.includes("לרעוד")) bad.push("trembling+לרעוד"); }
  await p.click(".answer"); await p.click("#next");
 }
 check("over 400 rounds the two synonyms never appear together",bad.length===0&&seen>0,`seen ${seen}, bad ${bad.join()}`);
 await p.evaluate(()=>{ S.stats["quiver"]=Array.from({length:9},()=>[1,"2026-11-01"]); S.stats["trembling"]=[[1,"2026-11-01"],[0,"2026-11-01"]]; save(); });
 await p.reload(); await p.click("[data-tab=addwords]");
 const txt=await p.textContent("#awList");
 check("9 attempts: the label says one more attempt is needed",txt.includes("בלמידה 9/10 · עוד ניסיון אחד לאחוז"),"");
 check("2 attempts: the label says 8 more attempts",txt.includes("בלמידה 2/10 · עוד 8 ניסיונות לאחוז"),"");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
