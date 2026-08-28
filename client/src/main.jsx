import { createRoot } from 'react-dom/client';
import { RouterProvider } from './router.jsx';
import App from './App.jsx';
import './styles/tokens.css';

// One-time rename of this device's stored keys from the app's old name
// ("posh-shop:*") to the current one ("posh-list:*") so nobody who was
// already using it gets logged out of their list or re-shown a dismissed
// prompt. Safe to leave in place — it's a no-op once there are no old keys.
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const oldKey = localStorage.key(i);
    if (!oldKey || !oldKey.startsWith('posh-shop:')) continue;
    const newKey = `posh-list:${oldKey.slice('posh-shop:'.length)}`;
    if (localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, localStorage.getItem(oldKey));
    }
    localStorage.removeItem(oldKey);
  }
} catch {
  // localStorage unavailable (private mode etc.) — nothing to migrate.
}

createRoot(document.getElementById('root')).render(
  <RouterProvider>
    <App />
  </RouterProvider>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Installability is progressive enhancement — the app works fine
      // without a registered service worker.
    });
  });
}
