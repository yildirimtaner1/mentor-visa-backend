import { type FC, useState, useEffect } from 'react';
import { SignInButton, SignUpButton, useAuth, UserButton } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSmartNav } from '../../hooks/useSmartNav';
import { fetchUserCredits } from '../../services/api';
import { ChevronDown, FileText, Pickaxe, CheckSquare, LineChart, Map, BookOpen } from 'lucide-react';

const DropdownMenu = ({ title, items, basePath }: { title: string, items: any[], basePath?: string }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isActive = items.some(i => location.pathname === i.path) || (basePath && location.pathname.startsWith(basePath));
  
  return (
    <div 
      style={{ position: 'relative' }} 
      onMouseEnter={() => setOpen(true)} 
      onMouseLeave={() => setOpen(false)}
    >
      <div className={`nav-link ${isActive ? 'active' : ''}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {title}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: '0', background: 'white', padding: '8px 0', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', minWidth: '240px', zIndex: 100, border: '1px solid rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
          {items.map(i => (
            <Link key={i.path} to={i.path} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', transition: 'background 0.1s' }} onMouseOver={e => e.currentTarget.style.background = '#f8fafc'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                {i.icon}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-color)' }}>{i.label}</div>
                {i.subtext && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{i.subtext}</div>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export const Navbar: FC = () => {
  const { isSignedIn, getToken } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrolled, hidden } = useSmartNav();
  const navigate = useNavigate();

  // Credit balance
  const [credits, setCredits] = useState<{ noc: number; audit: number; builder: number; ita: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isSignedIn) { setCredits(null); return; }
    const load = async () => {
      const tk = await getToken();
      if (!tk) return;
      const c = await fetchUserCredits(tk);
      setCredits({ 
        noc: c.find_noc_credits || 0, 
        audit: c.audit_letter_credits || 0,
        builder: c.letter_builder_credits || 0,
        ita: c.ita_strategy_credits || 0
      });
    };
    load();
  }, [isSignedIn, getToken]);

  const totalCredits = credits ? credits.noc + credits.audit + credits.builder + credits.ita : 0;

  const creditBadgeElement = credits !== null ? (
    <div
      onClick={() => navigate('/dashboard')}
      title={`NOC Finder: ${credits.noc} | Letter Builder: ${credits.builder} | Letter Auditor: ${credits.audit} | PR Strategy: ${credits.ita}`}
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
          <DropdownMenu 
            title="Premium Tools" 
            items={[
              { path: '/find-my-noc', label: 'Find My NOC', subtext: 'AI-powered duty matching', icon: <FileText size={16} /> },
              { path: '/audit-employment-letter', label: 'Audit Employment Letter', subtext: 'Verify IRCC compliance', icon: <CheckSquare size={16} /> },
              { path: '/build-employment-letter', label: 'Build Employment Letter', subtext: 'Generate custom drafts', icon: <Pickaxe size={16} /> },
              { path: '/crs-calculator', label: 'Build PR Strategy', subtext: 'Calculate your CRS score', icon: <LineChart size={16} /> },
            ]}
          />
          <DropdownMenu 
            title="Resources" 
            items={[
              { path: '/draw-results', label: 'Draw Results', subtext: 'Live Express Entry trackers', icon: <LineChart size={16} /> },
              { path: '/express-entry-cec-guide', label: 'CEC Guide', subtext: 'Requirements & process', icon: <BookOpen size={16} /> },
              { path: '/cec-checklist', label: 'CEC Checklist', subtext: 'Document checklist generator', icon: <CheckSquare size={16} /> },
              { path: '/noc-codes', label: 'NOC Directory', subtext: 'Browse the 2021 Matrix', icon: <Map size={16} /> },
            ]}
            basePath="/noc-codes"
          />
          
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
                {creditBadgeElement}
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
          <button className="mobile-menu-link" onClick={() => { navigate('/crs-calculator'); setMobileMenuOpen(false); }}>📊 Build PR Strategy</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/build-employment-letter'); setMobileMenuOpen(false); }}>🔨 Build Employment Letter</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/audit-employment-letter'); setMobileMenuOpen(false); }}>📄 Audit Employment Letter</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/draw-results'); setMobileMenuOpen(false); }}>📈 Draw Results</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/express-entry-cec-guide'); setMobileMenuOpen(false); }}>📘 Express Entry CEC Guide</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/cec-checklist'); setMobileMenuOpen(false); }}>✅ CEC Checklist</button>
          
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
                  {creditBadgeElement}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

