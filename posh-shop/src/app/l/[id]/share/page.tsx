"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ensureSession, supabase } from "@/lib/supabaseClient";
import type { Member } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default function SharePage({ params }: Props) {
  const { id } = use(params);
  const [token, setToken] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void (async () => {
      await ensureSession();
      const [{ data: list }, { data: mem }] = await Promise.all([
        supabase.from("lists").select("share_token").eq("id", id).single(),
        supabase.from("list_members").select("*").eq("list_id", id),
      ]);
      setToken(list?.share_token ?? null);
      setMembers(mem ?? []);
    })();
  }, [id]);

  const url =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/h/${token}`
      : "";

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 bg-[#FFD400] p-4">
      <Link href={`/l/${id}`} className="text-sm font-semibold text-[#6A5200]">
        ← Back to the list
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-extrabold text-[#14171C]">
        Share the list
      </h1>
      <p className="mb-4 text-sm text-[#6A5200]">
        Send this link. Whoever opens it is on the live list straight away.
      </p>

      <div className="rounded-xl bg-white p-4">
        <p className="break-all font-mono text-sm text-[#14171C]">
          {url || "…"}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={copy}
            disabled={!url}
            className="flex-1 rounded-lg bg-[#FF2E7E] px-4 py-2.5 font-semibold text-white disabled:opacity-50"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={() => void navigator.share({ url })}
              disabled={!url}
              className="rounded-lg border border-[#14171C] px-4 py-2.5 font-semibold text-[#14171C] disabled:opacity-50"
            >
              Send…
            </button>
          )}
        </div>
      </div>

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-[#6A5200]">
        On the list
      </h2>
      <ul className="space-y-1">
        {members.map((m) => (
          <li
            key={m.user_id}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2"
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: m.colour }}
            />
            <span className="font-medium text-[#14171C]">{m.display_name}</span>
          </li>
        ))}
        {members.length === 0 && (
          <li className="text-sm text-[#6A5200]">Just you so far.</li>
        )}
      </ul>
    </main>
  );
}
