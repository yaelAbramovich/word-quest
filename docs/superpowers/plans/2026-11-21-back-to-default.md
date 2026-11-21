# "Back to default" button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A button at the bottom of the Words tab that, after a clear warning and a confirmation, erases everything the app saved on this device and shows the 10 default (starter) words again, like a brand-new user.

**Architecture:** One function `resetToDefault()` in `common.js` removes every `localStorage` key that starts with `wq`, writes `wqPack="starter"`, and reloads the page. The Words tab gets a small warning box with the button (outside `#awList`, so it is not redrawn). It builds on the `wqPack` logic from `2026-11-21-delete-words-starter-words.md` (same branch).

**Tech Stack:** plain HTML/CSS/JS (static site), `localStorage`, Node + Playwright headless tests in `tests/`.

**Design (approved in chat, no spec file):** button `↩ חזרה לברירת מחדל` in a warning box at the bottom of the Words tab; confirm dialog; erases *everything* (words you added, edits, deleted and removed words, group, all progress, all settings such as voice/speed/mute/filters); shows the 10 starter words for everyone (also for people who had the old 19); only this device; cannot be undone; the existing "איפוס התקדמות" button is unchanged.

## Global Constraints

- Work only on branch `delete-words` (the branch already holds the `wqPack` logic this depends on). Do **not** merge to `main` or push `main`; the user merges after approval. Pushing `delete-words` is allowed only in the final task.
- UI text is Hebrew, RTL. Exact confirm text: `לחזור לברירת המחדל?` + newline + `זה ימחק הכל: מילים שהוספת, עריכות של משמעויות ומשפטים, מילים שמחקת או הסרת, הקבוצה, כל ההתקדמות וההגדרות (קול, מהירות, השתקה).` + newline + `יוצגו שוב רק 10 מילות ברירת המחדל. אי אפשר לבטל.`
- Erase **every** `localStorage` key that starts with `wq` (nothing else), then set `wqPack` to `"starter"` and reload. Do not call `save()` or write any other app key between the erase and the reload.
- Do not touch the existing `#reset` ("איפוס התקדמות") button.
- Bump the cache version (`?v=NN`) in `index.html` in the final task (currently `v=44`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Run tests with `node tests/run.js`. All existing tests must keep passing.

## File Structure

- `common.js` — `resetToDefault()`.
- `addwords.js` — the warning box and its click handler in the Words tab `render`.
- `style.css` — `.resetbox`.
- `tests/back-to-default.test.js` (new), `README.md`, `index.html`.

---

### Task 1: The "back to default" button

**Files:**
- Create: `tests/back-to-default.test.js`
- Modify: `common.js`, `addwords.js`, `style.css`, `README.md`

**Interfaces:**
- Consumes: `store`, the `wqPack` logic in `common.js` (`pack` is decided at load: any stored app data means `"legacy"`, otherwise `"starter"`, and an existing `wqPack` is respected).
- Produces: `resetToDefault()` (global in `common.js`; never returns because the page reloads); `#awDefault` button in the Words tab.

- [ ] **Step 1: Write the failing test `tests/back-to-default.test.js`**

```js
const {openApp,check,done,starterNames}=require("./helpers");
const KEYS=["wqCustom","wqEdits","wqDeleted","wqHidden","wqGroup","wqStats","wqTotals","wqCards","wqMistakes","wqLearned","wqVoice","wqRate","wqMuted","wqFilter","wqScope_quiz","wqScopeShared","wqScopeSharedValue","wqGrpOpen"];
(async()=>{
 const probe=await openApp(); const names=probe.names; await probe.close();
 const custom={w:"zzcustom",he:"בדיקה",m:"",ex:"A zzcustom test.",exs:["A zzcustom test."],custom:1};
 const app=await openApp({strong:names.slice(0,3),weak:names.slice(3,10),removed:names.slice(10,13),storage:{
  wqCustom:[custom],wqEdits:{bank:{he:"שונה",m:"",exs:["I edited this."]}},wqDeleted:[names[13]],
  wqGroup:{name:"מילים של השבוע",words:names.slice(3,8)},wqVoice:"x",wqRate:"1",wqMuted:"1",wqFilter:"weak",wqScope_quiz:"weak",wqGrpOpen:"1",
  wqTotals:{bank:{s:1,m:0,h:0}},wqCards:{bank:{b:1,d:5,l:1}},wqMistakes:{bank:2},wqLearned:["bank"]}});
 const {page}=app;
 await page.click("[data-tab=addwords]");
 const present=await page.evaluate(k=>k.filter(x=>localStorage.getItem(x)!==null),KEYS);
 check("before: the user has data under every key",present.length===KEYS.length,JSON.stringify(KEYS.filter(k=>!present.includes(k))));
 const before=await page.evaluate(()=>words.length);
 check("the button is there",!!(await page.$("#awDefault")));

 // cancel changes nothing (and does not reload)
 await page.evaluate(()=>{ window.__marker=1; });
 let msg=""; page.once("dialog",d=>{ msg=d.message(); d.dismiss(); });
 await page.click("#awDefault");
 check("the confirm explains what will be erased",msg.includes("לחזור לברירת המחדל")&&msg.includes("אי אפשר לבטל")&&msg.includes("10 מילות ברירת המחדל"),msg);
 check("cancel changes nothing",(await page.evaluate(()=>window.__marker===1&&words.length))===before&&(await page.evaluate(()=>localStorage.getItem("wqCustom")||"")).includes("zzcustom"));

 // accept: everything is erased and the 10 starter words are shown
 page.once("dialog",d=>d.accept());
 await Promise.all([page.waitForEvent("load"),page.click("#awDefault")]);
 await page.click("[data-tab=addwords]");
 const after=await page.evaluate(k=>({pack:localStorage.getItem("wqPack"),left:k.filter(x=>localStorage.getItem(x)!==null),names:words.map(w=>w.w).sort(),all:allWords.length,group,muted}),KEYS);
 check("the 10 starter words are shown",JSON.stringify(after.names)===JSON.stringify([...starterNames()].sort())&&after.all===10,JSON.stringify(after.names));
 check("the device is marked as a new one (starter pack)",after.pack==="starter");
 check("everything the user changed is gone (words, edits, deleted/removed words, group, progress, settings)",after.left.length===0&&after.group===null&&after.muted===false,JSON.stringify(after.left));
 check("the Words tab lists exactly the 10 words",(await page.textContent("#awList")).includes("המילים במשחקים (10)"));
 await page.reload();
 check("it stays like that after another reload",(await page.evaluate(()=>[words.length,localStorage.getItem("wqPack")])).join()==="10,starter");
 check("no page errors",app.errors.length===0,app.errors.join("|"));
 await app.close();

 // someone who had the old 19 words also gets the 10 starter words
 const old=await openApp({pack:"raw",storage:{wqTab:"quiz"}});
 check("before: this user has the 19 old words",(await old.page.evaluate(()=>words.length))===19);
 await old.page.click("[data-tab=addwords]");
 old.page.once("dialog",d=>d.accept());
 await Promise.all([old.page.waitForEvent("load"),old.page.click("#awDefault")]);
 check("after: the same user gets the 10 starter words",(await old.page.evaluate(()=>[words.length,localStorage.getItem("wqPack")])).join()==="10,starter");
 check("no page errors (old user)",old.errors.length===0,old.errors.join("|"));
 await old.close(); done();
})();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /Users/yael_a/codeProjects/word-quest && node tests/back-to-default.test.js`
Expected: FAIL (`#awDefault` does not exist yet; the "before" check on the keys should already pass).

- [ ] **Step 3: `common.js` — the reset function**

Directly below the `deleteWord` function add:

```js
// "back to default": erase everything this app saved on this device (words you added, edits, deleted and removed words, group,
// progress, settings) and show the 10 starter words again, like a brand-new user. Only this device. Cannot be undone.
function resetToDefault(){
 try{ Object.keys(localStorage).filter(k=>k.startsWith("wq")).forEach(k=>localStorage.removeItem(k)); }catch(e){}
 store.set("wqPack","starter");   // the next load counts as a new device even if the app writes its own keys first
 location.reload();
}
```

- [ ] **Step 4: `addwords.js` — the box and the handler**

In `games.addwords.render`, change the last line of the template from `<div id="awList"></div>\`;` to (the box sits after `#awList`, so it is never redrawn):

```js
 <div id="awList"></div>
 <div class="resetbox"><h4>↩ חזרה לברירת מחדל</h4>
  <p class="tip">מוחק את כל מה ששמרת במכשיר הזה (מילים שהוספת, עריכות, מילים שמחקת או הסרת, הקבוצה, ההתקדמות וההגדרות) ומחזיר את 10 מילות ברירת המחדל. אי אפשר לבטל.</p>
  <button type="button" id="awDefault">↩ חזרה לברירת מחדל</button></div>`;
```

Right after the line `fillVoices(); markRate();` add:

```js
 $("awDefault").onclick=()=>{
  if(confirm("לחזור לברירת המחדל?\nזה ימחק הכל: מילים שהוספת, עריכות של משמעויות ומשפטים, מילים שמחקת או הסרת, הקבוצה, כל ההתקדמות וההגדרות (קול, מהירות, השתקה).\nיוצגו שוב רק 10 מילות ברירת המחדל. אי אפשר לבטל.")) resetToDefault();
 };
```

- [ ] **Step 5: CSS and README**

Append to `style.css`:

```css
/* back to default: a separate warning box at the bottom of the Words tab */
.resetbox{margin:22px 0 6px;padding:12px;border:2px dashed #f0b6bb;border-radius:14px;background:#fff6f7}.resetbox h4{margin:0 0 4px;font-size:15px;color:#9b2c36}.resetbox .tip{margin:4px 0 10px}
.resetbox button{display:block;width:100%;border:0;border-radius:12px;background:#f3c9ce;color:#9b2c36;font:inherit;font-weight:700;font-size:15px;padding:12px}
```

In `README.md`, after the bullet that starts with `- **מחיקה לצמיתות**`, add: `- **חזרה לברירת מחדל** — בתחתית לשונית מילים: אחרי אזהרה ואישור, מוחק את כל מה ששמרת במכשיר הזה (מילים שהוספת, עריכות, מילים שמחקת או הסרת, הקבוצה, ההתקדמות וההגדרות) ומציג שוב את 10 מילות ברירת המחדל. אי אפשר לבטל. הכפתור ״איפוס התקדמות״ הקיים מאפס רק את ההתקדמות.`

- [ ] **Step 6: Run all tests**

Run: `node --check common.js && node --check addwords.js && node tests/run.js`
Expected: `ALL TEST FILES PASS`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Back to default: erase everything saved on this device and show the 10 starter words again" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Version, visual check, push

- [ ] **Step 1: Bump the cache version**

Run `sed -i '' 's/?v=44/?v=45/g' index.html` and confirm with `grep -o "v=[0-9]*" index.html | sort -u` that only `v=45` remains.

- [ ] **Step 2: Visual check**

With a clean headless profile at 390px width, open the Words tab, scroll to the bottom and take a screenshot of the box. Confirm by eye that the warning box is clearly separate from the list, the text is readable, and the button is full width and does not overlap anything. Fix `style.css` only if something is wrong.

- [ ] **Step 3: Full suite, commit, push the branch (not `main`)**

```bash
node tests/run.js        # expected: ALL TEST FILES PASS
git add -A
git commit -m "Bump cache version for back-to-default" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
```

---

## Self-review (against the approved design)

- Button at the bottom of the Words tab, warning box, exact confirm text, cancel changes nothing → Task 1 (test checks the dialog text and cancel).
- Erases everything (all `wq*` keys: words you added, edits, deleted/removed words, group, progress, settings) and shows the 10 starter words, also for someone who had the old 19; stays after another reload → Task 1 test (both users, extra reload).
- Only this device, cannot be undone (stated in the text), existing "איפוס התקדמות" untouched → Global Constraints.
- Names used consistently: `resetToDefault`, `#awDefault`, `.resetbox`, `wqPack`.
