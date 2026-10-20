import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthError, failed, ops, setSession, signIn, signOut, loadSession } from "./api";
import type { Gaps, Job, MatcherStatus, NewSets, Overview, Workflow } from "./api";
import { EventsTab, PricesTab } from "./Tools";
import "./admin.css";

// ── Formatting ──────────────────────────────────────────────────────────────
const n = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("en-US"));
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
function ago(t: string | number | null | undefined) {
  if (t == null) return "never";
  const ms = typeof t === "number" ? (t < 1e12 ? t * 1000 : t) : Date.parse(t);
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
function dur(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d ${Math.round((s % 86400) / 3600)}h`;
}

type Tone = "ok" | "warn" | "bad" | "idle";

// ── Small pieces ────────────────────────────────────────────────────────────
const Dot = ({ tone }: { tone: Tone }) => <span className={`ad-dot ad-${tone}`} aria-hidden />;

function Meter({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const p = Math.min(100, pct(value, max));
  const t = tone ?? (p >= 90 ? "bad" : p >= 75 ? "warn" : "ok");
  return (
    <div className="ad-meter" role="meter" aria-valuenow={value} aria-valuemax={max}>
      <div className={`ad-meter-fill ad-bg-${t}`} style={{ width: `${p}%` }} />
    </div>
  );
}

function Panel({ title, sub, right, children, wide }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`ad-panel${wide ? " ad-wide" : ""}`}>
      <header className="ad-panel-head">
        <div>
          <h2>{title}</h2>
          {sub ? <p className="ad-sub">{sub}</p> : null}
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function Btn({ onClick, children, kind = "ghost", confirm, disabled }: { onClick: () => Promise<unknown> | void; children: React.ReactNode; kind?: "gold" | "ghost"; confirm?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`ad-btn ad-btn-${kind}`}
      disabled={busy || disabled}
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <span className="ad-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

const Err = ({ msg }: { msg: string }) => <p className="ad-err">{msg}</p>;

function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone: Tone }) {
  return (
    <div className={`ad-kpi ad-kpi-${tone}`}>
      <div className="ad-kpi-label">
        <Dot tone={tone} />
        {label}
      </div>
      <div className="ad-kpi-value">{value}</div>
      {hint ? <div className="ad-kpi-hint">{hint}</div> : null}
    </div>
  );
}

const conclusionTone = (c: string | null): Tone => (c === "success" ? "ok" : c === "failure" ? "bad" : c === "cancelled" || c === "timed_out" ? "warn" : "idle");

// ── Issues: everything that needs a human, in one list ──────────────────────
function useIssues(o: Overview | null, newSets: NewSets | null) {
  return useMemo(() => {
    if (!o) return [];
    const out: { tone: Tone; text: string }[] = [];
    if (failed(o.matcher)) out.push({ tone: "bad", text: `Matcher unreachable — ${o.matcher.error}` });
    else {
      const staleDays = Math.min(...Object.values(o.matcher.games).map((g) => (g.updated_at ? (Date.now() / 1000 - g.updated_at) / 86400 : 999)));
      if (staleDays > 30) out.push({ tone: "warn", text: `Scanner index last updated ${Math.round(staleDays)} days ago` });
      const mem = o.matcher.memory;
      if (mem && mem.available_mb < 400) out.push({ tone: "warn", text: `Matcher VPS low on memory (${mem.available_mb} MB free)` });
      if (o.matcher.job.state === "error") out.push({ tone: "bad", text: `Last embed job failed: ${o.matcher.job.error}` });
    }
    if (!failed(o.syncs)) {
      for (const w of o.syncs.workflows) if (w.last.conclusion && w.last.conclusion !== "success") out.push({ tone: w.last.conclusion === "failure" ? "bad" : "warn", text: `${w.name}: last run ${w.last.conclusion}` });
      const m = o.syncs.minutes;
      if (m.used_est >= m.limit * 0.8) out.push({ tone: m.used_est >= m.limit ? "bad" : "warn", text: `GitHub Actions ${n(m.used_est)} / ${n(m.limit)} min this month` });
    } else out.push({ tone: "warn", text: `Sync status unavailable — ${o.syncs.error}` });
    if (!failed(o.data)) {
      if (o.data.price_flags.open_7d > 0) out.push({ tone: "warn", text: `${n(o.data.price_flags.open_7d)} suspect prices held back this week` });
      const lc = o.data.scans.last_7d ? o.data.scans.low_confidence_7d / o.data.scans.last_7d : 0;
      if (lc > 0.3) out.push({ tone: "warn", text: `${Math.round(lc * 100)}% of scans this week were low-confidence` });
    }
    if (newSets?.missing_from_catalogue.length) out.push({ tone: "warn", text: `${newSets.missing_from_catalogue.length} priced set(s) not in the catalogue yet` });
    if (newSets?.ptcg_not_imported.length) out.push({ tone: "warn", text: `${newSets.ptcg_not_imported.length} new pokemontcg.io set(s) ready to import` });
    return out;
  }, [o, newSets]);
}

// ── Sections ────────────────────────────────────────────────────────────────
function MatcherPanel({ m }: { m: Overview["matcher"] }) {
  if (failed(m)) return <Panel title="Scanner server"><Err msg={m.error} /></Panel>;
  const games = Object.entries(m.games).sort((a, b) => b[1].cards - a[1].cards);
  const mem = m.memory;
  return (
    <Panel title="Scanner server" sub={`${m.model.toUpperCase()} on ${m.device} · up ${dur(m.uptime_s)} · ${m.latency_ms} ms`} right={<span className="ad-pill ad-pill-ok"><Dot tone="ok" />Online</span>}>
      <div className="ad-stats">
        <div><span>Matches since start</span><b>{n(m.matches_since_start)}</b></div>
        <div><span>Errors</span><b>{n(m.match_errors_since_start)}</b></div>
        <div><span>Last match</span><b>{ago(m.last_match_at)}</b></div>
        <div><span>Re-rank</span><b>{m.rerank ? "On" : "Off"}</b></div>
      </div>
      {mem ? (
        <div className="ad-row">
          <span className="ad-row-label">Memory</span>
          <Meter value={mem.total_mb - mem.available_mb} max={mem.total_mb} />
          <span className="ad-row-val">{n(mem.total_mb - mem.available_mb)} / {n(mem.total_mb)} MB</span>
        </div>
      ) : null}
      {m.load_avg ? (
        <div className="ad-row">
          <span className="ad-row-label">Load</span>
          <span className="ad-row-val ad-mono">{m.load_avg.map((l) => l.toFixed(2)).join("  ")}</span>
        </div>
      ) : null}
      <table className="ad-table">
        <thead><tr><th>Index</th><th className="ad-r">Cards</th><th className="ad-r">Updated</th></tr></thead>
        <tbody>
          {games.map(([g, v]) => (
            <tr key={g}>
              <td>{g}</td>
              <td className="ad-r ad-mono">{n(v.cards)}</td>
              <td className={`ad-r ${v.updated_at && Date.now() / 1000 - v.updated_at > 30 * 86400 ? "ad-t-warn" : "ad-dim"}`}>{ago(v.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <JobView job={m.job} />
    </Panel>
  );
}

function JobView({ job }: { job: Job }) {
  if (!job || job.state === "idle") return null;
  const total = job.total ?? 0;
  return (
    <div className={`ad-job ad-job-${job.state}`}>
      <div className="ad-job-head">
        <b>{job.state === "running" ? "Embedding…" : job.state === "done" ? "Last embed finished" : "Last embed failed"}</b>
        <span className="ad-dim">{job.game}{job.sets?.length ? ` · ${job.sets.join(", ")}` : ""} · {ago(job.finished_at ?? job.started_at)}</span>
      </div>
      {job.state === "running" && total ? <Meter value={job.done ?? 0} max={total} tone="ok" /> : null}
      {total ? <div className="ad-dim ad-small">{n(job.done)} / {n(total)} cards{job.failed ? ` · ${job.failed} image(s) failed` : ""}</div> : null}
      {job.log?.length ? <pre className="ad-log">{job.log.slice(-6).join("\n")}</pre> : null}
    </div>
  );
}

function SetsPanel({ newSets, reloadSets, gaps, checkGaps, embed, job }: { newSets: NewSets | null | { error: string }; reloadSets: () => Promise<void>; gaps: Gaps | null | { error: string }; checkGaps: () => Promise<void>; embed: (sets: string[] | null) => Promise<void>; job: Job | null }) {
  const running = job?.state === "running";
  return (
    <Panel title="Sets & scanner coverage" sub="New releases, catalogue and what the scanner can recognise" wide right={<Btn onClick={reloadSets}>Refresh</Btn>}>
      {newSets == null ? <p className="ad-dim">Checking…</p> : failed(newSets) ? <Err msg={newSets.error} /> : (
        <>
          {newSets.ptcg_not_imported.length ? (
            <div className="ad-block">
              <h3>Ready to import <span className="ad-count">{newSets.ptcg_not_imported.length}</span></h3>
              {newSets.ptcg_not_imported.map((s) => (
                <div className="ad-item" key={s.id}>
                  <div><b>{s.name}</b><span className="ad-dim"> · {s.id} · {s.total} cards · {s.released}</span></div>
                  <Btn kind="gold" confirm={`Import ${s.name} (${s.total} cards) into the catalogue?`} onClick={async () => { await ops("seed-sets", { ids: [s.id] }); await reloadSets(); }}>Import</Btn>
                </div>
              ))}
            </div>
          ) : null}
          <div className="ad-block">
            <h3>Priced but not in catalogue <span className="ad-count">{newSets.missing_from_catalogue.length}</span></h3>
            {newSets.missing_from_catalogue.length === 0 ? <p className="ad-dim ad-small">Every recently priced set is in the catalogue.</p> : newSets.missing_from_catalogue.map((s) => (
              <div className="ad-item" key={s.set_name}>
                <div>
                  <b>{s.set_name}</b>
                  <span className="ad-dim"> · {s.priced_rows} priced rows{s.released_at ? ` · ${s.released_at}` : ""}</span>
                  {!s.ptcg_ids.length ? <div className="ad-small ad-dim">Not on pokemontcg.io yet — import once it's listed</div> : null}
                </div>
                {s.ptcg_ids.length ? <Btn kind="gold" confirm={`Import ${s.set_name} (${s.ptcg_ids.join(", ")})?`} onClick={async () => { await ops("seed-sets", { ids: s.ptcg_ids }); await reloadSets(); }}>Import</Btn> : null}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="ad-block">
        <div className="ad-block-head">
          <h3>Not in the scanner yet {gaps && !failed(gaps) ? <span className="ad-count">{n(gaps.missing)}</span> : null}</h3>
          <div className="ad-actions">
            <Btn onClick={checkGaps} disabled={running}>{gaps ? "Re-check" : "Check"}</Btn>
            {gaps && !failed(gaps) && gaps.missing > 0 ? <Btn kind="gold" disabled={running} confirm={`Embed all ${gaps.missing} missing cards into the live scanner?`} onClick={() => embed(null)}>Embed all</Btn> : null}
          </div>
        </div>
        {gaps == null ? <p className="ad-dim ad-small">Compares the catalogue with the live Pokémon index (takes ~15s).</p> : failed(gaps) ? <Err msg={gaps.error} /> : gaps.missing === 0 ? <p className="ad-small ad-t-ok">The scanner knows every catalogued card.</p> : (
          <div className="ad-chips">
            {Object.entries(gaps.by_set).slice(0, 24).map(([set, c]) => (
              <button key={set} className="ad-chip" disabled={running} onClick={() => window.confirm(`Embed ${c} card(s) from ${set}?`) && embed([set])}>
                {set} <b>{c}</b>
              </button>
            ))}
          </div>
        )}
        {job && job.state !== "idle" ? <JobView job={job} /> : null}
      </div>
    </Panel>
  );
}

const PC_GAMES = ["pokemon", "mtg", "yugioh", "onepiece", "onepiece-extra", "lorcana", "lorcana-promo"];

function SyncsPanel({ s, rerun }: { s: Overview["syncs"]; rerun: (file: string, inputs?: object) => Promise<void> }) {
  const [pcGame, setPcGame] = useState("pokemon");
  if (failed(s)) return <Panel title="Nightly syncs" wide><Err msg={s.error} /></Panel>;
  const m = s.minutes;
  return (
    <Panel title="Nightly syncs" sub="GitHub Actions · this month" wide>
      <div className="ad-row">
        <span className="ad-row-label">Minutes</span>
        <Meter value={m.used_est} max={m.limit} />
        <span className="ad-row-val">{n(m.used_est)} / {n(m.limit)} <span className="ad-dim">· projected {n(m.projected)}</span></span>
      </div>
      <div className="ad-wf-list">
        {s.workflows.map((w: Workflow) => (
          <div className="ad-wf" key={w.name}>
            <div className="ad-wf-top">
              <div className="ad-wf-name"><Dot tone={conclusionTone(w.last.conclusion ?? w.last.status)} /><a href={w.last.url} target="_blank" rel="noreferrer">{w.name}</a></div>
              <div className="ad-dim ad-small">{ago(w.last.started_at)} · {dur(w.last.duration_s)} · {n(w.minutes_month)} min</div>
            </div>
            <div className="ad-hist" aria-label="Last runs, newest first">
              {w.history.map((h, i) => <span key={i} className={`ad-hist-dot ad-bg-${conclusionTone(h.conclusion)}`} title={`${h.conclusion} · ${h.title} · ${ago(h.at)}`} />)}
            </div>
            <div className="ad-wf-foot">
              <span className="ad-small ad-dim">7d: <span className="ad-t-ok">{w.week.success} ok</span>{w.week.failure ? <> · <span className="ad-t-bad">{w.week.failure} failed</span></> : null}{w.week.other ? <> · {w.week.other} other</> : null}</span>
              {w.file === "sync-pricecharting.yml" ? (
                <span className="ad-actions">
                  <select className="ad-select" value={pcGame} onChange={(e) => setPcGame(e.target.value)}>{PC_GAMES.map((g) => <option key={g}>{g}</option>)}</select>
                  <Btn confirm={`Run the PriceCharting sync for ${pcGame} now?`} onClick={() => rerun(w.file, { game: pcGame })}>Run</Btn>
                </span>
              ) : (
                <Btn confirm={`Run "${w.name}" now? It uses Actions minutes.`} onClick={() => rerun(w.file)}>Run now</Btn>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ApisPanel({ a }: { a: Overview["apis"] }) {
  const [tcggo, setTcggo] = useState<any>(null);
  if (failed(a)) return <Panel title="API limits"><Err msg={a.error} /></Panel>;
  return (
    <Panel title="API limits" sub="Today, per provider">
      <div className="ad-block">
        <h3>eBay Browse</h3>
        {failed(a.ebay) ? <Err msg={a.ebay.error} /> : a.ebay.map((r) => (
          <div className="ad-row" key={r.resource}>
            <span className="ad-row-label">{r.resource.replace("buy.browse", "browse")}</span>
            <Meter value={r.limit - r.remaining} max={r.limit} />
            <span className="ad-row-val">{n(r.remaining)} left</span>
          </div>
        ))}
      </div>
      <div className="ad-block">
        <div className="ad-block-head">
          <h3>TCGGO (Cardmarket)</h3>
          <Btn onClick={async () => setTcggo(await ops("tcggo-quota").catch((e) => ({ error: e.message })))}>Check quota</Btn>
        </div>
        {tcggo == null ? <p className="ad-dim ad-small">Uses one API call, so it only runs when you ask.</p> : failed(tcggo) ? <Err msg={tcggo.error} /> : tcggo.requests_limit ? (
          <div className="ad-row">
            <span className="ad-row-label">Requests</span>
            <Meter value={Number(tcggo.requests_limit) - Number(tcggo.requests_remaining)} max={Number(tcggo.requests_limit)} />
            <span className="ad-row-val">{n(Number(tcggo.requests_remaining))} left</span>
          </div>
        ) : <p className="ad-small ad-dim">HTTP {tcggo.status} — no quota headers returned.</p>}
      </div>
      <div className="ad-block">
        <h3>AI grading (OpenRouter)</h3>
        {failed(a.openrouter) ? <Err msg={a.openrouter.error} /> : (
          <div className="ad-row">
            <span className="ad-row-label">Credits</span>
            <Meter value={a.openrouter.used} max={a.openrouter.credits} />
            <span className="ad-row-val">${(a.openrouter.credits - a.openrouter.used).toFixed(2)} left <span className="ad-dim">· ${a.openrouter.usage_monthly.toFixed(2)} this month</span></span>
          </div>
        )}
      </div>
      <div className="ad-block">
        <h3>Ximilar</h3>
        {failed(a.ximilar) ? <Err msg={a.ximilar.error} /> : a.ximilar.limit ? (
          <div className="ad-row">
            <span className="ad-row-label">Credits</span>
            <Meter value={a.ximilar.used ?? 0} max={a.ximilar.limit} />
            <span className="ad-row-val">{n(a.ximilar.used)} / {n(a.ximilar.limit)}</span>
          </div>
        ) : <p className="ad-dim ad-small">No credit info returned.</p>}
      </div>
      <div className="ad-block">
        <h3>App proxy (paid actions)</h3>
        {a.proxy_today.length === 0 ? <p className="ad-dim ad-small">No paid calls today.</p> : (
          <table className="ad-table">
            <tbody>{a.proxy_today.map((p) => <tr key={p.action}><td>{p.action}</td><td className="ad-r ad-mono">{n(p.calls)}</td><td className="ad-r ad-dim">{p.callers} caller{p.callers === 1 ? "" : "s"}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function DataPanel({ d }: { d: Overview["data"] }) {
  if (failed(d)) return <Panel title="Data quality"><Err msg={d.error} /></Panel>;
  const pc = d.pricecharting_coverage;
  return (
    <Panel title="Data quality" sub="Prices, catalogue and search">
      <div className="ad-stats">
        <div><span>Flags 24h</span><b>{n(d.price_flags.last_24h)}</b></div>
        <div><span>Open flags 7d</span><b className={d.price_flags.open_7d ? "ad-t-warn" : ""}>{n(d.price_flags.open_7d)}</b></div>
        <div><span>No image</span><b>{n(d.missing_images)}</b></div>
        <div><span>PC coverage</span><b>{pct(pc.matched, pc.total)}%</b></div>
      </div>
      <div className="ad-block">
        <h3>Suspect prices <span className="ad-count">{d.price_flags.recent.length}</span></h3>
        <div className="ad-scroll">
          <table className="ad-table">
            <tbody>
              {d.price_flags.recent.map((f, i) => (
                <tr key={i}>
                  <td><b>{f.name}</b> <span className="ad-dim">#{f.card_number}</span><div className="ad-small ad-dim">{f.set_name}</div></td>
                  <td className="ad-r ad-mono">€{f.old_price} → €{f.new_price}</td>
                  <td className={`ad-r ad-mono ${f.ratio > 1 ? "ad-t-ok" : "ad-t-bad"}`}>{f.ratio}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="ad-block">
        <h3>Searches with no results · 7d</h3>
        {d.search_gaps.length === 0 ? <p className="ad-dim ad-small">None.</p> : (
          <div className="ad-chips">{d.search_gaps.map((g) => <span key={g.game + g.query} className="ad-chip ad-chip-static">{g.query} <b>{g.count}</b></span>)}</div>
        )}
      </div>
    </Panel>
  );
}

function ActivityPanel({ d, u }: { d: Overview["data"]; u: Overview["users"] }) {
  return (
    <Panel title="Activity" sub="Users, scans and feedback" wide>
      {failed(u) ? <Err msg={u.error} /> : (
        <div className="ad-stats">
          <div><span>Users</span><b>{n(u.users)}</b></div>
          <div><span>Lockrs</span><b>{n(u.lockrs)}</b></div>
          <div><span>Cards owned</span><b>{n(u.owned_cards)}</b></div>
          <div><span>Push devices</span><b>{n(u.push_tokens)}</b></div>
        </div>
      )}
      {failed(d) ? null : (
        <div className="ad-split">
          <div className="ad-block">
            <h3>Recent scans <span className="ad-count">{d.scans.last_7d} · 7d</span></h3>
            <div className="ad-scans">
              {d.scans.recent.map((s, i) => (
                <div className="ad-scan" key={i}>
                  {s.matched_image_url ? <img src={s.matched_image_url} alt="" loading="lazy" /> : <div className="ad-scan-ph" />}
                  <div className="ad-scan-meta">
                    <b>{s.name}</b>
                    <span className="ad-small ad-dim">{s.set_name} · {ago(s.created_at)}</span>
                    <span className={`ad-small ad-mono ${s.margin < 0.03 ? "ad-t-warn" : "ad-t-ok"}`}>{s.score.toFixed(3)} · margin {s.margin.toFixed(3)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ad-block">
            <h3>Feedback <span className="ad-count">{d.feedback.last_7d} · 7d</span></h3>
            {d.feedback.recent.map((f, i) => (
              <div className="ad-feedback" key={i}>
                <div className="ad-small"><span className="ad-tag">{f.category}</span> <span className="ad-dim">{f.screen} · {ago(f.created_at)}{f.resolved_at ? " · resolved" : ""}</span></div>
                <p>{f.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="ad-login">
      <form
        className="ad-login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            setSession(await signIn(email, password));
            onIn();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Sign-in failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="ad-brand">ValueLockr <span>Ops</span></div>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error ? <Err msg={error} /> : null}
        <button className="ad-btn ad-btn-gold ad-btn-block" disabled={busy}>{busy ? <span className="ad-spin" /> : null}Sign in</button>
      </form>
    </div>
  );
}

const TABS = [
  ["overview", "Overview"],
  ["prices", "Prices"],
  ["events", "Events"],
] as const;
type Tab = (typeof TABS)[number][0];
const tabFromHash = (): Tab => {
  const h = window.location.hash.slice(1);
  return TABS.some(([k]) => k === h) ? (h as Tab) : "overview";
};

export default function Dashboard() {
  const [signedIn, setSignedIn] = useState(() => !!loadSession());
  const [tab, setTabState] = useState<Tab>(tabFromHash);
  const setTab = (t: Tab) => {
    setTabState(t);
    window.history.replaceState(null, "", t === "overview" ? window.location.pathname : `#${t}`);
  };
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newSets, setNewSets] = useState<NewSets | { error: string } | null>(null);
  const [gaps, setGaps] = useState<Gaps | { error: string } | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const poll = useRef<number | null>(null);

  const handle = useCallback((e: unknown) => {
    if (e instanceof AuthError) {
      signOut();
      setSignedIn(false);
      setError(e.message);
    } else setError(e instanceof Error ? e.message : String(e));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ops<Overview>("overview");
      setO(data);
      setError(null);
      if (!failed(data.matcher)) setJob(data.matcher.job);
    } catch (e) {
      handle(e);
    } finally {
      setLoading(false);
    }
  }, [handle]);

  const reloadSets = useCallback(async () => {
    try {
      setNewSets(await ops<NewSets>("new-sets"));
    } catch (e) {
      if (e instanceof AuthError) handle(e);
      else setNewSets({ error: e instanceof Error ? e.message : String(e) });
    }
  }, [handle]);

  const checkGaps = useCallback(async () => {
    try {
      setGaps(await ops<Gaps>("gaps", { game: "pokemon" }));
    } catch (e) {
      setGaps({ error: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  const watchJob = useCallback(() => {
    if (poll.current) window.clearInterval(poll.current);
    poll.current = window.setInterval(async () => {
      try {
        const j = await ops<Job>("job");
        setJob(j);
        if (j?.state !== "running") {
          if (poll.current) window.clearInterval(poll.current);
          poll.current = null;
          await Promise.all([refresh(), checkGaps()]);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  }, [refresh, checkGaps]);

  const embed = useCallback(async (sets: string[] | null) => {
    try {
      const r = await ops<{ ok: boolean; message: string; job: Job }>("embed", { game: "pokemon", sets });
      setJob(r.job);
      if (!r.ok) setError(r.message);
      else watchJob();
    } catch (e) {
      handle(e);
    }
  }, [handle, watchJob]);

  const rerun = useCallback(async (file: string, inputs?: object) => {
    try {
      await ops("rerun", { workflow: file, inputs });
      window.setTimeout(refresh, 4000);
    } catch (e) {
      handle(e);
    }
  }, [handle, refresh]);

  useEffect(() => {
    if (!signedIn) return;
    refresh();
    reloadSets();
    const id = window.setInterval(() => document.visibilityState === "visible" && refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [signedIn, refresh, reloadSets]);

  useEffect(() => {
    if (job?.state === "running" && !poll.current) watchJob();
  }, [job, watchJob]);

  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current); }, []);

  const issues = useIssues(o, newSets && !failed(newSets) ? newSets : null);

  if (!signedIn) return <Login onIn={() => setSignedIn(true)} />;

  const m = o?.matcher;
  const s = o?.syncs;
  const syncOk = s && !failed(s) ? s.workflows.filter((w) => w.last.conclusion === "success").length : 0;
  const syncTotal = s && !failed(s) ? s.workflows.length : 0;

  return (
    <div className="ad-root">
      <header className="ad-top">
        <div className="ad-brand">ValueLockr <span>Ops</span></div>
        <div className="ad-top-right">
          <span className="ad-dim ad-small ad-hide-sm">{o ? `Updated ${ago(o.generated_at)}` : "Loading…"}</span>
          <button className="ad-icon-btn" onClick={refresh} disabled={loading} aria-label="Refresh">{loading ? <span className="ad-spin" /> : "↻"}</button>
          <button className="ad-icon-btn" onClick={() => { signOut(); setSignedIn(false); setO(null); }} aria-label="Sign out">⏻</button>
        </div>
      </header>

      <nav className="ad-tabs" aria-label="Sections">
        {TABS.map(([k, label]) => (
          <button key={k} className={`ad-tab${tab === k ? " ad-tab-on" : ""}`} onClick={() => setTab(k)} aria-current={tab === k ? "page" : undefined}>
            {label}
          </button>
        ))}
      </nav>

      <main className="ad-main">
        {error ? <div className="ad-banner ad-banner-bad">{error}</div> : null}
        {tab === "prices" ? <PricesTab /> : tab === "events" ? <EventsTab /> : !o ? <div className="ad-loading"><span className="ad-spin ad-spin-lg" />Collecting status…</div> : (
          <>
            <div className={`ad-hero ${issues.some((i) => i.tone === "bad") ? "ad-hero-bad" : issues.length ? "ad-hero-warn" : "ad-hero-ok"}`}>
              <div>
                <div className="ad-hero-title">{issues.length === 0 ? "All systems normal" : `${issues.length} thing${issues.length === 1 ? "" : "s"} need${issues.length === 1 ? "s" : ""} attention`}</div>
                <div className="ad-dim ad-small">Signed in as {o.admin}</div>
              </div>
              {issues.length ? (
                <ul className="ad-issues">
                  {issues.map((i, k) => <li key={k}><Dot tone={i.tone} />{i.text}</li>)}
                </ul>
              ) : null}
            </div>

            <div className="ad-kpis">
              <Kpi label="Scanner" tone={m && !failed(m) ? "ok" : "bad"} value={m && !failed(m) ? "Online" : "Down"} hint={m && !failed(m) ? `${m.latency_ms} ms · ${n(Object.values((m as MatcherStatus).games).reduce((a, g) => a + g.cards, 0))} cards` : "unreachable"} />
              <Kpi label="Syncs" tone={syncTotal && syncOk === syncTotal ? "ok" : syncOk ? "warn" : "bad"} value={`${syncOk}/${syncTotal}`} hint="last runs green" />
              <Kpi
                label="Actions minutes"
                tone={s && !failed(s) ? (s.minutes.used_est >= s.minutes.limit ? "bad" : s.minutes.used_est >= s.minutes.limit * 0.8 ? "warn" : "ok") : "idle"}
                value={s && !failed(s) ? `${pct(s.minutes.used_est, s.minutes.limit)}%` : "—"}
                hint={s && !failed(s) ? `${n(s.minutes.used_est)} of ${n(s.minutes.limit)}` : undefined}
              />
              <Kpi label="Scans · 7d" tone="idle" value={!failed(o.data) ? n(o.data.scans.last_7d) : "—"} hint={!failed(o.data) ? `${n(o.data.scans.last_24h)} today` : undefined} />
              <Kpi label="Users" tone="idle" value={!failed(o.users) ? n(o.users.users) : "—"} hint={!failed(o.users) ? `${n(o.users.lockrs)} Lockrs` : undefined} />
            </div>

            <div className="ad-grid">
              <SetsPanel newSets={newSets} reloadSets={reloadSets} gaps={gaps} checkGaps={checkGaps} embed={embed} job={job} />
              <MatcherPanel m={o.matcher} />
              <ApisPanel a={o.apis} />
              <SyncsPanel s={o.syncs} rerun={rerun} />
              <DataPanel d={o.data} />
              <ActivityPanel d={o.data} u={o.users} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
