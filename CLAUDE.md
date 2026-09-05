# Posh-List — notes for future work

## Bulk item adds: one broadcast, one toast

When adding a feature that adds multiple items at once (e.g. "add the usuals", "add from a recipe"), do it as a single WS message handled in one loop server-side (`add_usuals`, `add_items` in `server/index.js`) that calls `addItem()` per item but only calls `broadcastState()` and `broadcast()` **once** at the end, with a single summarising `item_added` toast (`"N items from a recipe"`, matching `add_usuals`'s `"the usuals (N)"` pattern). Sending N separate `add_item` messages instead works, but floods everyone else connected to the room with N separate toasts for one action.

## Aisle categorization exists twice, on purpose

`client/src/lib/categorize.js` (browser) and `server/aisles.js`'s `guessAisleKey` (Node) are independent implementations of the same idea — a browser bundle and a Node server can't share a module without extra build tooling, and this app deliberately has none. Client-side code (anything under `client/src/`) should call `categorize()`; server-side code (anything handling a request with no client-computed `aisleKey`, like the external REST API) should call `guessAisleKey()`. Don't try to unify them — if you improve one heuristic, consider whether the same case should be added to the other, but keep them as separate files.

## Paste-a-recipe parsing is intentionally lossy

`client/src/lib/parseRecipeText.js` is a best-effort heuristic, not a real recipe parser — it looks for an "Ingredients" heading first (most real-world pastes have one), and only falls back to per-line guessing (skip the title, skip lines starting with a method-step verb, prefer lines starting with a quantity) when there's no heading at all. It will sometimes miss a line or include a false positive. That's fine by design: `PasteRecipe.jsx` always shows the result as an editable, checkable list before anything touches the real shopping list — don't try to make the parser perfect instead of trusting that review step.

## External API vs. native features

`POST /api/rooms/:slug/items` (documented in README.md) exists for callers with no WebSocket connection to the room — originally built for the (now-retired) Posh Nosh integration, but generically useful for any future external caller. A native, in-app feature (like "Add from a recipe") should use a WebSocket message instead (see `add_items` above), since it has an open connection already and can attribute the add to a real person (`addedBy`/`addedColor`) rather than `null`.
