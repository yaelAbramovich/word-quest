const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 const active=names.length-3;
 const left=()=>page.$$eval("#gbLeft .gbw",e=>e.map(x=>x.dataset.w));
 const right=()=>page.$$eval("#gbRight .gbw",e=>e.map(x=>x.dataset.w));
 const tap=n=>page.locator(`#grpBox .gbw[data-w="${n}"]`).click();
 await page.click("[data-tab=addwords]"); await page.click("[data-grpnew]");

 check("two columns: nothing chosen on the right, every active word on the left",(await right()).length===0&&(await left()).length===active,`${(await left()).length}/${active}`);
 check("old ticking list is gone",!(await page.$("[data-gbpick]")));
 check("counts shown on both column titles",(await page.textContent("#gbCntL"))===String(active)&&(await page.textContent("#gbCntR"))==="0");
 const sorted=a=>[...a].sort((x,y)=>x.localeCompare(y));
 const L0=await left(); check("left column is A-Z",JSON.stringify(L0)===JSON.stringify(sorted(L0)));

 // one tap moves a word across
 const a=L0[0], b=L0[5], c=L0[2];
 await tap(b); await tap(a); await tap(c);
 const R1=await right(), L1=await left();
 check("tapped words moved to the right column, A-Z",JSON.stringify(R1)===JSON.stringify(sorted([a,b,c])),JSON.stringify(R1));
 check("left column lost them and is still A-Z",L1.length===active-3&&!L1.includes(a)&&JSON.stringify(L1)===JSON.stringify(sorted(L1)));
 check("counts follow",(await page.textContent("#gbCntR"))==="3"&&(await page.textContent("#gbCntL"))===String(active-3));
 check("minimum bar warns below 4",(await page.textContent("#gbSum")).includes("נבחרו 3")&&!!(await page.$("#gbSum.warn")));
 // tap again returns it, at its place
 await tap(b);
 const L2=await left();
 check("tapping a chosen word returns it to the left, in A-Z order",L2.includes(b)&&JSON.stringify(L2)===JSON.stringify(sorted(L2))&&(await right()).length===2);
 await tap(b); await tap(L2.find(x=>![a,b,c].includes(x)));
 check("4 chosen: warning gone, text says ✓",!(await page.$("#gbSum.warn"))&&(await page.textContent("#gbSum")).includes("✓ נבחרו 4"));
 check("minimum is always written",(await page.textContent("#gbSum")).includes("מינימום 4"));

 // no jump: tap a word low in the left column
 await page.$eval("#gbLeft",e=>{e.scrollTop=150});
 const mid=(await left())[6];
 await page.locator(`#gbLeft .gbw[data-w="${mid}"]`).scrollIntoViewIfNeeded();
 const before=await page.evaluate(()=>({l:document.querySelector("#gbLeft").scrollTop,r:document.querySelector("#gbRight").scrollTop,p:window.scrollY}));
 await tap(mid);
 const after=await page.evaluate(()=>({l:document.querySelector("#gbLeft").scrollTop,r:document.querySelector("#gbRight").scrollTop,p:window.scrollY}));
 check("tapping a word does not move the columns or the page",before.l>0&&after.l===before.l&&after.r===before.r&&after.p===before.p,JSON.stringify({before,after}));

 // search narrows only the left column
 const rightBefore=await right();
 await page.fill("#gbSearch","an");
 const Ls=await left();
 const matches=await page.evaluate(([q,picked])=>words.filter(w=>!picked.includes(w.w)&&(w.w+" "+w.he).toLowerCase().includes(q)).map(w=>w.w).sort((x,y)=>x.localeCompare(y)),["an",rightBefore]);
 check("search narrows the left column to matching words",JSON.stringify(Ls)===JSON.stringify(matches)&&Ls.length<active-5,JSON.stringify(Ls));
 check("search does not touch the right column",JSON.stringify(await right())===JSON.stringify(rightBefore));
 check("left count follows the search",(await page.textContent("#gbCntL"))===String(Ls.length));
 await page.fill("#gbSearch","");
 // category narrows only the left column
 await page.selectOption("#gbCat","strong");
 const Lc=await left();
 const strongLeft=await page.evaluate(picked=>words.filter(w=>!picked.includes(w.w)&&category(w)==="strong").map(w=>w.w).sort((x,y)=>x.localeCompare(y)),await right());
 check("category 'חזקות' shows only strong words on the left",JSON.stringify(Lc)===JSON.stringify(strongLeft),JSON.stringify(Lc));
 check("right column unaffected by the category",(await right()).length===5);
 await page.selectOption("#gbCat","all");

 // save rules
 await page.fill("#gbName","   "); await page.click("#gbSave");
 check("empty name is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("שם"));
 await page.fill("#gbName","מילים של השבוע");
 await page.click("#gbSave");
 const stored=await page.evaluate(()=>JSON.parse(localStorage.wqGroup));
 check("5 chosen words are saved with the free-text name",stored.name==="מילים של השבוע"&&stored.words.length===5,JSON.stringify(stored));
 // edit pre-fills the right column
 await page.click("[data-grpedit]");
 check("edit opens the builder with the chosen words on the right",(await right()).length===5&&(await left()).length===active-5&&(await page.inputValue("#gbName"))==="מילים של השבוע");
 // too few
 for(const n of (await right()).slice(0,2)) await tap(n);
 await page.click("#gbSave");
 check("saving with fewer than 4 words is rejected with a message",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("4"));
 await page.click("#gbCancel");
 check("cancel keeps the saved group",(await page.evaluate(()=>JSON.parse(localStorage.wqGroup).words.length))===5);
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
