// Ops dashboard client. Signs in with Supabase Auth (the same accounts as the
// app) and talks only to the admin-ops Edge Function, which checks the
// account is on its admin allowlist and holds every secret. Nothing
// privileged is in this bundle.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const STORE_KEY = "vl-ops-session";

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  email: string;
}

function save(s: Session | null) {
  try {
    if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode — the session just won't survive a reload */
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

async function token(grant: "password" | "refresh_token", body: object): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.msg || "Sign-in failed");
  const s: Session = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600), email: j.user?.email ?? "" };
  save(s);
  return s;
}

export const signIn = (email: string, password: string) => token("password", { email, password });

export function signOut() {
  save(null);
}

let session: Session | null = loadSession();
export const setSession = (s: Session | null) => (session = s);

async function fresh(): Promise<Session> {
  if (!session) throw new AuthError("Not signed in");
  if (session.expires_at - 60 < Date.now() / 1000) {
    try {
      session = await token("refresh_token", { refresh_token: session.refresh_token });
    } catch {
      save(null);
      session = null;
      throw new AuthError("Session expired");
    }
  }
  return session;
}

export class AuthError extends Error {}

export async function ops<T = any>(action: string, payload: object = {}): Promise<T> {
  const s = await fresh();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-ops`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 403) throw new AuthError("This account is not an admin");
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j as T;
}

// ValueLockr Clip control — the clip-admin function on the clip TEST project.
// Same signed-in session; clip-admin verifies the token against this (live)
// project and its own ADMIN_EMAILS.
const CLIP_ADMIN_URL = "https://kkqotltawsnfrgyzjozs.supabase.co/functions/v1/clip-admin";

export async function clipOps<T = any>(action: string, payload: object = {}): Promise<T> {
  const s = await fresh();
  const res = await fetch(CLIP_ADMIN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 403) throw new AuthError("This account is not a clip admin");
  if (!res.ok) throw new Error(j.error || `Request failed (${res.status})`);
  return j as T;
}

// ── Response shapes (from supabase/functions/admin-ops) ─────────────────────
export type Maybe<T> = T | { error: string };
export const failed = (v: unknown): v is { error: string } => !!v && typeof v === "object" && "error" in (v as object);

export interface Job {
  state: "idle" | "running" | "done" | "error";
  game?: string;
  sets?: string[] | null;
  total?: number | null;
  done?: number;
  failed?: number;
  started_at?: number;
  finished_at?: number;
  error?: string;
  log?: string[];
}

export interface MatcherStatus {
  ok: boolean;
  latency_ms: number;
  uptime_s: number;
  model: string;
  device: string;
  rerank: boolean;
  games: Record<string, { cards: number; updated_at: number | null; rerank: boolean }>;
  matches_since_start: number;
  match_errors_since_start: number;
  last_match_at: number | null;
  load_avg: number[] | null;
  memory: { total_mb: number; available_mb: number } | null;
  job: Job;
}

export interface Workflow {
  name: string;
  file: string;
  last: { status: string; conclusion: string | null; title: string; started_at: string; duration_s: number; url: string };
  week: { success: number; failure: number; other: number };
  history: { conclusion: string; at: string; title: string }[];
  minutes_month: number;
}

export interface Overview {
  generated_at: string;
  admin: string;
  matcher: Maybe<MatcherStatus>;
  syncs: Maybe<{ workflows: Workflow[]; minutes: { used_est: number; limit: number; projected: number; runs: number } }>;
  data: Maybe<{
    price_flags: { last_24h: number; open_7d: number; recent: { game: string; name: string; set_name: string; card_number: string; old_price: number; new_price: number; ratio: number; flagged_at: string }[] };
    scans: { last_24h: number; last_7d: number; low_confidence_7d: number; recent: { game: string; name: string; set_name: string; number: string; score: number; margin: number; embed_ms: number; created_at: string; matched_image_url: string | null }[] };
    search_gaps: { query: string; game: string; count: number }[];
    missing_images: number;
    pricecharting_coverage: { matched: number; total: number };
    feedback: { last_7d: number; recent: { category: string; message: string; screen: string; card_name: string | null; created_at: string; resolved_at: string | null }[] };
  }>;
  users: Maybe<{ users: number | null; lockrs: number; owned_cards: number; new_lockrs_7d: number; push_tokens: number }>;
  apis: Maybe<{ proxy_today: { action: string; calls: number; callers: number }[]; ebay: Maybe<{ resource: string; limit: number; remaining: number; reset: string }[]>; openrouter: Maybe<{ credits: number; used: number; usage_daily: number; usage_monthly: number }>; ximilar: Maybe<{ used: number | null; limit: number | null }> }>;
}

export interface NewSets {
  missing_from_catalogue: { set_name: string; set_code: string | null; released_at: string | null; priced_rows: number; ptcg_ids: string[]; ptcg_cards: number }[];
  ptcg_not_imported: { id: string; name: string; total: number; released: string }[];
}

export interface Gaps {
  game: string;
  missing: number;
  checked_at: number;
  by_set: Record<string, number>;
}
