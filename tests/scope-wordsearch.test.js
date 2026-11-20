const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const weak=names.slice(3,10);
 const app=await openApp({strong:names.slice(0,3),weak,storage:{wqScopeShared:"1",wqScopeSharedValue:"weak"}});
 const {page}=app;
 await page.click("[data-tab=wordsearch]");
 const shown=await page.$$eval("#wsList .chip span[dir=ltr]",e=>e.map(x=>x.textContent.trim()));
 const left=await page.$$eval("#wsNote b",e=>e.map(x=>x.textContent.trim()));
 const union=new Set([...shown,...left]);
 check("word search = exactly the 7 weak words (shown + listed as not fitting)",union.size===7&&weak.every(w=>union.has(w))&&shown.length+left.length===7,JSON.stringify({shown,left}));
 // bigger pool than capacity: subset note
 await page.evaluate(()=>{ store.set("wqScopeSharedValue","all"); });
 await page.click("[data-tab=crossword]"); await page.click("[data-tab=wordsearch]");
 const note=await page.textContent("#wsNote");
 check("bigger pool shows 'X מתוך N'",/מוצגות 7 מתוך \d+ מילים/.test(note),note);
 // too few words
 await page.evaluate(n=>{ store.set("wqScopeSharedValue","group"); group={name:"g",words:n.slice(0,2)}; saveGroup(); },weak);
 await page.click("[data-tab=crossword]"); await page.click("[data-tab=wordsearch]");
 check("2 words: minimum message and no grid",(await page.textContent(".gwarn")).includes("לפחות 3")&&await page.$eval("#gBody",e=>e.hidden));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
