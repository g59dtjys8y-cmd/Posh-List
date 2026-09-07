import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from './wsServer.js';
import {
  createRoom,
  getRoom,
  resolveSlug,
  setAlias,
  renameRoom,
  setOfferWhoHas,
  setItemNote,
  setActiveLayout,
  addLayout,
  updateLayout,
  deleteLayout,
  addItem,
  addItems,
  incrementOrAddItem,
  setItemDone,
  deleteItem,
  clearDoneItems,
  addRegularsToList,
  setRegularOverride,
  getKnownItems,
  upsertPerson,
  touchPerson,
  saveSubscription,
  addLoyaltyCard,
  updateLoyaltyCard,
  deleteLoyaltyCard,
  getLoyaltyCardPhoto,
} from './db.js';
import { isValidAisleKey, isValidLayoutOrder, guessAisleKey } from './aisles.js';
import { notifyItemsAdded } from './push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8787;
const PUBLIC_DIR = path.join(__dirname, '..', 'client', 'public');

// ---------------------------------------------------------------------------
// Live presence + broadcast bookkeeping, keyed by room slug.
// ---------------------------------------------------------------------------
const roomSockets = new Map(); // slug -> Set<WSConnection>
const roomPersonCounts = new Map(); // slug -> Map<personId, openSocketCount>
const roomShopping = new Map(); // slug -> Map<personId, openShopScreenCount>
const lastShoppingBroadcast = new Map(); // slug -> ts (debounces the "X is shopping" nudge)

const SHOPPING_NUDGE_DEBOUNCE_MS = 5 * 60_000;

function socketsFor(slug) {
  if (!roomSockets.has(slug)) roomSockets.set(slug, new Set());
  return roomSockets.get(slug);
}
function personCountsFor(slug) {
  if (!roomPersonCounts.has(slug)) roomPersonCounts.set(slug, new Map());
  return roomPersonCounts.get(slug);
}
function connectedPersonIds(slug) {
  return new Set([...personCountsFor(slug).entries()].filter(([, n]) => n > 0).map(([id]) => id));
}
function shoppingFor(slug) {
  if (!roomShopping.has(slug)) roomShopping.set(slug, new Map());
  return roomShopping.get(slug);
}
function shoppingPersonIds(slug) {
  return [...shoppingFor(slug).entries()].filter(([, n]) => n > 0).map(([id]) => id);
}
function roomStateWithPresence(slug) {
  const room = getRoom(slug);
  if (!room) return null;
  const connected = connectedPersonIds(slug);
  room.people = room.people.map((p) => ({ ...p, connected: connected.has(p.id) }));
  room.shopping = shoppingPersonIds(slug);
  return room;
}
function broadcast(slug, message) {
  const payload = JSON.stringify(message);
  for (const ws of socketsFor(slug)) {
    if (ws.readyState === 'open') ws.send(payload);
  }
}
function broadcastState(slug) {
  const room = roomStateWithPresence(slug);
  if (room) broadcast(slug, { type: 'state', room });
}

// The one place every "items were added" event flows through — five call
// sites emit this (two REST, three WS), and every one of them routes
// through here instead of broadcasting + pushing individually, so a bulk
// add can never fan out into one push per item. `item` is whatever summary
// object that call site already built for the WS toast (unchanged from
// before); `names` is every item name in this batch and is what the push
// notification actually uses — always a full batch, never called per item.
function broadcastItemsAdded(slug, { item, names, addedByName, fromPersonId }) {
  if (!names?.length) return;
  broadcastState(slug);
  broadcast(slug, { type: 'item_added', item, addedByName, fromPersonId });
  notifyItemsAdded(slug, { names, addedByName, fromPersonId }).catch(() => {
    // notifyItemsAdded already swallows per-subscriber failures — this
    // only catches something going wrong before it even gets that far.
  });
}

