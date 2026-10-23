import { useCallback, useEffect, useState } from "react";
import { vendorOps } from "./api";
import { Msg } from "./Tools";

// Vendor applications from the app ("Become a vendor"). Approving creates the
// vendor account with the applicant as owner; a rejection reason is shown to
// the applicant in the app.

interface Application {
  id: string;
  user_id: string;
  email: string | null;
  business_name: string;
  country: string;
  registration_no: string | null;
  website: string | null;
  socials: string | null;
  expected_clips: number | null;
  message: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const when = (t: string | null) => (t ? new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export function VendorsTab() {
  const [data, setData] = useState<{ pending: Application[]; recent: Application[] } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await vendorOps("applications"));
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
      <section className="ad-panel ad-wide">
        <header className="ad-panel-head">
          <div>
            <h2>Vendor applications</h2>
            <p className="ad-sub">Approve to create the vendor account (applicant becomes owner). Rejections need a reason — the applicant sees it.</p>
          </div>
          <button className="ad-btn ad-btn-ghost" onClick={load}>Reload</button>
        </header>
        {data == null ? (
          <div className="ad-loading"><span className="ad-spin ad-spin-lg" />Loading…</div>
        ) : data.pending.length === 0 ? (
          <p className="ad-dim">No applications waiting.</p>
        ) : (
          <div className="vd-list">
            {data.pending.map((a) => <PendingCard key={a.id} app={a} onDone={(text) => { setMsg({ ok: true, text }); load(); }} />)}
          </div>
        )}
      </section>

      {data && data.recent.length ? (
        <section className="ad-panel ad-wide">
          <header className="ad-panel-head"><div><h2>Recent decisions</h2></div></header>
          <div className="vd-list">
            {data.recent.map((a) => (
              <div key={a.id} className="vd-row">
                <span className={`ad-dot ${a.status === "approved" ? "ad-ok" : a.status === "rejected" ? "ad-bad" : "ad-warn"}`} />
                <b>{a.business_name}</b>
                <span className="ad-small ad-dim">
                  {a.email ?? a.user_id} · {a.status}
                  {a.reject_reason ? ` — "${a.reject_reason}"` : ""} · {when(a.reviewed_at ?? a.created_at)}
                  {a.reviewed_by ? ` · by ${a.reviewed_by}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function PendingCard({ app, onDone }: { app: Application; onDone: (text: string) => void }) {
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const act = async (approve: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      if (approve) {
        await vendorOps("approve", { id: app.id });
        onDone(`Approved ${app.business_name}.`);
      } else {
        await vendorOps("reject", { id: app.id, reason });
        onDone(`Rejected ${app.business_name}.`);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vd-card">
      <div className="vd-head">
        <b>{app.business_name}</b>
        <span className="ad-small ad-dim">{app.country} · applied {when(app.created_at)}</span>
      </div>
      <dl className="vd-facts">
        <dt>Account</dt><dd>{app.email ?? app.user_id}</dd>
        <dt>Registration no.</dt><dd>{app.registration_no ?? "—"}</dd>
        <dt>Website</dt><dd>{app.website ?? "—"}</dd>
        <dt>Socials</dt><dd>{app.socials ?? "—"}</dd>
        <dt>Expected clips</dt><dd>{app.expected_clips ?? "—"}</dd>
        <dt>Message</dt><dd>{app.message ?? "—"}</dd>
      </dl>
      {rejecting ? (
        <div className="ad-form-row">
          <input className="ad-input" placeholder="Reason (shown to the applicant)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="ad-btn ad-btn-ghost" disabled={busy || !reason.trim()} onClick={() => act(false)}>Reject</button>
          <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => setRejecting(false)}>Cancel</button>
        </div>
      ) : (
        <div className="ad-form-row">
          <button className="ad-btn ad-btn-gold" disabled={busy} onClick={() => act(true)}>{busy ? <span className="ad-spin" /> : null}Approve</button>
          <button className="ad-btn ad-btn-ghost" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button>
        </div>
      )}
      <Msg m={msg} />
    </div>
  );
}
