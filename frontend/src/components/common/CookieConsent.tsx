import { useState } from 'react';
import ReactGA from 'react-ga4';

/**
 * Cookie consent banner (bottom-right; full-width on small screens).
 * Google Analytics only initializes AFTER "Accept all" — main.tsx checks the same
 * localStorage key on later visits, and the static gtag snippet was removed from
 * index.html, so declining genuinely keeps GA cookies off the device.
 * Essential cookies (Clerk sign-in session) are always on; Vercel Analytics is cookieless.
 */

const CONSENT_KEY = 'mv-cookie-consent'; // 'accepted' | 'essential'

export function initAnalyticsIfConsented() {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (id && localStorage.getItem(CONSENT_KEY) === 'accepted') {
    ReactGA.initialize(id);
  }
}

export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(CONSENT_KEY); } catch { return false; }
  });

  if (!visible) return null;

  const decide = (choice: 'accepted' | 'essential') => {
    try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* private mode */ }
    if (choice === 'accepted') {
      const id = import.meta.env.VITE_GA_MEASUREMENT_ID;
      if (id) ReactGA.initialize(id);
    }
    setVisible(false);
  };

  return (
    <div style={{
      position: 'fixed', bottom: '16px', right: '16px', left: 'max(16px, calc(100vw - 396px))',
      zIndex: 1100, background: 'white', border: '1px solid var(--border-color)',
      borderRadius: '14px', boxShadow: '0 12px 32px rgba(15,23,42,0.18)', padding: '16px 18px',
    }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '6px' }}>🍪 Cookies on Mentor Visa</div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: '0 0 12px' }}>
        We use essential cookies to keep you signed in, and — with your consent — analytics cookies to
        understand how our tools are used and improve them. See our{' '}
        <a href="/privacy-policy" style={{ color: 'var(--primary-color)' }}>privacy policy</a>.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => decide('accepted')} className="btn btn-primary"
          style={{ flex: 1, padding: '9px 14px', fontSize: '0.85rem', minWidth: '120px' }}>
          Accept all
        </button>
        <button onClick={() => decide('essential')}
          style={{ flex: 1, padding: '9px 14px', fontSize: '0.85rem', minWidth: '120px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-muted)' }}>
          Essential only
        </button>
      </div>
    </div>
  );
}
