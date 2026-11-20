# Word Quest — word categories, game scope, and "my group"

Branch: `word-groups` (merge to `main` only after the user approves).
UI strings are Hebrew (RTL); this spec is in English.

## Problems being fixed

1. Different games show different words for the same choice ("weak"). Causes: each game draws its own random words; games top up with non-weak words when the chosen set is too small; the crossword silently drops words it cannot place; and a word with 1 correct of 1 attempt counts as 100%, so it leaves "weak" after a single success.
2. Flashcards show a count (51) that does not match the Words tab (19): cards count removed words, and removed never-practiced words count as weak.
3. The Words tab uses two unrelated vocabularies (summary: with-percentage / learning / new; buttons: weak / strong) and the buttons do not match the games.
4. New feature: build one small named group of words and play exactly those words in every game.
5. Remove the A-Z button from the Words tab.

## 1. Categories (one definition, used everywhere)

`category(word)` in `common.js`, based on `wstat(word)`:

| Category | Hebrew | Rule |
|---|---|---|
| new | חדשות | never practiced (`n === 0`) |
| weak | חלשות | practiced, and not strong |
| strong | חזקות | `pct !== null` (10 attempts) and `pct >= 80` |

- Every active word is in exactly one category: new + weak + strong = number of active words.
- "Active" = not removed (✓). Removed words are in no category.
- A fourth scope value, `all`, means every active word. In the flashcards only, `all` means every word ever learned including removed ones, and its label says so, e.g. "הכל (51, מתוכן 32 שהוסרו)".
- The old `isWeak` (under 80% by raw rate) is deleted. Everything calls `category`.

## 2. Words tab

- Summary line uses the same names: "N חדשות · N חלשות · N חזקות".
- Filter row: **הכל (n) · חדשות (n) · חלשות (n) · חזקות (n) · 🎯 {group name} (n)** (the group chip only exists while a group exists). Each is a true filter; the count always equals the number of rows shown. A-Z is removed; the list is sorted alphabetically inside `הכל`, weakest-first inside weak, strongest-first inside strong.
- **Shared choice block** (new, at the top): checkbox "השתמש בבחירה אחת בכל המשחקים" + a selector (הכל / חדשות / חלשות / חזקות / group). Stored as `wqScopeShared` ("0"/"1") and `wqScopeSharedValue`.

## 3. Game scope

Every game has a selector at the top (replaces the current "all / weak" switch), next to the "?" button: הכל / חדשות / חלשות / חזקות / 🎯 {group name}, each with its count.

- **Shared choice off (default):** each game keeps its own choice (`wqScope_<game>`), as today.
- **Shared choice on:** every game uses `wqScopeSharedValue`; each game's selector is locked and shows "בחירה משותפת: חלשות (7) — לשינוי: לשונית מילים". Unticking restores each game's own choice.
- Counts shown in selectors are computed from the same pool the game uses (so they equal the Words tab).

### Which words a game gets (`poolFor(game)` / `pickSet`)

- Pool = active words of the chosen category, or the group's words, or all active words. Flashcards `all` = all words including removed.
- **No top-up.** A game plays only words from its pool. (The old fill-from-other-words behavior is deleted.)
- If the pool is bigger than the game's capacity (crossword ~9, word search 7), a weighted random subset is used and the game shows "9 מתוך 23".
- Quiz and hangman take the target word from the pool; quiz wrong options still come from all active words (4 options needed); the existing no-repeat rules stay.
- **Minimums (written in each game's "?" help and shown as a yellow hint above the game when not met):** crossword 4 words (5+ recommended: more crossings possible), word search 3. Quiz, hangman, cards: 1. Below the minimum the game shows the hint and the selector, not a game.
- **Words that do not fit:** the crossword retries generation many times to place every pool word (up to its capacity). Words that still do not fit, and word-search words longer than 10 letters, are listed under the game: "לא נכנסו הפעם: …". They are never replaced by other words.
- An empty pool shows "אין מילים בבחירה הזו" with the selector.

## 4. "My group"

One current group, stored on the device as `wqGroup = {name, words: [word names]}`.

- **Words tab section "🎯 הקבוצה שלי"** with a visible frame, the group name, count, and per-word progress.
- **Build / edit:** button "בניית קבוצה" →
  1. free-text **name** (required, trimmed, max 30 characters; suggested default "קבוצה 1");
  2. category (חדשות / חלשות / חזקות / הכל) and **how many** words; the app pre-selects that many (weakest first for weak, otherwise random);
  3. tick/untick words in the list of that category until right;
  4. save; minimum 4 words.
- **Separation in the list:** group words get a colored side stripe and 🎯; the group section is visually separate from the main list.
- **Finish:** "סיום קבוצה" clears it (stats and removed words untouched); words that became strong show ✓ in the group and the app suggests building the next one.
- A word removed with ✓ is dropped from the group. If the group has fewer than 4 words it still works in quiz, hangman and cards; crossword/word search show the minimum hint.
- Restoring an older choice: if the chosen scope is "group" and no group exists, the game falls back to `all`.

## Files

- `common.js`: `category`, scope helpers (`getScope`, shared logic, `poolFor`, `pickSet`), game bar selector, group storage.
- `crossword.js`, `wordsearch.js`, `hangman.js`, `quiz.js`, `cards.js`: use `pickSet`/`poolFor`; show subset/leftover/minimum messages; crossword retry to place all.
- `addwords.js`: filters with counts, summary line, shared-choice block, group section and builder.
- `style.css`, `index.html` (cache version), `README.md`.

## Testing

Headless Chromium at 390px with seeded `localStorage`:
- counts: new + weak + strong = active words; each filter count = rows shown; Words tab vs game selectors vs cards (`all` label) agree;
- for a pool of 7 weak words, crossword/word search/quiz/hangman/cards use exactly those 7 (no others); leftovers are listed when something does not fit;
- shared checkbox: locks and syncs all game selectors; unticking restores per-game choices;
- group: create with a free-text name, ≥4 enforced, appears in selectors and list with the stripe; "סיום קבוצה" clears it;
- minimum hints for crossword (4) and word search (3);
- no console errors.

## Out of scope

Several saved groups, renaming categories, changing the 80% / 10-attempt thresholds, auto-built groups.
