const {openApp,check,done}=require("./helpers");
// the "🔍 חיפוש משפטים ל-N מילים שחסר להן" button: it must show progress and a visible result, and a failed lookup must not be remembered
const mk=w=>({w,he:"בדיקה "+w,m:"",ex:"",exs:[],custom:1});
const okBody=w=>JSON.stringify({en:[{definitions:[{examples:[`A ${w} is used in this test sentence.`]}]}]});
const wordOf=r=>decodeURIComponent(r.request().url().split("/").pop());
(async()=>{
 const sentences=p=>p.evaluate(()=>allWords.filter(w=>w.custom&&w.ex).length);

 // 1. the service works: progress on the button, a visible result, the button goes away
 let app=await openApp({storage:{wqCustom:[mk("zzone"),mk("zztwo")]}}); let p=app.page;
 await p.route("**/en.wiktionary.org/**",async r=>{ await new Promise(x=>setTimeout(x,400)); r.fulfill({status:200,contentType:"application/json",body:okBody(wordOf(r))}); });
 await p.click("[data-tab=addwords]");
 await p.click("[data-fillall]");
 await p.waitForTimeout(150);
 const prog=await p.evaluate(()=>{ const b=document.querySelector("[data-fillall]"); return {t:b.textContent,d:b.disabled}; });
 check("while searching, the button itself shows the progress and is disabled",prog.t.includes("מחפשת")&&prog.t.includes("/2")&&prog.d,JSON.stringify(prog));
 await p.waitForSelector("#awList .fillmsg",{timeout:6000});
 check("a visible message says sentences were found for all the words",await p.isVisible("#awList .fillmsg")&&(await p.textContent("#awList .fillmsg")).includes("לכל 2"),await p.textContent("#awList .fillmsg"));
 check("both words got a sentence and the button is gone",(await sentences(p))===2&&!(await p.$("[data-fillall]")));
 await app.close();

 // 2. the service fails, then works again: the failure must not be remembered
 app=await openApp({storage:{wqCustom:[mk("zzone"),mk("zztwo")]}}); p=app.page;
 await p.route("**/en.wiktionary.org/**",r=>r.abort());
 await p.click("[data-tab=addwords]");
 await p.click("[data-fillall]");
 await p.waitForSelector("#awList .fillmsg",{timeout:6000});
 const fail=await p.textContent("#awList .fillmsg");
 check("when the lookup fails, a visible message says so (connection)",await p.isVisible("#awList .fillmsg")&&fail.includes("להתחבר"),fail);
 check("the button is still there and enabled, nothing was found",(await p.$eval("[data-fillall]",e=>!e.disabled))&&(await sentences(p))===0);
 await p.unroute("**/en.wiktionary.org/**");
 await p.route("**/en.wiktionary.org/**",r=>r.fulfill({status:200,contentType:"application/json",body:okBody(wordOf(r))}));
 await p.click("[data-fillall]");
 await p.waitForFunction(()=>allWords.filter(w=>w.custom&&w.ex).length===2,null,{timeout:6000}).catch(()=>{});
 check("clicking again after the failure works (the failure was not cached)",(await sentences(p))===2,String(await sentences(p)));
 await app.close();

 // 3. the service does not know the words (404): a visible 'not found' message; that answer may be remembered
 app=await openApp({storage:{wqCustom:[mk("zzone"),mk("zztwo")]}}); p=app.page;
 let requests=0;
 await p.route("**/en.wiktionary.org/**",r=>{ requests++; r.fulfill({status:404,body:"{}"}); });
 await p.click("[data-tab=addwords]");
 await p.click("[data-fillall]");
 await p.waitForSelector("#awList .fillmsg",{timeout:6000});
 const nf=await p.textContent("#awList .fillmsg");
 check("unknown words: a visible 'no sentences found' message (not a connection error)",await p.isVisible("#awList .fillmsg")&&nf.includes("לא מצאתי")&&!nf.includes("להתחבר"),nf);
 const r1=requests;
 await p.click("[data-fillall]"); await p.waitForTimeout(500);
 check("a real 'unknown word' answer is remembered (no new requests)",requests===r1,`${r1} -> ${requests}`);
 await app.close();

 // 4. partly found
 app=await openApp({storage:{wqCustom:[mk("zzone"),mk("zztwo")]}}); p=app.page;
 await p.route("**/en.wiktionary.org/**",r=>{ const w=wordOf(r); w==="zzone"?r.fulfill({status:200,contentType:"application/json",body:okBody(w)}):r.fulfill({status:404,body:"{}"}); });
 await p.click("[data-tab=addwords]");
 await p.click("[data-fillall]");
 await p.waitForSelector("#awList .fillmsg",{timeout:6000});
 const part=await p.textContent("#awList .fillmsg");
 check("partly found: the message says 1 of 2, and the button stays for the other word",part.includes("ל-1 מתוך 2")&&(await p.textContent("[data-fillall]")).includes("1"),part);
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
