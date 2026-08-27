"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ensureSession, supabase } from "@/lib/supabaseClient";
import { getVisitedLists, rememberList, type VisitedList } from "@/lib/identity";

export default function HomePage() {
  const router = useRouter();
  const [lists, setLists] = useState<VisitedList[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLists(getVisitedLists());
    void ensureSession();
  }, []);

  async function newList() {
    const name = window.prompt("Name the list", "Christmas")?.trim();
    if (!name) return;
    setBusy(true);
    try {
      await ensureSession();
      const { data, error } = await supabase.rpc("create_list", { p_name: name });
      if (error) throw error;
      const listId = data as string;
      const { data: row } = await supabase
        .from("lists")
        .select("share_token,name")
        .eq("id", listId)
        .single();
      rememberList({
        id: listId,
        token: row?.share_token ?? "",
        name: row?.name ?? name,
      });
      router.push(`/l/${listId}`);
    } catch {
      window.alert("Couldn't create the list.");
    } finally {
      setBusy(false);
    }
  }

  const pinned = lists.find((l) => l.name === "Shopping");
  const others = lists.filter((l) => l !== pinned);

  return (
    <main className="mx-auto w-full max-w-md flex-1 bg-[#FFD400] p-4">
      <h1 className="mb-4 text-2xl font-extrabold text-[#14171C]">Your lists</h1>

      {lists.length === 0 && (
        <p className="rounded-xl bg-white/60 p-4 text-sm text-[#6A5200]">
          Open the link someone shared with you and you&apos;ll land straight on the
          list — no sign-up.
        </p>
      )}

      {pinned && (
        <Link
          href={`/l/${pinned.id}`}
          className="mb-3 block rounded-xl bg-[#FF2E7E] p-4 text-white"
        >
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">
            Shopping
          </span>
          <span className="mt-1 block text-lg font-bold">Open the list</span>
        </Link>
      )}

      <ul className="space-y-2">
        {others.map((l) => (
          <li key={l.id}>
            <Link
              href={`/l/${l.id}`}
              className="block rounded-xl bg-white p-4 font-semibold text-[#14171C]"
            >
              {l.name}
            </Link>
          </li>
        ))}
      </ul>

      <button
        onClick={newList}
        disabled={busy}
        className="mt-3 w-full rounded-xl border-2 border-dashed border-[#6A5200] p-4 font-semibold text-[#6A5200] disabled:opacity-50"
      >
        {busy ? "Creating…" : "New list"}
      </button>
    </main>
  );
}
