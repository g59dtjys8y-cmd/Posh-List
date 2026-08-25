# Prompt for Claude Design

Paste everything below the line.

---

Design the mobile screens for **Posh Shop**, a shared household shopping list app. It's for
one UK family, not a product — so it has to be obvious enough that someone who's never seen
it can use it on the first try, with no onboarding and no account.

**The core idea:** one person installs it. Everyone else opens a link and is straight onto
the live list. No sign-up, no password.

## Screens

1. **Your lists.** The first thing you see. Cards for each list, with the main **Shopping**
   list pinned at the top in the highlight colour — it can't be deleted or reordered. Other
   lists (Christmas, DIY) are ordinary cards that swipe to reveal a delete action, with a
   line explaining they're recoverable for 30 days. A dashed "New list" tile at the bottom.
2. **The list.** Items grouped by supermarket aisle, in the order you actually walk the
   shop. Each department has a coloured rail down the left. Every item shows a small dot
   in the colour of whoever added it. Live presence line at the top ("Kate's on the list
   now") with overlapping avatars. Add field and a voice button pinned to the bottom.
3. **Share.** The most important screen. A share link, a copy button, a QR code option,
   and a list of who's currently on it. Must feel like it takes five seconds.
4. **In the shop.** One-handed mode. Bigger tap targets, aisle order, a progress bar
   ("8 of 13 in the trolley", "2 aisles left"), and a toast when someone at home adds
   something while you're there.
5. **Offer banner.** A dismissible strip above the list: "Tesco — 25% off 6+ wines until
   Mon 24 Aug". Needs a Clubcard caveat in smaller text.

## Palette — use these exactly

- Background / brand: `#FFD400` sunshine yellow
- Text on background: `#14171C`, muted `#6A5200`
- Highlight ticket: `#FF2E7E` with white text
- List surface: white, text `#14171C`, muted `#5C646E`, hairlines `#EDEFF2`
- Aisle rails: fruit & veg `#57C000`, bakery `#FF9E00`, meat & fish `#FF2E7E`,
  chilled `#0AA3FF`, frozen `#00CDDC`, cupboard `#8A6A3F`, household `#8B3DFF`
- Person colours: `#0A6CFF` and `#FF2E7E`

Push the bakery amber further towards orange — it currently sits too close to the yellow
background to read as a distinct department.

## Rules

- **The list surface stays white with near-black text.** Bright chrome is fine; the list
  itself gets read under supermarket strip lighting with one hand on a trolley.
- **The seven aisle colours must stay distinguishable from each other at a glance.** They
  encode which part of the shop you're in — they aren't decoration.
- The brand runs dark-on-light. Keep that consistent anywhere the brand colour appears.
- Signature device is a supermarket **shelf-edge price ticket** — use it for the one thing
  per screen that matters most, and nowhere else.
- Type should be confident and slightly characterful, not a neutral system sans. Pair a
  display face with a plain body face, plus a mono for quantities and counts.

## Copy

Plain and active. Buttons say what happens: "Send link", not "Submit". Empty states invite
an action rather than apologise. British English — shopping list, not grocery list.

## Deliberately not in this app

Accounts and profiles, prices or spend tracking, meal planning, chores, calendars, ads.
Don't design space for them.

## Deliver

Mobile frames at 390×844 for the five screens, plus a token sheet showing the colours,
type scale and the aisle colour set.
