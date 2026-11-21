const {openApp,check,done,starterNames}=require("./helpers");
const WANT=["borrow","forget","remember","enough","improve","choose","travel","difficult","kitchen","quickly"];
(async()=>{
 check("words.js holds exactly the 10 common starter words",JSON.stringify([...starterNames()].sort())===JSON.stringify([...WANT].sort()),starterNames().join());

 // ---- a brand-new user ----
 let app=await openApp({pack:"starter"}); let {page}=app;
 const info=await page.evaluate(()=>({n:words.length,all:allWords.length,pack:localStorage.getItem("wqPack"),list:words.map(w=>({w:w.w,he:w.he,m:w.m,ex:w.ex}))}));
 check("a new user gets the 10 starter words and the 'starter' pack is remembered",info.n===10&&info.all===10&&info.pack==="starter",JSON.stringify([info.n,info.pack]));
 check("every starter word has a meaning, an explanation and an example that contains the word",info.list.every(x=>x.he&&x.m&&x.ex&&x.ex.toLowerCase().includes(x.w)&&/^[a-z]{3,10}$/.test(x.w)),JSON.stringify(info.list.filter(x=>!(x.he&&x.m&&x.ex)).map(x=>x.w)));
 check("none of the old high-level words is there",!info.list.some(x=>["antipathy","tittered","latitude","curtsey"].includes(x.w)));
 await page.reload();
 check("the starter pack is kept on later visits (the app has written its own keys by now)",(await page.evaluate(()=>[words.length,localStorage.getItem("wqPack")])).join()==="10,starter");
 // every game works with 10 words
 await page.click("[data-tab=crossword]");
 check("crossword works with the starter words",(await page.$$eval("#cwLists li",e=>e.length))>=4);
 await page.click("[data-tab=wordsearch]");
 check("word search works",(await page.$$eval("#wsList .chip",e=>e.length))>=3);
 await page.click("[data-tab=quiz]");
 check("quiz shows 4 answers",(await page.$$eval(".answer",e=>e.length))===4);
 await page.click("[data-tab=hangman]");
 check("hangman shows a word to guess",!!(await page.$("#hmWord .hl")));
 await page.click("[data-tab=cards]");
 check("cards offer all 10 words",(await page.textContent("#scopeSel option")).includes("(10"));
 // the limit of 8 active words applies to the small pack
 await page.click("[data-tab=addwords]");
 for(let i=0;i<2;i++){ const n=await page.$eval("#awMain > li [data-delword]",e=>e.dataset.delword); page.once("dialog",d=>d.accept()); await page.click(`#awMain [data-delword="${n}"]`); }
 const n3=await page.$eval("#awMain > li [data-delword]",e=>e.dataset.delword);
 page.once("dialog",d=>d.accept()); await page.click(`#awMain [data-delword="${n3}"]`);
 check("a new user can delete 2 starter words but not a 3rd (8 stay)",(await page.evaluate(()=>words.length))===8&&(await page.textContent(".toast")).includes("8"));
 check("no page errors (new user)",app.errors.length===0,app.errors.join("|"));
 await app.close();

 // ---- an existing user (has stored data, no pack yet) keeps the 19 old words ----
 app=await openApp({pack:"raw",storage:{wqTab:"quiz"}}); page=app.page;
 const old=await page.evaluate(()=>({n:words.length,pack:localStorage.getItem("wqPack"),has:words.some(w=>w.w==="antipathy"),starter:words.some(w=>w.w==="borrow")}));
 check("an existing user keeps exactly the 19 old words and gets none of the new ones",old.n===19&&old.pack==="legacy"&&old.has&&!old.starter,JSON.stringify(old));
 await app.close();
 // existing user whose only data is words they added
 app=await openApp({pack:"raw",storage:{wqCustom:[{w:"zzcustom",he:"בדיקה",m:"",ex:"A zzcustom test.",exs:["A zzcustom test."],custom:1}]}}); page=app.page;
 check("having only your own added words also counts as an existing user",(await page.evaluate(()=>[words.length,localStorage.getItem("wqPack")])).join()==="20,legacy");
 check("no page errors (existing user)",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
