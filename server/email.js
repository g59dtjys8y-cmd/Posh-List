// Sends the "here's your list link" recovery email. Uses Resend's plain
// HTTP API directly (fetch, built into Node — no SDK) rather than adding
// an email-sending package: unlike VAPID push (real crypto worth not
// hand-rolling), sending an email is one POST with a bearer token, so a
// dependency would buy nothing here. Any provider with an HTTP JSON API
// (Postmark, Mailgun, SendGrid...) would drop in the same way — only
// RESEND_API_URL/the request shape below would need to change.
const RESEND_API_URL = 'https://api.resend.com/emails';
const { RESEND_API_KEY, EMAIL_FROM, PUBLIC_ORIGIN } = process.env;

const configured = Boolean(RESEND_API_KEY && EMAIL_FROM);
if (!configured) {
  // eslint-disable-next-line no-console
  console.log('Email sending disabled (RESEND_API_KEY/EMAIL_FROM not set).');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function linkFor(slug) {
  const origin = PUBLIC_ORIGIN || 'https://posh-list.onrender.com';
  return `${origin}/r/${slug}`;
}

async function sendMail({ to, subject, html, text }) {
  if (!configured) {
    // eslint-disable-next-line no-console
    console.log(`[email disabled] would send "${subject}" to ${to}`);
    return;
  }
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/**
 * The one recovery email this app ever sends: a link (or several, if this
 * email's attached to more than one list) straight back into a list. Used
 * both right after attaching an email to a list (immediate confirmation —
 * "here it is, saved") and by the standalone /recover flow (an email with
 * no lists open yet, looking up whatever it's attached to). `rooms` is
 * already-resolved `{ slug, name }` pairs — this never touches the db
 * itself, callers hand it exactly who to email about.
 */
export async function sendRecoveryLinksEmail(email, rooms) {
  if (!rooms.length) return;
  const single = rooms.length === 1;
  const subject = single ? `Your Posh List link: ${rooms[0].name}` : `Your Posh List links (${rooms.length})`;

  const htmlItems = rooms.map((r) => `<li><a href="${linkFor(r.slug)}">${escapeHtml(r.name)}</a></li>`).join('');
  const textItems = rooms.map((r) => `${r.name}: ${linkFor(r.slug)}`).join('\n');

  await sendMail({
    to: email,
    subject,
    html: `<p>Here ${single ? "'s your list" : 'are your lists'}:</p><ul>${htmlItems}</ul><p>Open a link on any device to pick up right where you left off.</p>`,
    text: `Here ${single ? "'s your list" : 'are your lists'}:\n\n${textItems}\n\nOpen a link on any device to pick up right where you left off.`,
  });
}
