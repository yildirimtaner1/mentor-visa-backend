import { type FC } from 'react';
import { SEO } from './common/SEO';
import data from '../data/processingTimes.json';

/**
 * Public, content-rich SEO landing page for Express Entry processing-time queries
 * ("Express Entry processing time", "AOR to PPR", "how long after biometrics", etc.).
 * Content is rendered from a static dataset (data/processingTimes.json) so it is fully
 * crawler-visible. The interactive, personalized tracker is the CTA.
 */

type Stat = { label: string; n: number; p25: number; median: number; p75: number };
const ALL = data.all as Record<string, Stat>;
const BY_STREAM = data.by_stream as Record<string, Record<string, Stat>>;
const TOTAL = data.total_cases as number;

// Column order for the table (only streams we actually have)
const STREAMS = ['CEC', 'FSW-Outland', 'PNP-Inland', 'FSW-Inland'].filter(s => BY_STREAM[s]);
const ROWS: { key: string; label: string }[] = [
  { key: 'aor_to_bil', label: 'AOR → Biometrics' },
  { key: 'aor_to_meds', label: 'AOR → Medical passed' },
  { key: 'aor_to_decision', label: 'AOR → Final decision' },
  { key: 'aor_to_p1', label: 'AOR → P1 (PR Portal, inland)' },
  { key: 'aor_to_ppr', label: 'AOR → PPR / Portal 2' },
  { key: 'aor_to_ecopr', label: 'AOR → eCOPR' },
];

const cec = (k: string) => BY_STREAM['CEC']?.[k];

// FAQ — single source for the visible Q&A and the FAQPage JSON-LD.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'How long does Express Entry take after AOR in 2026?',
    a: `Across ${TOTAL} recent Express Entry cases, the median time from AOR (Acknowledgement of Receipt) to PPR / Portal 2 is about ${ALL.aor_to_ppr?.median} days, and to eCOPR about ${ALL.aor_to_ecopr?.median} days. CEC applicants tend to run a little longer (median ${cec('aor_to_ppr')?.median} days to PPR/Portal 2).`,
  },
  {
    q: 'How long after biometrics is PPR for Express Entry?',
    a: `Biometrics are usually requested about ${ALL.aor_to_bil?.median} days after AOR (CEC median ${cec('aor_to_bil')?.median} days; outland applicants are faster). PPR / Portal 2 then typically follows by around the ${ALL.aor_to_ppr?.median}-day-from-AOR mark.`,
  },
  {
    q: 'What is the AOR-to-PPR time for a CEC application?',
    a: `For Canadian Experience Class, the median AOR → PPR / Portal 2 is about ${cec('aor_to_ppr')?.median} days, with most cases falling between ${cec('aor_to_ppr')?.p25} and ${cec('aor_to_ppr')?.p75} days.`,
  },
  {
    q: 'How long does the background check and final decision take?',
    a: `The median time from AOR to a final decision is about ${ALL.aor_to_decision?.median} days (CEC median ${cec('aor_to_decision')?.median} days). Background checks ("ghost updates") often change without an email notification.`,
  },
  {
    q: 'When should I submit a webform or CSE to IRCC?',
    a: `A good rule of thumb is to wait until your case is clearly past the typical range before raising a webform — for example, if biometrics still have not been requested well beyond the ${cec('aor_to_bil')?.p75}-day mark for CEC, or if there is no movement past 6 months. Our tracker flags when your case is slower than 90% of similar applicants.`,
  },
];

const FAQ_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

const fmtRange = (s?: Stat) => (s ? `${s.median}d` : '—');

