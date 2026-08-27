// The device's chosen nickname. Prompted once on first join, then reused for
// every list this device redeems.
const NICK_KEY = "posh-shop-nickname";

export function getNickname(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NICK_KEY);
}

export function setNickname(name: string): void {
  window.localStorage.setItem(NICK_KEY, name.trim());
}

// Lists this device has visited, most recent first. The share token is the only
// way back into a list, so we keep it here rather than relying on server reads.
const LISTS_KEY = "posh-shop-lists";

export type VisitedList = { id: string; token: string; name: string };

export function getVisitedLists(): VisitedList[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LISTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function rememberList(entry: VisitedList): void {
  const rest = getVisitedLists().filter((l) => l.id !== entry.id);
  window.localStorage.setItem(LISTS_KEY, JSON.stringify([entry, ...rest]));
}
