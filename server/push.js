// Web Push notifications — the one place VAPID signing and payload
// encryption happen, both handled by the `web-push` package rather than
// hand-rolled (see the note in package.json for why this one dependency
// is worth it).
import webpush from 'web-push';
import { getRoom, getSubscriptions, deleteSubscription, untickedCount } from './db.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  // Once at boot, not once per missed push — local dev with no keys set
  // should just quietly not notify, not spam the log or throw.
  console.log('Push notifications disabled (VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT not set).');
}

/**
 * Notify every device subscribed to `slug`, except whoever just made this
 * change themselves, that `names` were added. Exactly one push per call —
 * callers must batch a bulk add (a recipe import, "add the usuals") into
 * one call with every name, never one call per item, or a twelve-item
 * recipe becomes twelve buzzes.
 */
export async function notifyItemsAdded(slug, { names, addedByName, fromPersonId }) {
  if (!configured || !names?.length) return;

  const subscriptions = getSubscriptions(slug).filter((s) => s.personId !== fromPersonId);
  if (!subscriptions.length) return;

  const room = getRoom(slug);
  if (!room) return;

  // Computed once for the whole batch, not once per subscriber below.
  const unticked = untickedCount(slug);
  const who = addedByName || 'Someone';
  const body = names.length === 1 ? `${who} added ${names[0]}` : `${who} added ${names.length} items`;
  const payload = JSON.stringify({ slug, roomName: room.name, title: room.name, body, unticked });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          // The push service itself says this endpoint is gone for good —
          // stop trying it, or dead subscriptions accumulate forever.
          deleteSubscription(sub.endpoint);
        }
        // Any other error (a network blip, a transient 5xx from the push
        // service): swallow it. A push failing must never break the add.
      }
    })
  );
}
