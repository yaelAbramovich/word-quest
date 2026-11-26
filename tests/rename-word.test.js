const {openApp,check,done}=require("./helpers");
// editing a word's spelling: progress, group place and removed state move with it; empty / taken names are refused
const mk=(w,he)=>({w,he,m:"",ex:"",exs:[],custom:1});
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const builtin=names[0], other=names[1], custom="tittred";
 const grp={name:"קבוצה",words:[builtin,custom,names[2],names[3]]};
 const app=await openApp({strong:[builtin],storage:{wqCustom:[mk(custom,"רעד")],wqGroup:grp,wqHidden:[names[5]]}}); const p=app.page;
 await p.click("[data-tab=addwords]");
 const edit=async n=>{ await p.click(`[data-edit="${n}"]`); await p.waitForSelector("#edW"); };
 const names2=()=>p.evaluate(()=>allWords.map(w=>w.w));

 // 1. a built-in word
 const before=await p.evaluate(n=>JSON.stringify(S.stats[n]),builtin);
 await edit(builtin); await p.fill("#edW","  Newname "); await p.click("[data-edsave]");
 let all=await names2();
 check("built-in word: the new name exists once, the old one is gone",all.includes("Newname")&&!all.includes(builtin)&&all.filter(x=>x==="Newname").length===1,all.join());
 check("its stats moved with it",await p.evaluate(([o,n,b])=>JSON.stringify(S.stats[n])===b&&!(o in S.stats),[builtin,"Newname",before]));
 check("its place in the group moved with it",await p.evaluate(([o,n])=>group.words.includes(n)&&!group.words.includes(o),[builtin,"Newname"]));
 check("it still counts as strong",await p.evaluate(()=>category(allWords.find(w=>w.w==="Newname"))==="strong"));
 await p.reload(); await p.click("[data-tab=addwords]");
 all=await names2();
 check("after a reload the old built-in name does not come back",all.includes("Newname")&&!all.includes(builtin),all.join());
 check("after a reload the stats and group are still there",await p.evaluate(()=>!!S.stats["Newname"]&&group.words.includes("Newname")));

 // 2. one of your own words
 await edit(custom); await p.fill("#edW","tittered"); await p.click("[data-edsave]");
 all=await names2();
 check("own word: renamed",all.includes("tittered")&&!all.includes(custom));
 check("own word: still in the group",await p.evaluate(()=>group.words.includes("tittered")));
 await p.reload();
 check("own word: the rename is saved",(await names2()).includes("tittered"));

 // 3. refused names
 await p.click("[data-tab=addwords]");
 await edit(other); await p.fill("#edW","tittered"); await p.click("[data-edsave]");
 check("a name that exists is refused and the box stays open",(await p.isVisible("#edW"))&&(await p.textContent("#toast, .toast")).includes("יש כבר מילה כזו")&&(await names2()).includes(other));
 await p.fill("#edW","TITTERED"); await p.click("[data-edsave]");
 check("same name in other letter case is refused too",(await names2()).includes(other));
 await p.fill("#edW","   "); await p.click("[data-edsave]");
 check("an empty name is refused",(await names2()).includes(other)&&await p.isVisible("#edW"));

 // 4. saving without touching the name only changes the meaning
 await p.fill("#edW",other); await p.fill("#edHe","משמעות חדשה"); await p.click("[data-edsave]");
 check("untouched name: only the meaning changed",await p.evaluate(n=>allWords.find(w=>w.w===n)?.he==="משמעות חדשה",other));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
