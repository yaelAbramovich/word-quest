const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 await page.click("[data-tab=addwords]");
 await page.click("[data-grpnew]");
 check("builder opens with a default name and nothing pre-selected",(await page.inputValue("#gbName"))==="קבוצה 1"&&(await page.$$eval("[data-gbpick]:checked",e=>e.length))===0);
 check("no count input and no auto-pick button",!(await page.$("#gbCount"))&&!(await page.$("#gbAuto")));
 check("the minimum is written, with a warning while below it",(await page.textContent(".grp.building .sum")).includes("מינימום 4")&&!!(await page.$(".grp.building .sum.warn")));
 // validation
 await page.fill("#gbName","   "); await page.click("#gbSave");
 check("empty name is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("שם"));
 await page.fill("#gbName","מילים של השבוע");
 for(let i=0;i<2;i++) await page.locator("[data-gbpick]").nth(i).check();
 await page.click("#gbSave");
 check("fewer than 4 words is rejected with a message",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("4"));
 for(let i=2;i<5;i++) await page.locator("[data-gbpick]").nth(i).check();
 check("at 4+ words the warning is gone",!(await page.$(".grp.building .sum.warn")));
 await page.locator("[data-gbpick]").nth(5).check();
 check("no upper limit: a 6th word can be ticked",(await page.$$eval("[data-gbpick]:checked",e=>e.length))===6);
 await page.locator("[data-gbpick]").nth(5).uncheck();
 // ticking a word must not redraw/jump the list
 const low=page.locator("[data-gbpick]").nth(14);
 await low.scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>({list:document.querySelector(".gbl").scrollTop,page:window.scrollY}));
 await low.check();
 const after=await page.evaluate(()=>({list:document.querySelector(".gbl").scrollTop,page:window.scrollY,n:document.querySelectorAll("[data-gbpick]:checked").length,sum:document.querySelector("#gbSum").textContent}));
 check("ticking a lower word does not move the list",before.list>0&&after.list===before.list&&after.page===before.page,JSON.stringify({before,after}));
 check("the tick is kept and the counter updates",after.n===6&&after.sum.includes("נבחרו 6"),JSON.stringify(after));
 await low.uncheck();
 await page.click("#gbSave");
 check("group section shows the free-text name and count",(await page.textContent(".grp")).includes("מילים של השבוע")&&(await page.textContent(".grp")).includes("5 מילים"));
 const stored=await page.evaluate(()=>JSON.parse(localStorage.wqGroup));
 check("saved on the device",stored.name==="מילים של השבוע"&&stored.words.length===5);
 check("group words are marked in the main list",(await page.$$eval("#awMain > li.ingrp",e=>e.length))===5);
 const chip=await page.textContent("[data-filter=group]");
 check("filter chip 🎯 name (5)",chip.includes("מילים של השבוע")&&chip.includes("(5)"),chip);
 // collapse / expand
 check("group area is open by default",await page.$eval("#grpBox",e=>e.open));
 await page.click("#grpBox > summary");
 check("tapping the title collapses it (words hidden)",!(await page.$eval("#grpBox",e=>e.open))&&!(await page.isVisible("#grpBox .grpl")));
 await page.click("[data-filter=all]");
 check("it stays collapsed after the tab redraws",!(await page.$eval("#grpBox",e=>e.open)));
 check("the choice is remembered on the device",(await page.evaluate(()=>store.get("wqGrpOpen")))==="0");
 await page.click("#grpBox > summary");
 check("tapping again expands it",(await page.$eval("#grpBox",e=>e.open))&&(await page.isVisible("#grpBox .grpl")));
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
 await page.click("[data-grpedit]");
 check("edit opens the builder with the current name",(await page.inputValue("#gbName"))==="מילים של השבוע");
 await page.click("#grpBox > summary");
 check("the builder collapses too",!(await page.$eval("#grpBox",e=>e.open))&&!(await page.isVisible("#gbSave")));
 await page.click("#grpBox > summary");
 check("and expands again with its ticks kept",(await page.isVisible("#gbSave"))&&(await page.$$eval("[data-gbpick]:checked",e=>e.length))===4);
 await page.click("#gbCancel");
 // finish
 page.once("dialog",d=>d.accept());
 await page.click("[data-grpend]");
 check("finishing clears the group",(await page.evaluate(()=>group))===null&&!!(await page.$("[data-grpnew]")));
 check("games fall back to all when the group is gone",await page.evaluate(()=>getScope("quiz"))==="all");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
