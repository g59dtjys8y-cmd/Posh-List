import { useEffect } from 'react';
import { useRouter, useNavigate, matchPath } from './router.jsx';
import { RoomProvider } from './RoomContext.jsx';
import { getVisitedRooms } from './lib/identity.js';
import BottomNav from './components/BottomNav.jsx';
import Home from './pages/Home.jsx';
import MyLists from './pages/MyLists.jsx';
import Recover from './pages/Recover.jsx';
import List from './pages/List.jsx';
import Share from './pages/Share.jsx';
import InShop from './pages/InShop.jsx';
import Usuals from './pages/Usuals.jsx';
import LoyaltyCards from './pages/LoyaltyCards.jsx';
import Layouts from './pages/Layouts.jsx';
import EditLayout from './pages/EditLayout.jsx';
import PasteRecipe from './pages/PasteRecipe.jsx';

// An installed PWA launches at "/" — this sends it straight to the list
// instead of making that the most expensive tap in the app (one more, in a
// shop, one-handed). A device with no list yet has nowhere to land but
// Home's own first-run branch, so it goes there instead.
function Launcher() {
  const navigate = useNavigate();
  useEffect(() => {
    const room = getVisitedRooms()[0];
    navigate(room ? `/r/${room.slug}` : '/home', { replace: true });
  }, [navigate]);
  return null;
}

const ROUTES = [
  { pattern: '/', render: () => <Launcher /> },
  { pattern: '/home', render: () => <Home /> },
  { pattern: '/lists', render: () => <MyLists /> },
  { pattern: '/recover', render: () => <Recover /> },
  { pattern: '/r/:slug', render: (p) => <List key={p.slug} /> },
  { pattern: '/r/:slug/share', render: (p) => <Share key={p.slug} /> },
  { pattern: '/r/:slug/shop', render: (p) => <InShop key={p.slug} /> },
  { pattern: '/r/:slug/usuals', render: (p) => <Usuals key={p.slug} /> },
  { pattern: '/r/:slug/loyalty-cards', render: (p) => <LoyaltyCards key={p.slug} /> },
  { pattern: '/r/:slug/layouts', render: (p) => <Layouts key={p.slug} /> },
  { pattern: '/r/:slug/paste-recipe', render: (p) => <PasteRecipe key={p.slug} /> },
  {
    pattern: '/r/:slug/layouts/:layoutId',
    render: (p) => <EditLayout key={`${p.slug}-${p.layoutId}`} layoutId={p.layoutId} />,
  },
];

export default function App() {
  const { path } = useRouter();

  // BottomNav reads the current room straight from RoomProvider's context
  // (useRoomOptional) when there is one, so it has to render *inside* the
  // provider on room pages — outside it, it can't see the slug until the
  // provider's own fetch has round-tripped and it has no reason to re-render
  // once that lands.
  let page = (
    <>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24 }}>Page not found</div>
        <a href="/" style={{ color: 'var(--on-brand-muted)', fontWeight: 600 }}>
          Back to Posh List
        </a>
      </div>
      <BottomNav />
    </>
  );

  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path);
    if (!params) continue;

    page = !params.slug ? (
      <>
        {route.render(params)}
        <BottomNav />
      </>
    ) : (
      // key by slug so switching rooms client-side (e.g. "start your own
      // list", or the "Your lists" picker) fully remounts the provider —
      // otherwise per-room identity state leaks from one room into the next.
      <RoomProvider key={params.slug} slug={params.slug}>
        {route.render(params)}
        <BottomNav />
      </RoomProvider>
    );
    break;
  }

  return page;
}
