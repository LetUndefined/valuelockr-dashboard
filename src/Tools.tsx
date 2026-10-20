import { useCallback, useEffect, useState } from "react";
import { ops } from "./api";

// Prices and Radar events — the hands-on tools the old admin.html had.

interface Flag {
  id: string;
  game: string;
  name: string;
  set_name: string | null;
  card_number: string | null;
  old_price: number | null;
  new_price: number | null;
  avg_30d: number | null;
  ratio: number | null;
  flagged_at: string;
  resolution?: string | null;
  resolved_price?: number | null;
  resolved_at?: string | null;
}

interface PriceRow {
  game: string;
  tcgid: string;
  name: string;
  set_name: string | null;
  card_number: string | null;
  cardmarket_eur: number | null;
  tcgplayer_usd: number | null;
  avg_30d: number | null;
  updated_at: string | null;
  image_url: string | null;
}

export interface RadarEvent {
  id?: string;
  title: string;
  location_name: string | null;
  description: string | null;
  lat: number | string;
  lng: number | string;
  event_date: string;
  event_type: string;
  url: string | null;
}

const eur = (v: number | null | undefined) => (v == null ? "—" : `€${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const usd = (v: number | null | undefined) => (v == null ? "—" : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const since = (t: string | null | undefined) => {
  if (!t) return "—";
  const h = Math.round((Date.now() - Date.parse(t)) / 3600_000);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};
const GAMES = ["pokemon", "mtg", "yugioh", "lorcana", "onepiece", "f1", "funko"];
const EVENT_TYPES = [
  ["tournament", "Tournament"],
  ["trade", "Card show / trade"],
  ["shop", "Shop meetup"],
  ["release", "Release"],
  ["other", "Convention / other"],
];

function Msg({ m }: { m: { ok: boolean; text: string } | null }) {
  if (!m) return null;
  return <p className={m.ok ? "ad-ok-msg" : "ad-err"}>{m.text}</p>;
}

// ── Prices ──────────────────────────────────────────────────────────────────
export function PricesTab() {
  const [data, setData] = useState<{ open: Flag[]; resolved: Flag[]; open_total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await ops("flags"));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (f: Flag, resolution: "accepted" | "kept_old" | "custom") => {
    let price: string | null = null;
    if (resolution === "custom") {
      price = window.prompt(`Correct Cardmarket EUR (near mint) price for ${f.name}:`, f.old_price != null ? String(f.old_price) : "");
      if (price == null || price.trim() === "") return;
    }
    setBusy(f.id);
    try {
      await ops("resolve-flag", { id: f.id, resolution, price });
      setData((d) => (d ? { ...d, open: d.open.filter((x) => x.id !== f.id), open_total: d.open_total - 1 } : d));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="ad-grid ad-grid-2">
      <section className="ad-panel ad-wide">
        <header className="ad-panel-head">
          <div>
            <h2>Suspect prices</h2>
            <p className="ad-sub">Moves the nightly sync held back. Accept writes the new price, Keep old leaves the current one, Custom writes your own.</p>
          </div>
          {data ? <span className="ad-count">{data.open_total.toLocaleString("en-US")} open</span> : null}
        </header>
        {err ? <p className="ad-err">{err}</p> : !data ? <p className="ad-dim">Loading…</p> : data.open.length === 0 ? <p className="ad-t-ok">No open flags.</p> : (
          <div className="ad-flags">
            {data.open.map((f) => (
              <div className="ad-flag" key={f.id}>
                <div className="ad-flag-main">
                  <b>{f.name}</b> <span className="ad-dim">{f.card_number ? `#${f.card_number}` : ""}</span>
                  <div className="ad-small ad-dim">{f.game} · {f.set_name ?? "—"} · {since(f.flagged_at)}</div>
                </div>
                <div className="ad-flag-prices ad-mono">
                  <span className="ad-dim">{eur(f.old_price)}</span>
                  <span>→</span>
                  <b className={f.ratio != null && f.ratio > 1 ? "ad-t-ok" : "ad-t-bad"}>{eur(f.new_price)}</b>
                  {f.ratio != null ? <span className="ad-dim">{f.ratio}×</span> : null}
                  {f.avg_30d != null ? <span className="ad-small ad-dim">30d {eur(f.avg_30d)}</span> : null}
                </div>
                <div className="ad-actions">
                  <button className="ad-btn ad-btn-ghost" disabled={busy === f.id} onClick={() => resolve(f, "accepted")}>Accept</button>
                  <button className="ad-btn ad-btn-ghost" disabled={busy === f.id} onClick={() => resolve(f, "kept_old")}>Keep old</button>
                  <button className="ad-btn ad-btn-ghost" disabled={busy === f.id} onClick={() => resolve(f, "custom")}>Custom…</button>
                </div>
              </div>
            ))}
            {data.open_total > data.open.length ? <p className="ad-small ad-dim">Showing the newest {data.open.length} of {data.open_total.toLocaleString("en-US")}.</p> : null}
          </div>
        )}
      </section>
      <ManualPrice />
    </div>
  );
}

