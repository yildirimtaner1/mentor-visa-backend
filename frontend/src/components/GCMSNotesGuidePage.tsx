import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from './common/SEO';
import procData from '../data/processingTimes.json';

/**
 * Learning page: how to read & interpret GCMS notes.
 * Content-rich SEO page (targets "how to read GCMS notes", "GCMS notes meaning",
 * "R10 completeness check", "A11.2 eligibility" queries) + cross-sell to /order-gcms-notes.
 * Timelines are pulled from our own community dataset (processingTimes.json).
 */

const ALL = (procData as any).all as Record<string, { median: number }>;
const TOTAL_CASES = (procData as any).total_cases as number;

// ── The processing pipeline as it appears in GCMS ──
const STAGES = [
  {
    icon: '📨', name: 'AOR — Acknowledgement of Receipt',
    what: 'IRCC confirms your e-APR was submitted. Your GCMS file is created (or updated) and every later note hangs off this date.',
    inNotes: 'The application row shows "Received". All background-check sections typically show "Not Started".',
  },
  {
    icon: '📋', name: 'R10 Completeness Check',
    what: 'An officer verifies your application is complete under Regulation 10 of IRPR — every required document, form and fee is present. Incomplete files are rejected (not refused) and the fee is returned.',
    inNotes: 'A note like "R10 completeness check passed" or "Application deemed complete". This usually happens quietly in the first weeks.',
  },
  {
    icon: '🫆', name: 'Biometrics (BIL)',
    what: 'You receive a Biometric Instruction Letter and give fingerprints + photo at a VAC. Many applicants are exempt if biometrics from a previous application are still valid.',
    inNotes: `The Biometrics section flips to "Completed" once matched to your file. Median time from AOR in our data: ~${ALL.aor_to_bil?.median ?? 57} days.`,
  },
  {
    icon: '🩺', name: 'Medical Review (MEP)',
    what: "Your upfront medical exam (or requested one) is assessed. 'Medical passed' (MEP) means you're medically admissible; results are valid 12 months.",
    inNotes: `Medical section shows "Passed" with a validity date. Median from AOR: ~${ALL.aor_to_meds?.median ?? 57} days. If your medical expires mid-process, watch for an extension note or a re-exam request.`,
  },
  {
    icon: '🧮', name: 'A11.2 Eligibility Review',
    what: 'An officer re-verifies you still meet the CRS score you were invited at — work experience letters, language results, education, funds. This is where employment letters are scrutinized line-by-line.',
    inNotes: '"Eligibility: Passed" (or "Review Required" — see red flags below). Officer remarks often quote your employment letter duties directly.',
  },
  {
    icon: '⚖️', name: 'Criminality Check',
    what: 'Police certificates and databases are checked for criminal inadmissibility.',
    inNotes: 'Criminality section: "Not Started" → "In Progress" → "Passed". Usually one of the faster checks.',
  },
  {
    icon: '🌐', name: 'Information Sharing',
    what: 'Canada exchanges immigration data with partner countries (the "Five Eyes": US, UK, Australia, New Zealand) to verify identity and history.',
    inNotes: 'Info Sharing section moves to "Completed". Often finishes together with criminality.',
  },
  {
    icon: '🕵️', name: 'Security Screening',
    what: 'CSIS/CBSA screen for security inadmissibility. For most files this is quick; for some profiles (certain occupations, countries, travel histories) it can run months — the #1 cause of long delays.',
    inNotes: '"Not Started" → "In Progress" → "Passed". A long "In Progress" here with everything else passed = your file is waiting on security. CBSA notes (a separate request) show more detail.',
  },
  {
    icon: '✅', name: 'Final Decision → PPR / eCOPR',
    what: 'With all sections passed, an officer finalizes the file. Outland applicants get a Passport Request (PPR); inland applicants move through Portal 1 / Portal 2 emails to eCOPR.',
    inNotes: `Decision shows "Approved"; a "Ready for Visa" (RFV) remark often appears shortly before PPR. Median AOR → PPR/P2 in our data: ~${ALL.aor_to_ppr?.median ?? 104} days; AOR → eCOPR ~${ALL.aor_to_ecopr?.median ?? 123} days.`,
  },
];

