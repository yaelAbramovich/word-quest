const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const weak=names.slice(3,9);               // 6 weak words
 const app=await openApp({strong:names.slice(0,3),weak,storage:{wqScopeShared:"1",wqScopeSharedValue:"weak"}});
 const {page}=app;
 let ok=true, detail=[];
 for(let i=0;i<8;i++){   // several different random puzzles
  await page.click("[data-tab=crossword]"); await page.click("#cwNew");
  const shown=await page.$$eval("#cwLists li",e=>e.map(x=>x.dataset.en));
  const left=await page.$$eval("#cwNote b",e=>e.map(x=>x.textContent.trim()));
  const union=new Set([...shown,...left]);
  if(!(union.size===6&&weak.every(w=>union.has(w))&&shown.length+left.length===6)){ ok=false; detail.push(JSON.stringify({shown,left})); }
 }
 check("crossword = exactly the 6 weak words (placed + listed), 8 puzzles",ok,detail.join(" ; "));
 await page.evaluate(()=>{ store.set("wqScopeSharedValue","all"); });
 await page.click("[data-tab=hangman]"); await page.click("[data-tab=crossword]");
 check("bigger pool shows 'X מתוך N'",/מוצגות \d+ מתוך \d+ מילים/.test(await page.textContent("#cwNote")));
 await page.evaluate(n=>{ store.set("wqScopeSharedValue","group"); group={name:"g",words:n.slice(0,3)}; saveGroup(); },weak);
 await page.click("[data-tab=hangman]"); await page.click("[data-tab=crossword]");
 const msg=await page.textContent(".gwarn");
 check("3 words: minimum message (needs 4) and no grid",msg.includes("לפחות 4")&&await page.$eval("#gBody",e=>e.hidden),msg);
 await page.keyboard.press("A");   // typing while gated must not crash
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
