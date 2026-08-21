// A minimal client-side router — react-router-dom isn't installable in this
// sandbox (no npm registry access, see the project report), so this is a
// small hand-rolled stand-in covering just what the app needs: pushState
// navigation, back/forward support, and ":param" path matching.
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

const RouterContext = createContext(null);

export function RouterProvider({ children }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (replace) window.history.replaceState({}, '', to);
    else window.history.pushState({}, '', to);
    setPath(window.location.pathname);
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider');
  return ctx;
}

export function useNavigate() {
  return useRouter().navigate;
}

/** Match `pathname` against a "/r/:slug/share" style pattern. */
export function matchPath(pattern, pathname) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (p !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/** Link component using pushState instead of a full page load. */
export function Link({ to, children, className, style, onClick, ...rest }) {
  const navigate = useNavigate();
  return (
    <a
      href={to}
      className={className}
      style={style}
      onClick={(e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.(e);
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
