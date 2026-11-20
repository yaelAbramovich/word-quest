const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed});
 const {page}=app;
 const r=await page.evaluate(()=>{
  const c={new:0,weak:0,strong:0}; words.forEach(w=>c[category(w)]++);
  return {c,total:words.length,all:allWords.length};
 });
 check("new+weak+strong = active words",r.c.new+r.c.weak+r.c.strong===r.total,JSON.stringify(r));
 check("removed words are not active",r.total===r.all-3,JSON.stringify(r));
 check("3 strong, 7 weak",r.c.strong===3&&r.c.weak===7,JSON.stringify(r));
 check("one correct attempt out of one is weak, not strong",await page.evaluate(n=>category(words.find(w=>w.w===n)),weak[0])==="weak");
 // scope + pools
 const s=await page.evaluate(()=>{
  const out={};
  out.def=getScope("quiz");
  store.set("wqScope_quiz","weak"); out.own=getScope("quiz");
  store.set("wqScopeShared","1"); store.set("wqScopeSharedValue","strong"); out.shared=getScope("quiz");
  store.set("wqScopeShared","0");
  out.pools={all:poolOf("all","quiz").length,cardsAll:poolOf("all","cards").length,weak:poolOf("weak","quiz").length,strong:poolOf("strong","quiz").length,new:poolOf("new","quiz").length};
  store.set("wqScope_quiz","group"); out.groupWithoutGroup=getScope("quiz");
  return out;
 });
 check("default scope is all",s.def==="all");
 check("own scope used when not shared",s.own==="weak");
 check("shared scope wins when shared",s.shared==="strong");
 check("pool sizes",s.pools.weak===7&&s.pools.strong===3&&s.pools.all===r.total&&s.pools.cardsAll===r.all,JSON.stringify(s.pools));
 check("group scope without a group falls back to all",s.groupWithoutGroup==="all");
 // group + pickSet
 const g=await page.evaluate(n=>{
  group={name:"test",words:n}; saveGroup(); store.set("wqScope_quiz","group");
  const picked=pickSet("quiz",50); const one=pickSet("quiz",1,null,[n[0],n[1],n[2]])[0];
  hideWord(words.find(w=>w.w===n[0]));
  return {sc:getScope("quiz"),pool:poolFor("quiz").map(w=>w.w),picked:picked.map(w=>w.w),avoided:![n[0],n[1],n[2]].includes(one.w),after:group.words.length};
 },weak.slice(0,5));
 check("group scope pool = group words",g.sc==="group"&&g.picked.length===5&&g.picked.every(x=>weak.includes(x)),JSON.stringify(g));
 check("pickSet avoids recent words when others remain",g.avoided);
 check("removing a word drops it from the group",g.after===4&&!g.pool.includes(weak[0]),JSON.stringify(g));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
