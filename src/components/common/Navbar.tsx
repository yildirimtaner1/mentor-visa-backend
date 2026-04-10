import { type FC, useState, useEffect } from 'react';
import { SignInButton, SignUpButton, useAuth, UserButton } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSmartNav } from '../../hooks/useSmartNav';
import { fetchUserCredits } from '../../services/api';

export const Navbar: FC = () => {
  const { isSignedIn, getToken } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrolled, hidden } = useSmartNav();
  const location = useLocation();
  const navigate = useNavigate();
  const pagePath = location.pathname;

  // Credit balance
  const [credits, setCredits] = useState<{ noc: number; audit: number } | null>(null);

  useEffect(() => {
    if (!isSignedIn) { setCredits(null); return; }
    const load = async () => {
      const tk = await getToken();
      if (!tk) return;
      const c = await fetchUserCredits(tk);
      setCredits({ noc: c.find_noc_credits || 0, audit: c.audit_letter_credits || 0 });
    };
    load();
  }, [isSignedIn, getToken]);

  const totalCredits = credits ? credits.noc + credits.audit : 0;

  const CreditBadge = () => credits !== null ? (
    <div
      onClick={() => navigate('/dashboard')}
      title={`NOC Finder: ${credits.noc} credits | Letter Auditor: ${credits.audit} credits`}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        background: totalCredits > 0 ? 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' : '#F3F4F6',
        padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
        border: totalCredits > 0 ? '1px solid #C7D2FE' : '1px solid #E5E7EB',
        fontSize: '0.8rem', fontWeight: 600,
        color: totalCredits > 0 ? '#4338CA' : '#9CA3AF',
        transition: 'all 0.2s ease',
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>🎟️</span>
      <span>{totalCredits} credit{totalCredits !== 1 ? 's' : ''}</span>
    </div>
  ) : null;

  return (
    <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''} ${hidden ? 'nav-hidden' : ''}`}>
      <div className="landing-nav-inner">
        <Link to="/" className="landing-logo" style={{ cursor: 'pointer', textDecoration: 'none' }}>
          <img src="/logo.png" alt="Mentor Visa" className="landing-logo-icon" style={{ height: '36px', width: '36px', objectFit: 'contain' }} />
          <span className="landing-logo-text">Mentor Visa</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="nav-links-desktop">
          <Link to="/find-my-noc" className={`nav-link ${pagePath === '/find-my-noc' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Find My NOC</Link>
          <Link to="/audit-employment-letter" className={`nav-link ${pagePath === '/audit-employment-letter' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Audit Employment Letter</Link>
          <Link to="/express-entry-cec-guide" className={`nav-link ${pagePath === '/express-entry-cec-guide' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>Express Entry CEC Guide</Link>
          <Link to="/crs-calculator" className={`nav-link ${pagePath === '/crs-calculator' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>CRS Calculator</Link>
          <Link to="/cec-checklist" className={`nav-link ${pagePath === '/cec-checklist' ? 'active' : ''}`} style={{ textDecoration: 'none' }}>CEC Application Checklist</Link>
          
          <div className="nav-auth">
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                  <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Login</button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl={window.location.href} signInForceRedirectUrl={window.location.href}>
                  <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Sign Up</button>
                </SignUpButton>
              </>
            ) : (
              <>
                <CreditBadge />
                <button 
                  className="btn btn-outline" 
                  onClick={() => navigate('/dashboard')} 
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  My Evaluations
                </button>
                <UserButton />
              </>
            )}
          </div>
        </div>

        {/* Mobile Hamburger */}
        <button
          className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-link" onClick={() => { navigate('/find-my-noc'); setMobileMenuOpen(false); }}>🎯 Find My NOC</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/audit-employment-letter'); setMobileMenuOpen(false); }}>📄 Audit Employment Letter</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/express-entry-cec-guide'); setMobileMenuOpen(false); }}>📘 Express Entry CEC Guide</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/crs-calculator'); setMobileMenuOpen(false); }}>📊 CRS Calculator</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/cec-checklist'); setMobileMenuOpen(false); }}>✅ CEC Application Checklist</button>
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px', display: 'flex', gap: '12px' }}>
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.9rem' }}>Login</button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl={window.location.href} signInForceRedirectUrl={window.location.href}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.9rem' }}>Sign Up</button>
                </SignUpButton>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <button 
                  className="mobile-menu-link" 
                  onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                  style={{ fontWeight: 600 }}
                >
                  📋 My Evaluations
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                  <UserButton />
                  <CreditBadge />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

