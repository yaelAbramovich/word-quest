"use strict";
const http=require("http"),fs=require("fs"),path=require("path"),vm=require("vm");
const {chromium}=require(process.env.PW_PATH||"/Users/yael_a/codeProjects/Playwright-TS-Docker/node_modules/playwright");
const ROOT=path.join(__dirname,"..");
let failed=0;
function check(name,ok,detail){ console.log((ok?"PASS ":"FAIL ")+name+(ok?"":"  -> "+(detail||""))); if(!ok) failed++; }
function done(){ console.log(failed?`\n${failed} FAILED`:"\nALL PASS"); process.exit(failed?1:0); }
function serve(){
 const types={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".svg":"image/svg+xml"};
 const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent(req.url.split("?")[0]); if(p==="/") p="/index.html";
  const f=path.join(ROOT,p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ res.statusCode=404; return res.end(); }
  res.setHeader("content-type",types[path.extname(f)]||"application/octet-stream"); res.end(fs.readFileSync(f));
 });
 return new Promise(ok=>srv.listen(0,()=>ok({url:`http://localhost:${srv.address().port}/`,close:()=>srv.close()})));
}
// names of the built-in words of a pack, read from its file (default: the 19 legacy words the existing tests use)
function namesFrom(file,variable){
 const ctx={}; vm.runInNewContext(fs.readFileSync(path.join(ROOT,file),"utf8")+";this.list="+variable+";",ctx);
 return ctx.list.map(w=>w.w);
}
const wordNames=()=>namesFrom("legacy-words.js","legacyWords");
const starterNames=()=>namesFrom("words.js","words");
// seeds localStorage once per browser profile: strong = 10 correct over 3 days, weak = a few attempts (the first weak word has a single correct attempt)
async function openApp(plan={}){
 const srv=await serve(), browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:390,height:800}});
 const errors=[]; page.on("pageerror",e=>errors.push(e.message));
 const mode=plan.pack||"seeded";   // "seeded" (default, legacy pack), "starter" (a brand-new device), "raw" (only the given storage)
 const storage=mode==="raw"?plan.storage:Object.assign({wqPack:"legacy"},plan.storage);
 await page.addInitScript(({strong,weak,removed,storage,mode})=>{
  if(localStorage.getItem("__seeded")) return;
  localStorage.setItem("__seeded","1");
  if(mode==="starter") return;
  if(mode==="seeded"){
   const days=["2026-11-01","2026-11-02","2026-11-03"], st={};
   (strong||[]).forEach(n=>{ st[n]=Array.from({length:10},(_,i)=>[1,days[i%3]]); });
   (weak||[]).forEach((n,i)=>{ st[n]=i===0?[[1,days[0]]]:[[1,days[0]],[0,days[1]],[0,days[2]]]; });
   localStorage.setItem("wqStats",JSON.stringify(st));
   localStorage.setItem("wqHidden",JSON.stringify(removed||[]));
  }
  Object.entries(storage||{}).forEach(([k,v])=>localStorage.setItem(k,typeof v==="string"?v:JSON.stringify(v)));
 },{strong:plan.strong,weak:plan.weak,removed:plan.removed,storage,mode});
 await page.goto(srv.url);
 return {page,names:wordNames(),errors,close:async()=>{ await browser.close(); srv.close(); }};
}
module.exports={openApp,check,done,wordNames,starterNames};
