"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useList } from "@/lib/useList";
import type { Item } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export default function ListPage({ params }: Props) {
  const { id } = use(params);
  const { loading, error, list, aisles, items, members, addItems, setChecked, removeItem } =
    useList(id);
  const [draft, setDraft] = useState("");

  const grouped = useMemo(() => {
    const live = items.filter((i) => !i.checked);
    const order = new Map(aisles.map((a) => [a.id, a.position]));
    const buckets = new Map<string | null, Item[]>();
    for (const it of live) {
      const key = it.aisle_id;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(it);
    }
    return [...buckets.entries()].sort(
      ([a], [b]) => (order.get(a ?? "") ?? 99) - (order.get(b ?? "") ?? 99),
    );
  }, [items, aisles]);

  const checkedCount = items.filter((i) => i.checked).length;

  if (loading) return <Centre>Loading…</Centre>;
  if (error || !list) return <Centre>{error ?? "List not found."}</Centre>;

  const aisleById = new Map(aisles.map((a) => [a.id, a]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    void addItems(draft);
    setDraft("");
  }

  return (
    <div className="flex flex-1 flex-col bg-[#FFD400]">
      <header className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-[#14171C]">{list.name}</h1>
          <Link
            href={`/l/${id}/share`}
            className="rounded-full bg-[#14171C] px-3 py-1.5 text-sm font-semibold text-white"
          >
            Share
          </Link>
        </div>
        <p className="mt-1 text-sm text-[#6A5200]">
          {members.length
            ? `${members.map((m) => m.display_name).join(", ")} on the list`
            : "Just you so far"}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto rounded-t-2xl bg-white px-3 pt-3 pb-28">
        {grouped.length === 0 && (
          <p className="px-2 py-10 text-center text-[#5C646E]">
            Nothing on the list. Add the first thing below.
          </p>
        )}

        {grouped.map(([aisleId, rows]) => {
          const aisle = aisleId ? aisleById.get(aisleId) : undefined;
          return (
            <section key={aisleId ?? "none"} className="mb-4">
              <div className="mb-1 flex items-center gap-2 px-1">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: aisle?.colour ?? "#C3C9D0" }}
                />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-[#5C646E]">
                  {aisle?.name ?? "Not sorted"}
                </h2>
              </div>
              <ul>
                {rows.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center gap-3 border-l-4 py-2 pl-3 pr-1"
                    style={{ borderColor: aisle?.colour ?? "#EDEFF2" }}
                  >
                    <button
                      onClick={() => void setChecked(it, true)}
                      aria-label={`Tick ${it.name}`}
                      className="h-6 w-6 shrink-0 rounded-full border-2 border-[#C3C9D0]"
                    />
                    <span className="flex-1 text-[#14171C]">{it.name}</span>
                    {it.qty && (
                      <span className="font-mono text-sm text-[#5C646E]">{it.qty}</span>
                    )}
                    <button
                      onClick={() => void removeItem(it)}
                      aria-label={`Remove ${it.name}`}
                      className="px-2 text-[#C3C9D0]"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {checkedCount > 0 && (
          <details className="mt-4 px-1">
            <summary className="cursor-pointer text-sm text-[#5C646E]">
              {checkedCount} in the trolley
            </summary>
            <ul className="mt-2">
              {items
                .filter((i) => i.checked)
                .map((it) => (
                  <li key={it.id} className="flex items-center gap-3 py-1.5">
                    <button
                      onClick={() => void setChecked(it, false)}
                      aria-label={`Untick ${it.name}`}
                      className="h-5 w-5 shrink-0 rounded-full bg-[#57C000]"
                    />
                    <span className="flex-1 text-[#9AA1AA] line-through">{it.name}</span>
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      <form
        onSubmit={submit}
        className="fixed inset-x-0 bottom-0 border-t border-[#EDEFF2] bg-white p-3"
      >
        <div className="mx-auto flex max-w-md gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            enterKeyHint="done"
            placeholder="Add an item — or bread, milk, eggs"
            className="flex-1 rounded-lg border border-[#EDEFF2] px-4 py-3"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#FF2E7E] px-5 py-3 font-semibold text-white"
          >
            Add
          </button>
        </div>
      </form>
    </div>
  );
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6 text-[#5C646E]">
      {children}
    </main>
  );
}