export const ProcessingTimesPage: FC<{ onNavigate?: (p: string) => void }> = () => {
  return (
    <>
      <SEO
        title="Express Entry Processing Times 2026: AOR to PPR, Biometrics & eCOPR | Mentor Visa"
        description={`How long does Express Entry take in 2026? Median timelines from ${TOTAL} real cases — AOR to biometrics, medical, final decision, P1/P2, PPR and eCOPR, by stream (CEC, FSW, PNP). See when to raise a webform.`}
        keywords="Express Entry processing time 2026, AOR to PPR time, how long after biometrics PPR, eCOPR timeline, P1 P2 portal timeline, CEC processing time, Express Entry timeline, IRCC processing time"
        canonical="/express-entry-processing-times"
        schema={FAQ_SCHEMA}
      />

      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📊 Based on {TOTAL}+ real recent cases</div>
          <h1>Express Entry Processing Times<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>AOR to eCOPR, in 2026.</span></h1>
          <p style={{ maxWidth: '720px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            How long does each Express Entry milestone actually take? Below are median timelines from {TOTAL} real,
            recent permanent-residence applications — by stream and milestone — so you know what's normal and when your
            case is running late.
          </p>
          <a href="/track-my-application" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Get predictions for my case →
          </a>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>Median days between milestones, by stream</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 18 }}>
            Median (50th-percentile) days from AOR. Lower is faster. Based on {TOTAL} cases reported since mid-2025.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid var(--border-color)', fontSize: '0.85rem' }}>Milestone</th>
                  {STREAMS.map(s => (
                    <th key={s} style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px solid var(--border-color)', fontSize: '0.85rem' }}>{s}</th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px solid var(--border-color)', fontSize: '0.85rem' }}>All</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(r => (
                  <tr key={r.key}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: '0.88rem' }}>{r.label}</td>
                    {STREAMS.map(s => (
                      <td key={s} style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.88rem', color: BY_STREAM[s]?.[r.key] ? 'var(--text-main)' : '#cbd5e1' }}>
                        {fmtRange(BY_STREAM[s]?.[r.key])}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.88rem', fontWeight: 700 }}>{fmtRange(ALL[r.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
            Community-reported data, updated monthly (last updated {data.generated}). Estimates only — not a guarantee or legal advice.
          </p>
        </section>

        <section className="page-section">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 12 }}>How the Express Entry timeline works</h2>
          <p style={{ lineHeight: 1.7, marginBottom: 12 }}>
            After you submit your e-APR and receive your <strong>AOR</strong>, IRCC works through a predictable sequence:
            a <strong>biometrics</strong> request (median {ALL.aor_to_bil?.median} days after AOR), the <strong>medical</strong>
            passing (~{ALL.aor_to_meds?.median} days), <strong>background checks</strong>, and a <strong>final decision</strong>
            (~{ALL.aor_to_decision?.median} days). Outland applicants then receive a <strong>PPR</strong> (passport request),
            while inland applicants move through the PR Portal — <strong>P1</strong> (~{ALL.aor_to_p1?.median} days) and
            <strong> P2</strong> — before the final <strong>eCOPR</strong> (~{ALL.aor_to_ecopr?.median} days from AOR).
          </p>
          <p style={{ lineHeight: 1.7 }}>
            Timelines vary a lot by stream — outland FSW biometrics are typically requested within a few weeks, while CEC
            biometrics cluster around {cec('aor_to_bil')?.median} days. That's why a single "average" is misleading, and why
            our tracker predicts your dates from applicants who match your stream, country and category.
          </p>
        </section>

        <section className="page-section">
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 16 }}>Frequently asked questions</h2>
          {FAQ.map((f, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 6 }}>{f.q}</h3>
              <p style={{ lineHeight: 1.7, color: 'var(--text-main)' }}>{f.a}</p>
            </div>
          ))}
        </section>

        <section className="page-section" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10 }}>Want predictions for <em>your</em> case?</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 600, margin: '0 auto 20px' }}>
            Track every milestone and get expected dates tailored to your stream, country and category — plus a flag when your case is running slower than typical.
          </p>
          <a href="/track-my-application" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Open the Application Tracker →
          </a>
        </section>
      </div>
    </>
  );
};

export default ProcessingTimesPage;
