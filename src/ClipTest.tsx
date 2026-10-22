import { useEffect, useState } from "react";

// Test target for the QR on a ValueLockr Clip: /test/clip/c/<clip id>.
// Stands in for valuelockr.com/c/<id> (→ the app) until that exists. Public
// on purpose — a phone scanning a clip has no session — and it only shows
// what the clip's own screen already shows, via the clip test project's
// public clip-card function. Swap CLIP_CARD_URL for live when the clip ships.
const CLIP_CARD_URL = "https://kkqotltawsnfrgyzjozs.supabase.co/functions/v1/clip-card";

type Card = {
  state: "unclaimed" | "unlinked" | "card";
  clip_id: string;
  name?: string;
  number?: string | null;
  set?: string | null;
  variant?: string | null;
  grade?: string | null;
  image_url?: string | null;
  price_eur?: number | null;
  price?: number | null;
  currency?: "EUR" | "USD";
  price_updated_at?: string | null;
};

const money = (v: number | null | undefined, cur?: string) =>
  v == null
    ? "No price"
    : cur === "USD"
      ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "€" + v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ClipTest({ clipId }: { clipId: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${CLIP_CARD_URL}?id=${encodeURIComponent(clipId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) throw new Error("No clip with this id.");
        if (!r.ok) throw new Error(`Couldn't load this clip (${r.status}).`);
        setCard(await r.json());
      })
      .catch((e) => setError(e.message));
  }, [clipId]);

  const updated = card?.price_updated_at
    ? new Date(card.price_updated_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="ad-root ct-root">
      <div className="ad-brand ct-brand">VALUELOCKR</div>

      {error ? (
        <div className="ct-card"><h1 className="ct-name">Not found</h1><p className="ct-sub">{error}</p></div>
      ) : !card ? (
        <div className="ct-card"><p className="ct-sub">Loading…</p></div>
      ) : card.state !== "card" ? (
        <div className="ct-card">
          <h1 className="ct-name">{card.state === "unclaimed" ? "Not set up yet" : "No card linked"}</h1>
          <p className="ct-sub">This clip isn't showing a card right now.</p>
        </div>
      ) : (
        <div className="ct-card">
          {card.image_url && <img className="ct-img" src={card.image_url} alt={card.name} />}
          <h1 className="ct-name">{card.name}</h1>
          <p className="ct-sub">{[card.set, card.number && `#${card.number}`].filter(Boolean).join(" · ")}</p>
          <div className="ct-chips">
            {card.variant && <span className="ct-chip">{card.variant}</span>}
            <span className={`ct-chip${card.grade ? " ct-gold" : ""}`}>{card.grade ?? "Raw"}</span>
          </div>
          <div className="ct-label">Market value</div>
          <div className="ct-price">{money(card.price ?? card.price_eur, card.currency)}</div>
          {updated && <div className="ct-meta">Updated {updated}</div>}
        </div>
      )}

      <p className="ct-foot">
        Clip <code>{clipId}</code> · test page — in production this link opens the ValueLockr app.
      </p>
    </div>
  );
}
