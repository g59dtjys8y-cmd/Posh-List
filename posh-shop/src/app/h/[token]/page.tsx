"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureSession, supabase } from "@/lib/supabaseClient";
import { getNickname, rememberList, setNickname } from "@/lib/identity";

type Props = { params: Promise<{ token: string }> };

export default function JoinPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  async function join(nickname: string) {
    setError(null);
    try {
      await ensureSession();
      const { data, error } = await supabase.rpc("join_list", {
        token,
        nickname,
      });
      if (error) throw error;
      const listId = data as string;

      const { data: list } = await supabase
        .from("lists")
        .select("name")
        .eq("id", listId)
        .single();

      rememberList({ id: listId, token, name: list?.name ?? "Shopping" });
      router.replace(`/l/${listId}`);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "unknown link"
          ? "That link isn't valid any more."
          : "Couldn't join the list. Try the link again.",
      );
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const existing = getNickname();
    if (existing) void join(existing);
    else setNeedsName(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submitName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setNickname(trimmed);
    setNeedsName(false);
    void join(trimmed);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        {error ? (
          <p className="text-[#B0472F]">{error}</p>
        ) : needsName ? (
          <form onSubmit={submitName} className="space-y-4">
            <h1 className="text-xl font-semibold">What should we call you?</h1>
            <p className="text-sm text-[#5C646E]">
              Shows next to anything you add. Just a first name is fine.
            </p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kate"
              className="w-full rounded-lg border border-[#EDEFF2] px-4 py-3 text-center"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-[#FF2E7E] px-4 py-3 font-semibold text-white"
            >
              Join the list
            </button>
          </form>
        ) : (
          <p className="text-[#5C646E]">Joining…</p>
        )}
      </div>
    </main>
  );
}
