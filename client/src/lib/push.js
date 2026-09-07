// Converts the VAPID public key (base64url, as web-push and the server
// hand it out) into the raw Uint8Array pushManager.subscribe() expects.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribes this device to push for `slug`, if notification permission has
 * already been granted (BadgePrompt is what actually asks — iOS requires a
 * user gesture for that, so this never prompts on its own). Safe to call on
 * every room open: push_subscriptions' primary key is (room_slug, endpoint),
 * so re-POSTing an existing subscription is just an upsert, and a browser
 * with no push support or a permission that isn't "granted" yet is a
 * silent no-op either way.
 */
export async function subscribeToPush(slug, personId) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const res = await fetch('/api/push/public-key');
      const { key } = await res.json();
      if (!key) return; // server has no VAPID keys configured — nothing to subscribe with
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }
    await fetch(`/api/rooms/${slug}/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...subscription.toJSON(), personId }),
    });
  } catch {
    // Subscribing is a nice-to-have, not a blocker — a permissions quirk or
    // a network hiccup here shouldn't affect anything else about the room.
  }
}
