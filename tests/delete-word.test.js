const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const grp=names.slice(3,8);   // 5 weak words, in the group
 const custom={w:"zzcustom",he:"בדיקה",m:"",ex:"A zzcustom test.",exs:["A zzcustom test."],custom:1};
 const app=await openApp({strong,weak,removed,storage:{wqGroup:{name:"מילים של השבוע",words:grp},wqCustom:[custom]}}); const {page}=app;
 const active=names.length-3+1;   // 19 built-in - 3 removed + 1 custom
 await page.click("[data-tab=addwords]");
 const inLS=(key,name)=>page.evaluate(([k,n])=>(localStorage.getItem(k)||"").includes('"'+n+'"'),[key,name]);

 check("every row of the main list has a 🗑 button",(await page.$$eval("#awMain > li [data-delword]",e=>e.length))===active);
 check("every removed (done) word has a 🗑 button too",(await page.$$eval("li:has([data-restore]) [data-delword]",e=>e.length))===3);
 check("no 🗑 inside the group card",!(await page.$("#grpBox [data-delword]")));

 // cancel keeps the word
 const target=grp[0];
 let msg=""; page.once("dialog",d=>{ msg=d.message(); d.dismiss(); });
 await page.click(`#awMain [data-delword="${target}"]`);
 check("the confirm names the word and mentions the progress",msg.includes(target)&&msg.includes("לצמיתות")&&msg.includes("ההתקדמות"),msg);
 check("cancel keeps the word",!!(await page.$(`#awMain [data-delword="${target}"]`))&&await page.evaluate(n=>allWords.some(w=>w.w===n),target));

 // accept: a built-in word that is in the group and has progress
 check("before: the word has progress and is in the group",(await inLS("wqStats",target))&&(await page.evaluate(n=>group.words.includes(n),target)));
 page.once("dialog",d=>d.accept());
 await page.click(`#awMain [data-delword="${target}"]`);
 const st=await page.evaluate(n=>({inAll:allWords.some(w=>w.w===n),inWords:words.some(w=>w.w===n),grp:group.words.length,inGrp:group.words.includes(n),del:JSON.parse(localStorage.wqDeleted||"[]")}),target);
 check("the word is gone from the app and remembered as deleted",!st.inAll&&!st.inWords&&st.del.includes(target),JSON.stringify(st));
 check("it left the group",st.grp===4&&!st.inGrp);
 check("its progress is erased",!(await inLS("wqStats",target)));
 check("its row disappeared",!(await page.$(`#awMain [data-delword="${target}"]`))&&(await page.$$eval("#awMain > li",e=>e.length))===active-1);
 check("a toast says it was deleted",(await page.textContent(".toast")).includes("נמחקה"));
 await page.reload(); await page.click("[data-tab=addwords]");
 check("it stays deleted after a reload",!(await page.evaluate(n=>allWords.some(w=>w.w===n),target)));

 // a word you added yourself
 page.once("dialog",d=>d.accept());
 await page.click(`#awMain [data-delword="zzcustom"]`);
 check("a custom word is deleted from the saved custom words",!(await page.evaluate(()=>allWords.some(w=>w.w==="zzcustom")))&&!(await inLS("wqCustom","zzcustom")));

 // a done (removed) word
 const gone=removed[0];
 page.once("dialog",d=>d.accept());
 await page.click(`li:has([data-restore="${gone}"]) [data-delword]`);
 check("a done word can be deleted from the removed list",!(await page.$(`[data-restore="${gone}"]`))&&!(await page.evaluate(n=>allWords.some(w=>w.w===n),gone)));

 // deleting every word of the group clears the group
 for(const n of grp.slice(1)){ page.once("dialog",d=>d.accept()); await page.click(`#awMain [data-delword="${n}"]`); }
 check("when the last word of the group is deleted, the group is gone",(await page.evaluate(()=>group))===null&&!!(await page.$("[data-grpnew]")));

 // the limit of 8 active words
 await page.evaluate(()=>{ while(words.length>8) hideWord(words[0]); });
 await page.click("[data-filter=all]");
 const keepName=await page.$eval("#awMain > li [data-delword]",e=>e.dataset.delword);
 page.once("dialog",d=>d.accept());
 await page.click(`#awMain [data-delword="${keepName}"]`);
 check("with only 8 active words an active word cannot be deleted (message, nothing changes)",(await page.textContent(".toast")).includes("8")&&await page.evaluate(n=>allWords.some(w=>w.w===n),keepName));
 const doneName=await page.$eval("[data-restore]",e=>e.dataset.restore);
 page.once("dialog",d=>d.accept());
 await page.click(`li:has([data-restore="${doneName}"]) [data-delword]`);
 check("but a done word can still be deleted at 8 active words",!(await page.evaluate(n=>allWords.some(w=>w.w===n),doneName)));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