// ── Codes & abbreviations glossary ──
const CODES: { code: string; meaning: string; note: string }[] = [
  { code: 'UCI', meaning: 'Unique Client Identifier', note: 'Your permanent IRCC client number — every note in the file references it.' },
  { code: 'AOR', meaning: 'Acknowledgement of Receipt', note: 'Day 0 for all processing timelines.' },
  { code: 'R10', meaning: 'Regulation 10 completeness check', note: 'Complete = processed. Incomplete = returned with fee refund (not a refusal).' },
  { code: 'A11.2', meaning: 'Eligibility re-assessment', note: 'Confirms you still meet the CRS points you claimed at ITA. Employment letters are checked here.' },
  { code: 'BIL', meaning: 'Biometric Instruction Letter', note: 'The letter asking you to give fingerprints at a VAC.' },
  { code: 'MEP', meaning: 'Medical Exam Passed', note: 'Medical admissibility confirmed; valid for 12 months.' },
  { code: 'ADR', meaning: 'Additional Document Request', note: 'IRCC wants more evidence. Respond fully and fast — the clock pauses on you.' },
  { code: 'PFL', meaning: 'Procedural Fairness Letter', note: 'Serious: an officer has a concern (often misrepresentation) and gives you one chance to respond before refusing.' },
  { code: 'RFV', meaning: 'Ready for Visa', note: 'Officer remark that the file is approved and queued for PPR — the note everyone hopes to see.' },
  { code: 'PPR', meaning: 'Passport Request', note: 'Submit your passport for the PR visa (outland).' },
  { code: 'eCOPR', meaning: 'Electronic Confirmation of PR', note: 'The final document — you are a permanent resident.' },
  { code: 'VO', meaning: 'Visa Office', note: 'Which office holds your file (e.g. Ottawa, New Delhi, Sydney NS). Determines who is actioning it.' },
  { code: 'GU', meaning: '"Ghost Update"', note: 'Community term: your online status shows an updated date with no visible change — usually a background-check field moving in GCMS.' },
];

// ── Red flags ──
const RED_FLAGS = [
  {
    icon: '🚨', title: '"Review Required" on Eligibility',
    body: 'An officer was not satisfied on first pass — most often because the employment letter duties don\'t convincingly match the claimed NOC. Expect an ADR, a PFL, or a slow secondary review.',
    cta: { label: 'Audit your employment letter →', to: '/audit-employment-letter' },
  },
  {
    icon: '🐌', title: 'Security "In Progress" while everything else passed',
    body: 'Your file is parked in security screening. Nothing you send speeds this up, but knowing it\'s the bottleneck stops you from filing pointless webforms — and a CBSA notes request shows more detail.',
    cta: null,
  },
  {
    icon: '⏰', title: 'Medical validity date approaching',
    body: 'Medicals expire 12 months after the exam. If your notes show processing dragging past that date, expect either an extension note or a re-exam request — budget for the delay.',
    cta: null,
  },
  {
    icon: '📝', title: 'Officer remarks quoting your letter with doubts',
    body: 'Notes like "duties appear generic" or "unable to verify employment" signal where a refusal would come from. If you saw this in a previous refusal, fix that exact gap before reapplying.',
    cta: { label: 'Rebuild your evidence with the NOC Finder →', to: '/find-my-noc' },
  },
];

