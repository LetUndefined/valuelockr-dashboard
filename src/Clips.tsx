import { useCallback, useEffect, useState } from "react";
import { clipOps } from "./api";
import { Msg, since } from "./Tools";

// ValueLockr Clips across all vendors (live). Vendors pick cards, prices and
// screen options in the app; here the admin sees the fleet, pushes a
// refresh, runs a self-test / reads logs, and can revoke a clip (it then
// shows nothing and accepts nothing) or restore it.

interface Display {
  state: "unclaimed" | "unlinked" | "card" | "inactive";
  name?: string;
  number?: string | null;
  set?: string | null;
  grade?: string | null;
  image_url?: string | null;
  price?: number | null;
  currency?: "EUR" | "USD";
  slot?: string | null;
  item_status?: string;
}

interface Clip {
  id: string;
  vendor: string | null;
  vendor_item_id: string | null;
  public_code: string;
  status: "active" | "lost" | "revoked";
  side: "qr" | "logo";
  invert: boolean;
  slot: string | null;
  battery_mv: number | null;
  fw_version: string | null;
  last_seen: string | null;
  claimed_at: string | null;
  display: Display | null;
}

const money = (v: number | null | undefined, cur: string | undefined) =>
  v == null
    ? "No price"
    : cur === "USD"
      ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `€${v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ago = (t: string | null) => {
  if (!t) return "never";
  const s = Math.round((Date.now() - Date.parse(t)) / 1000);
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)}m ago` : since(t);
};

interface ClipLog {
  id: number;
  kind: "selftest" | "log";
  created_at: string;
  summary: { count?: number; ok?: number; timeouts?: number; avg_ms?: number; worst_ms?: number; wifi_off?: boolean; rssi?: number; heap?: number; fw?: string; uptime_s?: number } | null;
  lines: string[];
}

