const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const weak=names.slice(3,10), W=new Set(weak);
 const app=await openApp({strong:names.slice(0,3),weak,removed:names.slice(10,13),storage:{wqScopeShared:"1",wqScopeSharedValue:"weak"}});
 const {page}=app;
 // quiz
 await page.click("[data-tab=quiz]");
 const q=new Set();
 for(let i=0;i<25;i++){ q.add(await page.$eval("#qgame [data-say]",e=>e.dataset.say)); await page.click(".answer"); await page.click("#next"); }
 check("quiz plays only the 7 weak words",[...q].every(x=>W.has(x)),[...q].join());
 // hangman: the translation shown identifies the word
 await page.click("[data-tab=hangman]");
 const h=new Set();
 for(let i=0;i<12;i++){
  const he=(await page.textContent("#hmClue")).replace("התרגום:","").trim();
  h.add(await page.evaluate(t=>words.find(w=>w.he===t).w,he));
  for(const k of "QWERTYUIOPASDFGHJKLZXCVBNM"){ if(!(await page.$("#hmNext:not([disabled])"))){ const el=await page.$(`#view .key[data-k=${k}]:not([disabled])`); if(el) await el.click(); } }
  await page.click("#hmNext");
 }
 check("hangman plays only the 7 weak words",[...h].every(x=>W.has(x)),[...h].join());
 // cards: one round shows exactly the 7 weak words
 await page.click("[data-tab=cards]"); await page.click("#cdStart");
 const c=[];
 for(let i=0;i<7;i++){ c.push(await page.$eval(".cdcard .word",e=>e.textContent.trim())); await page.click("#cdShow"); await page.click("#cdOk"); }
 check("cards round = exactly the 7 weak words",c.length===7&&new Set(c).size===7&&c.every(x=>W.has(x)),c.join());
 check("cards round ends after the 7th card",!!(await page.$("#cdBody .win")));
 // empty pool: strong has 3 words; make it empty by choosing 'new' after everything is practiced
 await page.evaluate(()=>{ store.set("wqScopeSharedValue","new"); words.forEach(w=>{ if(category(w)==="new") S.stats[w.w]=[[0,"2026-11-01"]]; }); });
 await page.click("[data-tab=quiz]");
 check("empty pool shows a message instead of a game",!!(await page.$(".gwarn"))&&await page.$eval("#gBody",e=>e.hidden));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
