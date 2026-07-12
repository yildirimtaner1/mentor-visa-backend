import { useState, useEffect, type FC, type ChangeEvent } from 'react';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { SEO } from './common/SEO';
import { createGCMSOrder, getGCMSOrders, uploadGCMSConsent, createCheckoutSession, setGCMSPersons, downloadGCMSConsentForm, type GCMSOrderData, type GCMSRelatedPerson } from '../services/api';
import ReactGA from 'react-ga4';

const PRICE = 19.90;

const APPLICATION_TYPES = [
  'Express Entry — Permanent Residence',
  'Provincial Nominee Program (PNP)',
  'Study Permit',
  'Work Permit',
  'Visitor Visa / TRV',
  'Spousal / Family Sponsorship',
  'Citizenship',
  'Other',
];

interface GCMSOrder {
  id: number;
  status: 'awaiting_payment' | 'awaiting_consent' | 'received' | 'filed' | 'delivered';
  full_name: string;
  family_name?: string;
  given_name?: string;
  related_persons?: GCMSRelatedPerson[];
  email: string;
  date_of_birth: string;
  country_of_residence?: string;
  uci?: string;
  application_number?: string;
  application_type?: string;
  notes_type: 'ircc' | 'cbsa';
  extra_notes?: string;
  has_consent: boolean;
  created_at?: string;
}

const emptyForm: GCMSOrderData = {
  family_name: '', given_name: '', email: '', date_of_birth: '', country_of_residence: '',
  uci: '', application_number: '', application_type: APPLICATION_TYPES[0],
  notes_type: 'ircc', extra_notes: '',
};

const RELATIONSHIPS = ['Spouse', 'Common-law partner', 'Son', 'Daughter', 'Father', 'Mother', 'Other'];
const emptyPerson: GCMSRelatedPerson = { family_name: '', given_name: '', date_of_birth: '', relationship: 'Spouse', under_16: false };

// One labelled upload slot (signed form / per-person government ID).
function FileSlot({ label, sub, file, onPick, disabled }: {
  label: string; sub: string; file: File | null; onPick: (f: File) => void; disabled: boolean;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
      border: file ? '1px solid #6EE7B7' : '2px dashed var(--border-color)',
      background: file ? '#ECFDF5' : 'white', borderRadius: '10px',
      cursor: disabled ? 'default' : 'pointer',
    }}>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={disabled}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{file ? '✅' : '📎'}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.78rem', color: file ? '#065F46' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file ? file.name : sub}
        </span>
      </span>
      <span style={{ marginLeft: 'auto', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-color)', flexShrink: 0 }}>
        {file ? 'Change' : 'Choose file'}
      </span>
    </label>
  );
}

