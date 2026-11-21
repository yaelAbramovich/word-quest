const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const n=probe.names; await probe.close();
 const today=Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
 // n3,n4,n5: missed today.  n6: missed 10 days ago (still missed).  n7,n8: answered right (next review later).  n9: answered right 4 days ago, due again now (NOT missed).
 const cards={};
 [3,4,5].forEach(i=>{ cards[n[i]]={b:0,d:today,l:today}; });
 cards[n[6]]={b:0,d:today-10,l:today-10};
 [7,8].forEach(i=>{ cards[n[i]]={b:2,d:today+5,l:today}; });
 cards[n[9]]={b:1,d:today-3,l:today-4};
 const app=await openApp({strong:n.slice(0,3),weak:n.slice(3,10),removed:n.slice(10,13),storage:{wqCards:cards}}); const {page}=app;
 await page.click("[data-tab=cards]");
 const opts=await page.$$eval("#scopeSel option",o=>o.map(x=>({v:x.value,t:x.textContent.trim()})));
 check("flashcards selector order: הכל, לא ידעתי, חדשות, חלשות, חזקות",JSON.stringify(opts.map(o=>o.v))==='["all","missed","new","weak","strong"]',JSON.stringify(opts));
 check("'לא ידעתי' label has the exact text and counts words missed on ANY date",opts[1].t==="❌ לא ידעתי (4)",opts[1].t);
 const pool=await page.evaluate(()=>poolOf("missed","cards").map(w=>w.w).sort());
 check("the pool is exactly the missed words (today's and the old one), not the due-again or the right ones",JSON.stringify(pool)===JSON.stringify([n[3],n[4],n[5],n[6]].sort()),JSON.stringify(pool));
 // it is live: it follows the stored answers
 const live=await page.evaluate(([a,b])=>{ S.cards[a].d=S.cards[a].l+3; S.cards[b]={b:0,d:5,l:5}; return poolOf("missed","cards").length; },[n[3],n[0]]);
 check("answering a word right removes it, a new miss adds it (live)",live===4,String(live));   // n3 leaves, n0 joins
 // other games and the shared choice
 for(const g of ["quiz","hangman","wordsearch","crossword"]){
  await page.click(`[data-tab=${g}]`);
  check(`${g}: no 'לא ידעתי' in its selector`,!(await page.$('#scopeSel option[value="missed"]')));
 }
 await page.evaluate(()=>store.set("wqScope_quiz","missed"));
 check("a stale 'missed' choice in another game falls back to 'all'",(await page.evaluate(()=>getScope("quiz")))==="all");
 await page.click("[data-tab=addwords]");
 check("the shared choice in the Words tab does not offer it",!(await page.$('#shSel option[value="missed"]')));
 // with a group the order ends with the group
 await page.evaluate(([a,b,c,d])=>{ group={name:"מילים של השבוע",words:[a,b,c,d]}; saveGroup(); },[n[3],n[4],n[5],n[6]]);
 await page.click("[data-tab=cards]");
 const o2=await page.$$eval("#scopeSel option",o=>o.map(x=>x.value));
 check("with a group: הכל, לא ידעתי, חדשות, חלשות, חזקות, קבוצה",JSON.stringify(o2)==='["all","missed","new","weak","strong","group"]',JSON.stringify(o2));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
