const {openApp,check,done,starterNames}=require("./helpers");
const KEYS=["wqCustom","wqEdits","wqDeleted","wqHidden","wqGroup","wqStats","wqTotals","wqCards","wqMistakes","wqLearned","wqVoice","wqRate","wqMuted","wqFilter","wqScope_quiz","wqScopeShared","wqScopeSharedValue","wqGrpOpen"];
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const custom={w:"zzcustom",he:"בדיקה",m:"",ex:"A zzcustom test.",exs:["A zzcustom test."],custom:1};
 const app=await openApp({strong:names.slice(0,3),weak:names.slice(3,10),removed:names.slice(10,13),storage:{
  wqCustom:[custom],wqEdits:{bank:{he:"שונה",m:"",exs:["I edited this."]}},wqDeleted:[names[13]],
  wqGroup:{name:"מילים של השבוע",words:names.slice(3,8)},wqVoice:"x",wqRate:"1",wqMuted:"1",wqFilter:"weak",wqScope_quiz:"weak",wqScopeShared:"1",wqScopeSharedValue:"weak",wqGrpOpen:"1",
  wqTotals:{bank:{s:1,m:0,h:0}},wqCards:{bank:{b:1,d:5,l:1}},wqMistakes:{bank:2},wqLearned:["bank"]}});
 const {page}=app;
 await page.click("[data-tab=addwords]");
 const present=await page.evaluate(k=>k.filter(x=>localStorage.getItem(x)!==null),KEYS);
 check("before: the user has data under every key",present.length===KEYS.length,JSON.stringify(KEYS.filter(k=>!present.includes(k))));
 const before=await page.evaluate(()=>words.length);
 check("the button is there",!!(await page.$("#awDefault")));

 // cancel changes nothing (and does not reload)
 await page.evaluate(()=>{ window.__marker=1; });
 let msg=""; page.once("dialog",d=>{ msg=d.message(); d.dismiss(); });
 await page.click("#awDefault");
 check("the confirm explains what will be erased",msg.includes("לחזור לברירת המחדל")&&msg.includes("אי אפשר לבטל")&&msg.includes("10 מילות ברירת המחדל"),msg);
 check("cancel changes nothing",(await page.evaluate(()=>window.__marker===1&&words.length))===before&&(await page.evaluate(()=>localStorage.getItem("wqCustom")||"")).includes("zzcustom"));

 // accept: everything is erased and the 10 starter words are shown
 page.once("dialog",d=>d.accept());
 await Promise.all([page.waitForEvent("load"),page.click("#awDefault")]);
 await page.click("[data-tab=addwords]");
 const after=await page.evaluate(k=>({pack:localStorage.getItem("wqPack"),left:k.filter(x=>localStorage.getItem(x)!==null),names:words.map(w=>w.w).sort(),all:allWords.length,group,muted}),KEYS);
 check("the 10 starter words are shown",JSON.stringify(after.names)===JSON.stringify([...starterNames()].sort())&&after.all===10,JSON.stringify(after.names));
 check("the device is marked as a new one (starter pack)",after.pack==="starter");
 check("everything the user changed is gone (words, edits, deleted/removed words, group, progress, settings)",after.left.length===0&&after.group===null&&after.muted===false,JSON.stringify(after.left));
 check("the Words tab lists exactly the 10 words",(await page.textContent("#awList")).includes("המילים במשחקים (10)"));
 await page.reload();
 check("it stays like that after another reload",(await page.evaluate(()=>[words.length,localStorage.getItem("wqPack")])).join()==="10,starter");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close();

 // someone who had the old 19 words also gets the 10 starter words
 const old=await openApp({pack:"raw",storage:{wqTab:"quiz"}});
 check("before: this user has the 19 old words",(await old.page.evaluate(()=>words.length))===19);
 await old.page.click("[data-tab=addwords]");
 old.page.once("dialog",d=>d.accept());
 await Promise.all([old.page.waitForEvent("load"),old.page.click("#awDefault")]);
 check("after: the same user gets the 10 starter words",(await old.page.evaluate(()=>[words.length,localStorage.getItem("wqPack")])).join()==="10,starter");
 check("no page errors (old user)",old.errors.length===0,old.errors.join("|"));
 await old.close(); done();
})();
