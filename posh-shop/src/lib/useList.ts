"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ensureSession, supabase } from "./supabaseClient";
import type { Aisle, Item, List, Member } from "./types";
import { catalogueAisle } from "./catalogue";
import { parseAddInput } from "./parse";

type State = {
  loading: boolean;
  error: string | null;
  list: List | null;
  aisles: Aisle[];
  items: Item[];
  members: Member[];
};

const EMPTY: State = {
  loading: true,
  error: null,
  list: null,
  aisles: [],
  items: [],
  members: [],
};

export function useList(listId: string) {
  const [state, setState] = useState<State>(EMPTY);
  const aislesRef = useRef<Aisle[]>([]);

  useEffect(() => {
    let cancelled = false;
    aislesRef.current = [];

    async function load() {
      try {
        await ensureSession();
        const [list, aisles, items, members] = await Promise.all([
          supabase.from("lists").select("*").eq("id", listId).single(),
          supabase
            .from("aisles")
            .select("*")
            .eq("list_id", listId)
            .order("position"),
          supabase
            .from("items")
            .select("*")
            .eq("list_id", listId)
            .is("deleted_at", null),
          supabase.from("list_members").select("*").eq("list_id", listId),
        ]);

        if (cancelled) return;
        const err = list.error || aisles.error || items.error || members.error;
        if (err) throw err;

        aislesRef.current = aisles.data ?? [];
        setState({
          loading: false,
          error: null,
          list: list.data,
          aisles: aisles.data ?? [],
          items: items.data ?? [],
          members: members.data ?? [],
        });
      } catch {
        if (!cancelled)
          setState((s) => ({
            ...s,
            loading: false,
            error: "Couldn't load the list.",
          }));
      }
    }

    void load();

    const channel = supabase
      .channel(`list:${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `list_id=eq.${listId}` },
        (payload) => {
          setState((s) => applyItemChange(s, payload));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "list_members",
          filter: `list_id=eq.${listId}`,
        },
        () => {
          void supabase
            .from("list_members")
            .select("*")
            .eq("list_id", listId)
            .then(({ data }) =>
              setState((s) => ({ ...s, members: data ?? s.members })),
            );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [listId]);

  const addItems = useCallback(
    async (raw: string) => {
      const parsed = parseAddInput(raw);
      for (const p of parsed) {
        const id = crypto.randomUUID();
        const aisleName = catalogueAisle(p.name);
        const aisle = aislesRef.current.find((a) => a.name === aisleName);
        const now = new Date().toISOString();

        // optimistic
        setState((s) => ({
          ...s,
          items: [
            ...s.items,
            {
              id,
              list_id: listId,
              name: p.name,
              qty: p.qty,
              aisle_id: aisle?.id ?? null,
              checked: false,
              checked_at: null,
              checked_by: null,
              added_by: null,
              created_at: now,
              updated_at: now,
              deleted_at: null,
            },
          ],
        }));

        const { error } = await supabase.rpc("add_item", {
          p_id: id,
          p_list: listId,
          p_name: p.name,
          p_qty: p.qty,
          p_aisle: aisle?.id ?? null,
        });
        if (error) {
          setState((s) => ({
            ...s,
            items: s.items.filter((i) => i.id !== id),
          }));
        }
      }
    },
    [listId],
  );

  const setChecked = useCallback(async (item: Item, checked: boolean) => {
    const at = new Date().toISOString();
    setState((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.id === item.id ? { ...i, checked, checked_at: at } : i,
      ),
    }));
    await supabase.rpc("set_checked", {
      p_item: item.id,
      p_checked: checked,
      p_at: at,
    });
  }, []);

  const removeItem = useCallback(async (item: Item) => {
    setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
    await supabase
      .from("items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id);
  }, []);

  return { ...state, addItems, setChecked, removeItem };
}

function applyItemChange(
  s: State,
  payload: { eventType: string; new: Partial<Item>; old: Partial<Item> },
): State {
  const row = (payload.new ?? {}) as Item;
  if (payload.eventType === "DELETE") {
    return { ...s, items: s.items.filter((i) => i.id !== payload.old.id) };
  }
  if (row.deleted_at) {
    return { ...s, items: s.items.filter((i) => i.id !== row.id) };
  }
  const exists = s.items.some((i) => i.id === row.id);
  return {
    ...s,
    items: exists
      ? s.items.map((i) => (i.id === row.id ? { ...i, ...row } : i))
      : [...s.items, row],
  };
}
