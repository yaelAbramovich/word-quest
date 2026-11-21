const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 const left=()=>page.$$eval("#gbLeft .gbw",e=>e.map(x=>x.dataset.w));
 const right=()=>page.$$eval("#gbRight .gbw",e=>e.map(x=>x.dataset.w));
 const tap=n=>page.locator(`#grpBox .gbw[data-w="${n}"]`).click();
 await page.click("[data-tab=addwords]");
 await page.click("[data-grpnew]");
 check("builder opens with a default name and nothing chosen",(await page.inputValue("#gbName"))==="קבוצה 1"&&(await right()).length===0);
 check("the minimum is written, with a warning while below it",(await page.textContent("#gbSum")).includes("מינימום 4")&&!!(await page.$("#gbSum.warn")));
 // validation
 await page.fill("#gbName","   "); await page.click("#gbSave");
 check("empty name is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("שם"));
 await page.fill("#gbName","מילים של השבוע");
 const L=await left();
 for(const n of L.slice(0,2)) await tap(n);
 await page.click("#gbSave");
 check("fewer than 4 words is rejected with a message",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("4"));
 for(const n of L.slice(2,5)) await tap(n);
 check("at 4+ words the warning is gone",!(await page.$("#gbSum.warn")));
 await tap(L[5]);
 check("no upper limit: a 6th word can be chosen",(await right()).length===6);
 await tap(L[5]);
 await page.click("#gbSave");
 check("group section shows the free-text name and count",(await page.textContent("#grpBox > summary")).includes("מילים של השבוע")&&(await page.textContent("#grpBox > summary")).includes("5 מילים"));
 const stored=await page.evaluate(()=>JSON.parse(localStorage.wqGroup));
 check("saved on the device",stored.name==="מילים של השבוע"&&stored.words.length===5);
 check("group words are marked in the main list",(await page.$$eval("#awMain > li.ingrp",e=>e.length))===5);
 check("there is no group chip among the filters (the group has its own card)",!(await page.$("[data-filter=group]")));
 // games
 await page.click("[data-tab=quiz]");
 const opts=await page.$$eval("#scopeSel option",o=>o.map(x=>x.textContent.trim()));
 check("games offer the group with its name and count",opts.some(o=>o.includes("🎯 מילים של השבוע (5)")),JSON.stringify(opts));
 await page.selectOption("#scopeSel","group");
 const g=new Set(stored.words), seen=new Set();
 for(let i=0;i<20;i++){ seen.add(await page.$eval("#qgame [data-say]",e=>e.dataset.say)); await page.click(".answer"); await page.click("#next"); }
 check("quiz plays only the group's words",[...seen].every(x=>g.has(x)),[...seen].join());
 // removing a word from games drops it from the group
 await page.click("[data-tab=addwords]");
 await page.click(`#awMain [data-hide="${stored.words[0]}"]`);
 check("removing a word leaves the group",(await page.evaluate(()=>group.words.length))===4);
 // edit
 if(!(await page.$eval("#grpBox",e=>e.open))) await page.click("#grpBox > summary");
 await page.click("[data-grpedit]");
 check("edit opens the builder with the current name and words",(await page.inputValue("#gbName"))==="מילים של השבוע"&&(await right()).length===4);
 await page.click("#grpBox > summary");
 check("the builder collapses too",!(await page.$eval("#grpBox",e=>e.open))&&!(await page.isVisible("#gbSave")));
 await page.click("#grpBox > summary");
 check("and expands again with its words kept",(await page.isVisible("#gbSave"))&&(await right()).length===4);
 await page.click("#gbCancel");
 // finish
 if(!(await page.$eval("#grpBox",e=>e.open))) await page.click("#grpBox > summary");
 page.once("dialog",d=>d.accept());
 await page.click("[data-grpend]");
 check("finishing clears the group",(await page.evaluate(()=>group))===null&&!!(await page.$("[data-grpnew]")));
 check("games fall back to all when the group is gone",await page.evaluate(()=>getScope("quiz"))==="all");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
