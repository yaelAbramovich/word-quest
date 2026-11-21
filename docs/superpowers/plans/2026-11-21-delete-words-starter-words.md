# Delete a word for good + 10 common starter words — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) A 🗑 button on every word in the Words tab that deletes it for good (also from its group); (2) new users start with 10 common words instead of the 19 high-level ones, while existing users keep exactly the words they have now.

**Architecture:** `common.js` gets `deleteWord(w)` and a `wqDeleted` list (so deleted built-in words stay deleted). The 19 old words move to `legacy-words.js`; `words.js` becomes the 10-word starter pack; at first load `common.js` decides once (`wqPack`) which pack the device uses: anyone with stored app data keeps the legacy 19, a brand-new device gets the starter 10.

**Tech Stack:** plain HTML/CSS/JS (static site), `localStorage`, Node + Playwright headless tests in `tests/`.

**Design (approved in chat, no spec file):** see "Global Constraints" below; the user approved: 🗑 on every row of the main list and of the removed ("done") list, never inside the group card or builder; confirm before deleting; deleting removes the word from its group (an emptied group is cleared) and erases its progress/edits; an *active* word cannot be deleted when only 8 active words remain (same message as the ✓ button), done words can always be deleted; new users get the 10 words below; existing users keep their current words and get no new ones.

## Global Constraints

- Work only on branch `delete-words`. Do **not** merge to `main` or push `main`; the user merges after approval. Pushing `delete-words` is allowed only in the final task.
- UI text is Hebrew, RTL. Exact strings: confirm `למחוק את "WORD" לצמיתות?` + newline + `גם ההתקדמות שלו והעריכות שלו יימחקו.`; after deleting, toast `המילה נמחקה`; refusal (same as `hideWord`): `צריך לפחות 8 מילים פעילות כדי שהמשחקים יעבדו`; button `🗑` with `aria-label="מחיקה לצמיתות"`.
- `MIN_WORDS` (8) applies to deleting an **active** word; deleting a done (removed) word is always allowed.
- Storage keys: `wqDeleted` (names of deleted built-in words), `wqPack` (`"legacy"` or `"starter"`, decided once). Deleted words also lose their entries in `wqStats`, `wqTotals`, `wqMistakes`, `wqCards`, `wqLearned`, `wqEdits`, `wqHidden`, `wqGroup`, and (custom words) `wqCustom`.
- Existing user = any of these keys is present before the first load of this version: `wqTab`, `wqStats`, `wqCustom`, `wqHidden`, `wqCards`, `wqEdits`.
- Starter words must be only letters a–z, 3–10 letters, each with `he`, `m` (Hebrew explanation) and an `ex` sentence that contains the word. Exactly these 10: borrow, forget, remember, enough, improve, choose, travel, difficult, kitchen, quickly.
- Bump the cache version (`?v=NN` in `index.html`) in the final task; add the new script tag for `legacy-words.js`.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run tests with `node tests/run.js`. All existing tests must keep passing.

## File Structure

- `common.js` — `deleted` set + load-time filter, pack choice, `deleteWord`.
- `addwords.js` — 🗑 buttons, click handler.
- `words.js` — becomes the 10 starter words. `legacy-words.js` (new, moved from the old `words.js`) — the 19 old words as `legacyWords`.
- `index.html` — script tag, version.
- `tests/helpers.js` (pack-aware), `tests/delete-word.test.js` (new), `tests/starter-words.test.js` (new).
- `README.md`.

---

### Task 1: Delete a word for good

**Files:**
- Create: `tests/delete-word.test.js`
- Modify: `common.js`, `addwords.js`

