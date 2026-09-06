// The one hand-maintained offer this app shows — see README's
// "Deliberately not in this app". `endsAt` is the actual timestamp checked
// against the clock; `displayDates` is just the text shown alongside it,
// so update both together when the offer changes. There is exactly one
// copy of these facts — OfferBanner and the home screen's offer checker
// both import from here rather than holding their own.
export const OFFER = {
  id: 'tesco-wine-25-2026-08-24',
  retailer: 'TESCO',
  headline: '25% off 6+ wines',
  displayDates: 'until Mon 24 Aug',
  disclaimer: 'Clubcard price — scan your card at checkout. Excludes Scotland & NI.',
  endsAt: new Date('2026-08-25T00:00:00').getTime(),
};

export const SHOPS = [
  { name: 'Tesco', url: 'https://www.tesco.com/shop/en-GB/browse/drinks/wine/all' },
  { name: "Sainsbury's", url: 'https://www.sainsburys.co.uk/groceries/search?searchTerm=Wine' },
];

export function isOfferLive(now = Date.now()) {
  return now <= OFFER.endsAt;
}
