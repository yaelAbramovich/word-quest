const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 await page.click("[data-tab=addwords]");
 const btns=await page.$$eval("[data-filter]",e=>e.map(x=>({f:x.dataset.filter,t:x.textContent.trim()})));
 check("no A-Z button",!btns.some(b=>b.t.includes("A-Z")),JSON.stringify(btns));
 check("filters are הכל / חדשות / חלשות / חזקות / מילים שהוסרו",btns.map(b=>b.f).join()==="all,new,weak,strong,removed"&&btns[4].t.includes("מילים שהוסרו")&&btns[4].t.includes("(3)"),JSON.stringify(btns));
 const rowsFor=async f=>{ await page.click(`[data-filter=${f}]`); return page.$$eval("#awMain > li b[dir=ltr]",e=>e.map(x=>x.textContent.trim())); };
 const counts={};
 for(const b of btns){ const rows=await rowsFor(b.f); const n=+b.t.match(/\((\d+)\)/)[1]; counts[b.f]=rows; check(`'${b.t}' count equals rows shown (${rows.length})`,rows.length===n); }
 check("the 'מילים שהוסרו' filter lists exactly the removed words",JSON.stringify([...counts.removed].sort())===JSON.stringify([...removed].sort()),JSON.stringify(counts.removed));
 await page.click("[data-filter=removed]");
 check("removed words have restore and delete buttons in the list",(await page.$$eval("#awMain > li [data-restore]",e=>e.length))===3&&(await page.$$eval("#awMain > li [data-delword]",e=>e.length))===3);
 check("the heading follows the filter",(await page.textContent("#awList h4:not(.grph)")).includes("מילים שהוסרו (3)"));
 await page.click("[data-filter=all]");
 check("no separate removed-words section under the list any more",(await page.$$("[data-restore]")).length===0);
 check("weak and strong share no word",!counts.weak.some(w=>counts.strong.includes(w)));
 check("new+weak+strong = all",counts.new.length+counts.weak.length+counts.strong.length===counts.all.length);
 const sum=await page.textContent(".sum");
 check("summary uses the same three names and counts",sum.includes(`${counts.new.length} חדשות`)&&sum.includes("7 חלשות")&&sum.includes("3 חזקות"),sum);
 // the numbers match the game selector
 await page.click("[data-tab=quiz]");
 const opts=await page.$$eval("#scopeSel option",o=>o.map(x=>x.textContent.trim()));
 check("game selector counts = Words tab counts",opts[2]==="חלשות (7)"&&opts[3]==="חזקות (3)"&&opts[1]===`חדשות (${counts.new.length})`,JSON.stringify(opts));
 // shared block
 await page.click("[data-tab=addwords]");
 check("shared selector disabled until the checkbox is ticked",await page.$eval("#shSel",e=>e.disabled));
 await page.check("#shChk"); await page.selectOption("#shSel","weak");
 check("shared choice saved",await page.evaluate(()=>isShared()&&store.get("wqScopeSharedValue")==="weak"));
 for(const g of ["quiz","hangman","wordsearch","crossword","cards"]){
  await page.click(`[data-tab=${g}]`);
  check(`${g}: locked on the shared choice`,(await page.textContent(".scopelock")).includes("חלשות (7)"));
 }
 await page.click("[data-tab=addwords]"); await page.uncheck("#shChk");
 await page.click("[data-tab=quiz]");
 check("unticking restores the game's own selector",!!(await page.$("#scopeSel")));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