function ManualPrice() {
  const [game, setGame] = useState("pokemon");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [edit, setEdit] = useState<{ tcgid: string; eur: string; usd: string } | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMsg(null);
    try {
      setRows(await ops("price-search", { game, q }));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const save = async (r: PriceRow) => {
    if (!edit) return;
    try {
      await ops("price-set", { game: r.game, tcgid: r.tcgid, eur: edit.eur, usd: edit.usd });
      setMsg({ ok: true, text: `Saved ${r.name}.` });
      setEdit(null);
      search();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <section className="ad-panel ad-wide">
      <header className="ad-panel-head">
        <div>
          <h2>Set a price by hand</h2>
          <p className="ad-sub">Corrects a card's stored price. The next nightly sync overwrites it unless the new figure gets flagged.</p>
        </div>
      </header>
      <form className="ad-form-row" onSubmit={search}>
        <select className="ad-select" value={game} onChange={(e) => setGame(e.target.value)}>{GAMES.map((g) => <option key={g}>{g}</option>)}</select>
        <input className="ad-input" placeholder="Card name, e.g. Charizard" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="ad-btn ad-btn-gold">Search</button>
      </form>
      <Msg m={msg} />
      {rows == null ? null : rows.length === 0 ? <p className="ad-dim ad-small">No cards found.</p> : (
        <div className="ad-price-list">
          {rows.map((r) => {
            const editing = edit?.tcgid === r.tcgid;
            return (
              <div className="ad-price-row" key={r.tcgid}>
                {r.image_url ? <img src={r.image_url} alt="" loading="lazy" /> : <div className="ad-scan-ph" />}
                <div className="ad-price-meta">
                  <b>{r.name}</b>
                  <span className="ad-small ad-dim">{r.set_name ?? "—"}{r.card_number ? ` · #${r.card_number}` : ""} · updated {since(r.updated_at)}</span>
                  {editing ? (
                    <div className="ad-form-row ad-form-tight">
                      <label className="ad-mini">EUR<input className="ad-input" inputMode="decimal" value={edit.eur} onChange={(e) => setEdit({ ...edit, eur: e.target.value })} /></label>
                      <label className="ad-mini">USD<input className="ad-input" inputMode="decimal" value={edit.usd} onChange={(e) => setEdit({ ...edit, usd: e.target.value })} /></label>
                      <button type="button" className="ad-btn ad-btn-gold" onClick={() => save(r)}>Save</button>
                      <button type="button" className="ad-btn ad-btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
                    </div>
                  ) : (
                    <span className="ad-small ad-mono">{eur(r.cardmarket_eur)} <span className="ad-dim">· {usd(r.tcgplayer_usd)} · 30d {eur(r.avg_30d)}</span></span>
                  )}
                </div>
                {editing ? null : (
                  <button className="ad-btn ad-btn-ghost" onClick={() => setEdit({ tcgid: r.tcgid, eur: r.cardmarket_eur != null ? String(r.cardmarket_eur) : "", usd: r.tcgplayer_usd != null ? String(r.tcgplayer_usd) : "" })}>Edit</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Events ──────────────────────────────────────────────────────────────────
const EMPTY: RadarEvent = { title: "", location_name: "", description: "", lat: "", lng: "", event_date: "", event_type: "tournament", url: "" };

export function EventsTab() {
  const [data, setData] = useState<{ upcoming: (RadarEvent & { id: string })[]; past: (RadarEvent & { id: string })[] } | null>(null);
  const [form, setForm] = useState<RadarEvent>(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [places, setPlaces] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await ops("events"));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const set = (k: keyof RadarEvent) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const findPlace = async () => {
    const q = form.location_name || form.title;
    if (!q) return;
    try {
      const r = await ops<{ label: string; lat: number; lng: number }[]>("geocode", { q });
      setPlaces(r);
      if (!r.length) setMsg({ ok: false, text: "No place found — try a fuller address." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ops("event-save", { event: form });
      setMsg({ ok: true, text: form.id ? "Event updated." : "Event added." });
      setForm(EMPTY);
      setPlaces([]);
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const remove = async (ev: RadarEvent & { id: string }) => {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    try {
      await ops("event-delete", { id: ev.id });
      load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const upcoming = (data?.upcoming ?? []).filter((e) => !filter || `${e.title} ${e.location_name ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="ad-grid ad-grid-2">
      <section className="ad-panel">
        <header className="ad-panel-head">
          <div>
            <h2>{form.id ? "Edit event" : "Add event"}</h2>
            <p className="ad-sub">Shows on the Radar map in the app.</p>
          </div>
          {form.id ? <button className="ad-btn ad-btn-ghost" onClick={() => { setForm(EMPTY); setPlaces([]); }}>New instead</button> : null}
        </header>
        <form className="ad-form" onSubmit={save}>
          <label>Title<input className="ad-input" value={form.title} onChange={set("title")} required /></label>
          <div className="ad-form-2">
            <label>Date<input className="ad-input" type="date" value={form.event_date} onChange={set("event_date")} required /></label>
            <label>Type<select className="ad-select ad-input" value={form.event_type} onChange={set("event_type")}>{EVENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <label>Location
            <div className="ad-form-row ad-form-tight">
              <input className="ad-input" value={form.location_name ?? ""} onChange={set("location_name")} placeholder="Venue, city" />
              <button type="button" className="ad-btn ad-btn-ghost" onClick={findPlace}>Find on map</button>
            </div>
          </label>
          {places.length ? (
            <div className="ad-places">
              {places.map((p) => (
                <button type="button" key={p.label} className="ad-place" onClick={() => { setForm({ ...form, lat: p.lat.toFixed(6), lng: p.lng.toFixed(6) }); setPlaces([]); }}>
                  {p.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="ad-form-2">
            <label>Latitude<input className="ad-input" inputMode="decimal" value={form.lat} onChange={set("lat")} required /></label>
            <label>Longitude<input className="ad-input" inputMode="decimal" value={form.lng} onChange={set("lng")} required /></label>
          </div>
          <label>Link<input className="ad-input" value={form.url ?? ""} onChange={set("url")} placeholder="https://" /></label>
          <label>Description<textarea className="ad-input" rows={3} value={form.description ?? ""} onChange={set("description")} /></label>
          <Msg m={msg} />
          <button className="ad-btn ad-btn-gold ad-btn-block">{form.id ? "Save changes" : "Add event"}</button>
        </form>
      </section>

      <section className="ad-panel">
        <header className="ad-panel-head">
          <div>
            <h2>Upcoming</h2>
            <p className="ad-sub">{data ? `${data.upcoming.length} events` : "Loading…"}</p>
          </div>
          <input className="ad-input ad-input-sm" placeholder="Filter" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </header>
        <div className="ad-event-list">
          {upcoming.slice(0, 200).map((ev) => (
            <div className="ad-event" key={ev.id}>
              <div className="ad-event-date">
                <b>{new Date(ev.event_date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit" })}</b>
                <span>{new Date(ev.event_date + "T00:00:00").toLocaleDateString("en-GB", { month: "short" })}</span>
              </div>
              <div className="ad-event-meta">
                <b>{ev.title}</b>
                <span className="ad-small ad-dim">{ev.location_name ?? "—"} · {ev.event_type}</span>
              </div>
              <div className="ad-actions">
                <button className="ad-btn ad-btn-ghost" onClick={() => { setForm({ ...ev, lat: String(ev.lat), lng: String(ev.lng) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                <button className="ad-btn ad-btn-ghost ad-btn-danger" onClick={() => remove(ev)}>Delete</button>
              </div>
            </div>
          ))}
          {data && upcoming.length === 0 ? <p className="ad-dim ad-small">No events match.</p> : null}
        </div>
      </section>
    </div>
  );
}
