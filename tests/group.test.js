const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 await page.click("[data-tab=addwords]");
 await page.click("[data-grpnew]");
 check("builder opens with a default name and the weak words pre-selected",(await page.inputValue("#gbName"))==="קבוצה 1"&&(await page.$$eval("[data-gbpick]:checked",e=>e.length))===5);
 // validation
 await page.fill("#gbName","   "); await page.click("#gbSave");
 check("empty name is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("שם"));
 await page.fill("#gbName","מילים של השבוע");
 for(const w of await page.$$eval("[data-gbpick]:checked",e=>e.map(x=>x.dataset.gbpick)).then(a=>a.slice(0,2))) await page.uncheck(`[data-gbpick="${w}"]`);
 await page.click("#gbSave");
 check("fewer than 4 words is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("4"));
 await page.click("#gbAuto");
 check("auto-pick selects 5 again",(await page.$$eval("[data-gbpick]:checked",e=>e.length))===5);
 await page.click("#gbSave");
 check("group section shows the free-text name and count",(await page.textContent(".grp")).includes("מילים של השבוע")&&(await page.textContent(".grp")).includes("5 מילים"));
 const stored=await page.evaluate(()=>JSON.parse(localStorage.wqGroup));
 check("saved on the device",stored.name==="מילים של השבוע"&&stored.words.length===5);
 check("group words are marked in the main list",(await page.$$eval("#awMain > li.ingrp",e=>e.length))===5);
 const chip=await page.textContent("[data-filter=group]");
 check("filter chip 🎯 name (5)",chip.includes("מילים של השבוע")&&chip.includes("(5)"),chip);
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
 await page.click("#gbCancel");
 // finish
 page.once("dialog",d=>d.accept());
 await page.click("[data-grpend]");
 check("finishing clears the group",(await page.evaluate(()=>group))===null&&!!(await page.$("[data-grpnew]")));
 check("games fall back to all when the group is gone",await page.evaluate(()=>getScope("quiz"))==="all");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
