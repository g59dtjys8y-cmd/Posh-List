import { useRouter, matchPath } from './router.jsx';
import { RoomProvider } from './RoomContext.jsx';
import Home from './pages/Home.jsx';
import MyLists from './pages/MyLists.jsx';
import List from './pages/List.jsx';
import Share from './pages/Share.jsx';
import InShop from './pages/InShop.jsx';
import Usuals from './pages/Usuals.jsx';
import Layouts from './pages/Layouts.jsx';
import EditLayout from './pages/EditLayout.jsx';

const ROUTES = [
  { pattern: '/', render: () => <Home /> },
  { pattern: '/lists', render: () => <MyLists /> },
  { pattern: '/r/:slug', render: (p) => <List key={p.slug} /> },
  { pattern: '/r/:slug/share', render: (p) => <Share key={p.slug} /> },
  { pattern: '/r/:slug/shop', render: (p) => <InShop key={p.slug} /> },
  { pattern: '/r/:slug/usuals', render: (p) => <Usuals key={p.slug} /> },
  { pattern: '/r/:slug/layouts', render: (p) => <Layouts key={p.slug} /> },
  {
    pattern: '/r/:slug/layouts/:layoutId',
    render: (p) => <EditLayout key={`${p.slug}-${p.layoutId}`} layoutId={p.layoutId} />,
  },
];

export default function App() {
  const { path } = useRouter();

  for (const route of ROUTES) {
    const params = matchPath(route.pattern, path);
    if (!params) continue;

    if (!params.slug) return route.render(params);

    return <RoomProvider slug={params.slug}>{route.render(params)}</RoomProvider>;
  }

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24 }}>Page not found</div>
      <a href="/" style={{ color: 'var(--on-brand-muted)', fontWeight: 600 }}>
        Back to Posh List
      </a>
    </div>
  );
}
