const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const gw=names.slice(1,6);   // 2 strong (1,2), 3 weak (3,4,5)
 const app=await openApp({strong,weak,removed,storage:{wqGroup:{name:"מילים של השבוע",words:gw}}}); const {page}=app;
 await page.click("[data-tab=addwords]");
 check("the card is collapsed by default",!(await page.$eval("#grpBox",e=>e.open)));
 const head=await page.textContent("#grpBox > summary");
 check("collapsed card shows name, counts and legend",head.includes("מילים של השבוע")&&head.includes("5 מילים · 2 חזקות")&&head.includes("חזקות 2")&&head.includes("חלשות 3")&&head.includes("חדשות 0"),head);
 const seg=await page.$$eval(".gprog i",e=>e.map(x=>({c:x.className,n:+x.dataset.n})));
 check("progress bar has strong / weak / new segments with the group's counts",JSON.stringify(seg)===JSON.stringify([{c:"s",n:2},{c:"k",n:3},{c:"n",n:0}]),JSON.stringify(seg));
 const widths=await page.$$eval(".gprog i",e=>e.map(x=>x.getBoundingClientRect().width));
 check("bar widths follow the counts (2:3)",Math.abs(widths[0]/widths[1]-2/3)<0.05&&widths[2]<1,JSON.stringify(widths));
 check("collapsed card hides the word rows",!(await page.isVisible("#grpBox .grpl")));
 const h=await page.$eval("#grpBox",e=>e.getBoundingClientRect().height);
 check("collapsed card is slim (under 130px)",h<130,String(h));
 // expand
 await page.click("#grpBox > summary");
 check("tapping the card expands it",await page.$eval("#grpBox",e=>e.open)&&await page.isVisible("#grpBox .grpl"));
 check("every group word shows its progress details",(await page.$$eval("#grpBox .grpl li .st2",e=>e.length))>=5&&(await page.textContent("#grpBox .grpl")).includes("בלמידה"));
 check("buttons: edit, finish group, and a 'finished learning' button on every word",!!(await page.$("[data-grpedit]"))&&!!(await page.$("[data-grpend]"))&&(await page.$$("[data-grpdone]")).length===5);
 check("the open state is remembered",(await page.evaluate(()=>store.get("wqGrpOpen")))==="1");
 await page.click("[data-filter=all]");
 check("it stays open after the tab redraws",await page.$eval("#grpBox",e=>e.open));
 await page.click("#grpBox > summary");
 check("tapping again collapses it",!(await page.$eval("#grpBox",e=>e.open)));
 await page.click("#grpBox > summary");
 // finished learning
 const w0=gw[0];
 await page.click(`[data-grpdone="${w0}"]`);
 const st=await page.evaluate(w=>({g:group.words,hidden:hidden.has(w)}),w0);
 check("'סיימתי ללמוד' removes the word from the group and from the games",st.g.length===4&&!st.g.includes(w0)&&st.hidden,JSON.stringify(st));
 await page.click("[data-filter=removed]");
 check("the word appears in the removed words list (the 'מילים שהוסרו' filter)",!!(await page.$(`[data-restore="${w0}"]`)));
 await page.click(`[data-restore="${w0}"]`);
 check("restoring does not put it back in the group",(await page.evaluate(()=>group.words.length))===4);
 // finishing every word removes the group
 for(const n of await page.evaluate(()=>[...group.words])){
  if(!(await page.$eval("#grpBox",e=>e.open))) await page.click("#grpBox > summary");
  await page.click(`[data-grpdone="${n}"]`);
 }
 check("finishing every word removes the group and shows the empty state",(await page.evaluate(()=>group))===null&&!!(await page.$("[data-grpnew]")));
 // the limit of active words: with 8 active words left, 'finished learning' is refused
 await page.evaluate(()=>{
  group={name:"x",words:words.slice(0,4).map(w=>w.w)}; saveGroup();
  while(words.length>8){ const w=words.find(x=>!group.words.includes(x.w)); hideWord(w); }
 });
 await page.click("[data-filter=all]");
 if(!(await page.$eval("#grpBox",e=>e.open))) await page.click("#grpBox > summary");
 const keep=await page.evaluate(()=>group.words.length);
 await page.click(`#grpBox [data-grpdone]`);
 check("refused with a message when only 8 active words remain",(await page.evaluate(()=>group.words.length))===keep&&(await page.textContent(".toast")).includes("8"));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
