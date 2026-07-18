import { useState, useEffect, useCallback, type FC } from 'react';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { SEO } from './common/SEO';
import { getGCMSAnalysisStatus, analyzeGCMSNotes, createCheckoutSession, friendlyError } from '../services/api';
import ReactGA from 'react-ga4';

const PRICE = 19.90;

interface StageStatus { name: string; status: string; detail: string; }
interface OfficerRemark { date: string; plain_english: string; original_snippet: string; }
interface FlagConcern { severity: string; description: string; suggestion: string; }
interface NextStep { step: string; expected_window: string; basis: string; }
interface GlossaryItem { term: string; meaning: string; }

interface GCMSAnalysis {
  document_valid: boolean;
  rejection_reason?: string;
  overall_summary: string;
  application_snapshot: string[];
  stages: StageStatus[];
  officer_remarks: OfficerRemark[];
  flags_concerns: FlagConcern[];
  next_steps: NextStep[];
  glossary: GlossaryItem[];
  pages_analyzed?: number;
  original_filename?: string;
  credits_remaining?: number;
}

const STAGE_COLORS: Record<string, { dot: string; bg: string; label: string }> = {
  passed: { dot: '#059669', bg: '#ECFDF5', label: 'Passed' },
  in_progress: { dot: '#D97706', bg: '#FFFBEB', label: 'In progress' },
  flagged: { dot: '#DC2626', bg: '#FEF2F2', label: 'Flagged' },
  not_started: { dot: '#9CA3AF', bg: '#F9FAFB', label: 'Not started' },
  unknown: { dot: '#9CA3AF', bg: '#F9FAFB', label: 'Unknown' },
};

const SEV_COLORS: Record<string, { fg: string; bg: string }> = {
  high: { fg: '#991B1B', bg: '#FEF2F2' },
  medium: { fg: '#92400E', bg: '#FFFBEB' },
  low: { fg: '#065F46', bg: '#ECFDF5' },
};

const analyzerSchema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Mentor Visa GCMS Notes AI Analyzer',
  operatingSystem: 'Web',
  applicationCategory: 'WebApplication',
  offers: { '@type': 'Offer', price: '19.90', priceCurrency: 'CAD' },
  description: 'Upload your GCMS or CBSA notes PDF and get a plain-English report: stage-by-stage status, officer remarks explained, red flags, and likely next steps.',
});

