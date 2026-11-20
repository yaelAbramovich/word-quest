# Word categories, game scope & "my group" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tab and game uses one definition of word categories (new / weak / strong), games play exactly the words of the chosen category or group, and a user can build one small named "my group".

**Architecture:** `common.js` gets one `category()` function, a scope/pool layer (`getScope`, `poolOf`, `poolFor`, `pickSet`) and a group store. Games stop drawing their own words and ask `pickSet`/`poolFor`. The Words tab gets true filters, a shared-choice block and a group builder. No framework, no build step; verification is headless-Chromium scripts in `tests/`.

**Tech Stack:** plain HTML/CSS/JS (static site), `localStorage`, Node + Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-11-20-word-groups-design.md` (read it first).

## Global Constraints

- Work only on branch `word-groups`. Do **not** merge to `main` or push `main`; the user merges after approval.
- UI text is Hebrew, RTL. Category names exactly: **חדשות / חלשות / חזקות**; the fourth scope is **הכל**; the group scope shows `🎯 <name> (n)`.
- Category rule (spec §1): new = `wstat(w).n === 0`; strong = `pct !== null && pct >= 80`; weak = everything else practiced. A word is in exactly one category; removed (✓) words are in none.
- Flashcards: `all` = every word including removed (label shows "מתוכן N שהוסרו"); new/weak/strong/group = active words only.
- Games play **only** words of their pool, never topped up with others. Capacity: crossword 9, word search 7; bigger pool → random subset + note "מוצגות X מתוך N מילים". Words that do not fit → note "לא נכנסו הפעם: …".
- Minimums: crossword 4 words (word length 3–11; 5+ recommended), word search 3 (length 3–10), quiz/hangman/cards 1. Group minimum **4**, name required (free text, trimmed, max 30 characters).
- Shared choice lives in the **Words tab** (checkbox "השתמש בבחירה אחת בכל המשחקים" + selector). When on, each game's selector is locked and shows the shared choice.
- Storage keys: `wqScope_<game>`, `wqScopeShared` ("0"/"1"), `wqScopeSharedValue`, `wqGroup` (`{name, words:[names]}`), `wqFilter` (Words tab filter). Old `wqSort` is ignored.
- Remove the A-Z filter. Bump the cache version (`?v=NN` in `index.html`) in the final task.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run tests with `node tests/run.js` (needs Playwright; path via env `PW_PATH`, default `/Users/yael_a/codeProjects/Playwright-TS-Docker/node_modules/playwright`).

## File Structure

- `tests/helpers.js` (create) — static server, seeded headless page, `check`/`done`.
- `tests/run.js` (create) — runs every `tests/*.test.js`.
- `tests/*.test.js` (create, one per area).
- `common.js` — categories, group store, scope/pool layer, game bar selector, `gateGame`, `escHtml`.
- `quiz.js`, `hangman.js`, `cards.js`, `wordsearch.js`, `crossword.js` — use the pool; messages.
- `addwords.js` — Words tab: filters, summary, shared block, group section + builder.
- `style.css`, `index.html`, `README.md`.

---

### Task 1: Test harness + categories, group store, scope/pool core (additive)

**Files:**
- Create: `tests/helpers.js`, `tests/run.js`, `tests/core.test.js`
- Modify: `common.js` (add code; keep old `isWeak`, `pickWeighted`, `gameBar` working)

**Interfaces:**
- Produces (in `common.js`, global): `category(w) -> "new"|"weak"|"strong"`; `CAT_NAME`; `SCOPES`; `isShared() -> bool`; `getScope(game) -> "all"|"new"|"weak"|"strong"|"group"` (replaces the old one-liner of the same name); `group` (`let`, `{name,words}|null`); `GROUP_MIN=4`; `saveGroup()`; `groupWords() -> word[]`; `poolOf(scope,game) -> word[]`; `poolFor(game) -> word[]`; `pickSet(game,n,filter,avoid) -> word[]`.
- Produces (tests): `openApp(plan) -> {page,names,errors,close}` where `plan={strong:[names],weak:[names],removed:[names],storage:{key:value}}` seeds localStorage once; every non-seeded word is "new". `check(name,ok,detail)`, `done()`, `wordNames()`.

- [ ] **Step 1: Create `tests/helpers.js`**

```js
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
// names of the built-in words, read from words.js
function wordNames(){
 const ctx={}; vm.runInNewContext(fs.readFileSync(path.join(ROOT,"words.js"),"utf8")+";this.words=words;",ctx);
 return ctx.words.map(w=>w.w);
}
// seeds localStorage once per browser profile: strong = 10 correct over 3 days, weak = a few attempts (the first weak word has a single correct attempt)
async function openApp(plan={}){
 const srv=await serve(), browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:390,height:800}});
 const errors=[]; page.on("pageerror",e=>errors.push(e.message));
 await page.addInitScript(({strong,weak,removed,storage})=>{
  if(localStorage.getItem("__seeded")) return;
  localStorage.setItem("__seeded","1");
  const days=["2026-11-01","2026-11-02","2026-11-03"], st={};
  (strong||[]).forEach(n=>{ st[n]=Array.from({length:10},(_,i)=>[1,days[i%3]]); });
  (weak||[]).forEach((n,i)=>{ st[n]=i===0?[[1,days[0]]]:[[1,days[0]],[0,days[1]],[0,days[2]]]; });
  localStorage.setItem("wqStats",JSON.stringify(st));
  localStorage.setItem("wqHidden",JSON.stringify(removed||[]));
  Object.entries(storage||{}).forEach(([k,v])=>localStorage.setItem(k,typeof v==="string"?v:JSON.stringify(v)));
 },{strong:plan.strong,weak:plan.weak,removed:plan.removed,storage:plan.storage});
 await page.goto(srv.url);
 return {page,names:wordNames(),errors,close:async()=>{ await browser.close(); srv.close(); }};
}
module.exports={openApp,check,done,wordNames};
```

- [ ] **Step 2: Create `tests/run.js`**

```js
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
```

- [ ] **Step 3: Write the failing test `tests/core.test.js`**

```js
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
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd /Users/yael_a/codeProjects/word-quest && node tests/core.test.js`
Expected: FAIL / error such as `category is not defined`.

- [ ] **Step 5: Implement in `common.js`**

(a) Directly after the line `const hidden=new Set(parse("wqHidden","[]"));` add:

```js
// "my group": one small named set of words you chose to work on (word names are stored; only active words count)
let group=parse("wqGroup","null");
const GROUP_MIN=4;
function saveGroup(){ store.set("wqGroup",JSON.stringify(group)); }
```

(b) In `hideWord`, replace the line `hidden.add(w.w); saveHidden(); applyHidden(); return true;` with:

```js
 hidden.add(w.w); saveHidden(); applyHidden();
 if(group){ group.words=group.words.filter(n=>n!==w.w); saveGroup(); }   // a removed word leaves the group
 return true;
```

(c) Replace the old one-liner `const getScope=g=>store.get("wqScope_"+g,"all");` with this block (keep `isWeak`, `drawWeighted`, `pickWeighted`, `recentWords`, `gameBar`, `showHelp` exactly as they are for now):

```js
// ---- categories: every active word is in exactly one ----
const CAT_NAME={new:"חדשות",weak:"חלשות",strong:"חזקות"};
function category(w){
 const t=wstat(w);
 if(!t.n) return "new";
 return t.pct!==null&&t.pct>=80?"strong":"weak";   // strong only when a percentage is shown (10 attempts) and it is 80%+
}
// ---- which words a game plays: the choice (all / new / weak / strong / group) decides the pool ----
const SCOPES=["all","new","weak","strong","group"];
const isShared=()=>store.get("wqScopeShared","0")==="1";
function getScope(g){
 let s=isShared()?store.get("wqScopeSharedValue","all"):store.get("wqScope_"+g,"all");
 if(!SCOPES.includes(s)||(s==="group"&&!group)) s="all";
 return s;
}
function groupWords(){ return group?words.filter(w=>group.words.includes(w.w)):[]; }
// the flashcards' "all" also includes the words you removed (they keep being reviewed)
function poolOf(scope,game){
 if(scope==="group") return groupWords();
 if(scope==="all") return game==="cards"?allWords:words;
 return words.filter(w=>category(w)===scope);
}
const poolFor=g=>poolOf(getScope(g),g);
// up to n words from the game's pool (never from outside it); `avoid` = recent word names, skipped while enough others remain
function pickSet(game,n,filter,avoid){
 let base=poolFor(game).filter(filter||(()=>true));
 if(avoid&&avoid.length){ const f=base.filter(w=>!avoid.includes(w.w)); if(f.length>=n) base=f; }
 return drawWeighted(base,n);
}
```

- [ ] **Step 6: Run the test to verify it passes, and the app still loads**

Run: `node tests/core.test.js`
Expected: every line `PASS`, final `ALL PASS`.

- [ ] **Step 7: Commit**

```bash
git add tests common.js
git commit -m "Add test harness, word categories, group store and scope/pool core" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Game bar selector, shared lock, gating; quiz, hangman, cards use the pool

**Files:**
- Create: `tests/scope-ui.test.js`, `tests/scope-quiz-hangman-cards.test.js`
- Modify: `common.js` (gameBar, change handler, `gateGame`, `escHtml`, `scopeLabel`, shim), `quiz.js`, `hangman.js`, `cards.js`, `crossword.js` and `wordsearch.js` (only the `gameBar(...)` call signature), `style.css`

**Interfaces:**
- Consumes: Task 1 (`getScope`, `poolOf`, `poolFor`, `pickSet`, `isShared`, `group`, `CAT_NAME`, `SCOPES`).
- Produces: `escHtml(s)`; `scopeLabel(scope,game) -> html string` e.g. `חלשות (7)`, `הכל (19)`, cards: `הכל (51, מתוכן 32 שהוסרו)`, group: `🎯 <name> (n)`; `gameBar(game) -> html` (selector `#scopeSel`, or locked `.scopelock` when shared, "?" button, and an empty `<div id="gMsg">`); `gateGame(msg) -> bool` (true when the game may run; with a message it shows `.gwarn` in `#gMsg` and hides `#gBody`); `pickWeighted(n,filter,avoid)` becomes a shim: `pickSet(currentTab,n,filter,avoid)`; `isWeak` becomes `w=>category(w)!=="strong"` (temporary, deleted in Task 5).

- [ ] **Step 1: Write the failing test `tests/scope-ui.test.js`**

```js
const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 const total=await page.evaluate(()=>words.length);
 await page.click("[data-tab=quiz]");
 const opts=await page.$$eval("#scopeSel option",o=>o.map(x=>x.textContent.trim()));
 check("selector lists all/new/weak/strong with counts, no group yet",opts.length===4&&opts[0]===`הכל (${total})`&&opts[2]==="חלשות (7)"&&opts[3]==="חזקות (3)",JSON.stringify(opts));
 await page.selectOption("#scopeSel","weak");
 check("choice is saved for the game",await page.evaluate(()=>store.get("wqScope_quiz"))==="weak");
 await page.click("[data-tab=cards]");
 const cardOpts=await page.$$eval("#scopeSel option",o=>o.map(x=>x.textContent.trim()));
 check("cards 'all' counts removed words and says so",cardOpts[0]===`הכל (${total+3}, מתוכן 3 שהוסרו)`,cardOpts[0]);
 check("cards weak count equals the Words-tab weak count",cardOpts[2]==="חלשות (7)",cardOpts[2]);
 await page.evaluate(()=>{ store.set("wqScopeShared","1"); store.set("wqScopeSharedValue","strong"); });
 await page.click("[data-tab=quiz]");
 check("shared: selector is replaced by a lock",!(await page.$("#scopeSel"))&&!!(await page.$(".scopelock")));
 check("lock names the shared choice",(await page.textContent(".scopelock")).includes("חזקות (3)"));
 await page.click("[data-help]"); check("help sheet opens",!!(await page.$(".helpsheet"))); await page.click(".helpclose");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
```

- [ ] **Step 2: Write the failing test `tests/scope-quiz-hangman-cards.test.js`**

```js
const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const weak=names.slice(3,10), W=new Set(weak);
 const app=await openApp({strong:names.slice(0,3),weak,removed:names.slice(10,13),storage:{wqScopeShared:"1",wqScopeSharedValue:"weak"}});
 const {page}=app;
 // quiz
 await page.click("[data-tab=quiz]");
 const q=new Set();
 for(let i=0;i<25;i++){ q.add(await page.$eval("#qgame [data-say]",e=>e.dataset.say)); await page.click(".answer"); await page.click("#next"); }
 check("quiz plays only the 7 weak words",[...q].every(x=>W.has(x)),[...q].join());
 // hangman: the translation shown identifies the word
 await page.click("[data-tab=hangman]");
 const h=new Set();
 for(let i=0;i<12;i++){
  const he=(await page.textContent("#hmClue")).replace("התרגום:","").trim();
  h.add(await page.evaluate(t=>words.find(w=>w.he===t).w,he));
  for(const k of "QWERTYUIOPASDFGHJKLZXCVBNM"){ if(!(await page.$("#hmNext:not([disabled])"))){ const el=await page.$(`#view .key[data-k=${k}]:not([disabled])`); if(el) await el.click(); } }
  await page.click("#hmNext");
 }
 check("hangman plays only the 7 weak words",[...h].every(x=>W.has(x)),[...h].join());
 // cards: one round shows exactly the 7 weak words
 await page.click("[data-tab=cards]"); await page.click("#cdStart");
 const c=[];
 for(let i=0;i<7;i++){ c.push(await page.$eval(".cdcard .word",e=>e.textContent.trim())); await page.click("#cdShow"); await page.click("#cdOk"); }
 check("cards round = exactly the 7 weak words",c.length===7&&new Set(c).size===7&&c.every(x=>W.has(x)),c.join());
 check("cards round ends after the 7th card",!!(await page.$("#cdBody .win")));
 // empty pool: strong has 3 words; make it empty by choosing 'new' after everything is practiced
 await page.evaluate(()=>{ store.set("wqScopeSharedValue","new"); words.forEach(w=>{ if(category(w)==="new") S.stats[w.w]=[[0,"2026-11-01"]]; }); });
 await page.click("[data-tab=quiz]");
 check("empty pool shows a message instead of a game",!!(await page.$(".gwarn"))&&await page.$eval("#gBody",e=>e.hidden));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `node tests/scope-ui.test.js; node tests/scope-quiz-hangman-cards.test.js`
Expected: FAIL (`#scopeSel` not found / words outside the weak set).

- [ ] **Step 4: Implement in `common.js`**

Replace `isWeak` with the temporary alias, replace `pickWeighted` with the shim, and replace the whole `gameBar` function. Keep `drawWeighted`, `recentWords`, `HELP`, `showHelp` unchanged.

```js
const isWeak=w=>category(w)!=="strong";   // temporary: deleted when the Words tab moves to category()
function pickWeighted(n,filter,avoid){ return pickSet(currentTab,n,filter,avoid); }   // temporary shim: removed when the last game moves to pickSet
const escHtml=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function scopeLabel(s,game){
 const n=poolOf(s,game).length;
 if(s==="group") return `🎯 ${escHtml(group.name)} (${n})`;
 if(s==="all"){
  const gone=game==="cards"?allWords.length-words.length:0;
  return `הכל (${n}${gone?`, מתוכן ${gone} שהוסרו`:""})`;
 }
 return `${CAT_NAME[s]} (${n})`;
}
// compact game bar: which words to play + a small "?" that opens the instructions
function gameBar(game){
 const sc=getScope(game);
 const pick=isShared()
  ?`<div class="scopelock">🔗 בחירה משותפת: <b>${scopeLabel(sc,game)}</b><small>לשינוי: לשונית מילים</small></div>`
  :`<select class="scopesel" id="scopeSel" aria-label="אילו מילים לשחק">${SCOPES.filter(s=>s!=="group"||group).map(s=>`<option value="${s}"${s===sc?" selected":""}>${scopeLabel(s,game)}</option>`).join("")}</select>`;
 return `<div class="gbar">${pick}<button class="helpbtn" data-help="${game}" aria-label="הוראות" aria-haspopup="dialog">?</button></div><div id="gMsg"></div>`;
}
// true = the game may run. With a message: show it (instead of the game) and hide the game body `#gBody`
function gateGame(msg){
 const m=$("gMsg"), b=$("gBody");
 if(m) m.innerHTML=msg?`<div class="gwarn">${msg}</div>`:"";
 if(b) b.hidden=!!msg;
 return !msg;
}
```

In the global click handler at the top of `document.addEventListener("click",...)`, delete the two lines that handle `[data-scope]` (`const sc=...` and `if(sc){...}`) — the `[data-help]` lines stay. Right after that click listener, add:

```js
document.addEventListener("change",e=>{
 if(e.target.id==="scopeSel"){ store.set("wqScope_"+currentTab,e.target.value); showTab(currentTab); }
});
```

- [ ] **Step 5: Implement `quiz.js`**

Change `newRound()` start and `render` (keep everything else):

```js
function newRound(){
 const ctx=mode==="context", fits=w=>w.exs.some(x=>blankRe(w).test(x));
 const pool=poolFor("quiz").filter(w=>!ctx||fits(w));
 if(!gateGame(pool.length?"":ctx?"אין בבחירה הזו מילים עם משפט שמתאים לחידון הקשר":"אין מילים בבחירה הזו")) return;
 current=pickSet("quiz",1,ctx?fits:null,recent.list)[0];
 recent.add(current);
 rotateSentence(current,ctx?(x=>blankRe(current).test(x)):null);
```

(the old first lines `current=pickWeighted(...)`, `recent.add(current);`, `rotateSentence(...)` are replaced by the five lines above; the rest of `newRound` is unchanged). In `games.quiz.render`, change the markup so the modes stay visible and the game is inside `#gBody`:

```js
 c.innerHTML=gameBar("quiz")+`<nav class="modes">
  <button class="mode" data-mode="meaning">🧠 משמעות</button>
  <button class="mode" data-mode="context">📖 הקשר</button>
  <button class="mode" data-mode="reverse">🎯 שליפה</button>
  <button class="mode" data-mode="listen">🔊 האזנה</button></nav><div id="gBody"><div id="qgame"></div></div>`;
```

Append to `HELP.quiz` (inside the template string, before the closing backtick): `<p>למעלה בוחרים אילו מילים לשחק (הכל / חדשות / חלשות / חזקות / הקבוצה שלי). המשחק משתמש רק במילים שנבחרו.</p>`.

- [ ] **Step 6: Implement `hangman.js`**

```js
function newWord(){
 if(!gateGame(poolFor("hangman").length?"":"אין מילים בבחירה הזו")) return;
 const w=pickSet("hangman",1,null,recent.list)[0]; recent.add(w);
 H={w,L:letters(w),guessed:new Set(),wrong:0,done:false};
 $("hmInfo").innerHTML=""; draw();
 speak(w.w); // hearing the word first helps with spelling
}
```

In `render`, wrap everything after `gameBar("hangman")` in `<div id="gBody">…</div>`: the template becomes ``c.innerHTML=gameBar("hangman")+`<div id="gBody">\n <div class="tools top">…</div> … <div id="hmInfo"></div></div>`;`` (same inner markup as today, one added opening and closing `div`). Append to `HELP.hangman`: `<p>למעלה בוחרים אילו מילים לשחק. המשחק משתמש רק במילים שנבחרו.</p>`.

- [ ] **Step 7: Implement `cards.js`**

Replace the `pool` line with `const pool=()=>poolFor("cards");`. Change the first line of `intro()` to guard an empty pool:

```js
function intro(){
 if(!pool().length){ $("cdBody").innerHTML=`<div class="gwarn">אין מילים בבחירה הזו</div>`; return; }
 const n=dueCount(), total=pool().length, gone=allWords.filter(w=>hidden.has(w.w)).length;
```

(the rest of `intro` unchanged). Change `gameBar("cards",allWords)` to `gameBar("cards")` in `render`. Append to `HELP.cards`: `<p>למעלה בוחרים אילו מילים לתרגל. ״הכל״ כולל גם מילים שהסרתם.</p>`.

- [ ] **Step 8: Update the other two games' call**

In `crossword.js` and `wordsearch.js` the `gameBar("crossword")` / `gameBar("wordsearch")` calls already pass only the game name — verify with `grep -n "gameBar(" *.js` that no call passes a second argument.

- [ ] **Step 9: Add CSS to the end of `style.css`**

```css
/* scope selector, shared lock, game messages */
.scopesel{flex:1;min-width:0;font:inherit;font-size:14px;padding:9px 8px;border:0;border-radius:13px;background:#ececf3;color:var(--dark)}
.scopelock{flex:1;min-width:0;background:#fff4cf;border-radius:13px;padding:7px 10px;font-size:13px;line-height:1.35}.scopelock small{display:block;color:var(--muted);font-size:11.5px}
.gwarn{background:#fff4cf;border-radius:13px;padding:12px;margin:0 0 10px;font-size:14px;line-height:1.5}.gnote{font-size:13px;color:var(--muted);margin:6px 0;line-height:1.5}
[hidden]{display:none!important}
```

- [ ] **Step 10: Run all tests**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Game selector with counts, shared lock, quiz/hangman/cards play exactly their pool" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Word search plays exactly its pool

**Files:**
- Create: `tests/scope-wordsearch.test.js`
- Modify: `wordsearch.js`, `style.css` (none needed)

**Interfaces:**
- Consumes: `poolFor`, `pickSet`, `gateGame`, `gameBar`.
- Produces: `#wsNote` (class `gnote`) containing `מוצגות X מתוך N מילים` and/or `לא נכנסו הפעם: <b dir="ltr">word</b> …`.

- [ ] **Step 1: Write the failing test**

```js
const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const weak=names.slice(3,10);
 const app=await openApp({strong:names.slice(0,3),weak,storage:{wqScopeShared:"1",wqScopeSharedValue:"weak"}});
 const {page}=app;
 await page.click("[data-tab=wordsearch]");
 const shown=await page.$$eval("#wsList .chip span[dir=ltr]",e=>e.map(x=>x.textContent.trim()));
 const left=await page.$$eval("#wsNote b",e=>e.map(x=>x.textContent.trim()));
 const union=new Set([...shown,...left]);
 check("word search = exactly the 7 weak words (shown + listed as not fitting)",union.size===7&&weak.every(w=>union.has(w))&&shown.length+left.length===7,JSON.stringify({shown,left}));
 // bigger pool than capacity: subset note
 await page.evaluate(()=>{ store.set("wqScopeSharedValue","all"); });
 await page.click("[data-tab=crossword]"); await page.click("[data-tab=wordsearch]");
 const note=await page.textContent("#wsNote");
 check("bigger pool shows 'X מתוך N'",/מוצגות 7 מתוך \d+ מילים/.test(note),note);
 // too few words
 await page.evaluate(n=>{ store.set("wqScopeSharedValue","group"); group={name:"g",words:n.slice(0,2)}; saveGroup(); },weak);
 await page.click("[data-tab=crossword]"); await page.click("[data-tab=wordsearch]");
 check("2 words: minimum message and no grid",(await page.textContent(".gwarn")).includes("לפחות 3")&&await page.$eval("#gBody",e=>e.hidden));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/scope-wordsearch.test.js`
Expected: FAIL (`#wsNote` missing).

- [ ] **Step 3: Implement `wordsearch.js`**

Add near the top of the IIFE (after `let G, els=[] …`): `const CAP=7;` and

```js
const fitWords=()=>poolFor("wordsearch").filter(w=>{const n=letters(w).length;return n>=3&&n<=SIZE;});
```

Replace `generate()` with (the placement loop is the existing one, moved into `attempt`):

```js
function attempt(ws,dirs){
 const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(""));
 const placed=[];
 for(const w of ws){
  const L=letters(w);
  for(let t=0;t<300;t++){
   const [dr,dc]=dirs[Math.floor(Math.random()*dirs.length)];
   const r=Math.floor(Math.random()*SIZE), c=Math.floor(Math.random()*SIZE);
   const er=r+dr*(L.length-1), ec=c+dc*(L.length-1);
   if(er<0||ec<0||er>=SIZE||ec>=SIZE) continue;
   let ok=true;
   for(let i=0;i<L.length&&ok;i++){const x=grid[r+dr*i][c+dc*i]; if(x&&x!==L[i]) ok=false}
   if(!ok) continue;
   for(let i=0;i<L.length;i++) grid[r+dr*i][c+dc*i]=L[i];
   placed.push({w,L,found:false,idx:placed.length});
   break;
  }
 }
 return {grid,placed};
}
function generate(){
 const hard=store.get("wqHard","0")==="1";
 const dirs=hard?HARD:EASY;
 const pool=poolFor("wordsearch"), fit=fitWords(), sub=fit.length>CAP;
 let best=null;
 for(let t=0;t<(sub?1:12);t++){          // a small pool is retried until every word is placed
  const ws=(sub?pickSet("wordsearch",CAP,w=>fit.includes(w)):fit).slice().sort((a,b)=>letters(b).length-letters(a).length);
  const a=attempt(ws,dirs); a.ws=ws;
  if(!best||a.placed.length>best.placed.length) best=a;
  if(a.placed.length===ws.length) break;
 }
 const {grid,placed,ws}=best;
 const pool2=ws.map(letters).join("")+"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++) if(!grid[r][c]) grid[r][c]=pool2[Math.floor(Math.random()*pool2.length)];
 // words that did not make it into this grid (or are too short/long for it) are listed, never replaced by other words
 const missed=sub?[]:ws.filter(w=>!placed.some(p=>p.w===w)).concat(pool.filter(w=>!fit.includes(w)));
 return {grid,placed,hard,colors:{},won:false,hintCell:null,miss:new Set(),missed,shown:sub?placed.length:null,total:pool.length};
}
```

In `drawList()` append at the end of the function:

```js
 const parts=[];
 if(G.shown!==null) parts.push(`מוצגות ${G.shown} מתוך ${G.total} מילים`);
 if(G.missed.length) parts.push(`לא נכנסו הפעם: ${G.missed.map(w=>`<b dir="ltr">${w.w}</b>`).join(", ")}`);
 $("wsNote").innerHTML=parts.join(" · ");
```

Replace `newGame()`:

```js
function newGame(){
 const n=fitWords().length;
 if(!gateGame(n>=3?"":`בתפזורת צריך לפחות 3 מילים באורך 3–10 אותיות (בבחירה הזו יש ${n}).`)) return;
 G=generate(); sel=[]; dragging=false; moved=false; anchor=null;
 $("wsInfo").innerHTML=""; buildGrid(); drawList(); paint();
}
```

In `render`, wrap everything after `gameBar("wordsearch")` in `<div id="gBody">…</div>` and add `<div class="gnote" id="wsNote"></div>` after `<div class="chips" id="wsList"></div>`. Append to `HELP.wordsearch`: `<p>בתפזורת צריך לפחות 3 מילים (באורך 3–10 אותיות). למעלה בוחרים אילו מילים לשחק; המשחק משתמש רק בהן, ומילים שלא נכנסו מופיעות מתחת ללוח.</p>`.

Also guard `hint()` and the pointer handlers against a gated game: at the top of `hint()` add `if(!G||$("gBody").hidden) return;`, and `bind()`'s `pointerdown` already returns when `G.won`; add `|| $("gBody").hidden` to its condition `if(!c||G.won)`.

- [ ] **Step 4: Run all tests**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Word search: play exactly the chosen words, list leftovers, minimum message" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Crossword plays exactly its pool; remove the `pickWeighted` shim

**Files:**
- Create: `tests/scope-crossword.test.js`
- Modify: `crossword.js`, `common.js` (delete shim)

**Interfaces:**
- Consumes: `poolFor`, `pickSet`, `gateGame`.
- Produces: clue-list items carry `data-en="<word>"` (for tests); `#cwNote` (class `gnote`) with the same note format as word search.

- [ ] **Step 1: Write the failing test**

```js
const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const weak=names.slice(3,9);               // 6 weak words
 const app=await openApp({strong:names.slice(0,3),weak,storage:{wqScopeShared:"1",wqScopeSharedValue:"weak"}});
 const {page}=app;
 let ok=true, detail=[];
 for(let i=0;i<8;i++){   // several different random puzzles
  await page.click("[data-tab=crossword]"); await page.click("#cwNew");
  const shown=await page.$$eval("#cwLists li",e=>e.map(x=>x.dataset.en));
  const left=await page.$$eval("#cwNote b",e=>e.map(x=>x.textContent.trim()));
  const union=new Set([...shown,...left]);
  if(!(union.size===6&&weak.every(w=>union.has(w))&&shown.length+left.length===6)){ ok=false; detail.push(JSON.stringify({shown,left})); }
 }
 check("crossword = exactly the 6 weak words (placed + listed), 8 puzzles",ok,detail.join(" ; "));
 await page.evaluate(()=>{ store.set("wqScopeSharedValue","all"); });
 await page.click("[data-tab=hangman]"); await page.click("[data-tab=crossword]");
 check("bigger pool shows 'X מתוך N'",/מוצגות \d+ מתוך \d+ מילים/.test(await page.textContent("#cwNote")));
 await page.evaluate(n=>{ store.set("wqScopeSharedValue","group"); group={name:"g",words:n.slice(0,3)}; saveGroup(); },weak);
 await page.click("[data-tab=hangman]"); await page.click("[data-tab=crossword]");
 const msg=await page.textContent(".gwarn");
 check("3 words: minimum message (needs 4) and no grid",msg.includes("לפחות 4")&&await page.$eval("#gBody",e=>e.hidden),msg);
 await page.keyboard.press("A");   // typing while gated must not crash
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/scope-crossword.test.js`
Expected: FAIL (`data-en` missing / `#cwNote` missing).

- [ ] **Step 3: Implement `crossword.js`**

Add after `let P; // current puzzle`: `const CAP=9;` and

```js
const fitWords=()=>poolFor("crossword").filter(w=>{const n=letters(w).length;return n>=3&&n<=11;});
```

Replace `generate()` up to and including the line `const {ent,r0,c0,W,H}=best;` with:

```js
function generate(){
 const pool=poolFor("crossword"), fit=fitWords(), sub=fit.length>CAP;
 let best=null;
 for(let t=0;t<(sub?60:250);t++){            // a small pool is retried many times to place every word
  const ws=sub?pickSet("crossword",CAP,w=>fit.includes(w)):fit;
  const ent=build(ws);
  if(!ent.length||(sub&&ent.length<6)) continue;
  const r0=Math.min(...ent.map(e=>e.r)), c0=Math.min(...ent.map(e=>e.c));
  const r1=Math.max(...ent.map(e=>e.r+(e.d?e.L.length-1:0))), c1=Math.max(...ent.map(e=>e.c+(e.d?0:e.L.length-1)));
  const H=r1-r0+1, W=c1-c0+1;
  if(W>11||H>11) continue;
  const score=ent.length*10-W*H/4;
  if(!best||score>best.score) best={ent,r0,c0,W,H,score,ws};
  if(ent.length>=(sub?8:ws.length)) break;
 }
 if(!best){ // fallback: should be very rare
  const ws=sub?pickSet("crossword",5,w=>fit.includes(w)):fit;
  const ent=build(ws);
  const r0=Math.min(...ent.map(e=>e.r)), c0=Math.min(...ent.map(e=>e.c));
  best={ent,r0,c0,ws,
   W:Math.max(...ent.map(e=>e.c+(e.d?0:e.L.length)))-c0,
   H:Math.max(...ent.map(e=>e.r+(e.d?e.L.length:1)))-r0};
 }
 const {ent,r0,c0,W,H}=best;
 // words that did not make it into the grid (or do not fit a crossword) are listed, never replaced by other words
 const placed=new Set(ent.map(e=>e.w));
 const left=sub?[]:best.ws.filter(w=>!placed.has(w)).concat(pool.filter(w=>!fit.includes(w)));
 const note={shown:sub?placed.size:null,total:pool.length,left};
```

Leave the rest of `generate()` (from `const cells=Array.from…`) as is, but change its final `return` to include the note:

```js
 return {W,H,cells,entries,ei:first<0?0:first,ci:0,bad:new Set(),won:false,note};
```

In `draw()`, change the clue lists template so each `<li>` carries `data-en`: replace `<li data-e="${i}" class=` with `<li data-e="${i}" data-en="${x.w.w}" class=`. At the end of `draw()` add:

```js
 const n=P.note, parts=[];
 if(n.shown!==null) parts.push(`מוצגות ${n.shown} מתוך ${n.total} מילים`);
 if(n.left.length) parts.push(`לא נכנסו הפעם: ${n.left.map(w=>`<b dir="ltr">${w.w}</b>`).join(", ")}`);
 $("cwNote").innerHTML=parts.join(" · ");
```

Replace `newPuzzle()`:

```js
function newPuzzle(){
 const n=fitWords().length;
 if(!gateGame(n>=4?"":`בתשבץ צריך לפחות 4 מילים באורך 3–11 אותיות (בבחירה הזו יש ${n}). כדאי 5 ומעלה, כדי שיהיו יותר חיבורים בין המילים.`)){ P=P0=null; return; }
 P=P0=generate();
 $("cwInfo").innerHTML="";
 draw();
}
```

Guard the handlers against `P===null`: add `if(!P) return;` as the first line of `key(k)`, `hint()`, `reveal()` and `onCell(r,c)`. In `render`, wrap everything after `gameBar("crossword")` in `<div id="gBody">…</div>` and add `<div class="gnote" id="cwNote"></div>` right after `<div class="clue" id="cwClue"></div>`'s sibling `<div id="cwInfo"></div>`. Append to `HELP.crossword`: `<p>בתשבץ צריך לפחות 4 מילים (באורך 3–11 אותיות); כדאי 5 ומעלה. למעלה בוחרים אילו מילים לשחק. מילים שלא נכנסו ללוח מופיעות מתחתיו.</p>`.

- [ ] **Step 4: Delete the shim and check nothing uses it**

In `common.js` delete the `function pickWeighted(...)` shim line. Run `grep -n "pickWeighted" *.js` — expected: no output.

- [ ] **Step 5: Run all tests**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Crossword: play exactly the chosen words, retry to place all, minimum message" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Words tab — categories, filters with counts, shared-choice block

**Files:**
- Create: `tests/words-tab.test.js`
- Modify: `addwords.js`, `common.js` (delete `isWeak`), `style.css`

**Interfaces:**
- Consumes: `category`, `CAT_NAME`, `SCOPES`, `scopeLabel`, `isShared`, `group`, `groupWords`, `store`.
- Produces: module-level `val(w)` (sort key), `filt` (`"all"|"new"|"weak"|"strong"|"group"`, storage `wqFilter`), the main list `<ul class="cl" id="awMain">`, filter buttons `[data-filter]`, shared block `#shChk` / `#shSel`.

- [ ] **Step 1: Write the failing test**

```js
const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 await page.click("[data-tab=addwords]");
 const btns=await page.$$eval("[data-filter]",e=>e.map(x=>({f:x.dataset.filter,t:x.textContent.trim()})));
 check("no A-Z button",!btns.some(b=>b.t.includes("A-Z")),JSON.stringify(btns));
 check("filters are הכל/חדשות/חלשות/חזקות",btns.map(b=>b.f).join()==="all,new,weak,strong",JSON.stringify(btns));
 const rowsFor=async f=>{ await page.click(`[data-filter=${f}]`); return page.$$eval("#awMain > li b[dir=ltr]",e=>e.map(x=>x.textContent.trim())); };
 const counts={};
 for(const b of btns){ const rows=await rowsFor(b.f); const n=+b.t.match(/\((\d+)\)/)[1]; counts[b.f]=rows; check(`'${b.t}' count equals rows shown (${rows.length})`,rows.length===n); }
 check("weak and strong share no word",!counts.weak.some(w=>counts.strong.includes(w)));
 check("new+weak+strong = all",counts.new.length+counts.weak.length+counts.strong.length===counts.all.length);
 const sum=await page.textContent(".sum");
 check("summary uses the same three names and counts",sum.includes(`${counts.new.length} חדשות`)&&sum.includes("7 חלשות")&&sum.includes("3 חזקות"),sum);
 // the numbers match the game selector
 await page.click("[data-tab=quiz]");
 const opts=await page.$$eval("#scopeSel option",o=>o.map(x=>x.textContent.trim()));
 check("game selector counts = Words tab counts",opts[2]==="חלשות (7)"&&opts[3]==="חזקות (3)"&&opts[1]===`חדשות (${counts.new.length})`,JSON.stringify(opts));
 // shared block
 await page.click("[data-tab=addwords]");
 check("shared selector disabled until the checkbox is ticked",await page.$eval("#shSel",e=>e.disabled));
 await page.check("#shChk"); await page.selectOption("#shSel","weak");
 check("shared choice saved",await page.evaluate(()=>isShared()&&store.get("wqScopeSharedValue")==="weak"));
 for(const g of ["quiz","hangman","wordsearch","crossword","cards"]){
  await page.click(`[data-tab=${g}]`);
  check(`${g}: locked on the shared choice`,(await page.textContent(".scopelock")).includes("חלשות (7)"));
 }
 await page.click("[data-tab=addwords]"); await page.uncheck("#shChk");
 await page.click("[data-tab=quiz]");
 check("unticking restores the game's own selector",!!(await page.$("#scopeSel")));
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/words-tab.test.js`
Expected: FAIL (`[data-filter]` not found).

- [ ] **Step 3: Implement `addwords.js`**

(a) Replace `let sortBy=store.get("wqSort","weak");` with:

```js
const FILTERS=["all","new","weak","strong","group"];
let filt=store.get("wqFilter","all");
const alpha=(a,b)=>a.w.localeCompare(b.w);
const val=w=>{const t=wstat(w); return !t.n?2:t.pct!==null?t.pct/100:t.c/t.n};   // sort key: lower = weaker
```

(b) In `drawCustom()` delete its local `const val=…` line, and replace everything from `const act=[...words].sort(` (or the filter-based `const act=(sortBy===…)` block) through `const avg=…;` with:

```js
 const cnt={all:words.length,new:0,weak:0,strong:0}; words.forEach(w=>cnt[category(w)]++);
 const hasGroup=!!group&&groupWords().length>0;
 if(!FILTERS.includes(filt)||(filt==="group"&&!hasGroup)) filt="all";
 const act=filt==="strong"?words.filter(w=>category(w)==="strong").sort((a,b)=>val(b)-val(a))
  :filt==="weak"?words.filter(w=>category(w)==="weak").sort((a,b)=>val(a)-val(b))
  :filt==="new"?words.filter(w=>category(w)==="new").sort(alpha)
  :filt==="group"?groupWords().sort(alpha)
  :[...words].sort(alpha);
 const withPct=words.map(wstat).filter(t=>t.pct!==null);
 const avg=withPct.length?Math.round(withPct.reduce((x,t)=>x+t.pct,0)/withPct.length):null;
```

(c) Delete `const nWeak=…` and replace the `sb` helper with:

```js
 const fb=(k,t,n)=>`<button data-filter="${k}" class="${filt===k?"on":""}">${t} (${n})</button>`;
```

(d) Replace the `<div class="sum">…</div>` line with:

```js
 <div class="sum">${cnt.new} חדשות · ${cnt.weak} חלשות · ${cnt.strong} חזקות${avg===null?"":` · ממוצע ${avg}%`}${rec.length?` · 💡 ${rec.length} מומלצות להסרה`:""}</div>
```

(e) Replace the `<div class="tools sorts">…</div>` line with the shared block + filter row, and give the main list an id:

```js
 ${sharedBox}
 <div class="tools sorts">${fb("all","הכל",cnt.all)}${fb("new","חדשות",cnt.new)}${fb("weak","חלשות",cnt.weak)}${fb("strong","חזקות",cnt.strong)}${hasGroup?fb("group",`🎯 ${esc(group.name)}`,groupWords().length):""}</div>
 <ul class="cl" id="awMain">${act.map(
```

(i.e. change `<ul class="cl">${act.map(` to `<ul class="cl" id="awMain">${act.map(`). Define `sharedBox` just before the `$("awList").innerHTML=` assignment:

```js
 const sv0=store.get("wqScopeSharedValue","all"), shared=isShared();
 const shCur=!SCOPES.includes(sv0)||(sv0==="group"&&!hasGroup)?"all":sv0;
 const sharedBox=`<div class="sharedbox"><label class="chk"><input type="checkbox" id="shChk"${shared?" checked":""}> השתמש בבחירה אחת בכל המשחקים</label>
  <select id="shSel"${shared?"":" disabled"} aria-label="הבחירה המשותפת">${SCOPES.filter(s=>s!=="group"||hasGroup).map(s=>`<option value="${s}"${s===shCur?" selected":""}>${scopeLabel(s,"words")}</option>`).join("")}</select>
  <p class="tip">${shared?"כל המשחקים משתמשים בבחירה הזו, והבחירה בתוך כל משחק נעולה.":"כבוי: בכל משחק אפשר לבחור בנפרד אילו מילים לשחק."}</p></div>`;
```

(f) In the explanation paragraph (`<p class="sub">האחוז נמדד…`) insert at its start: `חדשה = עוד לא תורגלה. חלשה = תורגלה ועדיין אין אחוז, או שהאחוז מתחת ל-80%. חזקה = יש אחוז (אחרי ${WINDOW} ניסיונות) ו-80% ומעלה. ` (same names are used in the games).

(g) In the click handler replace the two `so` lines:

```js
  const so=e.target.closest("[data-sort]");
  if(so){ sortBy=so.dataset.sort; store.set("wqSort",sortBy); drawCustom(); return; }
```

with:

```js
  const fl=e.target.closest("[data-filter]");
  if(fl){ filt=fl.dataset.filter; store.set("wqFilter",filt); drawCustom(); return; }
```

and right after the `$("awList").addEventListener("click",…)` statement add:

```js
 $("awList").addEventListener("change",e=>{
  if(e.target.id==="shChk"){ store.set("wqScopeShared",e.target.checked?"1":"0"); drawCustom(); return; }
  if(e.target.id==="shSel"){ store.set("wqScopeSharedValue",e.target.value); drawCustom(); return; }
 });
```

(h) Delete `const isWeak=…` from `common.js`; run `grep -n "isWeak\|sortBy\|data-sort" *.js` — expected: no output.

- [ ] **Step 4: Add CSS to `style.css`**

```css
.sharedbox{background:#f7f7fb;border-radius:14px;padding:10px 12px;margin:8px 0}.sharedbox .chk{display:flex;gap:8px;align-items:center;font-size:14.5px;font-weight:600}.sharedbox select{width:100%;font:inherit;font-size:15px;padding:9px;border-radius:11px;border:2px solid #e3e3ee;background:#fff;color:var(--dark);margin:8px 0 2px}.sharedbox select:disabled{opacity:.5}.sharedbox .tip{margin:4px 0 0}
```

- [ ] **Step 5: Run all tests**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Words tab: true filters with counts from one category definition, shared choice, no A-Z" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: "My group" — section and builder in the Words tab

**Files:**
- Create: `tests/group.test.js`
- Modify: `addwords.js`, `style.css`

**Interfaces:**
- Consumes: `group`, `GROUP_MIN`, `saveGroup`, `groupWords`, `category`, `statLine` (existing), `val`, `alpha`, `esc`, `toast`, `shuffle`.
- Produces: module state `builder` (`null` or `{name,cat,count,picked:Set}`); functions `groupClick(e)`, `groupInput(e)`, `groupChange(e)`; markup hooks `[data-grpnew]`, `[data-grpedit]`, `[data-grpend]`, `#gbName`, `#gbCat`, `#gbCount`, `#gbAuto`, `[data-gbpick]`, `#gbSave`, `#gbCancel`.

- [ ] **Step 1: Write the failing test**

```js
const {openApp,check,done}=require("./helpers");
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const strong=names.slice(0,3), weak=names.slice(3,10), removed=names.slice(10,13);
 const app=await openApp({strong,weak,removed}); const {page}=app;
 await page.click("[data-tab=addwords]");
 await page.click("[data-grpnew]");
 check("builder opens with a default name and the weak words pre-selected",(await page.inputValue("#gbName"))==="קבוצה 1"&&(await page.$$eval("[data-gbpick]:checked",e=>e.length))===5);
 // validation
 await page.fill("#gbName","   "); await page.click("#gbSave");
 check("empty name is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("שם"));
 await page.fill("#gbName","מילים של השבוע");
 for(const w of await page.$$eval("[data-gbpick]:checked",e=>e.map(x=>x.dataset.gbpick)).then(a=>a.slice(0,2))) await page.uncheck(`[data-gbpick="${w}"]`);
 await page.click("#gbSave");
 check("fewer than 4 words is rejected",!!(await page.$("#gbSave"))&&(await page.textContent(".toast")).includes("4"));
 await page.click("#gbAuto");
 check("auto-pick selects 5 again",(await page.$$eval("[data-gbpick]:checked",e=>e.length))===5);
 await page.click("#gbSave");
 check("group section shows the free-text name and count",(await page.textContent(".grp")).includes("מילים של השבוע")&&(await page.textContent(".grp")).includes("5 מילים"));
 const stored=await page.evaluate(()=>JSON.parse(localStorage.wqGroup));
 check("saved on the device",stored.name==="מילים של השבוע"&&stored.words.length===5);
 check("group words are marked in the main list",(await page.$$eval("#awMain > li.ingrp",e=>e.length))===5);
 const chip=await page.textContent("[data-filter=group]");
 check("filter chip 🎯 name (5)",chip.includes("מילים של השבוע")&&chip.includes("(5)"),chip);
 // games
 await page.click("[data-tab=quiz]");
 const opts=await page.$$eval("#scopeSel option",o=>o.map(x=>x.textContent.trim()));
 check("games offer the group with its name and count",opts.some(o=>o.includes("🎯 מילים של השבוע (5)")),JSON.stringify(opts));
 await page.selectOption("#scopeSel","group");
 const g=new Set(stored.words), seen=new Set();
 for(let i=0;i<20;i++){ seen.add(await page.$eval("#qgame [data-say]",e=>e.dataset.say)); await page.click(".answer"); await page.click("#next"); }
 check("quiz plays only the group's words",[...seen].every(x=>g.has(x)),[...seen].join());
 // removing a word from games drops it from the group
 await page.click("[data-tab=addwords]");
 await page.click(`#awMain [data-hide="${stored.words[0]}"]`);
 check("removing a word leaves the group",(await page.evaluate(()=>group.words.length))===4);
 // edit
 await page.click("[data-grpedit]");
 check("edit opens the builder with the current name",(await page.inputValue("#gbName"))==="מילים של השבוע");
 await page.click("#gbCancel");
 // finish
 page.once("dialog",d=>d.accept());
 await page.click("[data-grpend]");
 check("finishing clears the group",(await page.evaluate(()=>group))===null&&!!(await page.$("[data-grpnew]")));
 check("games fall back to all when the group is gone",await page.evaluate(()=>getScope("quiz"))==="all");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close(); done();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/group.test.js`
Expected: FAIL (`[data-grpnew]` not found).

- [ ] **Step 3: Implement builder state and helpers in `addwords.js`**

Add after the `val`/`alpha` definitions (module level):

```js
let builder=null;   // while the group builder is open: {name,cat,count,picked:Set}
const BUILD_CATS=[["all","הכל"],["new","חדשות"],["weak","חלשות"],["strong","חזקות"]];
const builderPool=()=>builder.cat==="all"?words:words.filter(w=>category(w)===builder.cat);
function autoPick(){   // the weakest first for "weak", otherwise random
 const pool=builderPool();
 const list=builder.cat==="weak"?[...pool].sort((a,b)=>val(a)-val(b)):shuffle(pool);
 builder.picked=new Set(list.slice(0,builder.count).map(w=>w.w));
}
function builderHTML(){
 const pool=[...builderPool()].sort(alpha), n=builder.picked.size;
 return `<div class="grp building"><h4>🎯 ${group?"עריכת הקבוצה":"קבוצה חדשה"}</h4>
 <label class="lbl">שם הקבוצה (אפשר לכתוב חופשי)</label><input id="gbName" maxlength="30" placeholder="למשל: מילים של השבוע" value="${esc(builder.name)}">
 <label class="lbl">מאיזו קטגוריה לבחור?</label><select id="gbCat">${BUILD_CATS.map(([k,t])=>`<option value="${k}"${builder.cat===k?" selected":""}>${t}</option>`).join("")}</select>
 <label class="lbl">כמה מילים? (מינימום ${GROUP_MIN})</label>
 <div class="gbrow"><input id="gbCount" type="number" inputmode="numeric" min="${GROUP_MIN}" max="${Math.max(GROUP_MIN,pool.length)}" value="${builder.count}"><button class="wide" id="gbAuto">✨ בחירה אוטומטית</button></div>
 <div class="sum">נבחרו ${n} מילים${n<GROUP_MIN?` (צריך לפחות ${GROUP_MIN})`:""}. אפשר לסמן ולבטל סימון ברשימה:</div>
 <ul class="cl gbl">${pool.map(w=>`<li><label class="gbpick"><input type="checkbox" data-gbpick="${esc(w.w)}"${builder.picked.has(w.w)?" checked":""}><span><b dir="ltr">${esc(w.w)}</b> — ${esc(w.he)}</span></label></li>`).join("")}</ul>
 <div class="tools"><button class="wide" id="gbSave">💾 שמירת הקבוצה</button><button class="wide" id="gbCancel">ביטול</button></div></div>`;
}
function groupClick(e){
 const t=id=>e.target.closest(id);
 if(t("[data-grpnew]")){ builder={name:"קבוצה 1",cat:"weak",count:5,picked:new Set()}; autoPick(); drawCustom(); return true; }
 if(t("[data-grpedit]")){ builder={name:group.name,cat:"all",count:groupWords().length,picked:new Set(groupWords().map(w=>w.w))}; drawCustom(); return true; }
 if(t("[data-grpend]")){
  if(confirm(`לסיים את הקבוצה "${group.name}"? ההתקדמות של המילים נשמרת.`)){ group=null; saveGroup(); if(filt==="group"){ filt="all"; store.set("wqFilter",filt); } drawCustom(); }
  return true;
 }
 if(t("#gbAuto")){ autoPick(); drawCustom(); return true; }
 if(t("#gbCancel")){ builder=null; drawCustom(); return true; }
 if(t("#gbSave")){
  const name=builder.name.trim();
  if(!name){ toast("צריך לתת שם לקבוצה"); return true; }
  if(builder.picked.size<GROUP_MIN){ toast(`צריך לבחור לפחות ${GROUP_MIN} מילים`); return true; }
  group={name:name.slice(0,30),words:[...builder.picked]}; saveGroup(); builder=null; drawCustom(); toast("הקבוצה נשמרה ✓");
  return true;
 }
 return false;
}
function groupInput(e){ if(builder&&e.target.id==="gbName") builder.name=e.target.value; }
function groupChange(e){
 if(!builder) return false;
 if(e.target.id==="gbCat"){ builder.cat=e.target.value; autoPick(); drawCustom(); return true; }
 if(e.target.id==="gbCount"){ builder.count=Math.max(GROUP_MIN,Math.min(+e.target.value||GROUP_MIN,builderPool().length)); autoPick(); drawCustom(); return true; }
 if(e.target.dataset.gbpick!==undefined){
  const n=e.target.dataset.gbpick; e.target.checked?builder.picked.add(n):builder.picked.delete(n); drawCustom(); return true;
 }
 return false;
}
```

- [ ] **Step 4: Wire it into `drawCustom()` and the listeners**

Inside `drawCustom()`, after the `row` helper is defined, add:

```js
 const groupSection=()=>{
  if(!hasGroup) return `<div class="grp empty"><button class="next" style="display:block;margin:0" data-grpnew>🎯 בניית קבוצה</button><p class="tip">אפשר לבחור כמה מילים בלבד ללמוד עכשיו, לתת להן שם, ולשחק בהן בכל המשחקים.</p></div>`;
  const gw=groupWords().sort(alpha), strongN=gw.filter(w=>category(w)==="strong").length;
  return `<div class="grp"><div class="grph"><b>🎯 ${esc(group.name)}</b><span>${gw.length} מילים · ${strongN} חזקות</span></div>
  ${strongN===gw.length?`<div class="win">🎉 כל המילים בקבוצה חזקות! אפשר לסיים ולבנות קבוצה חדשה.</div>`:""}
  <ul class="cl grpl">${gw.map(w=>row(w,"",(category(w)==="strong"?`<div class="st2"><span class="g">✓ חזקה</span></div>`:"")+statLine(w),0)).join("")}</ul>
  <div class="tools"><button data-grpedit>✏️ עריכת הקבוצה</button><button data-grpend>סיום קבוצה</button></div></div>`;
 };
```

Change `row` so group words are marked (the main list and the group section): replace its definition with

```js
 const row=(w,btns,extra,n)=>{ const g=group&&group.words.includes(w.w); return `<li${g?' class="ingrp"':""}><span>${n?`<span class="num">${n}.</span> `:""}${g?"🎯 ":""}<b dir="ltr">${esc(w.w)}</b> — ${esc(w.he)}</span>${btns}${extra||""}</li>`; };
```

Make the Words list start with the builder or the group section: in the `$("awList").innerHTML=` template, put `${builder?builderHTML():groupSection()}` as the very first thing, before `<h4>המילים במשחקים (…)</h4>`. In the click listener's first line add `if(groupClick(e)) return;`. After the existing `"change"` listener (Task 5) make it start with `if(groupChange(e)) return;`, and add `$("awList").addEventListener("input",groupInput);`.

- [ ] **Step 5: Add CSS to `style.css`**

```css
/* my group */
.grp{border:2px solid #b9b0ff;border-radius:18px;padding:12px;margin:0 0 14px;background:#faf9ff}.grp.empty{border-style:dashed;background:transparent}.grph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}.grph b{font-size:16px}.grph span{color:var(--muted);font-size:13px}
.grp .lbl{display:block;font-size:12.5px;color:var(--muted);margin:8px 0 3px}.grp input:not([type=checkbox]),.grp select{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:9px;border-radius:11px;border:2px solid #e3e3ee;background:#fff;color:var(--dark)}.gbrow{display:flex;gap:8px}.gbrow input{flex:0 0 90px}.gbrow button{flex:1;border:0;border-radius:11px;background:#ececf3;font:inherit;font-size:14px}
.gbl{max-height:320px;overflow:auto}.gbpick{display:flex;gap:10px;align-items:center;padding:4px 0}.gbpick input{width:20px;height:20px;flex:none}
.cl li.ingrp{border-inline-start:4px solid #6c5ce7}
```

- [ ] **Step 6: Run all tests**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "My group: named group with builder, separate section, 🎯 marks, used by every game" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: README, cache version, final verification

**Files:**
- Modify: `README.md`, `index.html`

**Interfaces:** none new.

- [ ] **Step 1: Bump the cache version**

Run: `grep -o "v=[0-9]*" index.html | sort -u` (currently `v=35`), then `sed -i '' 's/?v=35/?v=36/g' index.html` and confirm with the same grep that only `v=36` remains.

- [ ] **Step 2: Update `README.md`**

In the "תכונות" section replace the bullets about "כל המילים / רק חלשות" and "לשונית מילים" with:

```markdown
- **קטגוריות אחידות** — כל מילה פעילה היא בדיוק אחת מ: **חדשות** (עוד לא תורגלה), **חלשות** (תורגלה, ועדיין אין אחוז או שהאחוז מתחת ל-80%), **חזקות** (יש אחוז, אחרי 10 ניסיונות, ו-80% ומעלה). אותן קטגוריות ואותם מספרים בלשונית מילים ובכל המשחקים.
- **בחירת מילים בכל משחק** — למעלה בכל משחק: הכל / חדשות / חלשות / חזקות / הקבוצה שלי, עם מספר המילים. המשחק משתמש רק במילים שנבחרו (בלי להשלים ממילים אחרות). בכרטיסיות, ״הכל״ כולל גם מילים שהוסרו.
- **בחירה אחת לכל המשחקים** — בלשונית מילים אפשר לסמן ״השתמש בבחירה אחת בכל המשחקים״; אז כל המשחקים משחקים באותן מילים והבחירה בתוכם נעולה.
- **הקבוצה שלי** — לשונית מילים ← ״בניית קבוצה״: נותנים שם חופשי, בוחרים קטגוריה וכמה מילים (מינימום 4), ומסמנים או מבטלים מילים. כל המשחקים יכולים לשחק רק בקבוצה. ״סיום קבוצה״ מנקה אותה.
- **מינימום מילים** — תשבץ: 4 מילים (באורך 3–11 אותיות, מומלץ 5 ויותר). תפזורת: 3 מילים (באורך 3–10 אותיות). מילים שלא נכנסות ללוח מופיעות מתחתיו.
- **לשונית מילים** — כפתורי סינון עם ספירה: הכל, חדשות, חלשות, חזקות (וגם הקבוצה שלי כשיש).
```

In the "פיתוח ופרסום" section add the line: ``- בדיקות: `node tests/run.js` (דורש Playwright; אפשר להגדיר `PW_PATH` לנתיב שלו). הבדיקות מריצות דפדפן ללא ממשק בגודל טלפון.``

- [ ] **Step 3: Run the whole suite**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 4: Manual smoke check on a phone-width page**

Start `python3 -m http.server 8791` in the project folder and open `http://localhost:8791` at about 390px width. Check by eye, once: a game's selector row fits on one line; the Words tab group section is clearly framed; the 🎯 marks and the side stripe show in the list. Stop the server afterwards (`pkill -f "http.server 8791"`).

- [ ] **Step 5: Commit (branch only; do not merge or push main)**

```bash
git add -A
git commit -m "README for categories, scope, groups; bump cache version" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin word-groups
```

(Pushing the feature branch is allowed; `main` stays untouched until the user approves the merge.)

---

## Self-review (spec coverage)

- Spec §1 categories → Task 1 (`category`), used in Tasks 2, 5, 6; strong rule + 1/1 attempt covered by `core.test.js`.
- Spec §2 Words tab (summary, filters with counts, A-Z removed, shared block) → Task 5.
- Spec §3 game scope (selector, per-game, shared lock, no top-up, subset note, minimums, leftover list, empty pool, retry to place all) → Tasks 2–4.
- Spec §4 group (name, builder, min 4, separation, finish, removal drops word, fallback to all) → Tasks 1 and 6.
- Testing section → every task has a headless test; Task 7 runs all and does a visual check.
- Names consistent across tasks: `category`, `poolOf`, `poolFor`, `pickSet`, `gateGame`, `scopeLabel`, `gameBar`, `group`/`groupWords`/`saveGroup`/`GROUP_MIN`, `filt`/`val`/`alpha`, `builder`.