// ---------------------------------------------------------------------------
// Tiny helpers standing in for express: JSON body parsing + static files.
// ---------------------------------------------------------------------------

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// CORS is open on the API: rooms are only as secret as their slug (same
// trust model as the app's own share links), there's no auth to leak, and
// this is what lets an external app like Posh Nosh add items to a list
// someone pastes a link for, from a different origin.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// The client resizes/compresses to a canvas data URL before sending —
// "data:image/jpeg;base64,...." — decode it back to raw bytes here. Returns
// null for anything malformed or an unrecognised image type rather than
// throwing, since this only ever comes from a WS message the client fully
// controls the shape of.
function parseImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return null;
  const [, type, base64] = match;
  if (!ALLOWED_PHOTO_TYPES.has(type)) return null;
  try {
    return { type, buffer: Buffer.from(base64, 'base64') };
  } catch {
    return null;
  }
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...CORS_HEADERS,
    ...extraHeaders,
  });
  res.end(payload);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // SPA fallback: any non-file, non-API, non-asset route serves index.html
  // so client-side routes like /r/8fk3q2/share survive a hard refresh.
  const hasExt = path.extname(safePath) !== '';
  if (!hasExt) filePath = path.join(PUBLIC_DIR, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (hasExt) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, fallback) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(fallback);
      });
      return;
    }
    const ext = path.extname(filePath);
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // The JS bundle changes constantly in dev — never let the browser cache it.
    if (ext === '.js' || ext === '.html') headers['Cache-Control'] = 'no-store';
    res.writeHead(200, headers);
    res.end(data);
  });
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