// 4-stage fulfillment timeline, driven by order.status (received -> filed -> delivered).
function OrderTimeline({ order }: { order: GCMSOrder }) {
  const stages = [
    { label: 'Ordered & paid', sub: null as string | null },
    { label: 'Documents received', sub: 'Signed consent + ID verified by our team' },
    { label: 'Submitted to IRCC', sub: 'ATIP request filed on your behalf' },
    { label: 'GCMS notes sent to your email', sub: 'The day IRCC releases them' },
  ];
  const done = order.status === 'delivered' ? 4 : order.status === 'filed' ? 3 : 2;
  return (
    <div style={{ textAlign: 'left' }}>
      {stages.map((s, i) => {
        const isDone = i < done, isCurrent = i === done;
        return (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', opacity: isDone || isCurrent ? 1 : 0.45 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, fontSize: '0.75rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white',
                background: isDone ? '#10B981' : isCurrent ? 'var(--primary-color)' : '#CBD5E1',
              }}>
                {isDone ? '✓' : isCurrent ? '⋯' : i + 1}
              </div>
              {i < stages.length - 1 && <div style={{ width: '2px', height: '26px', background: isDone ? '#10B981' : '#E2E8F0' }} />}
            </div>
            <div style={{ paddingTop: '3px' }}>
              <div style={{ fontWeight: isCurrent ? 700 : 600, fontSize: '0.9rem' }}>
                {s.label}{isCurrent && <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}> — in progress</span>}
              </div>
              {s.sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.sub}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_LABELS: Record<GCMSOrder['status'], string> = {
  awaiting_payment: 'Awaiting payment',
  awaiting_consent: 'Awaiting documents',
  received: 'Preparing to file',
  filed: 'Submitted to IRCC',
  delivered: 'Notes emailed ✓',
};

// Age check for the IMM 5744 signing rules (under-16s are listed but don't sign).
function isUnder16(dob: string): boolean {
  if (!dob) return false;
  const d = new Date(dob + 'T00:00:00');
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 16);
  return d > cutoff;
}

// FAQ — rendered on-page and injected as FAQPage JSON-LD for SEO.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What are GCMS notes?',
    a: 'GCMS (Global Case Management System) notes are the complete internal file IRCC keeps on your application: officer notes, eligibility assessments, security screening progress, and the reasons behind delays or refusals. They are far more detailed than the letters IRCC sends you.',
  },
  {
    q: 'Why should I order my GCMS notes?',
    a: 'GCMS notes are the only way to see exactly why your application is delayed, what an officer flagged, or the full reasoning behind a refusal — so you can fix the real problem before reapplying or responding.',
  },
  {
    q: 'How long does it take to receive GCMS notes?',
    a: 'By law, ATIP requests are answered within 30 days, though extensions can stretch it to 40-60 days in busy periods. We file your request as soon as we receive your signed consent form and email you the notes the day they arrive.',
  },
  {
    q: 'Why do I need to sign a consent form?',
    a: "ATIP requests can only be filed from inside Canada. The signed consent form (IRCC form IMM 5744) authorizes us to request your file on your behalf — it's the standard, IRCC-approved way for applicants outside Canada to get their notes.",
  },
  {
    q: 'What is the difference between IRCC and CBSA notes?',
    a: 'IRCC notes cover your application processing (the most common choice). CBSA notes come from the Canada Border Services Agency and cover security screening and border records — useful when your file is stuck in security review.',
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1px solid var(--border-color)', fontSize: '0.95rem', background: 'white',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px',
};

export const OrderGCMSNotesPage: FC = () => {
  const { isSignedIn, getToken } = useAuth();

  // Wizard: 1 = info, 2 = payment, 3 = consent upload, 4 = done
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<GCMSOrderData>(() => {
    try {
      const saved = sessionStorage.getItem('gcmsOrderForm');
      return saved ? { ...emptyForm, ...JSON.parse(saved) } : emptyForm;
    } catch { return emptyForm; }
  });
  const [order, setOrder] = useState<GCMSOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  // Step 3a — other people on the application (IMM 5744 fits applicant + 3)
  const [persons, setPersons] = useState<GCMSRelatedPerson[]>([]);
  const [formReady, setFormReady] = useState(false); // pre-filled IMM 5744 generated & downloaded
  // Step 3b — documents: the signed form + one government ID per person (applicant first)
  const [docConsent, setDocConsent] = useState<File | null>(null);
  const [docIds, setDocIds] = useState<(File | null)[]>([]);
  // Completed orders (received/filed/delivered) — shown as trackable history, never block a new order
  const [pastOrders, setPastOrders] = useState<GCMSOrder[]>([]);

  const set = (k: keyof GCMSOrderData) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const next = { ...form, [k]: e.target.value };
    setForm(next);
    sessionStorage.setItem('gcmsOrderForm', JSON.stringify(next));
  };

  const formValid = form.family_name.trim().length > 0 && form.given_name.trim().length > 0
    && /\S+@\S+\.\S+/.test(form.email) && !!form.date_of_birth;
  const personsValid = persons.every(p => p.family_name.trim() && p.given_name.trim() && p.date_of_birth);

  // On sign-in / return from Stripe: resume the latest in-progress order at the right step.
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      const res = await getGCMSOrders(token); // backend lazily verifies payment + 24h auto-file
      const orders: GCMSOrder[] = res.orders || [];
      // Completed orders become trackable history; only an in-progress order resumes the wizard,
      // so a returning customer can always start a new order.
      setPastOrders(orders.filter(o => ['received', 'filed', 'delivered'].includes(o.status)));
      const active = orders.find(o => o.status === 'awaiting_payment' || o.status === 'awaiting_consent');
      if (active) {
        setOrder(active);
        if (active.related_persons?.length) setPersons(active.related_persons);
        setStep(active.status === 'awaiting_payment' ? 2 : 3);
      }
      // Clean the Stripe return params so refreshes don't re-trigger anything.
      const url = new URL(window.location.href);
      if (url.searchParams.has('payment_success') || url.searchParams.has('payment_canceled')) {
        url.searchParams.delete('payment_success');
        url.searchParams.delete('payment_canceled');
        url.searchParams.delete('session_id');
        window.history.replaceState({}, '', url.toString());
      }
    })();
  }, [isSignedIn, getToken]);

  const submitInfo = async () => {
    if (!formValid) { setError('Please fill in your full name, a valid email, and your date of birth.'); return; }
    setError(''); setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const created = await createGCMSOrder(form, token);
      setOrder(created);
      // A prepaid GCMS credit skips the payment step entirely (order arrives already paid).
      setStep(created.status === 'awaiting_consent' ? 3 : 2);
      ReactGA.event('tool_engagement', { tool_name: 'GCMS Order' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  const pay = async () => {
    if (!order) return;
    setError(''); setBusy(true);
    ReactGA.event('begin_checkout', { currency: 'CAD', value: PRICE, items: [{ item_id: 'gcms', item_name: 'GCMS Notes Order', price: PRICE }] });
    try {
      const token = await getToken();
      if (!token) return;
      const res = await createCheckoutSession('gcms', token, '/order-gcms-notes', order.id);
      if (res?.session_url) window.location.href = res.session_url;
      else setError('Could not start checkout. Please try again.');
    } catch (e: any) {
      setError(e.message || 'Could not start checkout. Please try again.');
      setBusy(false);
    }
  };

  const generateForm = async () => {
    if (!order) return;
    if (!personsValid) { setError('Please complete surname, given name(s), and date of birth for each person.'); return; }
    setError(''); setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const withAge = persons.map(p => ({ ...p, under_16: isUnder16(p.date_of_birth) }));
      const updated = await setGCMSPersons(order.id, withAge, token);
      setOrder(updated);
      await downloadGCMSConsentForm(order.id, token);
      setDocIds(new Array(1 + withAge.length).fill(null)); // one ID slot per person
      setFormReady(true);
    } catch (e: any) {
      setError(e.message || 'Could not generate the form. Please try again.');
    } finally { setBusy(false); }
  };

  const submitDocuments = async () => {
    if (!order || !docConsent || docIds.some(f => !f)) return;
    setError(''); setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const updated = await uploadGCMSConsent(order.id, docConsent, token, docIds as File[]);
      setOrder(updated);
      setUploadedFile(docConsent);
      setStep(4);
      sessionStorage.removeItem('gcmsOrderForm');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
    } finally { setBusy(false); }
  };

  // After completing an order, let the user immediately start another one.
  const startNewOrder = () => {
    if (order) setPastOrders(prev => [order, ...prev.filter(p => p.id !== order.id)]);
    setOrder(null);
    setForm(emptyForm);
    setPersons([]);
    setFormReady(false);
    setDocConsent(null);
    setDocIds([]);
    setUploadedFile(null);
    setError('');
    sessionStorage.removeItem('gcmsOrderForm');
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const StepBadge = ({ n, label }: { n: number; label: string }) => {
    const done = step > n, active = step === n;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: done || active ? 1 : 0.45 }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: '0.85rem', color: 'white',
          background: done ? '#10B981' : active ? 'var(--primary-color)' : '#CBD5E1',
        }}>
          {done ? '✓' : n}
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{label}</span>
      </div>
    );
  };

  return (
    <div>
      <SEO
        title="Order Your GCMS Notes — Full IRCC File in 30-40 Days | Mentor Visa"
        description={`See exactly why your application is delayed or was refused. We file your ATIP request and email you the complete GCMS notes — officer assessments, security screening status, and internal remarks. $${PRICE.toFixed(2)} CAD flat.`}
        keywords="order GCMS notes, GCMS notes Canada, ATIP request IRCC, CBSA notes, application delayed IRCC, refusal reasons Express Entry, IMM 5744 consent"
        canonical="/order-gcms-notes"
        schema={FAQ_SCHEMA}
      />

      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📂 Your Complete IRCC File</div>
          <h1>Order Your GCMS Notes.<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>See What the Officer Sees.</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Application delayed, stuck in security screening, or refused without a real explanation? Your GCMS notes contain
            every officer remark, assessment, and flag on your file. We handle the entire ATIP request — you just sign one form.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span>💰 <span style={{ color: 'var(--primary-light)' }}>${PRICE.toFixed(2)} CAD flat</span> — no hidden fees</span>
            <span>⚡ Filed within 1 business day</span>
            <span>📬 Notes emailed the day they arrive</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>

            {/* Step indicator */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
              padding: '16px 20px', background: 'white', borderRadius: '14px',
              border: '1px solid var(--border-color)', marginBottom: '24px',
            }}>
              <StepBadge n={1} label="Your information" />
              <StepBadge n={2} label="Payment" />
              <StepBadge n={3} label="Signed consent" />
            </div>

            {error && (
              <div style={{ color: '#DC2626', fontSize: '0.9rem', marginBottom: '16px', padding: '10px 16px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
                ⚠️ {error}
              </div>
            )}

            {/* ── Previous orders — trackable history, shown while starting a new order ── */}
            {step === 1 && pastOrders.length > 0 && (
              <div className="info-card" style={{ padding: '24px 28px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>📦 Your previous orders</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                  We'll email each order's notes to you the day IRCC releases them. Starting a new order below won't affect these.
                </p>
                {pastOrders.map(o => (
                  <details key={o.id} style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', background: '#F8FAFC' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <span>Order #{o.id} — {o.given_name ? `${o.given_name} ${o.family_name || ''}`.trim() : o.full_name}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: '999px',
                        background: o.status === 'delivered' ? '#ECFDF5' : '#EEF2FF',
                        color: o.status === 'delivered' ? '#065F46' : '#4338CA',
                        border: o.status === 'delivered' ? '1px solid #6EE7B7' : '1px solid #C7D2FE' }}>
                        {STATUS_LABELS[o.status]}
                      </span>
                      {o.created_at && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{new Date(o.created_at).toLocaleDateString('en-CA')}</span>}
                    </summary>
                    <div style={{ marginTop: '14px' }}>
                      <OrderTimeline order={o} />
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* ── STEP 1 — Information ── */}
            {step === 1 && (
              <div className="info-card" style={{ padding: '32px 28px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Step 1 — Tell us about your application</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '22px' }}>
                  We use this to prepare your ATIP request exactly as IRCC expects it. Details must match your application.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={labelStyle}>Surname / family name *</label>
                    <input style={inputStyle} value={form.family_name} onChange={set('family_name')} placeholder="As shown on your passport" />
                  </div>
                  <div>
                    <label style={labelStyle}>Given name(s) *</label>
                    <input style={inputStyle} value={form.given_name} onChange={set('given_name')} placeholder="First + middle names, as on passport" />
                  </div>
                  <div>
                    <label style={labelStyle}>Email (we send your notes here) *</label>
                    <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" />
                  </div>
                  <div>
                    <label style={labelStyle}>Date of birth *</label>
                    <input style={inputStyle} type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country of residence</label>
                    <input style={inputStyle} value={form.country_of_residence} onChange={set('country_of_residence')} placeholder="e.g. India" />
                  </div>
                  <div>
                    <label style={labelStyle}>UCI (if known)</label>
                    <input style={inputStyle} value={form.uci} onChange={set('uci')} placeholder="e.g. 11-2233-4455" />
                  </div>
                  <div>
                    <label style={labelStyle}>Application number (if known)</label>
                    <input style={inputStyle} value={form.application_number} onChange={set('application_number')} placeholder="e.g. E001234567" />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Application type</label>
                  <select style={inputStyle} value={form.application_type} onChange={set('application_type')}>
                    {APPLICATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>Which notes do you need?</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                    {([
                      { v: 'ircc', title: 'IRCC (GCMS) notes', sub: 'Officer assessments & processing detail — the most common choice' },
                      { v: 'cbsa', title: 'CBSA notes', sub: 'Security screening & border records — for files stuck in security review' },
                    ] as const).map(opt => (
                      <div key={opt.v}
                        onClick={() => { const next = { ...form, notes_type: opt.v }; setForm(next); sessionStorage.setItem('gcmsOrderForm', JSON.stringify(next)); }}
                        style={{
                          padding: '14px', borderRadius: '10px', cursor: 'pointer',
                          border: form.notes_type === opt.v ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                          background: form.notes_type === opt.v ? '#EEF2FF' : 'white',
                        }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '2px' }}>{opt.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{opt.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <label style={labelStyle}>Anything else we should know? (optional)</label>
                  <textarea style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }} value={form.extra_notes} onChange={set('extra_notes')}
                    placeholder="e.g. My application has been in security screening since March…" />
                </div>

                {isSignedIn ? (
                  <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy || !formValid} onClick={submitInfo}>
                    {busy ? 'Saving…' : 'Continue to payment →'}
                  </button>
                ) : (
                  <SignInButton mode="modal" fallbackRedirectUrl="/order-gcms-notes">
                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                      Sign in to continue (free account) →
                    </button>
                  </SignInButton>
                )}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                  Your details are used only to file your ATIP request. Nothing is charged until the next step.
                </p>
              </div>
            )}

            {/* ── STEP 2 — Payment ── */}
            {step === 2 && order && (
              <div className="info-card" style={{ padding: '32px 28px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Step 2 — Payment</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Review your order, then pay securely. You'll be taken to our Stripe checkout.
                </p>

                <div style={{ background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '18px 20px', marginBottom: '20px' }}>
                  {[
                    ['Applicant', order.given_name && order.family_name ? `${order.given_name} ${order.family_name.toUpperCase()}` : order.full_name],
                    ['Email', order.email],
                    ['Date of birth', order.date_of_birth],
                    ['Notes requested', order.notes_type === 'cbsa' ? 'CBSA (security screening & border records)' : 'IRCC — GCMS notes'],
                    ['Application type', order.application_type || '—'],
                    ['UCI / Application #', [order.uci, order.application_number].filter(Boolean).join(' / ') || 'Not provided (that’s OK)'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '6px 0', fontSize: '0.9rem', borderBottom: '1px dashed #E2E8F0' }}>
                      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{k}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', fontSize: '1.05rem', fontWeight: 800 }}>
                    <span>Total (one-time)</span>
                    <span style={{ color: 'var(--primary-color)' }}>${PRICE.toFixed(2)} CAD</span>
                  </div>
                </div>

                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy} onClick={pay}>
                  {busy ? 'Redirecting to Stripe…' : `Pay $${PRICE.toFixed(2)} CAD — secure checkout →`}
                </button>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>🔒 Stripe secure payment</span>
                  <span>💚 3-day money-back guarantee</span>
                </div>
                <button className="btn btn-outline" style={{ width: '100%', marginTop: '12px' }} onClick={() => setStep(1)} disabled={busy}>
                  ← Edit my information
                </button>
              </div>
            )}

            {/* ── STEP 3 — Consent form: household -> pre-filled download -> sign -> upload ── */}
            {step === 3 && order && (
              <div className="info-card" style={{ padding: '32px 28px' }}>
                <div style={{ padding: '12px 16px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', color: '#065F46', fontWeight: 600 }}>
                  ✅ Payment received — one last step and we can file your request.
                </div>

                {!formReady ? (
                  <>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Step 3 — We prepare your consent form</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                      IRCC requires a signed consent form (IMM 5744) before we can request your file.
                      Tell us who's on the application and <strong>we'll fill the entire form for you</strong> — you just print, sign, and upload.
                    </p>

                    <label style={labelStyle}>Is anyone else included in your application? (spouse, children…)</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {[0, 1, 2, 3].map(n => (
                        <button key={n} type="button"
                          onClick={() => setPersons(prev => {
                            const next = prev.slice(0, n);
                            while (next.length < n) next.push({ ...emptyPerson });
                            return next;
                          })}
                          style={{
                            padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600,
                            border: persons.length === n ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                            background: persons.length === n ? '#EEF2FF' : 'white',
                          }}>
                          {n === 0 ? 'Just me' : `Me + ${n}`}
                        </button>
                      ))}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-8px', marginBottom: '16px' }}>
                      One IMM 5744 fits up to 4 people. More than 4? Mention it in an email — we'll prepare a second form at no charge.
                    </p>

                    {persons.map((p, i) => (
                      <div key={i} style={{ background: '#F8FAFC', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px', color: 'var(--primary-color)' }}>
                          Person {i + 2} {isUnder16(p.date_of_birth) && <span style={{ color: '#B45309' }}>· under 16 — listed on the form, parents sign for them</span>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <div>
                            <label style={labelStyle}>Surname *</label>
                            <input style={inputStyle} value={p.family_name}
                              onChange={e => setPersons(prev => prev.map((x, j) => j === i ? { ...x, family_name: e.target.value } : x))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Given name(s) *</label>
                            <input style={inputStyle} value={p.given_name}
                              onChange={e => setPersons(prev => prev.map((x, j) => j === i ? { ...x, given_name: e.target.value } : x))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Date of birth *</label>
                            <input style={inputStyle} type="date" value={p.date_of_birth}
                              onChange={e => setPersons(prev => prev.map((x, j) => j === i ? { ...x, date_of_birth: e.target.value } : x))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Relationship to you</label>
                            <select style={inputStyle} value={p.relationship}
                              onChange={e => setPersons(prev => prev.map((x, j) => j === i ? { ...x, relationship: e.target.value } : x))}>
                              {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }} disabled={busy || !personsValid} onClick={generateForm}>
                      {busy ? 'Preparing your form…' : '📄 Generate my pre-filled IMM 5744 →'}
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                      🔒 These details go only onto IRCC's consent form (IMM 5744) — nothing is shared beyond IRCC.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Almost done — sign &amp; upload your documents</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
                      Your pre-filled IMM 5744 just downloaded
                      (<button type="button" onClick={generateForm} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-color)', fontWeight: 600, cursor: 'pointer', fontSize: 'inherit' }}>download again</button>).
                      IRCC is strict about signatures, so follow these exactly:
                    </p>
                    <ol style={{ paddingLeft: '20px', fontSize: '0.92rem', lineHeight: 1.9, marginBottom: '20px' }}>
                      <li><strong>Print</strong> the form (page 1 is enough)</li>
                      <li>Everyone <strong>16 or older</strong> signs in their box — <strong style={{ color: '#1D4ED8' }}>handwritten, in BLUE ink</strong> (IRCC rejects electronic signatures)</li>
                      <li>The <strong>date is already filled in</strong> next to each signature — please sign today so they match</li>
                      {(order.related_persons || []).some(p => p.under_16) && (
                        <li>For children under 16: they don't sign — <strong>both parents</strong> sign the form instead</li>
                      )}
                      <li><strong>Scan or photograph</strong> everything — colour, well-lit, 300dpi or a sharp phone photo</li>
                    </ol>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                      <FileSlot
                        label="Signed IMM 5744 consent form"
                        sub="The form you just printed and signed"
                        file={docConsent} disabled={busy}
                        onPick={f => setDocConsent(f)}
                      />
                      {[`${order.given_name || ''} ${order.family_name || order.full_name}`.trim(),
                        ...(order.related_persons || []).map(p => `${p.given_name} ${p.family_name}`.trim())
                      ].map((name, i) => (
                        <FileSlot key={i}
                          label={`Government-issued ID — ${name}`}
                          sub="Passport bio page or ID card showing their name and signature"
                          file={docIds[i] ?? null} disabled={busy}
                          onPick={f => setDocIds(prev => prev.map((x, j) => j === i ? f : x))}
                        />
                      ))}
                    </div>

                    <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '12px 16px', fontSize: '0.82rem', color: '#0C4A6E', lineHeight: 1.6, marginBottom: '16px' }}>
                      🔒 <strong>Why we ask for ID:</strong> IRCC only processes an ATIP request when the consent
                      signature can be verified against government-issued identification for each person. Your
                      documents are stored encrypted, used solely to file this request with IRCC, never shared with
                      anyone else, and retained for a maximum of 6 years ({' '}
                      <a href="/privacy-policy" target="_blank" style={{ color: '#0369A1', fontWeight: 600 }}>privacy policy</a>).
                    </div>

                    <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
                      disabled={busy || !docConsent || docIds.some(f => !f)} onClick={submitDocuments}>
                      {busy ? 'Uploading…' : `Submit ${1 + docIds.length} document${docIds.length ? 's' : ''} — finish my order →`}
                    </button>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '12px', marginBottom: 0 }}>
                      Stuck? Email info@mentorvisa.com and we'll walk you through it.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* ── STEP 4 — Done / status timeline ── */}
            {step === 4 && order && (
              <div className="info-card" style={{ padding: '36px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{order.status === 'delivered' ? '📬' : '🎉'}</div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '10px' }}>
                  {order.status === 'delivered' ? 'Your GCMS notes have been sent!'
                    : order.status === 'filed' ? 'Your ATIP request is with IRCC.'
                    : "We've got everything we need!"}
                </h3>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: '520px', margin: '0 auto 20px' }}>
                  {uploadedFile ? <>Your signed consent form and ID document(s) were received securely. </> : null}
                  {order.status === 'delivered'
                    ? <>Check <strong>{order.email}</strong> — your complete notes are in your inbox.</>
                    : <>We file your {order.notes_type === 'cbsa' ? 'CBSA' : 'GCMS'} request within 1 business day.
                      IRCC typically responds within <strong>30–40 days</strong>, and we'll email your complete notes to{' '}
                      <strong>{order.email}</strong> the day they arrive.</>}
                </p>

                {/* Status timeline */}
                <div style={{ maxWidth: '420px', margin: '0 auto 24px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', textAlign: 'center' }}>
                    Order #{order.id} — status
                  </div>
                  <OrderTimeline order={order} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 24px' }}>
                  🔒 Your signed form and ID are stored encrypted, used only to file this request with IRCC,
                  and never shared with anyone else. Questions? info@mentorvisa.com
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="/track-my-application" className="btn btn-primary" style={{ textDecoration: 'none' }}>📅 Track my application meanwhile</a>
                  <a href="/audit-employment-letter" className="btn btn-outline" style={{ textDecoration: 'none' }}>📄 Audit my employment letter</a>
                  <button className="btn btn-outline" onClick={startNewOrder}>➕ Order notes for another application</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* What's inside — SEO/value content */}
        <section className="page-section">
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px', textAlign: 'center' }}>What your GCMS notes reveal</h2>
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '24px' }}>
              The letters IRCC sends you say almost nothing. Your file says everything.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {[
                { icon: '🧑‍⚖️', title: 'Officer assessments', sub: 'The actual eligibility notes an officer wrote about your work experience, funds, and documents.' },
                { icon: '🛡️', title: 'Security screening status', sub: 'Whether security, criminality, and info-sharing checks are in progress, passed, or stalled.' },
                { icon: '⏱️', title: 'The real reason for delays', sub: 'Which step your file is actually sitting at — not the generic "processing" status in your account.' },
                { icon: '❌', title: 'Full refusal reasoning', sub: 'The detailed grounds behind a refusal, so your next application fixes the right problem.' },
              ].map((c, i) => (
                <div key={i} style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px' }}>
                  <div style={{ fontSize: '1.6rem', marginBottom: '8px' }}>{c.icon}</div>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>{c.title}</div>
                  <div style={{ fontSize: '0.87rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="page-section">
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>Frequently asked questions</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              New to GCMS notes? Read our full guide: <a href="/how-to-read-gcms-notes" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>How to read your GCMS notes — codes, stages &amp; red flags →</a>
            </p>
            {FAQ.map((f, i) => (
              <details key={i} style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', marginBottom: '10px' }}>
                <summary style={{ fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>{f.q}</summary>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.65, marginTop: '10px', marginBottom: 0 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default OrderGCMSNotesPage;
