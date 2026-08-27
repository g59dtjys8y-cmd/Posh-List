export type List = {
  id: string;
  name: string;
  share_token: string;
  is_pinned: boolean;
  position: number;
  archived_at: string | null;
};

export type Aisle = {
  id: string;
  list_id: string;
  name: string;
  colour: string;
  position: number;
};

export type Item = {
  id: string;
  list_id: string;
  name: string;
  qty: string | null;
  aisle_id: string | null;
  checked: boolean;
  checked_at: string | null;
  checked_by: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Member = {
  list_id: string;
  user_id: string;
  display_name: string;
  colour: string;
  joined_at: string;
};