const FAQ = [
  {
    q: 'What do GCMS notes actually contain?',
    a: 'The full internal record of your application: a file summary, every officer note and assessment, the status of each background check (eligibility, criminality, security, info sharing, medical), correspondence logs, and system activity with dates and the responsible office.',
  },
  {
    q: 'How do I order my GCMS notes?',
    a: 'GCMS notes are released under ATIP rules, and requests must be filed from inside Canada. If you are abroad, you authorize a representative with a signed IMM 5744 consent form. Our service files the request for $19.90 CAD and emails you the notes when IRCC responds — typically 30-40 days.',
  },
  {
    q: 'What is the difference between "Not Started", "In Progress", and "Passed"?',
    a: 'Each background check section moves through these states. "Not Started" means the check has not been opened, "In Progress" means it is actively being processed (or waiting in a queue), and "Passed" means it cleared. A final decision needs every section passed.',
  },
  {
    q: 'What does "Review Required" mean in GCMS notes?',
    a: 'An officer flagged that section for a closer look instead of passing it. On eligibility, it usually means the evidence (most often the employment reference letter) did not convincingly support the points claimed. It is not a refusal — but it is your earliest warning of one.',
  },
  {
    q: 'How often should I order GCMS notes?',
    a: 'Most applicants order once processing feels stalled — e.g. past the median timelines with no movement — and again after any refusal to get the complete reasoning. Since IRCC takes 30-40 days to release notes, ordering more often than every 2-3 months rarely adds information.',
  },
];

const FAQ_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