async function handleApi(req, res, url) {
  const { pathname } = url;

  if (pathname === '/api/rooms' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const layoutOrder = isValidLayoutOrder(body.layoutOrder) ? body.layoutOrder : null;
    const room = createRoom(String(body.name || 'Shopping list').slice(0, 80), layoutOrder);
    if (body.from) {
      // Conversion signal only — no FK, the source room isn't touched.
      console.log(`room ${room.slug} started from ${String(body.from).slice(0, 40)}`);
    }
    return sendJson(res, 201, { slug: room.slug });
  }

  const roomMatch = pathname.match(/^\/api\/rooms\/([a-z0-9-]+)$/);
  if (roomMatch && req.method === 'GET') {
    // Accepts either a room's real slug or a friendly alias someone set
    // for it — both resolve to the same underlying list.
    const slug = resolveSlug(roomMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    return sendJson(res, 200, roomStateWithPresence(slug));
  }

  const identifyMatch = pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/identify$/);
  if (identifyMatch && req.method === 'POST') {
    const slug = resolveSlug(identifyMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    const body = await readJsonBody(req);
    if (!body.name && !body.id) return sendJson(res, 400, { error: 'name required' });
    const person = upsertPerson(slug, {
      id: body.id,
      name: body.name ? String(body.name).slice(0, 40) : undefined,
    });
    return sendJson(res, 200, person);
  }

  // Renaming from a screen with no live WS connection to this room (My
  // lists manages every room this device knows about, not just the one
  // that's currently open) — same effect as the `rename_room` WS message,
  // just reachable without opening the list first.
  const renameMatch = pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/rename$/);
  if (renameMatch && req.method === 'POST') {
    const slug = resolveSlug(renameMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    const body = await readJsonBody(req);
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) return sendJson(res, 400, { error: 'name required' });
    renameRoom(slug, name);
    broadcastState(slug);
    return sendJson(res, 200, { name });
  }

  // Bulk item add for external callers (e.g. Posh Nosh's "add to shopping
  // list" import) that have no WebSocket connection to this room — reuses
  // the exact same addItem + broadcast path a live `add_item` WS message
  // takes, so anyone with the list open sees the items appear immediately.
  const itemsMatch = pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/items$/);
  if (itemsMatch && req.method === 'POST') {
    const slug = resolveSlug(itemsMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    const body = await readJsonBody(req);
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
    const source = typeof body.source === 'string' ? body.source.trim().slice(0, 40) : null;

    const items = rawItems
      .map((raw) => {
        const name = String(raw?.name || '').trim().slice(0, 120);
        if (!name) return null;
        const aisleKey = isValidAisleKey(raw?.aisleKey) ? raw.aisleKey : guessAisleKey(name);
        const qty = Number.isFinite(raw?.qty) && raw.qty > 0 ? Math.floor(raw.qty) : 1;
        return { name, qty, aisleKey };
      })
      .filter(Boolean);
    const added = addItems(slug, items, { addedBy: null, addedColor: null });

    if (added.length) {
      broadcastItemsAdded(slug, {
        item: added.length === 1
          ? { name: added[0].name, aisleKey: added[0].aisleKey }
          : { name: `${added.length} items from a recipe`, aisleKey: 'cupboard' },
        names: added.map((a) => a.name),
        addedByName: source || 'Posh Nosh',
        fromPersonId: null,
      });
    }

    return sendJson(res, 201, { added });
  }

  // Home's quick-add row — a single named item, one tap. Unlike the bulk
  // endpoint above, a repeat of the same name bumps its quantity instead
  // of adding another line; that's the whole point of a one-tap shortcut,
  // and not something the recipe-import path above should also do (an
  // imported recipe's ingredient list is exact, not a running tally).
  const quickAddMatch = pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/quick-add$/);
  if (quickAddMatch && req.method === 'POST') {
    const slug = resolveSlug(quickAddMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    const body = await readJsonBody(req);
    const name = String(body.name || '').trim().slice(0, 120);
    if (!name) return sendJson(res, 400, { error: 'name required' });
    const source = typeof body.source === 'string' ? body.source.trim().slice(0, 40) : null;

    const result = incrementOrAddItem(slug, { name, aisleKey: guessAisleKey(name) });

    broadcastItemsAdded(slug, {
      item: { id: result.id, name: result.name, qty: result.qty, aisleKey: result.aisleKey },
      names: [result.name],
      addedByName: source || 'Quick add',
      fromPersonId: null,
    });

    return sendJson(res, 201, result);
  }

  // A browser's push subscription for this room, plus whichever person id
  // this device is currently using in it — nullable, since a subscription
  // can be made before a name's been set (identify happens over WS, not
  // necessarily before this).
  const pushSubscribeMatch = pathname.match(/^\/api\/rooms\/([a-z0-9-]+)\/push-subscribe$/);
  if (pushSubscribeMatch && req.method === 'POST') {
    const slug = resolveSlug(pushSubscribeMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    const body = await readJsonBody(req);
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null;
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;
    if (!endpoint || !p256dh || !auth) return sendJson(res, 400, { error: 'invalid subscription' });
    saveSubscription(slug, {
      endpoint,
      personId: typeof body.personId === 'string' ? body.personId : null,
      p256dh,
      auth,
    });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/push/public-key' && req.method === 'GET') {
    return sendJson(res, 200, { key: process.env.VAPID_PUBLIC_KEY || null });
  }

  // Serves a loyalty card's photo as an actual image response (not JSON) so
  // it can be used directly as an <img src> — mutating a card still goes
  // over the room's WS connection like layouts do, this is read-only.
  const loyaltyPhotoMatch = pathname.match(
    /^\/api\/rooms\/([a-z0-9-]+)\/loyalty-cards\/([a-z0-9_-]+)\/photo$/i
  );
  if (loyaltyPhotoMatch && req.method === 'GET') {
    const slug = resolveSlug(loyaltyPhotoMatch[1]);
    if (!slug) return sendJson(res, 404, { error: 'Room not found' });
    const photo = getLoyaltyCardPhoto(slug, loyaltyPhotoMatch[2]);
    if (!photo) return sendJson(res, 404, { error: 'Photo not found' });
    res.writeHead(200, {
      'Content-Type': photo.type,
      'Content-Length': photo.data.length,
      // No caching: a card's photo can be replaced in an edit without its
      // id (and so this URL) changing, and there's no ETag/version to
      // revalidate against — always refetching is cheap for an
      // already-compressed thumbnail-sized image.
      'Cache-Control': 'no-store',
      ...CORS_HEADERS,
    });
    return res.end(photo.data);
  }

  sendJson(res, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------------------
// Rate limiting — a fixed-window hit counter per client key. `POST
// /api/rooms` gets its own tighter window (it's the one route that costs
// disk space forever, on a 1GB plan); everything else under /api/ shares a
// looser general one. Swept periodically so a Map entry from a client that
// never comes back doesn't sit in memory indefinitely.
// ---------------------------------------------------------------------------

const RATE_LIMITS = {
  createRoom: { windowMs: 60 * 60_000, max: 10 },
  api: { windowMs: 60_000, max: 120 },
};

// key -> { createRoom: [timestamps], api: [timestamps] }
const rateBuckets = new Map();

function clientKey(req) {
  // Render sits behind a proxy — the real client is the first hop in
  // X-Forwarded-For when present; the raw socket address otherwise (local
  // dev, or any direct connection).
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

/** Records a hit for `bucket` under `key` and reports whether it's allowed. */
function checkRateLimit(key, bucket, { windowMs, max }) {
  const now = Date.now();
  const buckets = rateBuckets.get(key) || {};
  const hits = (buckets[bucket] || []).filter((ts) => now - ts < windowMs);

  if (hits.length >= max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  hits.push(now);
  buckets[bucket] = hits;
  rateBuckets.set(key, buckets);
  return { allowed: true };
}

const SWEEP_INTERVAL_MS = 10 * 60_000;
setInterval(() => {
  const now = Date.now();
  const maxWindow = Math.max(RATE_LIMITS.createRoom.windowMs, RATE_LIMITS.api.windowMs);
  for (const [key, buckets] of rateBuckets) {
    const stillFresh = Object.values(buckets).some((hits) => hits.some((ts) => now - ts < maxWindow));
    if (!stillFresh) rateBuckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const isCreateRoom = url.pathname === '/api/rooms' && req.method === 'POST';
    const bucket = isCreateRoom ? 'createRoom' : 'api';
    const { allowed, retryAfterSeconds } = checkRateLimit(clientKey(req), bucket, RATE_LIMITS[bucket]);
    if (!allowed) {
      sendJson(res, 429, { error: 'Too many requests' }, { 'Retry-After': String(retryAfterSeconds) });
      return;
    }

    handleApi(req, res, url).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('API error', err);
      sendJson(res, 500, { error: 'Internal error' });
    });
    return;
  }
  serveStatic(req, res, url.pathname);
});

// ---------------------------------------------------------------------------
// WebSocket realtime sync
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const requestedRoom = url.searchParams.get('room');
  const personId = url.searchParams.get('personId');
  const name = url.searchParams.get('name');

  // The URL the browser is on may be a friendly alias rather than the
  // room's real slug — resolve once here so everything below (and every
  // handleMessage call for this connection) works with the one true slug.
  const slug = requestedRoom ? resolveSlug(requestedRoom) : null;

  if (!slug) {
    ws.close(4004, 'Room not found');
    return;
  }

  ws.slug = slug;
  ws.personId = personId || null;
  socketsFor(slug).add(ws);

  if (personId) {
    try {
      upsertPerson(slug, { id: personId, name: name || undefined });
    } catch (err) {
      // A stale client could hand us a personId that already belongs to a
      // different room. Don't let that take the whole server down — just
      // treat this socket as not-yet-identified; the client re-identifies
      // over the 'identify' message once it has a name for this room.
      console.error('connection upsertPerson failed', err);
      ws.personId = null;
    }
    if (ws.personId) {
      const counts = personCountsFor(slug);
      counts.set(personId, (counts.get(personId) || 0) + 1);
    }
  }

  ws.send(JSON.stringify({ type: 'state', room: roomStateWithPresence(slug) }));
  broadcastState(slug);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    try {
      handleMessage(ws, slug, msg);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('WS message error', err);
    }
  });

  ws.on('close', () => {
    const sockets = socketsFor(slug);
    sockets.delete(ws);
    if (ws.personId) {
      const counts = personCountsFor(slug);
      const remainingCount = (counts.get(ws.personId) || 1) - 1;
      // Delete rather than set-to-0: leaving a 0 behind means every distinct
      // personId this room has *ever* seen sits in this Map forever, not
      // just the ones currently connected.
      if (remainingCount > 0) counts.set(ws.personId, remainingCount);
      else counts.delete(ws.personId);

      if (ws.shopScreens) {
        const m = shoppingFor(slug);
        const remainingScreens = Math.max(0, (m.get(ws.personId) || 0) - ws.shopScreens);
        if (remainingScreens > 0) m.set(ws.personId, remainingScreens);
        else m.delete(ws.personId);
      }
      touchPerson(slug, ws.personId);
    }

    // Last socket for this room gone — drop its presence bookkeeping
    // entirely instead of leaving empty Maps/Sets keyed by every slug this
    // server has ever handled a connection for.
    if (sockets.size === 0) {
      roomSockets.delete(slug);
      roomPersonCounts.delete(slug);
      roomShopping.delete(slug);
      lastShoppingBroadcast.delete(slug);
    } else {
      broadcastState(slug);
    }
  });
});