function StageTimeline({ stages }: { stages: StageStatus[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {stages.map((s, i) => {
        const c = STAGE_COLORS[s.status] || STAGE_COLORS.unknown;
        return (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: c.bg, borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-color)' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.dot, marginTop: '5px', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {s.name}
                <span style={{ marginLeft: '10px', fontSize: '0.75rem', fontWeight: 600, color: c.dot, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{c.label}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.detail}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalysisReport({ report }: { report: GCMSAnalysis }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card">
        <h3 className="card-title">📋 Where your application stands</h3>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.65, margin: 0 }}>{report.overall_summary}</p>
        {report.application_snapshot?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
            {report.application_snapshot.map((f, i) => (
              <span key={i} style={{ fontSize: '0.8rem', background: '#F1F5F9', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '4px 12px' }}>{f}</span>
            ))}
          </div>
        )}
        {report.pages_analyzed ? (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '12px 0 0' }}>
            {report.pages_analyzed} pages analyzed{report.original_filename ? ` — ${report.original_filename}` : ''}
          </p>
        ) : null}
      </div>

      {report.stages?.length > 0 && (
        <div className="card">
          <h3 className="card-title">🧭 Stage-by-stage status</h3>
          <StageTimeline stages={report.stages} />
        </div>
      )}

      {report.officer_remarks?.length > 0 && (
        <div className="card">
          <h3 className="card-title">🗒️ Officer remarks, explained</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.officer_remarks.map((r, i) => (
              <div key={i} style={{ background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px' }}>
                {r.date && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{r.date}</div>}
                <div style={{ fontSize: '0.9rem', margin: '4px 0' }}>{r.plain_english}</div>
                {r.original_snippet && (
                  <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '3px solid var(--border-color)', paddingLeft: '10px' }}>
                    “{r.original_snippet}”
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.flags_concerns?.length > 0 && (
        <div className="card">
          <h3 className="card-title">🚩 Flags &amp; concerns</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {report.flags_concerns.map((f, i) => {
              const c = SEV_COLORS[(f.severity || 'low').toLowerCase()] || SEV_COLORS.low;
              return (
                <div key={i} style={{ background: c.bg, borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: c.fg, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.severity} severity</div>
                  <div style={{ fontSize: '0.9rem', margin: '4px 0' }}>{f.description}</div>
                  {f.suggestion && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>💡 {f.suggestion}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {report.next_steps?.length > 0 && (
        <div className="card">
          <h3 className="card-title">⏭️ What likely happens next</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {report.next_steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary-color)', flexShrink: 0 }}>{i + 1}.</span>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{s.step}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{s.expected_window}{s.basis ? ` — ${s.basis}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '14px', marginBottom: 0 }}>
            Estimates are based on what your notes show and typical IRCC patterns — they are not a guarantee. Track your milestones with the <a href="/track-my-application" style={{ color: 'var(--primary-color)' }}>Smart Application Tracker</a>.
          </p>
        </div>
      )}

      {report.glossary?.length > 0 && (
        <div className="card">
          <h3 className="card-title">📖 Terms in your notes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '8px' }}>
            {report.glossary.map((g, i) => (
              <div key={i} style={{ fontSize: '0.85rem' }}><strong>{g.term}</strong> — {g.meaning}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const GCMSAnalyzerPage: FC = () => {
  const { isSignedIn, getToken } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [past, setPast] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<GCMSAnalysis | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const tk = await getToken();
      if (!tk) return;
      const s = await getGCMSAnalysisStatus(tk);
      setCredits(s.credits ?? 0);
      setPast(s.analyses || []);
    } catch { /* non-fatal — page still renders */ }
  }, [isSignedIn, getToken]);

  useEffect(() => { refreshStatus(); }, [refreshStatus]);

  // Returning from Stripe: the status endpoint lazily verifies the payment and grants the credit.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
      refreshStatus();
      const url = new URL(window.location.href);
      url.searchParams.delete('payment_success');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refreshStatus]);

  const buy = async () => {
    setError(''); setBuying(true);
    ReactGA.event('begin_checkout', { currency: 'CAD', value: PRICE, items: [{ item_id: 'gcms_analyzer', item_name: 'GCMS Notes AI Analysis', price: PRICE }] });
    try {
      const tk = await getToken();
      if (!tk) return;
      const res = await createCheckoutSession('gcms_analyzer', tk, '/gcms-notes-analyzer');
      if (res?.session_url) window.location.href = res.session_url;
      else { setError('Could not start checkout. Please try again.'); setBuying(false); }
    } catch (e: any) {
      setError(friendlyError(e, 'Could not start checkout. Please try again.'));
      setBuying(false);
    }
  };

  const analyze = async () => {
    if (!file) return;
    setError(''); setBusy(true); setReport(null);
    try {
      const tk = await getToken();
      if (!tk) return;
      const res = await analyzeGCMSNotes(file, tk);
      if (res.document_valid === false) {
        setError(res.rejection_reason || 'This does not look like a GCMS notes PDF. Your credit was not used — please upload the correct file.');
      } else {
        setReport(res);
        setCredits(res.credits_remaining ?? null);
        ReactGA.event('tool_engagement', { tool_name: 'GCMS Analyzer' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        refreshStatus();
      }
    } catch (e: any) {
      setError(friendlyError(e, 'The analysis failed. Please try again.'));
    } finally { setBusy(false); }
  };

  const hasCredit = (credits ?? 0) > 0;

  return (
    <>
      <SEO
        title="GCMS Notes AI Analyzer | Understand Your IRCC File in Minutes"
        description="Upload your GCMS or CBSA notes PDF and get a plain-English report: stage-by-stage status, officer remarks explained, red flags, and likely next steps. $19.90 — free with every Mentor Visa GCMS order."
        keywords="GCMS notes analysis, read GCMS notes, GCMS notes explained, IRCC file analysis, ATIP notes"
        canonical="/gcms-notes-analyzer"
        schema={analyzerSchema}
      />
      <section className="page-section" style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '10px' }}>🔍 GCMS Notes AI Analyzer</h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Your GCMS notes are 30–80 pages of internal IRCC screens and acronyms. Upload the PDF and get a
            plain-English report in minutes: what stage you're really at, what the officer wrote, and what happens next.
          </p>
        </div>

        {report ? (
          <>
            <AnalysisReport report={report} />
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button className="btn btn-outline" onClick={() => { setReport(null); setFile(null); }}>Analyze another file</button>
            </div>
          </>
        ) : (
          <>
            {/* What you get */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 className="card-title">What's in your report</h3>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.92rem', lineHeight: 1.9 }}>
                <li><strong>Stage-by-stage status</strong> — Eligibility, Medical, Criminality, Security, Info Sharing, Final Decision</li>
                <li><strong>Officer remarks explained</strong> — every free-text note translated into plain English</li>
                <li><strong>Flags &amp; concerns</strong> — ADRs, procedural fairness signals, reviews, long idle gaps — with severity</li>
                <li><strong>Likely next steps</strong> — what typically follows from where your file stands</li>
                <li><strong>Glossary</strong> — every acronym in <em>your</em> notes, decoded</li>
              </ul>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>
                Works with IRCC (GCMS) and CBSA notes releases. New to GCMS notes? Read the <a href="/how-to-read-gcms-notes" style={{ color: 'var(--primary-color)' }}>free guide</a> or <a href="/order-gcms-notes" style={{ color: 'var(--primary-color)' }}>order your notes</a> — every Mentor Visa order includes one free analysis.
              </p>
            </div>

            {!isSignedIn ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
                <h3 style={{ marginBottom: '8px' }}>Sign in to analyze your notes</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '18px' }}>Your report is saved to your account so you can revisit it any time.</p>
                <SignInButton mode="modal" forceRedirectUrl="/gcms-notes-analyzer" fallbackRedirectUrl="/gcms-notes-analyzer">
                  <button className="btn btn-primary btn-lg">Sign in to continue</button>
                </SignInButton>
              </div>
            ) : hasCredit ? (
              <div className="card">
                <h3 className="card-title">✅ You have {credits} analysis {credits === 1 ? 'credit' : 'credits'} — upload your notes</h3>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '16px',
                  border: file ? '1px solid #6EE7B7' : '2px dashed var(--border-color)',
                  background: file ? '#ECFDF5' : 'white', borderRadius: '10px', cursor: 'pointer',
                }}>
                  <input type="file" accept=".pdf" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(''); } }} />
                  <span style={{ fontSize: '1.4rem' }}>{file ? '✅' : '📎'}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>{file ? file.name : 'Choose your GCMS / CBSA notes PDF'}</span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>The digital PDF you received by email (max 20MB). Scanned copies are not supported.</span>
                  </span>
                </label>
                <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '16px' }} disabled={!file || busy} onClick={analyze}>
                  {busy ? 'Analyzing your file — this takes 1–2 minutes…' : 'Analyze my notes'}
                </button>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '10px', marginBottom: 0 }}>
                  If the file isn't a notes release, your credit is <strong>not</strong> used and you can re-upload.
                </p>
              </div>
            ) : (
              <div className="pricing-card" style={{ background: '#ffffff', maxWidth: '440px', margin: '0 auto' }}>
                <div className="pricing-card-header">
                  <h3>GCMS Notes AI Analysis</h3>
                  <div className="pricing-price">${PRICE.toFixed(2)} <span>CAD</span></div>
                  <p className="pricing-desc">One complete plain-English report of your notes. Included <strong>free</strong> with every <a href="/order-gcms-notes" style={{ color: 'var(--primary-color)' }}>Mentor Visa GCMS order</a>.</p>
                </div>
                <div className="pricing-card-footer">
                  <button className="pricing-btn primary" style={{ width: '100%' }} disabled={buying} onClick={buy}>
                    {buying ? 'Redirecting…' : `Get my analysis — $${PRICE.toFixed(2)} CAD`}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '16px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: '10px', padding: '12px 16px', fontSize: '0.9rem' }}>
                ⚠️ {error}
              </div>
            )}

            {past.length > 0 && (
              <div className="card" style={{ marginTop: '24px' }}>
                <h3 className="card-title">Your past analyses</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {past.map((a, i) => (
                    <button key={i} className="btn btn-outline" style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                      onClick={() => { setReport({ ...(a.result || {}), original_filename: a.original_filename }); window.scrollTo({ top: 0 }); }}>
                      📄 {a.original_filename || 'GCMS analysis'}{a.created_at ? ` — ${new Date(a.created_at).toLocaleDateString()}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy note */}
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '24px' }}>
              Your notes are processed securely and stored under the same retention policy as all Mentor Visa documents — see our <a href="/privacy-policy" style={{ color: 'var(--primary-color)' }}>privacy policy</a>.
            </p>
          </>
        )}
      </section>
    </>
  );
};

export default GCMSAnalyzerPage;
