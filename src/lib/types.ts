import type { Category } from "./categories";

export type Profile = {
  id: string;
  couple_id: string | null;
  display_name: string;
};

export type Couple = {
  id: string;
  name: string | null;
  invite_code: string;
};

export type Me = {
  userId: string;
  email: string;
  profile: Profile;
  partner: Profile | null;
  couple: Couple | null;
};

/** Linha devolvida pela RPC get_dates (já com as notas filtradas). */
export type DateItem = {
  id: string;
  created_by: string;
  place_name: string;
  place_address: string | null;
  date_on: string; // yyyy-mm-dd
  category: Category;
  cost: number | null;
  cover_path: string | null;
  favorite: boolean;
  created_at: string;
  my_score: number | null;
  my_comment: string | null;
  partner_rated: boolean;
  partner_score: number | null;
  partner_comment: string | null;
  couple_avg: number | null;
};

export type DatePhoto = {
  id: string;
  date_id: string;
  path: string;
  position: number;
};

export type WishItem = {
  id: string;
  place_name: string;
  notes: string | null;
  added_by: string;
  done_date_id: string | null;
  created_at: string;
};

export type DateInput = {
  place_name: string;
  place_address: string | null;
  date_on: string;
  category: Category;
  cost: number | null;
};