**Interfaces:**
- Consumes (existing): `allWords`, `words`, `hidden`, `saveHidden()`, `applyHidden()`, `group`, `saveGroup()`, `S` (`stats`, `totals`, `mistakes`, `cards`, `learned`), `save()`, `edits`, `saveCustom()`, `MIN_WORDS`, `toast`, `renderStats()`, `drawCustom()`.
- Produces: `deleted` (a `Set` of deleted built-in word names, stored in `wqDeleted`); `deleteWord(w) -> bool` (global in `common.js`; `false` and a toast when an active word would leave fewer than 8); `[data-delword="name"]` buttons.

- [ ] **Step 1: Write the failing test `tests/delete-word.test.js`**

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/yael_a/codeProjects/word-quest && node tests/delete-word.test.js`
Expected: FAIL (the 🗑 buttons do not exist yet).

- [ ] **Step 3: `common.js` — the deleted list and `deleteWord`**

Directly above the line `parse("wqCustom","[]").forEach(c=>{ if(!words.some(x=>x.w===c.w)) words.push(c); });` insert:

```js
// built-in words you deleted for good stay deleted (words you added yourself are simply removed from wqCustom)
const deleted=new Set(parse("wqDeleted","[]"));
for(let i=words.length-1;i>=0;i--) if(deleted.has(words[i].w)) words.splice(i,1);
```

Directly below `function restoreWord(name){ … }` add:

```js
// delete a word for good: the word itself, its progress and edits, and its place in the group.
// An active word cannot be deleted when only MIN_WORDS active words remain (the games need words); a done (removed) word always can.
function deleteWord(w){
 if(!hidden.has(w.w)&&words.length<=MIN_WORDS){ toast(`צריך לפחות ${MIN_WORDS} מילים פעילות כדי שהמשחקים יעבדו`); return false; }
 const i=allWords.indexOf(w); if(i>=0) allWords.splice(i,1);
 if(w.custom) saveCustom(); else { deleted.add(w.w); store.set("wqDeleted",JSON.stringify([...deleted])); }
 hidden.delete(w.w); saveHidden(); applyHidden();
 if(group){ group.words=group.words.filter(n=>n!==w.w); if(!group.words.length) group=null; saveGroup(); }
 [S.stats,S.totals,S.mistakes,S.cards].forEach(o=>{ delete o[w.w]; }); S.learned.delete(w.w);
 delete edits[w.w]; store.set("wqEdits",JSON.stringify(edits));
 save();
 return true;
}
```

- [ ] **Step 4: `addwords.js` — buttons and handler**

In the main-list row (the long line starting `<ul class="cl" id="awMain">${act.map(`), replace the final custom-only button `${w.custom?`<button data-rm="${esc(w.w)}" aria-label="מחיקה">✕</button>`:""}` with a button for every word:

```js
<button data-delword="${esc(w.w)}" aria-label="מחיקה לצמיתות" title="מחיקה לצמיתות">🗑</button>
```

In the removed-words list (the line starting `(gone.length?`<h4>מילים שהוסרו`), add the same button after the restore button, i.e. the row becomes:

```js
row(w,`<button data-restore="${esc(w.w)}" class="wide" aria-label="החזרה">↩ החזרה</button><button data-delword="${esc(w.w)}" aria-label="מחיקה לצמיתות" title="מחיקה לצמיתות">🗑</button>`)
```

Replace the old `data-rm` handler (the three lines starting `const d=e.target.closest("[data-rm]"); if(!d) return;` through `hidden.delete(d.dataset.rm); … drawCustom();`) with:

```js
  const dw=e.target.closest("[data-delword]");
  if(dw){
   const w=allWords.find(x=>x.w===dw.dataset.delword); if(!w) return;
   if(confirm(`למחוק את "${w.w}" לצמיתות?\nגם ההתקדמות שלו והעריכות שלו יימחקו.`)&&deleteWord(w)){
    if(builder) builder.picked.delete(w.w);   // the group builder must not keep a deleted word
    renderStats(); drawCustom(); toast("המילה נמחקה");
   }
   return;
  }
```

(Keep the closing `});` of the click listener that follows.)

- [ ] **Step 5: Run all tests**

Run: `node --check common.js && node --check addwords.js && node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Delete a word for good: 🗑 on every word, also leaves its group and erases its progress" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 10 common starter words for new users; existing users keep their words

**Files:**
- Create: `legacy-words.js` (moved from `words.js`), `tests/starter-words.test.js`
- Modify: `words.js` (rewritten), `index.html`, `common.js`, `tests/helpers.js`, `README.md`

**Interfaces:**
- Consumes: Task 1 (`deleted`, `deleteWord`), `store`, `words`.
- Produces: global `legacyWords` (the 19 old words, from `legacy-words.js`); `pack` (`"legacy"|"starter"`, stored in `wqPack`); test helpers `starterNames()` and an `openApp` option `pack:"starter"` (brand-new device, nothing stored) / `pack:"raw"` (only the given `storage`, nothing else) — default is a seeded profile on the **legacy** pack (`wqPack:"legacy"`), so every existing test keeps using the 19 old words.

- [ ] **Step 1: Make the test harness pack-aware (`tests/helpers.js`)**

Replace `wordNames()` and `openApp`'s seeding as follows.

```js
// names of the built-in words of a pack, read from its file (default: the 19 legacy words the existing tests use)
function namesFrom(file,variable){
 const ctx={}; vm.runInNewContext(fs.readFileSync(path.join(ROOT,file),"utf8")+";this.list="+variable+";",ctx);
 return ctx.list.map(w=>w.w);
}
const wordNames=()=>namesFrom("legacy-words.js","legacyWords");
const starterNames=()=>namesFrom("words.js","words");
```

In `openApp`, change the init script so it supports three modes and the default storage includes `wqPack:"legacy"`:

```js
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
```

and export `starterNames`: `module.exports={openApp,check,done,wordNames,starterNames};`. (Everything else in `openApp` stays.)

- [ ] **Step 2: Write the failing test `tests/starter-words.test.js`**

```js
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node tests/starter-words.test.js`
Expected: FAIL / error (`legacy-words.js` does not exist yet).

- [ ] **Step 4: Move the old words, write the starter words**

Run: `git mv words.js legacy-words.js`, then in `legacy-words.js` change the first two lines to:

```js
// The original 19 words. People who already used Word Quest keep these (see `wqPack` in common.js); new users get the starter words in words.js.
const legacyWords = [
```

(the rest of the file is unchanged). Create a new `words.js` with exactly:

```js
// The starter words every NEW user gets: 10 common, everyday words. (People who used the app before keep their original words: see legacy-words.js.)
// Add words here: {w:"english",he:"תרגום",m:"הסבר",ex:"example sentence containing the word"}
const words = [
{w:"borrow",he:"ללוות או לשאול (חפץ)",m:"לקחת משהו מאדם אחר בכוונה להחזיר אותו.",ex:"Can I borrow your pen for a minute?"},
{w:"forget",he:"לשכוח",m:"לא לזכור משהו, או לא להיזכר בו בזמן שצריך.",ex:"Don't forget to call me tonight."},
{w:"remember",he:"לזכור",m:"להחזיק משהו בזיכרון, או להיזכר בו.",ex:"I remember my first day at school."},
{w:"enough",he:"מספיק",m:"כמות שמספיקה למה שצריך, לא פחות ולא יותר.",ex:"We have enough food for everyone."},
{w:"improve",he:"להשתפר או לשפר",m:"להפוך למשהו טוב יותר.",ex:"She practices every day to improve her English."},
{w:"choose",he:"לבחור",m:"להחליט איזו אפשרות רוצים מבין כמה אפשרויות.",ex:"You can choose any color you like."},
{w:"travel",he:"לנסוע או לטייל",m:"לעבור ממקום למקום, בדרך כלל למרחק.",ex:"They travel to Italy every summer."},
{w:"difficult",he:"קשה או מסובך",m:"לא קל לעשות או להבין.",ex:"This question is too difficult for me."},
{w:"kitchen",he:"מטבח",m:"החדר בבית שבו מבשלים אוכל.",ex:"My mother is cooking in the kitchen."},
{w:"quickly",he:"במהירות",m:"בפרק זמן קצר, לא לאט.",ex:"He finished his homework quickly."},
];
```

- [ ] **Step 5: `index.html` — load the legacy file**

Add `<script src="legacy-words.js?v=43"></script>` on the line right after `<script src="words.js?v=43"></script>`, then bump every `?v=43` to `?v=44` (`sed -i '' 's/?v=43/?v=44/g' index.html`).

- [ ] **Step 6: `common.js` — choose the pack once**

Directly above the `deleted` block added in Task 1 (so the pack is chosen before deleted words are filtered), insert:

```js
// Which built-in words does this device get? Decided once and remembered (wqPack):
// people who already used the app keep their original 19 words (legacy); a brand-new device gets the 10 starter words.
const EXISTING_USER_KEYS=["wqTab","wqStats","wqCustom","wqHidden","wqCards","wqEdits"];
let pack=store.get("wqPack","");
if(!pack){ pack=EXISTING_USER_KEYS.some(k=>store.get(k,null)!==null)?"legacy":"starter"; store.set("wqPack",pack); }
if(pack==="legacy") words.splice(0,words.length,...legacyWords);
```

- [ ] **Step 7: README**

In `README.md`, in the section about adding words, add the bullets: `- **מילים להתחלה** — משתמש חדש מתחיל עם 10 מילים נפוצות (ב-words.js). מי שכבר השתמש באפליקציה שומר על המילים שהיו לו (legacy-words.js), ולא מתווספות לו מילים חדשות.` and `- **מחיקה לצמיתות** — כפתור 🗑 ליד כל מילה בלשונית מילים (גם ברשימת המילים שהוסרו) מוחק אותה, את ההתקדמות שלה ואת השייכות שלה לקבוצה. אי אפשר למחוק מילה פעילה כשנשארו רק 8 מילים פעילות. אין מחיקה בתוך הקבוצה, רק ברשימה המלאה.`

- [ ] **Step 8: Run all tests**

Run: `node tests/run.js`
Expected: `ALL TEST FILES PASS` (the older tests keep using the 19 legacy words through the harness default).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "New users start with 10 common words; existing users keep their words (legacy pack)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Final verification and push

- [ ] **Step 1: Full suite and a visual check**

Run `node tests/run.js` (expected `ALL TEST FILES PASS`). Start `python3 -m http.server 8791` in the project folder, open it in a headless browser at 390px wide with a clean profile and take screenshots of: the Words tab (10 starter words, 🗑 on each row), and a confirm for one word. Confirm by eye that the row buttons still fit on one line on a phone width (the extra 🗑 must not push the ✓ or ✏️ buttons off the row); if they wrap badly, make the row buttons slightly narrower in `style.css` and re-check. Stop the server afterwards.

- [ ] **Step 2: Push the branch (not `main`)**

```bash
git add -A
git commit -m "Row buttons fit with the new delete button" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"   # only if Step 1 required a CSS change
git push -u origin delete-words
```

---

## Self-review (against the approved design)

- 🗑 on every main-list row and removed-list row, none in the group card or builder → Task 1 (tests check the group card).
- Confirm dialog, toast, built-in + custom words, group removal (and emptied group cleared), progress/edits erased, persists after reload (`wqDeleted`) → Task 1.
- Active-word limit of 8, done words always deletable → Task 1 test and Task 2 starter test.
- 10 common starter words for new users; existing users (any stored data) keep the 19 and get no new words; pack remembered → Task 2 (tests cover new, existing, custom-only, reload).
- Names used consistently: `deleteWord`, `deleted`, `wqDeleted`, `legacyWords`, `wqPack`, `pack`, `[data-delword]`.
