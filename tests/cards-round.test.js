const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const n=probe.names; await probe.close();
 const today=Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
 // 8 words were answered right recently: the old schedule would hide them from a round
 const cards={}; n.slice(3,11).forEach(w=>{ cards[w]={b:2,d:today+5,l:today-2}; });
 const app=await openApp({removed:n.slice(0,3),storage:{wqCards:cards}}); const {page}=app;
 await page.click("[data-tab=cards]");
 check("no red number on the cards tab",!(await page.$(".tabs [data-tab=cards] .bdg")));
 const intro=(await page.textContent("#cdBody .sub")).trim();
 check("the intro states the real size of the round (all 19, 3 of them done words)",intro.includes("19 כרטיסים בסבב")&&intro.includes("3 מילים שהסרת"),intro);
 check("no text about 'due today' or 'all words are included'",!intro.includes("מחכים לך היום")&&!intro.includes("נכללות בסבב"));
 await page.click("#cdStart");
 const seen=new Set();
 for(let g=0;!(await page.$("#cdBody .win"))&&g<60;g++){
  seen.add(await page.$eval(".cdcard .word",e=>e.textContent.trim()));
  await page.click("#cdShow"); await page.click("#cdOk");
 }
 check("'הכל' plays EVERY word, also the ones the old schedule hid and the done ones",seen.size===19,String(seen.size));
 check("the end of a round offers 'סבב נוסף'",(await page.textContent("#cdMore")).includes("סבב נוסף"));
 await page.click("#cdMore");
 check("'סבב נוסף' starts another full round",(await page.textContent(".cdleft")).includes("נשארו 19 כרטיסים"));

 // ---- the 'לא ידעתי' selection: only missed words, and it updates live ----
 await page.evaluate(([a,b,t])=>{ S.cards[a]={b:0,d:t,l:t}; S.cards[b]={b:0,d:t,l:t}; save(); },[n[3],n[4],today]);   // two misses
 await page.click("[data-tab=quiz]"); await page.click("[data-tab=cards]");
 await page.selectOption("#scopeSel","missed");
 check("the selector counts the 2 missed words",(await page.$eval('#scopeSel option[value="missed"]',e=>e.textContent.trim()))==="❌ לא ידעתי (2)");
 check("the intro says 2 cards",(await page.textContent("#cdBody .sub")).includes("2 כרטיסים בסבב"));
 await page.click("#cdStart");
 const first=await page.$eval(".cdcard .word",e=>e.textContent.trim());
 check("the round contains only missed words",[n[3],n[4]].includes(first),first);
 await page.click("#cdShow"); await page.click("#cdOk");
 check("answering 'ידעתי' makes the count drop at once",(await page.$eval('#scopeSel option[value="missed"]',e=>e.textContent.trim()))==="❌ לא ידעתי (1)");
 await page.click("#cdShow"); await page.click("#cdOk");
 check("the round ends and says nothing is left in 'לא ידעתי'",(await page.textContent("#cdBody")).includes("אין יותר כרטיסים ב״לא ידעתי״"));
 await page.click("#cdMore");
 check("with nothing missed, 'סבב נוסף' shows the empty message",(await page.textContent("#cdBody .gwarn")).includes("אין כרטיסים שסימנת ״לא ידעתי״"));
 // a word you keep missing in the 'all' selection joins 'לא ידעתי'
 await page.selectOption("#scopeSel","all");
 await page.click("#cdStart");
 const target=await page.$eval(".cdcard .word",e=>e.textContent.trim());
 for(let g=0;!(await page.$("#cdBody .win"))&&g<80;g++){
  const w=await page.$eval(".cdcard .word",e=>e.textContent.trim());
  await page.click("#cdShow"); await page.click(w===target?"#cdNo":"#cdOk");
 }
 const afterMiss=await page.$eval('#scopeSel option[value="missed"]',e=>e.textContent.trim());
 check("a word you keep missing joins 'לא ידעתי'",afterMiss==="❌ לא ידעתי (1)",afterMiss);
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