function handleMessage(ws, slug, msg) {
  switch (msg.type) {
    case 'identify': {
      if (!msg.name && !msg.personId) return;
      const person = upsertPerson(slug, { id: msg.personId, name: msg.name });
      ws.personId = person.id;
      const counts = personCountsFor(slug);
      counts.set(person.id, (counts.get(person.id) || 0) + 1);
      ws.send(JSON.stringify({ type: 'identified', person }));
      broadcastState(slug);
      break;
    }

    case 'add_item': {
      const name = String(msg.name || '').trim().slice(0, 120);
      if (!name) return;
      const aisleKey = isValidAisleKey(msg.aisleKey) ? msg.aisleKey : 'cupboard';
      const qty = Number.isFinite(msg.qty) && msg.qty > 0 ? Math.floor(msg.qty) : 1;
      const itemId = addItem(slug, {
        name,
        qty,
        aisleKey,
        addedBy: msg.addedBy || ws.personId,
        addedColor: msg.addedColor,
      });
      broadcastItemsAdded(slug, {
        item: { id: itemId, name, qty, aisleKey },
        names: [name],
        addedByName: msg.addedByName || null,
        fromPersonId: ws.personId,
      });
      break;
    }

    case 'toggle_item': {
      if (!msg.itemId) return;
      setItemDone(slug, msg.itemId, !!msg.done, msg.doneBy || ws.personId);
      broadcastState(slug);
      break;
    }

    case 'set_item_note': {
      if (!msg.itemId || typeof msg.note !== 'string') return;
      setItemNote(slug, msg.itemId, msg.note.trim().slice(0, 80));
      broadcastState(slug);
      break;
    }

    case 'delete_item': {
      if (!msg.itemId) return;
      deleteItem(slug, msg.itemId);
      broadcastState(slug);
      break;
    }

    case 'clear_done': {
      clearDoneItems(slug);
      broadcastState(slug);
      break;
    }

    case 'add_usuals': {
      const added = addRegularsToList(slug, {
        addedBy: msg.addedBy || ws.personId,
        addedColor: msg.addedColor,
      });
      if (added.length) {
        broadcastItemsAdded(slug, {
          item: { name: `the usuals (${added.length})`, aisleKey: 'cupboard' },
          names: added,
          addedByName: msg.addedByName || null,
          fromPersonId: ws.personId,
        });
      } else {
        broadcastState(slug);
      }
      break;
    }

    case 'add_items': {
      // Bulk add (e.g. from the "paste a recipe" screen) — one state
      // broadcast and one summarising toast, not one of each per item, so
      // adding a whole recipe's worth of ingredients doesn't flood everyone
      // else's screen with a toast per line.
      const rawItems = Array.isArray(msg.items) ? msg.items.slice(0, 100) : [];
      const items = rawItems
        .map((raw) => {
          const name = String(raw?.name || '').trim().slice(0, 120);
          if (!name) return null;
          const aisleKey = isValidAisleKey(raw?.aisleKey) ? raw.aisleKey : guessAisleKey(name);
          const qty = Number.isFinite(raw?.qty) && raw.qty > 0 ? Math.floor(raw.qty) : 1;
          return { name, qty, aisleKey };
        })
        .filter(Boolean);
      const added = addItems(slug, items, {
        addedBy: msg.addedBy || ws.personId,
        addedColor: msg.addedColor,
      });
      if (added.length) {
        broadcastItemsAdded(slug, {
          item: added.length === 1
            ? { name: added[0].name, aisleKey: added[0].aisleKey }
            : { name: `${added.length} items from a recipe`, aisleKey: 'cupboard' },
          names: added.map((a) => a.name),
          addedByName: msg.addedByName || null,
          fromPersonId: ws.personId,
        });
      }
      break;
    }

    case 'set_regular': {
      if (typeof msg.nameKey !== 'string' || !msg.nameKey.trim()) return;
      const value = msg.value === 1 || msg.value === 0 ? msg.value : null;
      setRegularOverride(slug, msg.nameKey, value);
      broadcastState(slug);
      ws.send(JSON.stringify({ type: 'known_items', items: getKnownItems(slug) }));
      break;
    }

    case 'request_known_items': {
      ws.send(JSON.stringify({ type: 'known_items', items: getKnownItems(slug) }));
      break;
    }

    case 'enter_shop': {
      if (!ws.personId) return;
      const m = shoppingFor(slug);
      const noneShoppingBefore = [...m.values()].every((n) => !n);
      m.set(ws.personId, (m.get(ws.personId) || 0) + 1);
      ws.shopScreens = (ws.shopScreens || 0) + 1;
      const now = Date.now();
      if (
        noneShoppingBefore &&
        now - (lastShoppingBroadcast.get(slug) || 0) > SHOPPING_NUDGE_DEBOUNCE_MS
      ) {
        lastShoppingBroadcast.set(slug, now);
        const room = getRoom(slug);
        const person = room?.people.find((p) => p.id === ws.personId);
        broadcast(slug, {
          type: 'shopping_started',
          personId: ws.personId,
          name: person?.name || 'Someone',
        });
      }
      broadcastState(slug);
      break;
    }

    case 'leave_shop': {
      if (!ws.personId) return;
      const m = shoppingFor(slug);
      m.set(ws.personId, Math.max(0, (m.get(ws.personId) || 0) - 1));
      ws.shopScreens = Math.max(0, (ws.shopScreens || 0) - 1);
      broadcastState(slug);
      break;
    }

    case 'rename_room': {
      if (typeof msg.name !== 'string' || !msg.name.trim()) return;
      renameRoom(slug, msg.name.trim().slice(0, 80));
      broadcastState(slug);
      break;
    }

    case 'set_offer_who_has': {
      // Plain informational note, not an ownership claim — anyone can set
      // or clear it, same trust model as renaming the room.
      if (typeof msg.text !== 'string') return;
      setOfferWhoHas(slug, msg.text.trim().slice(0, 40));
      broadcastState(slug);
      break;
    }

    case 'set_alias': {
      const alias = String(msg.alias || '').trim().toLowerCase();
      if (!alias) return;
      const result = setAlias(slug, alias);
      // Targeted response — only the requester needs to know whether their
      // chosen alias was taken/invalid; everyone else just gets the normal
      // state broadcast once it succeeds (room.alias reflects it).
      ws.send(JSON.stringify({ type: 'alias_result', ok: result.ok, error: result.error || null, alias }));
      if (result.ok) broadcastState(slug);
      break;
    }

    case 'add_layout': {
      const name = String(msg.name || '').trim().slice(0, 60) || 'New layout';
      const order = isValidLayoutOrder(msg.order) ? msg.order : null;
      if (!order) return;
      const id = addLayout(slug, name, order);
      if (msg.makeActive) setActiveLayout(slug, id);
      broadcastState(slug);
      break;
    }

    case 'update_layout': {
      if (!msg.layoutId) return;
      const patch = {};
      if (typeof msg.name === 'string' && msg.name.trim()) patch.name = msg.name.trim().slice(0, 60);
      if (isValidLayoutOrder(msg.order)) patch.order = msg.order;
      updateLayout(slug, msg.layoutId, patch);
      broadcastState(slug);
      break;
    }

    case 'delete_layout': {
      if (!msg.layoutId) return;
      deleteLayout(slug, msg.layoutId);
      broadcastState(slug);
      break;
    }

    case 'set_active_layout': {
      if (!msg.layoutId) return;
      if (setActiveLayout(slug, msg.layoutId)) broadcastState(slug);
      break;
    }

    case 'add_loyalty_card': {
      const label = String(msg.label || '').trim().slice(0, 40);
      if (!label) return;
      const codeValue = typeof msg.codeValue === 'string' ? msg.codeValue.trim().slice(0, 40) : null;
      const photo = msg.photoDataUrl ? parseImageDataUrl(msg.photoDataUrl) : null;
      if (msg.photoDataUrl && !photo) return; // malformed/unsupported image, reject the whole add
      addLoyaltyCard(slug, {
        label,
        codeValue,
        photo: photo?.buffer,
        photoType: photo?.type,
      });
      broadcastState(slug);
      break;
    }

    case 'update_loyalty_card': {
      if (!msg.cardId) return;
      const patch = {};
      if (typeof msg.label === 'string' && msg.label.trim()) patch.label = msg.label.trim().slice(0, 40);
      if (typeof msg.codeValue === 'string') patch.codeValue = msg.codeValue.trim().slice(0, 40);
      if (msg.clearPhoto) {
        patch.photo = null;
      } else if (msg.photoDataUrl) {
        const photo = parseImageDataUrl(msg.photoDataUrl);
        if (!photo) return; // malformed/unsupported image, reject the whole update
        patch.photo = photo.buffer;
        patch.photoType = photo.type;
      }
      updateLoyaltyCard(slug, msg.cardId, patch);
      broadcastState(slug);
      break;
    }

    case 'delete_loyalty_card': {
      if (!msg.cardId) return;
      deleteLoyaltyCard(slug, msg.cardId);
      broadcastState(slug);
      break;
    }

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      break;
  }
}

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Posh List server listening on http://localhost:${PORT}`);
});
