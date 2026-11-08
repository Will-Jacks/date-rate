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
  monthly_budget: number | null;
};

export type Me = {
  userId: string;
  email: string;
  profile: Profile;
  partner: Profile | null;
  couple: Couple | null;
};

/** Notas opcionais por critério (1–10). */
export type Criteria = Partial<Record<"food" | "ambience" | "price" | "vibe", number>>;

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
  /** ponto de foco da capa, 0–100 (ausente antes da migração 0006) */
  cover_x?: number;
  cover_y?: number;
  favorite: boolean;
  created_at: string;
  quote: string | null;
  tags: string[];
  lat: number | null;
  lng: number | null;
  my_score: number | null;
  my_comment: string | null;
  my_criteria: Criteria | null;
  partner_rated: boolean;
  partner_score: number | null;
  partner_comment: string | null;
  partner_criteria: Criteria | null;
  couple_avg: number | null;
  comments_count: number;
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
  place_address: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  added_by: string;
  done_date_id: string | null;
  created_at: string;
};

export type Plan = {
  id: string;
  created_by: string;
  place_name: string;
  place_address: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_at: string;
  notes: string | null;
  wish_id: string | null;
  done_date_id: string | null;
};

export type Comment = {
  id: string;
  date_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type Reaction = {
  id: string;
  date_id: string;
  target_kind: "rating" | "comment";
  target_ref: string;
  user_id: string;
  emoji: string;
};

/** Lugar escolhido na busca (OpenStreetMap). */
export type PlacePick = {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category?: Category;
};

export type DateInput = {
  place_name: string;
  place_address: string | null;
  date_on: string;
  category: Category;
  cost: number | null;
  quote: string | null;
  tags: string[];
  lat: number | null;
  lng: number | null;
  cover_x: number;
  cover_y: number;
};
