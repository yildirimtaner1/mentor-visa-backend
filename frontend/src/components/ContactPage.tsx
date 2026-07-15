import { useState, type FC, type ChangeEvent } from 'react';
import { useUser } from '@clerk/clerk-react';
import { SEO } from './common/SEO';
import { sendContactMessage } from '../services/api';

const SUBJECTS = [
  'Technical issue',
  'Billing & payments',
  'GCMS notes order',
  'Refund request',
  'Feedback & suggestions',
  'Question about my results',
  'Partnership / business',
  'Other',
];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1px solid var(--border-color)', fontSize: '1rem', background: 'white',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px',
};

const SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ContactPage',
  mainEntity: {
    '@type': 'Organization',
    name: 'Mentor Visa',
    url: 'https://mentorvisa.com',
    email: 'contact@mentorvisa.com',
    contactPoint: { '@type': 'ContactPoint', email: 'contact@mentorvisa.com', contactType: 'customer support' },
  },
});

export const ContactPage: FC = () => {
  const { user } = useUser();
  const [form, setForm] = useState({
    first_name: user?.firstName || '',
    last_name: user?.lastName || '',
    email: user?.primaryEmailAddress?.emailAddress || '',
    subject: SUBJECTS[0],
    message: '',
    website: '', // honeypot — hidden from humans, bots fill it
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const valid = form.first_name.trim() && form.last_name.trim()
    && /\S+@\S+\.\S+/.test(form.email) && form.message.trim().length >= 10;

  const submit = async () => {
    if (!valid) { setError('Please fill in your name, a valid email, and a message of at least 10 characters.'); return; }
    setError(''); setBusy(true);
    try {
      await sendContactMessage(form);
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Could not send your message.');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <SEO
        title="Contact Us — Mentor Visa"
        description="Questions about your Express Entry tools, a GCMS notes order, or billing? Send us a message — we reply within 1 business day. contact@mentorvisa.com"
        keywords="contact Mentor Visa, Mentor Visa support, GCMS notes help, Express Entry tools support"
        canonical="/contact"
        schema={SCHEMA}
      />

      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">💬 We're here to help</div>
          <h1>Contact <span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>Us</span></h1>
          <p style={{ maxWidth: '620px', margin: '0 auto', fontSize: '1.05rem', lineHeight: 1.6 }}>
            A question about a tool, your GCMS order, billing, or anything else — send us a message
            and we'll get back to you within 1 business day.
          </p>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', maxWidth: '960px', margin: '0 auto', alignItems: 'start' }}>

            {/* Form */}
            <div className="info-card" style={{ padding: '30px 26px', gridColumn: 'span 1' }}>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '30px 10px' }}>
                  <div style={{ fontSize: '2.6rem', marginBottom: '12px' }}>📨</div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>Message sent!</h3>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: '380px', margin: '0 auto 18px' }}>
                    Thanks, {form.first_name} — we've received your message about
                    “{form.subject}” and will reply to <strong>{form.email}</strong> within 1 business day.
                  </p>
                  <button className="btn btn-outline" onClick={() => { setSent(false); setForm(f => ({ ...f, message: '' })); }}>
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '18px' }}>Send us a message</h3>
                  {error && (
                    <div style={{ color: '#DC2626', fontSize: '0.88rem', marginBottom: '14px', padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA' }}>
                      ⚠️ {error}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                    <div>
                      <label style={labelStyle}>First name *</label>
                      <input style={inputStyle} value={form.first_name} onChange={set('first_name')} autoComplete="given-name" />
                    </div>
                    <div>
                      <label style={labelStyle}>Last name *</label>
                      <input style={inputStyle} value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Email address *</label>
                    <input style={inputStyle} type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={labelStyle}>Subject</label>
                    <select style={inputStyle} value={form.subject} onChange={set('subject')}>
                      {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>Message *</label>
                    <textarea style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} value={form.message} onChange={set('message')}
                      placeholder="Tell us what's going on — include your order number or the tool you were using if relevant." />
                  </div>
                  {/* Honeypot — hidden from humans */}
                  <input type="text" value={form.website} onChange={set('website')} tabIndex={-1} autoComplete="off"
                    style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }} aria-hidden="true" />
                  <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy || !valid} onClick={submit}>
                    {busy ? 'Sending…' : 'Send message →'}
                  </button>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                    🔒 Used only to reply to you — see our <a href="/privacy-policy" style={{ color: 'var(--primary-color)' }}>privacy policy</a>.
                  </p>
                </>
              )}
            </div>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="info-card" style={{ padding: '24px 26px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px' }}>Reach us directly</h3>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, margin: 0 }}>
                  📧 <a href="mailto:contact@mentorvisa.com" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>contact@mentorvisa.com</a>
                </p>
              </div>
              <div className="info-card" style={{ padding: '24px 26px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px' }}>Before you write…</h3>
                <ul style={{ paddingLeft: '18px', fontSize: '0.88rem', lineHeight: 1.9, margin: 0, color: 'var(--text-muted)' }}>
                  <li><a href="/order-gcms-notes" style={{ color: 'var(--primary-color)' }}>GCMS order status</a> — sign in and open the order page; your live status is right there.</li>
                  <li><a href="/how-to-read-gcms-notes" style={{ color: 'var(--primary-color)' }}>How to read GCMS notes</a> — codes, stages and red flags explained.</li>
                  <li><a href="/refund-policy" style={{ color: 'var(--primary-color)' }}>Refund policy</a> — 3-day money-back guarantee details.</li>
                  <li><a href="/glossary" style={{ color: 'var(--primary-color)' }}>Immigration glossary</a> — 70+ terms explained.</li>
                </ul>
              </div>
              <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '14px 18px', fontSize: '0.85rem', color: '#4338CA', lineHeight: 1.6 }}>
                ⏱️ <strong>Typical response time:</strong> under 1 business day. GCMS order questions are prioritized.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ContactPage;