// Ask an online clip to run test refreshes, then wait for its upload.
function Diagnostics({ clipId }: { clipId: string }) {
  const [count, setCount] = useState(5);
  const [wifiOff, setWifiOff] = useState(false);
  const [logs, setLogs] = useState<ClipLog[] | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const l: ClipLog[] = await clipOps("logs", { clip_id: clipId });
    setLogs(l);
    return l;
  }, [clipId]);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const run = async () => {
    setMsg(null);
    try {
      const before = logs?.[0]?.id ?? 0;
      await clipOps("selftest", { clip_id: clipId, count, wifi_off: wifiOff });
      setWaiting(true);
      setMsg({ ok: true, text: `Test sent. ${count} refreshes take about ${count * 10} s; results appear here when the clip uploads them.` });
      // Poll for the clip's upload (each refresh ~3–10 s + 3 s pause).
      const deadline = Date.now() + (count * 25 + 30) * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 4000));
        const l = await load();
        if ((l[0]?.id ?? 0) > before) {
          setOpen(l[0].id);
          setMsg(null);
          setWaiting(false);
          return;
        }
      }
      setMsg({ ok: false, text: "No results came back. The clip may be offline or in deep sleep (press RESET), or still on older firmware." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setWaiting(false);
    }
  };

  return (
    <div className="cl-diag">
      <h3>Diagnostics</h3>
      <div className="ad-form-row">
        <select className="ad-select" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Refreshes">
          {[3, 5, 10].map((n) => <option key={n} value={n}>{n} refreshes</option>)}
        </select>
        <label className="ad-small cl-check"><input type="checkbox" checked={wifiOff} onChange={(e) => setWifiOff(e.target.checked)} /> WiFi off during test</label>
        <button className="ad-btn ad-btn-gold" onClick={run} disabled={waiting}>{waiting ? <span className="ad-spin" /> : null}Run screen test</button>
      </div>
      <Msg m={msg} />
      {logs && logs.length ? (
        <div className="cl-logs">
          {logs.map((l) => {
            const s = l.summary;
            const bad = (s?.timeouts ?? 0) > 0;
            return (
              <div key={l.id} className="cl-log">
                <button type="button" className="cl-log-head" onClick={() => setOpen(open === l.id ? null : l.id)}>
                  <span className={`ad-dot ${l.kind === "selftest" ? (bad ? "ad-bad" : "ad-ok") : "ad-warn"}`} />
                  <b>{l.kind === "selftest" ? `Screen test ${s?.ok ?? "?"}/${s?.count ?? "?"} OK` : "Log"}</b>
                  <span className="ad-small ad-dim">
                    {new Date(l.created_at).toLocaleString("en-GB")}
                    {s ? ` · avg ${s.avg_ms} ms · worst ${s.worst_ms} ms · WiFi ${s.wifi_off ? "off" : "on"} · RSSI ${s.rssi} · fw ${s.fw}` : ""}
                  </span>
                </button>
                {open === l.id ? <pre className="cl-pre">{l.lines.join("\n")}</pre> : null}
              </div>
            );
          })}
        </div>
      ) : logs ? <p className="ad-dim ad-small">No diagnostics uploaded yet.</p> : null}
    </div>
  );
}

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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: done });
      onChanged();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const statusTone = clip.status === "active" ? "ad-ok" : clip.status === "lost" ? "ad-warn" : "ad-bad";

  return (
    <section className="ad-panel ad-wide">
      <header className="ad-panel-head">
        <div>
          <h2 className="ad-mono"><span className={`ad-dot ${statusTone}`} /> {clip.id}</h2>
          <p className="ad-sub">
            {clip.vendor ?? "Unclaimed"} · {clip.status}
            {clip.slot ? ` · ${clip.slot}` : ""} · last seen {ago(clip.last_seen)}
            {clip.fw_version ? ` · fw ${clip.fw_version}` : ""}
            {clip.battery_mv ? ` · ${(clip.battery_mv / 1000).toFixed(2)} V` : ""}
          </p>
        </div>
        <div className="ad-form-row">
          <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => act(() => clipOps("refresh", { clip_id: clip.id }), "Refresh sent.")}>Refresh screen</button>
          {clip.status === "revoked" ? (
            <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => act(() => clipOps("revoke", { clip_id: clip.id, revoked: false }), "Restored.")}>Restore</button>
          ) : (
            <button
              className="ad-btn ad-btn-ghost"
              disabled={busy}
              onClick={() => window.confirm(`Revoke ${clip.id}? It goes dark and can't be used until restored.`) && act(() => clipOps("revoke", { clip_id: clip.id, revoked: true }), "Revoked.")}
            >
              Revoke
            </button>
          )}
        </div>
      </header>

      <div className="cl-now">
        <span className="ad-small ad-dim">On screen now</span>
        {d?.state === "card" ? (
          <div className="ad-price-row">
            {d.image_url ? <img src={d.image_url} alt="" /> : <div className="ad-scan-ph" />}
            <div className="ad-price-meta">
              <b>{d.name}</b>
              <span className="ad-small ad-dim">{[d.set, d.number && `#${d.number}`, d.grade, d.slot].filter(Boolean).join(" · ")}</span>
              <span className="ad-small ad-mono">
                {money(d.price, d.currency)}
                <span className="ad-dim"> · {clip.side === "logo" ? "VL logo" : "QR"}{clip.invert ? " · inverted" : ""}</span>
              </span>
            </div>
          </div>
        ) : (
          <p className="ad-dim ad-small">
            {d?.state === "unlinked" ? "Claimed, no card linked." : d?.state === "inactive" ? "Dark (lost or revoked)." : "Not claimed by a vendor."}
          </p>
        )}
        {clip.status === "active" && d?.state === "card" ? (
          <a className="ad-small" href={`/c/${clip.public_code}`} target="_blank" rel="noreferrer">Buyer page ↗</a>
        ) : null}
      </div>

      <Msg m={msg} />
      <Diagnostics clipId={clip.id} />
    </section>
  );
}
