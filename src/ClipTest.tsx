import { useEffect, useState } from "react";

// Buyer page behind the QR on a ValueLockr Clip: /c/<public code>. Public on
// purpose (a buyer scanning a case has no account) — it calls the
// clip_public() SQL function with the public key, which returns only what the
// clip already shows plus the market reference and the vendor's name. The
// public code is random, so clips can't be enumerated. In production this
// link will open the ValueLockr app (step E).

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

type Card = {
  state: "card" | "unavailable";
  vendor?: string;
  vendor_country?: string;
  name?: string;
  number?: string | null;
  set?: string | null;
  variant?: string | null;
  grade?: string | null;
  condition?: string | null;
  image_url?: string | null;
  item_status?: "available" | "reserved" | "sold";
  price?: number | null;
  currency?: "EUR" | "USD";
  market?: number | null;
  market_source?: string | null;
  market_converted?: boolean;
  updated_at?: string | null;
};

const SOURCE: Record<string, string> = { cardmarket: "Cardmarket", tcgplayer: "TCGPlayer", pricecharting: "PriceCharting", graded: "graded sales" };

const money = (v: number | null | undefined, cur?: string) =>
  v == null
    ? "No price"
    : cur === "USD"
      ? "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "€" + Number(v).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ClipTest({ code }: { code: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/clip_public`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: code }),
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Couldn't load this card (${r.status}).`);
        const j = await r.json();
        if (!j) throw new Error("This code doesn't belong to a ValueLockr clip.");
        setCard(j);
      })
      .catch((e) => setError(e.message));
  }, [code]);

  return (
    <div className="ad-root ct-root">
      <div className="ad-brand ct-brand">VALUELOCKR</div>

      {error ? (
        <div className="ct-card"><h1 className="ct-name">Not found</h1><p className="ct-sub">{error}</p></div>
      ) : !card ? (
        <div className="ct-card"><p className="ct-sub">Loading…</p></div>
      ) : card.state !== "card" ? (
        <div className="ct-card">
          <h1 className="ct-name">Not available</h1>
          <p className="ct-sub">This clip isn't showing a card right now.</p>
        </div>
      ) : (
        <div className="ct-card">
          {card.image_url && <img className="ct-img" src={card.image_url} alt={card.name} />}
          <h1 className="ct-name">{card.name}</h1>
          <p className="ct-sub">{[card.set, card.number && `#${card.number}`, card.variant].filter(Boolean).join(" · ")}</p>
          <div className="ct-chips">
            <span className={`ct-chip${card.grade ? " ct-gold" : ""}`}>{card.grade ?? "Raw"}</span>
            {card.condition && <span className="ct-chip">{card.condition}</span>}
            {card.item_status && card.item_status !== "available" && <span className="ct-chip ct-gold">{card.item_status === "sold" ? "Sold" : "Reserved"}</span>}
          </div>
          <div className="ct-label">Price at {card.vendor}</div>
          <div className="ct-price">{money(card.price, card.currency)}</div>
          {card.market != null ? (
            <div className="ct-meta">
              Market reference: {money(card.market, card.currency)}
              {card.market_source ? ` · ${SOURCE[card.market_source] ?? card.market_source}` : ""}
              {card.market_converted ? " (converted)" : ""}
            </div>
          ) : null}
        </div>
      )}

      <p className="ct-foot">
        {card?.vendor ? `${card.vendor}${card.vendor_country ? ` · ${card.vendor_country}` : ""} · ` : ""}Prices by ValueLockr.
      </p>
    </div>
  );
}
