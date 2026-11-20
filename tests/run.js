"use strict";
const {readdirSync}=require("fs"),{spawnSync}=require("child_process"),path=require("path");
let bad=0;
for(const f of readdirSync(__dirname).filter(x=>x.endsWith(".test.js")).sort()){
 console.log("\n=== "+f);
 const r=spawnSync(process.execPath,[path.join(__dirname,f)],{stdio:"inherit"});
 if(r.status!==0) bad++;
}
console.log(bad?`\n${bad} test file(s) failed`:"\nALL TEST FILES PASS");
process.exit(bad?1:0);
