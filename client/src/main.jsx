import { createRoot } from 'react-dom/client';
import { RouterProvider } from './router.jsx';
import App from './App.jsx';
import './styles/tokens.css';

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
