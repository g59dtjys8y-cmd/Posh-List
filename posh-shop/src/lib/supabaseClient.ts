import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in .env.local",
  );
}

// One browser-side client for the whole app. Anonymous sign-in gives every
// device a real JWT (see posh-shop-schema.md), which is what Realtime authorises
// subscriptions from.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "posh-shop-auth",
  },
});

/** Ensure the device is signed in (anonymously) and return its user id. */
export async function ensureSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return signed.user!.id;
}
