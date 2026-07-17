import { useState, useEffect, useRef, type FC } from 'react';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import ptData from '../data/processingTimes.json';
import { getJourney, updateJourney, getTrackerOptions, getProcessingStats } from '../services/journeyApi';
import { createCheckoutSession } from '../services/api';
import { PaywallGate } from './common/PaywallGate';
import { useJourneyStore } from '../stores/journeyStore';
import { SEO } from './common/SEO';
import './ApplicationTracker.css';

const TRACKER_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Express Entry PR Application Tracker',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://mentorvisa.com/track-my-application',
  description: 'Track every Express Entry PR milestone (AOR, biometrics, medical, background check, final decision, P1/P2, PPR, eCOPR) and get processing-time predictions tailored to your stream, country and category from real recent cases.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
  provider: { '@type': 'Organization', name: 'Mentor Visa', url: 'https://mentorvisa.com' },
});

/**
 * PR Application Tracker.
 *  - FREE: milestone timeline + "About Your Application" cohort inputs + dependents
 *    (persisted in journey.tracker_data).
 *  - PAID (Optimize/starter): Smart Timeline Predictions from community case data
 *    (cohort percentiles), with inland (Canada) -> P1/P2 vs outland -> PPR.
 */

// ─── Types ───────────────────────────────────────────────────────────────────
type MilestoneKey =
  | 'pool_entry' | 'ita' | 'eapr' | 'aor' | 'mep' | 'bil'
  | 'biometrics' | 'bg_check' | 'bg_complete' | 'decision'
  | 'ppr' | 'p1' | 'p2' | 'ecopr';

interface Dependent { id: string; name: string; relationship: 'spouse' | 'child'; }
interface Cohort { country: string; stream: string; category: string; vo: string; }
interface ProcTransition { label: string; n: number; cohort: string; p25: number; median: number; p75: number; p90: number; }
interface TrackerOptions { streams: string[]; countries: string[]; categories: string[]; visa_offices: string[]; }
// Phase C extras: IRCC can issue multiple ADRs, but at most one PFL per application.
interface ADREvent { id: string; received?: string; submitted?: string; }
interface PFLEvent { received?: string; submitted?: string; }
interface TrackerEvents { adrs: ADREvent[]; pfl?: PFLEvent | null; }
interface TrackerState {
  milestones: Partial<Record<MilestoneKey, string>>;
  dependents: Dependent[];
  cohort: Cohort;
  events: TrackerEvents;
}

// Static fallbacks (used only if the DB options haven't loaded yet)
const FALLBACK_STREAMS = ['CEC', 'FSW-Outland', 'FSW-Inland', 'PNP-Inland', 'PNP-Outland'];
const FALLBACK_CATEGORIES = ['General', 'CEC', 'PNP', 'French', 'Healthcare', 'STEM', 'Trades', 'Transport', 'Agriculture', 'Education'];

// Ordered for the tracker decision: lead with the tracker/predictor (the feature being unlocked
// here), then the rest of the Optimize toolkit. Mirrors the pricing page contents.
const OPTIMIZE_FEATURES = [
  'Smart Post-ITA Milestone Tracker & Predictor',
  'Unlimited NOC Code Finder',
  'Unlimited Employment Letter Audits',
  'Unlimited CRS Point Simulator (What-If Scenarios)',
  '20 Question Credits — Express Entry AI Assistant',
  'Personalized Document Checklist & Expiry Tracker',
  '1 Free GCMS Notes Order ($19.90 value)',
];

