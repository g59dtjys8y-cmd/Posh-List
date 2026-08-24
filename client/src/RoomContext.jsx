import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { fetchRoom } from './lib/api.js';
import { getIdentity, saveIdentity, newPersonId, setLastRoomSlug } from './lib/identity.js';

const RoomContext = createContext(null);

function wsUrlFor(slug, identity) {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const params = new URLSearchParams({ room: slug });
  if (identity) {
    params.set('personId', identity.id);
    params.set('name', identity.name);
  }
  return `${proto}://${window.location.host}/ws?${params.toString()}`;
}

export function RoomProvider({ slug, children }) {
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [identity, setIdentity] = useState(() => getIdentity(slug));
  const [toasts, setToasts] = useState([]);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempt = useRef(0);
  const identityRef = useRef(identity);
  identityRef.current = identity;

  // Instant paint: fetch current state over REST while the socket connects
  // — a newcomer sees the live list immediately, no waiting on a handshake.
  useEffect(() => {
    let cancelled = false;
    setRoom(null);
    fetchRoom(slug).then((r) => {
      if (cancelled) return;
      setRoom(r);
      // Remember this as "the" list so opening the app fresh (home screen
      // icon, bare domain, an old browser bookmark) comes straight back
      // here instead of spinning up a new, empty list.
      if (r) setLastRoomSlug(slug);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(wsUrlFor(slug, identityRef.current));
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === 'state') {
          setRoom(msg.room);
        } else if (msg.type === 'item_added') {
          if (msg.fromPersonId && msg.fromPersonId === identityRef.current?.id) return;
          const id = `${Date.now()}-${Math.random()}`;
          setToasts((t) => [
            ...t,
            {
              id,
              text: `${msg.addedByName || 'Someone'} added ${msg.item.name}`,
              aisleKey: msg.item.aisleKey,
            },
          ]);
          setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 8000);
        reconnectAttempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();
    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [slug]);

  const send = useCallback((message) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, []);

  const setName = useCallback(
    (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = identityRef.current?.id || newPersonId();
      const next = { id, name: trimmed };
      saveIdentity(slug, next);
      setIdentity(next);
      send({ type: 'identify', personId: id, name: trimmed });
    },
    [slug, send]
  );

  // Home-screen badge: reflect how many things are still unticked.
  useEffect(() => {
    if (!room) return;
    const unticked = room.items.filter((i) => !i.done).length;
    try {
      if ('setAppBadge' in navigator) {
        if (unticked > 0) navigator.setAppBadge(unticked).catch(() => {});
        else navigator.clearAppBadge?.().catch(() => {});
      }
    } catch {
      // Badging API not supported here — progressive enhancement, no-op.
    }
  }, [room]);

  const dismissToast = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const activeLayout = useMemo(() => {
    if (!room) return null;
    return room.aisleLayouts.find((l) => l.id === room.activeLayoutId) || room.aisleLayouts[0];
  }, [room]);

  const value = useMemo(
    () => ({
      slug,
      room,
      connected,
      identity,
      setName,
      send,
      toasts,
      dismissToast,
      activeLayout,
    }),
    [slug, room, connected, identity, setName, send, toasts, dismissToast, activeLayout]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