export const GCMSNotesGuidePage: FC = () => {
  return (
    <div>
      <SEO
        title="How to Read Your GCMS Notes: Codes, Stages & Red Flags Explained | Mentor Visa"
        description="A plain-English guide to interpreting GCMS notes: the AOR-to-PPR pipeline, what R10, A11.2, RFV, ADR and PFL mean, background-check statuses, and the red flags that predict delays or refusals."
        keywords="how to read GCMS notes, GCMS notes explained, R10 completeness check, A11.2 eligibility, GCMS security screening in progress, review required GCMS, RFV ready for visa, ghost update Express Entry"
        canonical="/how-to-read-gcms-notes"
        schema={FAQ_SCHEMA}
      />

      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📖 Plain-English Guide</div>
          <h1>How to Read Your<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>GCMS Notes.</span></h1>
          <p style={{ maxWidth: '720px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Your GCMS notes are 40-100 pages of bureaucratic shorthand — but hidden inside is exactly where your file
            sits, what the officer thinks, and whether trouble is coming. This guide decodes every stage, code, and status.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/order-gcms-notes" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block' }}>
              Don't have your notes yet? Order them — $19.90 →
            </Link>
            <Link to="/gcms-notes-analyzer" className="btn btn-lg" style={{ background: 'white', color: '#1E3A8A', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
              Have them already? Let AI decode them →
            </Link>
          </div>
        </div>
      </section>

      <div className="page-container">

        {/* What the document looks like */}
        <section className="page-section">
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>What's inside the document</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              A GCMS release arrives as one long PDF. Skip the boilerplate and go straight to these four parts:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {[
                { icon: '🗂️', title: '1 · File summary', sub: 'Your UCI, application numbers, the visa office holding the file, and one status line per application.' },
                { icon: '🧾', title: '2 · Assessment screen', sub: 'The grid everyone checks first: Eligibility / Medical / Criminality / Security / Info Sharing, each with a status.' },
                { icon: '🗒️', title: '3 · Officer notes', sub: 'Free-text remarks in reverse date order. This is where reasoning, doubts, and "Ready for Visa" lines live.' },
                { icon: '📬', title: '4 · Correspondence log', sub: 'Every letter and email IRCC sent (or prepared) — sometimes you\'ll spot an upcoming ADR before it lands in your inbox.' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>{c.title}</div>
                  <div style={{ fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stage-by-stage pipeline */}
        <section className="page-section">
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>The 9 stages, AOR to PPR</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '22px', lineHeight: 1.6 }}>
              Every Express Entry PR file moves through the same pipeline. Timelines below are medians from{' '}
              <Link to="/express-entry-processing-times" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
                our dataset of {TOTAL_CASES} real cases</Link>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {STAGES.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px 20px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0, fontSize: '1.3rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#EEF2FF', border: '1px solid #C7D2FE',
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                      <span style={{ color: 'var(--primary-color)', marginRight: '6px' }}>{i + 1}.</span>{s.name}
                    </div>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, margin: '0 0 8px' }}>{s.what}</p>
                    <p style={{ fontSize: '0.85rem', lineHeight: 1.55, margin: 0, color: '#0369A1', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '8px 12px' }}>
                      <strong>In your notes:</strong> {s.inNotes}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Codes table */}
        <section className="page-section">
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>The codes cheat-sheet</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '18px' }}>
              The abbreviations you'll actually see, in the order you'll meet them.
            </p>
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>Code</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meaning</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>What it tells you</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CODES.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 800, color: 'var(--primary-color)', background: '#EEF2FF', padding: '3px 10px', borderRadius: '6px', fontSize: '0.85rem' }}>{c.code}</span>
                        </td>
                        <td style={{ padding: '11px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.meaning}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Red flags */}
        <section className="page-section">
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>Red flags worth acting on</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '18px' }}>
              Most notes are routine. These four patterns are not — each one predicts a delay, an ADR/PFL, or a refusal.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              {RED_FLAGS.map((f, i) => (
                <div key={i} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{f.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: '#92400E' }}>{f.title}</div>
                  <div style={{ fontSize: '0.88rem', color: '#78350F', lineHeight: 1.6 }}>{f.body}</div>
                  {f.cta && (
                    <Link to={f.cta.to} style={{ display: 'inline-block', marginTop: '10px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                      {f.cta.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Reading tips */}
        <section className="page-section">
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '12px' }}>Five tips for a first read</h2>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.9, fontSize: '0.95rem', background: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '22px 22px 22px 40px', margin: 0 }}>
              <li><strong>Start at the assessment grid,</strong> not page 1 — the five section statuses tell you 80% of the story in ten seconds.</li>
              <li><strong>Read officer notes bottom-up.</strong> They're in reverse chronological order; reading oldest-first shows how the officer's view evolved.</li>
              <li><strong>Compare dates against the medians.</strong> A section "In Progress" for 3 weeks is normal; the same section untouched for 4 months is your bottleneck.</li>
              <li><strong>Search the PDF</strong> (Ctrl+F) for "review", "concern", "unable to verify", "ADR" and "fairness" — the words that precede every bad outcome.</li>
              <li><strong>Note which Visa Office holds the file.</strong> Timelines differ wildly between offices, and any webform/MP inquiry should reference it.</li>
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section className="page-section">
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '16px' }}>Frequently asked questions</h2>
            {FAQ.map((f, i) => (
              <details key={i} style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', marginBottom: '10px' }}>
                <summary style={{ fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>{f.q}</summary>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.65, marginTop: '10px', marginBottom: 0 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="page-section">
          <div style={{
            maxWidth: '760px', margin: '0 auto', padding: '36px 28px', textAlign: 'center',
            background: 'linear-gradient(135deg, #0F172A, #1E3A8A)', borderRadius: '16px', color: 'white',
          }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '10px', color: 'white' }}>
              Reading about it only helps if you have the notes.
            </h3>
            <p style={{ fontSize: '0.95rem', opacity: 0.85, marginBottom: '22px', lineHeight: 1.6, maxWidth: '540px', marginLeft: 'auto', marginRight: 'auto' }}>
              We file your ATIP request within one business day and email you the complete file the day IRCC releases it.
              One flat fee, no subscriptions.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/order-gcms-notes" className="btn btn-lg" style={{ background: 'white', color: '#1E3A8A', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                Order my GCMS notes — $19.90 CAD →
              </Link>
              <Link to="/gcms-notes-analyzer" className="btn btn-lg" style={{ background: 'transparent', border: '2px solid rgba(255,255,255,0.6)', color: 'white', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>
                Already have notes? AI analysis — $14.90 →
              </Link>
            </div>
            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '14px', marginBottom: 0 }}>
              Filed within 1 business day · IRCC responds in ~30-40 days · Free AI analysis with every order
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default GCMSNotesGuidePage;