// ─── Milestone config ──────────────────────────────────────────────────────────
interface MilestoneDef { key: MilestoneKey; label: string; phase: string; icon: string; tag?: string; }
const MILESTONES: MilestoneDef[] = [
  { key: 'pool_entry', label: 'Profile in Express Entry Pool', phase: 'Phase A · Pre-ITA', icon: '🎯' },
  { key: 'ita',        label: 'Invitation to Apply (ITA)', phase: 'Phase B · ITA', icon: '📨' },
  { key: 'eapr',       label: 'e-APR Submitted', phase: 'Phase C · Post-eAPR', icon: '📝' },
  { key: 'aor',        label: 'Acknowledgement of Receipt (AOR)', phase: 'Phase C · Post-eAPR', icon: '📬' },
  { key: 'mep',        label: 'Medical Exam Passed (MEP)', phase: 'Phase C · Post-eAPR', icon: '🏥' },
  { key: 'bil',        label: 'Biometrics Instruction Letter (BIL)', phase: 'Phase C · Post-eAPR', icon: '👋' },
  { key: 'biometrics', label: 'Biometrics Completed', phase: 'Phase C · Post-eAPR', icon: '✅' },
  { key: 'bg_check',   label: 'Background Check Started', phase: 'Phase C · Post-eAPR', icon: '🔍' },
  { key: 'bg_complete', label: 'Background Check Completed', phase: 'Phase C · Post-eAPR', icon: '🔒' },
  { key: 'decision',   label: 'Final Decision Made', phase: 'Phase C · Post-eAPR', icon: '⚖️' },
  { key: 'ppr',        label: 'Passport Request (PPR)', phase: 'Final', tag: 'Outland', icon: '🛂' },
  { key: 'p1',         label: 'P1 — PR Portal Invitation', phase: 'Final', tag: 'Inland', icon: '🚪' },
  { key: 'p2',         label: 'P2 — Submit Photo & Details', phase: 'Final', tag: 'Inland', icon: '📤' },
  { key: 'ecopr',      label: 'eCOPR — Confirmation of PR', phase: 'Final', icon: '🎉' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────────
const DAY = 86400000;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parse = (s?: string | null) => (s ? new Date(s.slice(0, 10) + 'T00:00:00') : null);
const daysFromToday = (d: Date) => Math.round((d.getTime() - today().getTime()) / DAY);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmt = (d: Date | null) => d ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const uid = () => (crypto?.randomUUID?.() || `dep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

const ACCENT = '#6366f1', GREEN = '#10b981', AMBER = '#f59e0b', RED = '#ef4444', MUTED = '#94a3b8';
const inputStyle: React.CSSProperties = { fontSize: '0.82rem', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-main)' };
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid var(--border-color)', borderRadius: 14, padding: '20px 22px' };
const headStyle: React.CSSProperties = { fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED, fontWeight: 700, marginBottom: 12 };

// ─── "Your Estimated Timeline" horizontal visual ───────────────────────────────
export interface TimelineItem {
  key: string; label: string; final?: boolean;
  actual: Date | null;        // logged by the user
  pred: Date | null;          // chained prediction
  p25: Date | null; p75: Date | null;
  n: number;
}

const fmtShort = (d: Date | null) => d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';

const EstimatedTimeline: FC<{ items: TimelineItem[]; aor: Date }> = ({ items, aor }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  if (!items.length) return null;

  // Export the card as a PNG — native share sheet on mobile, download elsewhere.
  const shareCard = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#ffffff', scale: 2, logging: false });
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'my-express-entry-timeline.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Express Entry timeline', text: 'My estimated Express Entry timeline — via mentorvisa.com' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'my-express-entry-timeline.png';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      }
    } catch { /* user cancelled the share sheet, or capture failed — no-op */ }
    finally { setSharing(false); }
  };

  const finalItem = items[items.length - 1];
  const journeyEnd = finalItem.actual || finalItem.pred;
  const totalDays = journeyEnd ? Math.round((journeyEnd.getTime() - aor.getTime()) / DAY) : null;
  const daysSince = Math.max(0, -daysFromToday(aor));
  // "You're here": the first milestone that isn't logged and whose expected date is still ahead.
  let hereIdx = items.findIndex(it => !it.actual && it.pred && daysFromToday(it.pred) >= 0);
  if (hereIdx === -1) hereIdx = items.length - 1;

  return (
    <div ref={cardRef} className="tracker-card" style={{ ...cardStyle, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <h2 style={{ ...headStyle, marginBottom: 0 }}>Your Estimated Timeline</h2>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 11px', borderRadius: 999, background: '#ede9fe', color: '#6d28d9' }}>
          AOR: {fmt(aor)}
        </span>
        <button onClick={shareCard} disabled={sharing} data-html2canvas-ignore="true"
          style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, padding: '5px 13px', borderRadius: 999, border: `1px solid ${ACCENT}`, background: '#fff', color: ACCENT, cursor: 'pointer' }}>
          {sharing ? 'Preparing…' : '📤 Share'}
        </button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: 'linear-gradient(135deg, #eef2ff, #f5f3ff)', border: '1px solid #e0e7ff', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.8px', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 3 }}>Estimated journey</div>
          <div style={{ fontSize: 'clamp(1rem, 3.5vw, 1.3rem)', fontWeight: 800, color: 'var(--text-main, #1e293b)' }}>
            {fmt(aor)} → {fmt(journeyEnd)}
          </div>
          {totalDays !== null && (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>~{totalDays} days from AOR to {finalItem.label}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.8px', color: '#7c3aed', textTransform: 'uppercase', marginBottom: 3 }}>Days since AOR</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main, #1e293b)', lineHeight: 1 }}>
            {daysSince}<span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}> days</span>
          </div>
        </div>
      </div>

      {/* Node row — horizontally scrollable on small screens */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
        <div style={{ position: 'relative', display: 'flex', minWidth: `${items.length * 138}px` }}>
          {/* connecting line (sits at dot height: chip 22 + label ~20 + gap 8 + half-dot 7 = 57) */}
          <div style={{ position: 'absolute', left: 60, right: 60, top: 57, height: 2, background: '#e2e8f0' }} />
          {items.map((it, i) => {
            const shown = it.actual || it.pred;
            const done = !!it.actual;
            const likelyDone = !done && !!it.pred && daysFromToday(it.pred) < 0;
            const color = it.final ? AMBER : (done || likelyDone) ? ACCENT : '#a5b4fc';
            return (
              <div key={it.key} style={{ flex: '1 0 138px', textAlign: 'center', position: 'relative', padding: '0 6px' }}>
                {/* You're-here chip row (fixed height keeps dots aligned) */}
                <div style={{ height: 22 }}>
                  {i === hereIdx && (
                    <span style={{ fontSize: '0.64rem', fontWeight: 800, padding: '2px 10px', borderRadius: 999, border: `1.5px solid ${ACCENT}`, color: ACCENT, background: '#fff', whiteSpace: 'nowrap' }}>
                      › You're here
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: it.final ? AMBER : done || likelyDone ? '#6d28d9' : 'var(--text-main, #1e293b)', height: 20 }}>
                  {it.label}
                </div>
                <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
                  <span style={{
                    width: it.final ? 15 : 13, height: it.final ? 15 : 13, borderRadius: '50%', display: 'inline-block',
                    background: done || likelyDone || it.final ? color : '#fff',
                    border: `3px solid ${color}`, boxShadow: i === hereIdx ? `0 0 0 4px ${ACCENT}22` : undefined,
                  }} />
                </div>
                <div style={{ fontSize: '0.86rem', fontWeight: 800, marginTop: 8, color: it.final ? AMBER : 'var(--text-main, #1e293b)' }}>
                  {fmt(shown)}
                </div>
                {done ? (
                  <div style={{ fontSize: '0.66rem', color: GREEN, fontWeight: 700, marginTop: 2 }}>logged ✓</div>
                ) : likelyDone ? (
                  <div style={{ fontSize: '0.66rem', color: '#7c3aed', fontWeight: 700, marginTop: 2 }}>likely done</div>
                ) : (
                  <div style={{ fontSize: '0.66rem', color: MUTED, marginTop: 2 }}>
                    {fmtShort(it.p25)} · {fmtShort(it.pred)} · <strong style={{ color: it.final ? AMBER : '#6d28d9' }}>{fmtShort(it.p75)}</strong>
                  </div>
                )}
                <div style={{ marginTop: 5 }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#ecfdf5', color: '#047857' }}>n={it.n}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ fontSize: '0.66rem', color: MUTED, marginTop: 10, marginBottom: 0, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span>Dates chain from your own logged milestones where available (small dates: 25th · median · 75th percentile). Estimates from similar recent cases — guidance, not a guarantee.</span>
        <span style={{ fontWeight: 700, color: ACCENT, whiteSpace: 'nowrap' }}>mentorvisa.com/track-my-application</span>
      </p>
    </div>
  );
};

// Community-data insight shown when the user logs an ADR (refreshed with each monthly scrape).
const ADR_IMPACT = (ptData as any).adr_impact as
  { with_median: number; without_median: number; delta: number; n_with: number; n_without: number } | undefined;

// ─── Phase C events: ADRs (repeatable) + PFL (single) ──────────────────────────
const PhaseCEvents: FC<{
  events: TrackerEvents;
  onChange: (ev: TrackerEvents) => void;
}> = ({ events, onChange }) => {
  const dateIn = (value: string | undefined, set: (v: string) => void, label: string) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.66rem', fontWeight: 700, color: MUTED, flex: 1, minWidth: 128 }}>
      {label}
      <input type="date" value={value || ''} onChange={e => set(e.target.value)} style={{ ...inputStyle, fontSize: '0.8rem' }} />
    </label>
  );
  return (
    <div style={{ background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: 12, padding: '14px 16px', margin: '10px 0 4px' }}>
      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#92400e', marginBottom: 2 }}>⚠️ Phase C events (optional)</div>
      <div style={{ fontSize: '0.7rem', color: '#a16207', marginBottom: 10 }}>
        Did IRCC ask for more? Track document requests (ADR) and procedural fairness letters (PFL). Multiple ADRs can happen; only one PFL.
      </div>

      {events.adrs.map((adr, i) => (
        <div key={adr.id} style={{ background: '#fff', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800 }}>📎 ADR {events.adrs.length > 1 ? `#${i + 1}` : ''} — Additional Document Request</span>
            <button onClick={() => onChange({ ...events, adrs: events.adrs.filter(a => a.id !== adr.id) })}
              aria-label="Remove ADR" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: '0.85rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {dateIn(adr.received, v => onChange({ ...events, adrs: events.adrs.map(a => a.id === adr.id ? { ...a, received: v || undefined } : a) }), 'ADR received')}
            {dateIn(adr.submitted, v => onChange({ ...events, adrs: events.adrs.map(a => a.id === adr.id ? { ...a, submitted: v || undefined } : a) }), 'ADR submitted')}
          </div>
        </div>
      ))}

      {events.pfl && (
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#b91c1c' }}>🚨 PFL — Procedural Fairness Letter</span>
            <button onClick={() => onChange({ ...events, pfl: null })}
              aria-label="Remove PFL" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: '0.85rem' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {dateIn(events.pfl.received, v => onChange({ ...events, pfl: { ...events.pfl, received: v || undefined } }), 'PFL received')}
            {dateIn(events.pfl.submitted, v => onChange({ ...events, pfl: { ...events.pfl, submitted: v || undefined } }), 'PFL response submitted')}
          </div>
        </div>
      )}

      {events.adrs.length > 0 && ADR_IMPACT && (
        <div style={{ fontSize: '0.7rem', color: '#78350f', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', marginBottom: 8, lineHeight: 1.55 }}>
          📊 In our community data, cases with an ADR reached PPR a median of <strong>{ADR_IMPACT.delta} days later</strong> ({ADR_IMPACT.with_median}d vs {ADR_IMPACT.without_median}d — {ADR_IMPACT.n_with} ADR cases vs {ADR_IMPACT.n_without} without; small sample, treat as indicative).
        </div>
      )}
      {events.pfl && (
        <div style={{ fontSize: '0.7rem', color: '#7f1d1d', background: '#fee2e2', borderRadius: 8, padding: '8px 12px', marginBottom: 8, lineHeight: 1.55 }}>
          A PFL is serious — respond fully before the deadline. Reviews of PFL responses typically add meaningful processing time. Your{' '}
          <a href="/order-gcms-notes" style={{ color: '#b91c1c', fontWeight: 700 }}>GCMS notes</a> show exactly what concern triggered it.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => onChange({ ...events, adrs: [...events.adrs, { id: uid() }] })}
          style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid #fcd34d', background: '#fff', color: '#92400e', cursor: 'pointer' }}>
          + Add ADR
        </button>
        {!events.pfl && (
          <button onClick={() => onChange({ ...events, pfl: {} })}
            style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#b91c1c', cursor: 'pointer' }}>
            + Add PFL
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Timeline milestone card (modern, mobile-friendly, with "N days ago") ──────
const MilestoneCard: FC<{ def: MilestoneDef; date?: string; isNext: boolean; onChange: (v: string) => void }> =
({ def, date, isNext, onChange }) => {
  const d = parse(date);
  const since = d ? -daysFromToday(d) : null;
  let agoNum = '', agoLbl = '';
  if (since !== null) {
    if (since === 0) { agoNum = 'Today'; agoLbl = ''; }
    else if (since > 0) { agoNum = String(since); agoLbl = since === 1 ? 'day ago' : 'days ago'; }
    else { agoNum = String(-since); agoLbl = -since === 1 ? 'day to go' : 'days to go'; }
  }
  return (
    <div className={`milestone-card${d ? ' milestone-done' : ''}${isNext ? ' milestone-next' : ''}`}>
      <div className="milestone-icon">{def.icon}</div>
      <div className="milestone-main">
        <div className="milestone-title-row">
          <span className="milestone-title">{def.label}</span>
          {def.tag && <span className="milestone-tag" data-tag={def.tag}>{def.tag}</span>}
          {isNext && <span className="milestone-chip">NEXT</span>}
        </div>
        <input type="date" className="milestone-date-input" value={date || ''} onChange={(e) => onChange(e.target.value)} aria-label={`${def.label} date`} />
      </div>
      {since !== null && (
        <div className="milestone-ago">
          <div className="milestone-ago-num">{agoNum}</div>
          {agoLbl && <div className="milestone-ago-lbl">{agoLbl}</div>}
        </div>
      )}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const ApplicationTrackerPage: FC = () => {
  const { isSignedIn, getToken } = useAuth();
  const { tier } = useJourneyStore();
  const isPaid = tier === 'starter' || tier === 'complete';
  const EMPTY_COHORT: Cohort = { country: '', stream: '', category: '', vo: '' };
  const [state, setState] = useState<TrackerState>({ milestones: {}, dependents: [], cohort: EMPTY_COHORT, events: { adrs: [] } });
  const [options, setOptions] = useState<TrackerOptions>({ streams: [], countries: [], categories: [], visa_offices: [] });
  const [proc, setProc] = useState<Record<string, ProcTransition | null> | null>(null);
  const [spousePrefill, setSpousePrefill] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newDep, setNewDep] = useState<{ name: string; relationship: 'spouse' | 'child' }>({ name: '', relationship: 'child' });

  // Load journey state + cohort dropdown options.
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const [j, opts] = await Promise.all([
          getJourney(token),
          getTrackerOptions(token).catch(() => null),
        ]);
        if (cancelled) return;
        const t = (j as any)?.tracker_data || {};
        setState({
          milestones: t.milestones ?? {},
          dependents: t.dependents ?? [],
          cohort: { ...EMPTY_COHORT, ...(t.cohort || {}) },
          events: { adrs: t.events?.adrs ?? [], pfl: t.events?.pfl ?? null },
        });
        setSpousePrefill(Boolean((j as any)?.profile_data?.spouse_accompanying) && !(t.dependents?.length));
        if (opts) setOptions(opts as TrackerOptions);
      } catch (e) {
        console.error('[tracker] load failed', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn, getToken]);

  // Fetch cohort processing-time stats when stream is set (403 for free users -> proc stays null).
  useEffect(() => {
    if (!isSignedIn || !loaded || !state.cohort.stream) { setProc(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getProcessingStats(token, {
          stream: state.cohort.stream, country: state.cohort.country,
          category: state.cohort.category, vo: state.cohort.vo,
        });
        if (!cancelled) setProc((res as any)?.transitions ?? null);
      } catch { if (!cancelled) setProc(null); }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [isSignedIn, loaded, state.cohort, getToken]);

  // Persist tracker_data (debounced, after initial load).
  useEffect(() => {
    if (!loaded || !isSignedIn) return;
    const t = setTimeout(async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await updateJourney(token, { tracker_data: { milestones: state.milestones, dependents: state.dependents, cohort: state.cohort, events: state.events } });
      } catch (e) { console.error('[tracker] save failed', e); }
    }, 700);
    return () => clearTimeout(t);
  }, [state, loaded, isSignedIn, getToken]);

  const setMilestone = (k: MilestoneKey, v: string) =>
    setState(s => ({ ...s, milestones: { ...s.milestones, [k]: v || undefined } }));
  const setCohort = (patch: Partial<Cohort>) =>
    setState(s => ({ ...s, cohort: { ...s.cohort, ...patch } }));

  const addDependent = () => {
    const name = newDep.name.trim() || (newDep.relationship === 'spouse' ? 'Spouse' : 'Child');
    setState(s => ({ ...s, dependents: [...s.dependents, { id: uid(), name, relationship: newDep.relationship }] }));
    setNewDep({ name: '', relationship: 'child' });
    setSpousePrefill(false);
  };
  const removeDependent = (id: string) =>
    setState(s => ({ ...s, dependents: s.dependents.filter(d => d.id !== id) }));

  // Paywall CTA -> straight to Stripe checkout (no intermediate pricing page).
  const handleUpgrade = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      const res = await createCheckoutSession('starter', token, '/track-my-application');
      if ((res as any)?.session_url) window.location.href = (res as any).session_url;
    } catch (e) { console.error('[tracker] checkout failed', e); }
  };

  const nextIdx = MILESTONES.findIndex(m => !state.milestones[m.key]);
  const itaDate = parse(state.milestones.ita);
  const eaprDone = !!state.milestones.eapr;
  const itaDeadline = itaDate ? new Date(itaDate.getTime() + 60 * DAY) : null;
  const itaDaysLeft = itaDeadline ? daysFromToday(itaDeadline) : null;
  const completed = MILESTONES.filter(m => state.milestones[m.key]).length;

  const cohortReady = !!(state.cohort.stream && state.cohort.country && state.cohort.category);
  // Inland if residing in Canada -> final stage is P1/P2; otherwise outland -> PPR.
  const inland = state.cohort.country.trim().toLowerCase() === 'canada';
  // Each prediction is anchored on the milestone immediately before it (interval model).
  // Early stages anchor on AOR; the back half chains: Decision → P1 → P2 → eCOPR (inland),
  // or Decision → PPR (outland). P2 and PPR share the same source date in the community data.
  const predictable: { milestone: MilestoneKey; anchor: MilestoneKey; transition: string }[] = [
    { milestone: 'bil', anchor: 'aor', transition: 'aor_to_bil' },
    { milestone: 'mep', anchor: 'aor', transition: 'aor_to_meds' },
    { milestone: 'decision', anchor: 'aor', transition: 'aor_to_decision' },
    ...(inland
      ? [{ milestone: 'p1' as MilestoneKey, anchor: 'decision' as MilestoneKey, transition: 'decision_to_p1' },
         { milestone: 'p2' as MilestoneKey, anchor: 'p1' as MilestoneKey, transition: 'p1_to_p2' }]
      : [{ milestone: 'ppr' as MilestoneKey, anchor: 'decision' as MilestoneKey, transition: 'decision_to_ppr' }]),
    { milestone: 'ecopr', anchor: (inland ? 'p2' : 'ppr') as MilestoneKey, transition: 'p2_to_ecopr' },
  ];

  // Chain predicted dates: an actual logged anchor date wins; otherwise use the anchor's own
  // prediction. Requires predictable to be in chronological order (it is).
  const predForKey: Partial<Record<MilestoneKey, Date>> = {};
  if (proc) {
    for (const { milestone, anchor, transition } of predictable) {
      const t = proc[transition];
      if (!t) continue;
      const base = parse(state.milestones[anchor]) || predForKey[anchor] || null;
      if (!base) continue;
      predForKey[milestone] = addDays(base, t.median);
    }
  }

  // Items for the "Your Estimated Timeline" visual (needs predictions + a logged AOR).
  const aorDate = parse(state.milestones.aor);
  const TL_LABELS: Record<string, string> = { bil: 'BIL', mep: 'Medical', decision: 'Final Decision', p1: 'P1', p2: 'P2', ppr: 'PPR', ecopr: 'eCOPR' };
  const timelineItems: TimelineItem[] = (proc && aorDate)
    ? predictable.flatMap(({ milestone, anchor, transition }) => {
        const t = proc[transition];
        if (!t) return [];
        const actual = parse(state.milestones[milestone]);
        const base = parse(state.milestones[anchor]) || predForKey[anchor] || null;
        if (!actual && !base) return [];
        return [{
          key: milestone, label: TL_LABELS[milestone] || milestone, final: milestone === 'ecopr',
          actual, pred: predForKey[milestone] || null,
          p25: base ? addDays(base, t.p25) : null, p75: base ? addDays(base, t.p75) : null,
          n: t.n,
        }];
      })
    : [];

  // Red flag for the GCMS upsell: an interval already slower than 90% of similar cases —
  // either logged late, or its predicted p90 date has passed with no milestone logged.
  const hasRedFlag = !!proc && predictable.some(({ milestone, anchor, transition }) => {
    const t = proc[transition];
    if (!t) return false;
    const lg = parse(state.milestones[milestone]);
    const anchorActual = parse(state.milestones[anchor]);
    if (lg && anchorActual) return Math.round((lg.getTime() - anchorActual.getTime()) / DAY) > t.p90;
    const base = anchorActual || predForKey[anchor] || null;
    return !lg && !!base && daysFromToday(addDays(base, t.p90)) < 0;
  });

  const streamOpts = options.streams.length ? options.streams : FALLBACK_STREAMS;
  const categoryOpts = options.categories.length ? options.categories : FALLBACK_CATEGORIES;

  // Context-aware hero CTA: sign-in (anon) · unlock predictions via Stripe (free) · jump to timeline (paid).
  const heroCta = !isSignedIn ? (
    <SignInButton mode="modal" forceRedirectUrl="/track-my-application" signUpForceRedirectUrl="/track-my-application">
      <button className="btn btn-primary btn-lg" style={{ border: 'none', cursor: 'pointer' }}>Start Tracking Free →</button>
    </SignInButton>
  ) : isPaid ? (
    <a href="#timeline" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block' }}>View My Timeline ↓</a>
  ) : (
    <button className="btn btn-primary btn-lg" style={{ border: 'none', cursor: 'pointer' }} onClick={handleUpgrade}>Unlock Smart Predictions — $49 CAD</button>
  );

  return (
    <>
      <SEO
        title="Express Entry Application Tracker & Timeline Predictions | Mentor Visa"
        description="Track every Express Entry PR milestone — AOR, biometrics, medical, background check, final decision, P1/P2, PPR, eCOPR — and get processing-time predictions tailored to your stream, country and category from 700+ real recent applications."
        keywords="Express Entry processing time, PR application tracker, Express Entry timeline 2026, AOR to PPR, biometrics to PPR, eCOPR timeline, P1 P2 portal, IRCC processing time, Express Entry application tracker"
        canonical="/track-my-application"
        schema={TRACKER_SCHEMA}
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📊 Built on real Express Entry cases</div>
          <h1>Know Exactly<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>What Happens Next.</span></h1>
          <p style={{ maxWidth: '720px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Track every milestone and get timeline predictions <strong>tailored to your stream, country and category</strong> — built on 700+ real, recent Express Entry cases. See if your case is running slower than typical, and know exactly when to raise a webform.
          </p>
          {heroCta}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, marginTop: 14 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📈 <span style={{ color: 'var(--primary-light)' }}>Predictions tailored to your case</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🔔 Slow-case &amp; webform alerts</span>
          </div>
        </div>
      </section>

      {isSignedIn && (
      <div className="tracker-container" id="timeline">
        <div style={{ marginBottom: 8 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {completed} of {MILESTONES.length} milestones logged · saved to your account
          </p>
        </div>

      {itaDate && !eaprDone && itaDaysLeft !== null && (
        <div style={{ margin: '14px 0', padding: '14px 18px', borderRadius: 12,
          background: itaDaysLeft <= 14 ? '#fef2f2' : '#eef2ff', border: `1px solid ${itaDaysLeft <= 14 ? '#fecaca' : '#c7d2fe'}` }}>
          <span style={{ fontWeight: 800, color: itaDaysLeft <= 14 ? RED : ACCENT }}>⏳ {itaDaysLeft} days left</span>{' '}
          <span style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>to submit your e-APR (60 days from your ITA on {fmt(itaDate)}).</span>
        </div>
      )}

      {/* Your Estimated Timeline — appears once predictions load and AOR is logged */}
      {aorDate && timelineItems.length > 0 && (
        <EstimatedTimeline items={timelineItems} aor={aorDate} />
      )}

      <div className="tracker-grid">
        {/* LEFT — timeline (standalone milestone cards) */}
        <div>
          <h2 style={{ ...headStyle, marginBottom: 14 }}>Application Timeline</h2>
          {MILESTONES.map((m, i) => (
            <div key={m.key}>
              {(i === 0 || MILESTONES[i - 1].phase !== m.phase) && (
                <div className="milestone-phase">{m.phase}</div>
              )}
              <MilestoneCard def={m} date={state.milestones[m.key]} isNext={i === nextIdx} onChange={(v) => setMilestone(m.key, v)} />
              {/* Phase C extras (ADR / PFL) slot in right after the last Phase C milestone */}
              {m.key === 'decision' && (
                <PhaseCEvents events={state.events} onChange={(ev) => setState(s => ({ ...s, events: ev }))} />
              )}
            </div>
          ))}
        </div>

        {/* RIGHT — cohort inputs (free) + predictions (paid) + dependents (free) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* About your application — FREE, DB-driven dropdowns */}
          <div className="tracker-card" style={cardStyle}>
            <h2 style={{ ...headStyle, marginBottom: 6 }}>About Your Application</h2>
            <p style={{ fontSize: '0.74rem', color: MUTED, marginBottom: 12 }}>We use this to predict your timeline from similar applicants.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <select value={state.cohort.stream} onChange={(e) => setCohort({ stream: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="">Stream (required)…</option>
                {streamOpts.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={state.cohort.country} onChange={(e) => setCohort({ country: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="">Country of residence (required)…</option>
                {options.countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={state.cohort.category} onChange={(e) => setCohort({ category: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="">EE draw category (required)…</option>
                {categoryOpts.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={state.cohort.vo} onChange={(e) => setCohort({ vo: e.target.value })} style={{ ...inputStyle, width: '100%' }}>
                <option value="">Primary visa office (optional)…</option>
                {options.visa_offices.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            {!cohortReady && (
              <div style={{ fontSize: '0.72rem', color: AMBER, marginTop: 8 }}>Select stream, country & draw category to unlock predictions.</div>
            )}
            {cohortReady && (
              <div style={{ fontSize: '0.72rem', color: MUTED, marginTop: 8 }}>
                {inland ? 'Inland application (residing in Canada) — final stage is P1 / P2.' : 'Outland application — final stage is PPR.'}
              </div>
            )}
          </div>

          {/* Smart timeline predictions — PAID (Optimize) */}
          <div className="tracker-card" style={cardStyle}>
            <h2 style={headStyle}>Smart Timeline Predictions</h2>
            <PaywallGate requiredTier="starter" featureName="Smart Application Tracker" onUpgrade={handleUpgrade} features={OPTIMIZE_FEATURES}>
              {!cohortReady ? (
                <div style={{ fontSize: '0.8rem', color: MUTED }}>Select your stream, country & draw category above to load predictions.</div>
              ) : !state.milestones.aor ? (
                <div style={{ fontSize: '0.8rem', color: MUTED }}>Log your <strong>AOR date</strong> on the timeline to see predicted dates.</div>
              ) : !proc ? (
                <div style={{ fontSize: '0.8rem', color: MUTED }}>Loading predictions…</div>
              ) : (
                <div>
                  {predictable.map(({ milestone, anchor, transition }) => {
                    const t = proc[transition];
                    const mdef = MILESTONES.find(m => m.key === milestone);
                    if (!t) return null;
                    const lg = parse(state.milestones[milestone]);
                    const anchorActual = parse(state.milestones[anchor]);
                    // "how you're tracking" needs the real interval — both this milestone and its anchor logged.
                    const actual = (lg && anchorActual) ? Math.round((lg.getTime() - anchorActual.getTime()) / DAY) : null;
                    // Predicted date anchors on the actual predecessor date when known, else the chained prediction.
                    const base = anchorActual || predForKey[anchor] || null;
                    if (!lg && !base) return null; // nothing to predict yet (predecessor unknown)
                    const anchorLabel = MILESTONES.find(m => m.key === anchor)?.label.split(' (')[0].split(' —')[0] || 'previous step';
                    const vs = actual == null ? null
                      : actual <= t.p25 ? { txt: 'faster than most', c: GREEN }
                      : actual <= t.p75 ? { txt: 'on track', c: GREEN }
                      : actual <= t.p90 ? { txt: 'a bit slower than typical', c: AMBER }
                      : { txt: 'slower than 90% of similar cases', c: RED };
                    return (
                      <div key={milestone} style={{ padding: '9px 0', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>{mdef?.icon} {mdef?.label}</div>
                        {actual != null ? (
                          <div style={{ fontSize: '0.78rem' }}>
                            <span style={{ color: vs!.c, fontWeight: 700 }}>{vs!.txt}</span>
                            <span style={{ color: MUTED }}> — yours {actual}d vs median {t.median}d from {anchorLabel}</span>
                          </div>
                        ) : lg ? (
                          <div style={{ fontSize: '0.78rem', color: MUTED }}>Logged {fmt(lg)}</div>
                        ) : (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>
                            Expected <strong>{fmt(addDays(base!, t.median))}</strong>
                            <span style={{ color: MUTED }}> · most: {fmt(addDays(base!, t.p25))} – {fmt(addDays(base!, t.p75))}</span>
                            <span style={{ color: MUTED }}> ({t.median}d from {anchorLabel})</span>
                          </div>
                        )}
                        <div style={{ fontSize: '0.66rem', color: MUTED }}>Based on {t.n} cases ({t.cohort})</div>
                      </div>
                    );
                  })}
                  {hasRedFlag && (
                    <a href="/order-gcms-notes" style={{ display: 'block', textDecoration: 'none', marginTop: 12, padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#b91c1c', marginBottom: 3 }}>🚨 Slower than 90% of similar cases</div>
                      <div style={{ fontSize: '0.74rem', color: '#7f1d1d', lineHeight: 1.5 }}>
                        Your GCMS notes show exactly which step your file is stuck at — officer remarks included.
                        We file the request for you. <strong>Order for $19.90 →</strong>
                      </div>
                    </a>
                  )}
                  <div style={{ fontSize: '0.66rem', color: MUTED, marginTop: 8 }}>Estimates from recent community-reported timelines — guidance, not a guarantee.</div>
                </div>
              )}
            </PaywallGate>
          </div>

          {/* Dependents — FREE */}
          <div className="tracker-card" style={cardStyle}>
            <h2 style={{ ...headStyle, marginBottom: 10 }}>Household / Dependents</h2>
            {spousePrefill && (
              <div style={{ fontSize: '0.74rem', color: ACCENT, marginBottom: 8 }}>
                Your profile says a spouse is accompanying — add them below.
              </div>
            )}
            {state.dependents.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: d.relationship === 'spouse' ? '#0ea5e9' : '#8b5cf6',
                  background: d.relationship === 'spouse' ? '#e0f2fe' : '#ede9fe', padding: '2px 7px', borderRadius: 5 }}>{d.relationship}</span>
                <span style={{ flex: 1, fontSize: '0.86rem', color: 'var(--text-main)' }}>{d.name}</span>
                <button onClick={() => removeDependent(d.id)} aria-label="Remove dependent"
                  style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input placeholder="Name" value={newDep.name} onChange={(e) => setNewDep(n => ({ ...n, name: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 120 }} />
              <select value={newDep.relationship} onChange={(e) => setNewDep(n => ({ ...n, relationship: e.target.value as 'spouse' | 'child' }))} style={inputStyle}>
                <option value="spouse">Spouse</option>
                <option value="child">Child</option>
              </select>
              <button onClick={addDependent} style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', background: ACCENT, border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>Add</button>
            </div>
          </div>
        </div>
      </div>

      <p style={{ fontSize: '0.72rem', color: MUTED, marginTop: 24, textAlign: 'center' }}>
        Informational only — not legal or immigration advice. Always confirm dates against your IRCC account.
      </p>
      </div>
      )}
    </>
  );
};

export default ApplicationTrackerPage;
