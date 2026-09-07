// A device's own editable shortlist of one-tap "add to today's list"
// buttons on Home — not tied to any particular room, just the household's
// usual few things that are worth a single tap instead of typing them out.
const KEY = 'posh-list:quick-add';
const MAX_ITEMS = 12;

export const DEFAULT_QUICK_ADD_ITEMS = ['Wine', 'Bread', 'Milk', 'Tomatoes', 'Chicken'];

export function getQuickAddItems() {
  try {
    const raw = localStorage.getItem(KEY);
    // No stored value at all (never customised) is the only case that
    // falls back to the defaults — an intentional "remove everything"
    // edit stores an empty array and stays empty.
    if (raw == null) return DEFAULT_QUICK_ADD_ITEMS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_QUICK_ADD_ITEMS;
    return parsed.filter((s) => typeof s === 'string' && s.trim()).slice(0, MAX_ITEMS);
  } catch {
    return DEFAULT_QUICK_ADD_ITEMS;
  }
}

export function saveQuickAddItems(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage unavailable — edits just won't persist across reloads.
  }
}
