# Word Quest — group UX: two-column builder and slim progress card

Branch: `group-ux` (merge to `main` only after the user approves).
Builds on `2026-11-20-word-groups-design.md` (categories, scopes, one named group, minimum 4). Those rules are unchanged.
UI strings are Hebrew (RTL); this spec is in English.

## Problems being fixed

1. **Building** a group means ticking words in one long list; the chosen words are mixed in with the rest and hard to see.
2. **Seeing** the group takes too much room in the Words tab, and progress is hard to read at a glance.
3. Unclear what happens to a word taken out of a group (swapped for another vs. finished learning).

## 1. Builder: two columns (replaces the ticking list)

Opens from "בניית קבוצה" / "✏️ עריכת הקבוצה" inside the collapsible group box (`#grpBox`, as today). Fields, top to bottom:

1. **Name** (`#gbName`, free text, required, max 30, default "קבוצה 1" — unchanged).
2. **Search** (`#gbSearch`): filters the *left* column by English or Hebrew text (case-insensitive substring).
3. **Category** select (`#gbCat`: הכל / חדשות / חלשות / חזקות): narrows the *left* column. Default הכל.
4. **Quick buttons:** "הוספת הכל מהרשימה" (moves every word currently shown in the left column to the right) and "ניקוי הבחירה" (moves every chosen word back).
5. **Minimum bar** (`#gbSum`, as today): "⚠️ נבחרו N מילים. צריך לפחות 4 מילים בקבוצה." below the minimum, "✓ נבחרו N מילים." at or above it; "מינימום 4; אפשר לסמן כמה שרוצים" always written; no upper limit.
6. **Two columns** (a grid; the page is RTL so the first column sits on the right):
   - **Right: "✓ נבחרו (n)"** — all chosen words, always visible regardless of search/category.
   - **Left: "לא נבחרו (n)"** — active (not removed) words that are not chosen, narrowed by search + category.
   - Each column scrolls on its own (`max-height` about 320px). Both are sorted A-Z (`localeCompare`), so a word returns to the place it came from.
   - A word card shows the English word (bold, LTR) and the Hebrew meaning (small, may wrap to two lines). Cards in the left column carry a small arrow pointing toward the chosen column.
7. **Save / Cancel** (`#gbSave`, `#gbCancel`): save validates the name (toast "צריך לתת שם לקבוצה") and the minimum (toast "צריך לבחור לפחות 4 מילים"), then stores `wqGroup` exactly as today.

### Moving words

- **One tap on a word card** moves it to the other column (chosen ↔ not chosen). No dragging.
- **No redraw while moving.** The card element itself is moved in the DOM to its A-Z position in the other column; only the two counters and `#gbSum` are updated. The scroll positions of both columns and of the page do not change (this is the earlier "list jumps to the top" bug; the test must check it).
- The moved card flashes briefly (green outline, about 600 ms).
- A toast "‹word› נוספה לקבוצה · ביטול" / "‹word› הוסרה מהקבוצה · ביטול" appears for about 4 seconds. "ביטול" reverses the last move or the last bulk action (a snapshot of the previous selection is kept; one level).
- Changing search or category redraws **only the left column** (the right column and its scroll stay).
- Editing an existing group opens the same builder with the right column pre-filled (`cat` = הכל).
- Moving a word to the left only returns it to the pool; its category is unchanged (derived from its progress). It does **not** mark it as learned.

### Removed from the old builder

The checkbox list (`data-gbpick`, `.gbl`), the "N words are from other categories" note and the category-keeps-picks logic (both columns are always visible, so they are no longer needed).

## 2. Group card (replaces the group section)

A single collapsible card (`<details id="grpBox">`), **collapsed by default** (`wqGrpOpen` default "0"; the saved choice is still remembered, and building/editing still forces it open).

**Collapsed** (about the height of the other collapsible sections):
- title: `🎯 <name>` and `N מילים · S חזקות`;
- a segmented **progress bar** (green = strong, yellow = weak, grey = new; segment widths = share of the group's words in each category);
- a legend line: `חזקות S · חלשות W · חדשות N`.

**Expanded** (tap the card to open, tap again to close):
- every group word with the existing progress details (`statLine`: last-10 dots, percentage or "בלמידה n/10", successes / mistakes / hints), a "✓ חזקה" mark for strong words;
- on each word a **"✓ סיימתי ללמוד"** button: the word leaves the group **and** moves to the removed/done words list (the existing `hideWord` mechanism, restorable from "מילים שהוסרו"); this respects the existing minimum of active words (`MIN_WORDS`, toast if refused);
- buttons "✏️ עריכת הקבוצה" and "סיום קבוצה" (as today);
- 🎉 "כל המילים בקבוצה חזקות! אפשר לסיים ולבנות קבוצה חדשה." when every word is strong.

Empty state (no group) is unchanged: the "בניית קבוצה" button and its tip.

## Unchanged

Categories and their rule, game selectors and the shared-choice checkbox, game word pools (including the crossword/word search minimums), the 🎯 marker and side stripe in the main list, the group minimum of 4 and the free-text name, removal from a group when a word is removed with ✓ elsewhere, the games' behavior when a group has fewer than 4 words.

## Files

- `addwords.js`: replace `builderHTML`, `builderSumHTML`, `groupChange`/`groupClick` builder parts and the group section with the two-column builder and the card.
- `style.css`: two-column grid, word cards, flash animation, toast, progress bar and legend, card summary.
- `tests/group.test.js` (update) and `tests/group-ux.test.js` (new).
- `README.md`, cache version in `index.html`.

## Testing

Headless Chromium at 390px with seeded `localStorage`:
- builder opens with two columns, counts add up (right + left = active words when no filter);
- one tap moves a word across; counts and `#gbSum` update; the word lands in A-Z order; tapping it again returns it; undo reverses a move and a bulk action;
- **scroll position of the left column and the page is identical before and after a tap lower in the list**;
- search narrows only the left column; category narrows only the left column; the right column is unaffected;
- "הוספת הכל מהרשימה" moves exactly the shown words; "ניקוי הבחירה" returns all;
- minimum bar warning below 4, save rejected with the message, save accepted at 4+; name required; edit mode pre-fills the right column;
- card: collapsed by default, shows name, counts, bar widths matching the category counts, legend; tap expands and shows each word's progress details; state remembered; collapses again;
- "✓ סיימתי ללמוד" removes the word from the group and puts it in "מילים שהוסרו"; restoring it does not re-add it to the group; refused (toast) when it would go below `MIN_WORDS`;
- full existing suite (`node tests/run.js`) still passes; no console errors.

## Out of scope

Dragging, several saved groups, group history/statistics, changing the category rules.
