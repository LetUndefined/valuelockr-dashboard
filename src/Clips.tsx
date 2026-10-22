import { useCallback, useEffect, useState } from "react";
import { clipOps, ops } from "./api";
import { GAMES, Msg, PriceRow, eur, since } from "./Tools";

// ValueLockr Clips (test project): see what each clip shows, pick a card from
// the live catalogue and push it to the clip. Nothing changes on a clip until
// "Update clip" is pressed.

interface Display {
  state: "unclaimed" | "unlinked" | "card";
  name?: string;
  number?: string | null;
  set?: string | null;
  grade?: string | null;
  image_url?: string | null;
  price_eur?: number | null;
  slot?: string | null;
}

interface Clip {
  id: string;
  slot: string | null;
  battery_mv: number | null;
  fw_version: string | null;
  last_seen: string | null;
  display: Display | null;
}

const ago = (t: string | null) => {
  if (!t) return "never";
  const s = Math.round((Date.now() - Date.parse(t)) / 1000);
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : since(t);
};

export function ClipsTab() {
  const [clips, setClips] = useState<Clip[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setClips(await clipOps("list"));
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Msg m={msg} />
      {clips == null ? (
        <div className="ad-loading"><span className="ad-spin ad-spin-lg" />Loading clips…</div>
      ) : clips.length === 0 ? (
        <p className="ad-dim">No clips provisioned yet.</p>
      ) : (
        clips.map((c) => <ClipPanel key={c.id} clip={c} onChanged={load} />)
      )}
    </>
  );
}

function ClipPanel({ clip, onChanged }: { clip: Clip; onChanged: () => void }) {
  const d = clip.display;
  const [game, setGame] = useState("pokemon");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [picked, setPicked] = useState<PriceRow | null>(null);
  const [grade, setGrade] = useState(d?.grade ?? "");
  const [slot, setSlot] = useState(clip.slot ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMsg(null);
    try {
      setRows(await ops("price-search", { game, q }));
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  const update = async () => {
    if (!picked) return;
    setBusy(true);
    setMsg(null);
    try {
      const shown: Display = await clipOps("set", { clip_id: clip.id, game: picked.game, tcgid: picked.tcgid, grade, slot });
      setMsg({ ok: true, text: `Sent to the clip: ${shown.name} · ${shown.price_eur != null ? eur(shown.price_eur) : "no price"}. An online clip redraws in a few seconds.` });
      setPicked(null);
      setRows(null);
      setQ("");
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const redraw = async () => {
    setMsg(null);
    try {
      await clipOps("refresh", { clip_id: clip.id });
      setMsg({ ok: true, text: "Refresh sent." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <section className="ad-panel ad-wide">
      <header className="ad-panel-head">
        <div>
          <h2 className="ad-mono">{clip.id}</h2>
          <p className="ad-sub">
            Last seen {ago(clip.last_seen)}
            {clip.fw_version ? ` · fw ${clip.fw_version}` : ""}
            {clip.battery_mv ? ` · ${(clip.battery_mv / 1000).toFixed(2)} V` : ""}
          </p>
        </div>
        <button className="ad-btn ad-btn-ghost" onClick={redraw}>Refresh screen</button>
      </header>

      <div className="cl-now">
        <span className="ad-small ad-dim">On screen now</span>
        {d?.state === "card" ? (
          <div className="ad-price-row">
            {d.image_url ? <img src={d.image_url} alt="" /> : <div className="ad-scan-ph" />}
            <div className="ad-price-meta">
              <b>{d.name}</b>
              <span className="ad-small ad-dim">{[d.set, d.number && `#${d.number}`, d.grade, d.slot].filter(Boolean).join(" · ")}</span>
              <span className="ad-small ad-mono">{d.price_eur != null ? eur(d.price_eur) : "No price"}</span>
            </div>
          </div>
        ) : (
          <p className="ad-dim ad-small">{d?.state === "unlinked" ? "Claimed, no card linked." : "Not set up."}</p>
        )}
      </div>

      <h3>Change card</h3>
      <form className="ad-form-row" onSubmit={search}>
        <select className="ad-select" value={game} onChange={(e) => setGame(e.target.value)}>{GAMES.map((g) => <option key={g}>{g}</option>)}</select>
        <input className="ad-input" placeholder="Card name, e.g. Charizard" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="ad-btn ad-btn-gold">Search</button>
      </form>

      {rows == null ? null : rows.length === 0 ? <p className="ad-dim ad-small">No cards found.</p> : (
        <div className="ad-price-list cl-results">
          {rows.map((r) => (
            <button
              type="button"
              key={r.tcgid}
              className={`ad-price-row cl-pick${picked?.tcgid === r.tcgid ? " cl-picked" : ""}`}
              onClick={() => setPicked(r)}
            >
              {r.image_url ? <img src={r.image_url} alt="" loading="lazy" /> : <div className="ad-scan-ph" />}
              <div className="ad-price-meta">
                <b>{r.name}</b>
                <span className="ad-small ad-dim">{r.set_name ?? "—"}{r.card_number ? ` · #${r.card_number}` : ""}</span>
                <span className="ad-small ad-mono">{eur(r.cardmarket_eur)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {picked ? (
        <div className="cl-confirm">
          <p className="ad-small">
            Selected <b>{picked.name}</b> · {picked.set_name ?? "—"}{picked.card_number ? ` #${picked.card_number}` : ""}
          </p>
          <div className="ad-form-row">
            <label className="ad-mini">Grade<input className="ad-input" placeholder="e.g. PSA 10 (empty = raw)" value={grade} onChange={(e) => setGrade(e.target.value)} /></label>
            <label className="ad-mini">Slot<input className="ad-input" placeholder="e.g. Box A · 01" maxLength={24} value={slot} onChange={(e) => setSlot(e.target.value)} /></label>
          </div>
          <button className="ad-btn ad-btn-gold" onClick={update} disabled={busy}>
            {busy ? <span className="ad-spin" /> : null}Update clip
          </button>
        </div>
      ) : null}

      <Msg m={msg} />
    </section>
  );
}
