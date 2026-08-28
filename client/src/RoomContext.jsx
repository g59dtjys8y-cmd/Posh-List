import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { fetchRoom } from './lib/api.js';
import { getIdentity, saveIdentity, newPersonId, rememberVisitedRoom } from './lib/identity.js';

const RoomContext = createContext(null);

// Send a heartbeat well under any reverse-proxy idle-connection timeout
// (Render's included) so a quiet room's socket doesn't get silently
// dropped between actions. The server already answers {type:'ping'} with
// {type:'pong'} — this is what actually calls it.
const HEARTBEAT_INTERVAL_MS = 25_000;

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
  const [aliasResult, setAliasResult] = useState(null);
  const [knownItems, setKnownItems] = useState(null);
  const [shoppingNotice, setShoppingNotice] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempt = useRef(0);
  const heartbeatTimer = useRef(null);
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
      // Remember this as one of "your lists" so opening the app fresh
      // (home screen icon, bare domain, an old browser bookmark) can
      // return to it, and so the "My lists" menu can show every list this
      // device has been part of, not just the very last one.
      if (r) rememberVisitedRoom(slug, r.name);
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
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
        }, HEARTBEAT_INTERVAL_MS);
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
          // Drop the "someone's shopping" nudge once that person has left
          // the shop screen (or nobody's shopping any more).
          setShoppingNotice((n) =>
            n && (msg.room.shopping || []).includes(n.personId) ? n : null
          );
        } else if (msg.type === 'shopping_started') {
          if (msg.personId === identityRef.current?.id) return;
          setShoppingNotice({ personId: msg.personId, name: msg.name || 'Someone' });
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
        } else if (msg.type === 'alias_result') {
          setAliasResult(msg);
        } else if (msg.type === 'known_items') {
          setKnownItems(msg.items);
        }
      };

      ws.onclose = () => {
        clearInterval(heartbeatTimer.current);
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
      clearInterval(heartbeatTimer.current);
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

  const clearAliasResult = useCallback(() => setAliasResult(null), []);

  const requestKnownItems = useCallback(() => {
    send({ type: 'request_known_items' });
  }, [send]);

  const dismissShoppingNotice = useCallback(() => setShoppingNotice(null), []);

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
      aliasResult,
      clearAliasResult,
      knownItems,
      requestKnownItems,
      shoppingNotice,
      dismissShoppingNotice,
    }),
    [slug, room, connected, identity, setName, send, toasts, dismissToast, activeLayout, aliasResult, clearAliasResult, knownItems, requestKnownItems, shoppingNotice, dismissShoppingNotice]
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoom must be used inside RoomProvider');
  return ctx;
}
