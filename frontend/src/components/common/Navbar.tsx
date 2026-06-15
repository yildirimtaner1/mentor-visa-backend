import { type FC, useState, useEffect } from 'react';
import { SignInButton, SignUpButton, useAuth, UserButton } from '@clerk/clerk-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSmartNav } from '../../hooks/useSmartNav';
import { fetchUserCredits } from '../../services/api';
import { ChevronDown, FileText, CheckSquare, LineChart, Map, BookOpen, MessageCircle, CalendarClock } from 'lucide-react';

const DropdownMenu = ({ title, items, basePath, columns = 1 }: { title: string, items: any[], basePath?: string, columns?: number }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isActive = items.some(i => location.pathname === i.path) || (basePath && location.pathname.startsWith(basePath));
  
  return (
    <div 
      className="dropdown-container"
      style={{ position: 'relative' }} 
      onMouseEnter={() => setOpen(true)} 
      onMouseLeave={() => setOpen(false)}
    >
      <div className={`nav-link ${isActive ? 'active' : ''}`}>
        {title}
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      <div 
        className="dropdown-content" 
        style={{ 
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: '8px',
          minWidth: columns > 1 ? '580px' : '300px'
        }}
      >
        {items.map(i => (
          <Link key={i.path} to={i.path} className="dropdown-item">
            <div className="dropdown-icon-box">
              {i.icon}
            </div>
            <div>
              <div className="dropdown-item-title">{i.label}</div>
              {i.subtext && <div className="dropdown-item-subtext">{i.subtext}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export const Navbar: FC = () => {
  const { isSignedIn, getToken } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrolled, hidden } = useSmartNav();
  const navigate = useNavigate();
  const location = useLocation();

  // Credit balance
  const [credits, setCredits] = useState<{ noc: number; audit: number; builder: number; ita: number; tier: string } | null>(null);

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
        ita: c.ita_strategy_credits || 0,
        tier: c.subscription_tier || 'free'
      });
    };
    load();
  }, [isSignedIn, getToken]);

  const isTierUnlimited = (type: 'audit' | 'builder') => {
    if (!credits) return false;
    if (type === 'audit') return ['starter', 'complete'].includes(credits.tier);
    if (type === 'builder') return credits.tier === 'complete';
    return false;
  };

  const totalCreditsDisplay = () => {
    if (!credits) return '0 credits';
    
    const isAuditUnlimited = isTierUnlimited('audit');
    const isBuilderUnlimited = isTierUnlimited('builder');
    
    // Calculate credits for tools NOT covered by unlimited tier
    const otherCredits = (isAuditUnlimited ? 0 : credits.audit) + 
                        (isBuilderUnlimited ? 0 : credits.builder) + 
                        credits.noc + 
                        credits.ita;
                       
    if (isAuditUnlimited && isBuilderUnlimited) {
      return otherCredits > 0 ? `Unlimited + ${otherCredits} credit${otherCredits !== 1 ? 's' : ''}` : 'Unlimited Access';
    }
    
    if (isAuditUnlimited || isBuilderUnlimited) {
      return otherCredits > 0 ? `Unlimited + ${otherCredits} credit${otherCredits !== 1 ? 's' : ''}` : 'Unlimited Access';
    }
    
    return `${otherCredits} credit${otherCredits !== 1 ? 's' : ''}`;
  };

  const creditBadgeElement = credits !== null ? (
    <div
      onClick={() => navigate('/dashboard')}
      title={`NOC Finder: ${credits.noc} | Letter Builder: ${isTierUnlimited('builder') ? 'Unlimited' : credits.builder} | Letter Auditor: ${isTierUnlimited('audit') ? 'Unlimited' : credits.audit}${credits.ita > 0 ? ` | ITA Strategy: ${credits.ita}` : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
        padding: '5px 12px', borderRadius: '20px', cursor: 'pointer',
        border: '1px solid #C7D2FE',
        fontSize: '0.8rem', fontWeight: 600,
        color: '#4338CA',
        transition: 'all 0.2s ease',
      }}
    >
      <span style={{ fontSize: '0.9rem' }}>🎟️</span>
      <span>{totalCreditsDisplay()}</span>
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
            title="Get Started" 
            items={[
              { path: '/get-started', label: 'Check Eligibility', subtext: 'FSWP, CEC & FSTP assessment', icon: <CheckSquare size={16} /> },
              { path: '/crs-calculator', label: 'Calculate CRS Score', subtext: 'Score & maximize your points', icon: <LineChart size={16} /> },
              { path: '/ai-profile-assistant', label: 'Express Entry AI Assistant', subtext: 'AI help for your IRCC application', icon: <MessageCircle size={16} /> },
            ]}
          />
          <DropdownMenu 
            title="Tools" 
            items={[
              { path: '/find-my-noc', label: 'Find My NOC', subtext: 'AI-powered duty matching', icon: <FileText size={16} /> },
              { path: '/audit-employment-letter', label: 'Audit Employment Letter', subtext: 'Verify IRCC compliance', icon: <CheckSquare size={16} /> },
              { path: '/track-my-application', label: 'Smart Application Tracker', subtext: 'Track milestones and dates, receive smart predictions', icon: <CalendarClock size={16} /> },
              { path: '/documents', label: '12 Mistakes Checklist', subtext: 'Error prevention guide', icon: <FileText size={16} /> },
            ]}
          />
          <DropdownMenu 
            title="Learn" 
            columns={2}
            items={[
              { path: '/draw-results', label: 'Draw Results', subtext: 'Live Express Entry tracker', icon: <LineChart size={16} /> },
              { path: '/express-entry-processing-times', label: 'Processing Times', subtext: 'AOR to eCOPR, by stream', icon: <CalendarClock size={16} /> },
              { path: '/express-entry-cec-guide', label: 'CEC Guide', subtext: 'Requirements & process', icon: <BookOpen size={16} /> },
              { path: '/cec-checklist', label: 'CEC Checklist', subtext: 'Document checklist generator', icon: <CheckSquare size={16} /> },
              { path: '/noc-codes', label: 'NOC Directory', subtext: 'Browse the 2021 Matrix', icon: <Map size={16} /> },
              { path: '/gckey-setup-guide', label: 'GCKey Setup Guide', subtext: 'Create your IRCC account', icon: <FileText size={16} /> },
            ]}
            basePath="/noc-codes"
          />

          <Link 
            to="/pricing" 
            className={`nav-link ${location.pathname === '/pricing' ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            Pricing
          </Link>
          
          <div className="nav-auth">
            {!isSignedIn ? (
              <>
                <button 
                  className="btn btn-ghost" 
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                  onClick={() => navigate('/get-started')}
                >
                  Start Free →
                </button>
                <SignInButton mode="modal" forceRedirectUrl={window.location.pathname} signUpForceRedirectUrl={window.location.pathname}>
                  <button className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>Login</button>
                </SignInButton>
              </>
            ) : (
              <>
                {creditBadgeElement}
                <button 
                  className="btn btn-outline" 
                  onClick={() => navigate('/my-profile')} 
                  style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                >
                  My Profile
                </button>
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
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '0 8px 8px', marginTop: '4px' }}>Get Started</div>
          <button className="mobile-menu-link" onClick={() => { navigate('/get-started'); setMobileMenuOpen(false); }}>🚀 Check Eligibility</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/crs-calculator'); setMobileMenuOpen(false); }}>📊 Calculate CRS Score</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/ai-profile-assistant'); setMobileMenuOpen(false); }}>🤖 Express Entry AI Assistant</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/pricing'); setMobileMenuOpen(false); }}>💎 Pricing</button>
          
          <div style={{ borderTop: '1px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '12px 8px 8px', marginTop: '8px' }}>Tools</div>
          <button className="mobile-menu-link" onClick={() => { navigate('/find-my-noc'); setMobileMenuOpen(false); }}>🎯 Find My NOC</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/audit-employment-letter'); setMobileMenuOpen(false); }}>📄 Audit Employment Letter</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/track-my-application'); setMobileMenuOpen(false); }}>📅 Smart Application Tracker</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/documents'); setMobileMenuOpen(false); }}>⚠️ 12 Mistakes Checklist</button>

          <div style={{ borderTop: '1px solid var(--border-color)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 700, padding: '12px 8px 8px', marginTop: '8px' }}>Learn</div>
          <button className="mobile-menu-link" onClick={() => { navigate('/draw-results'); setMobileMenuOpen(false); }}>📈 Draw Results</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/express-entry-processing-times'); setMobileMenuOpen(false); }}>⏱️ Processing Times</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/express-entry-cec-guide'); setMobileMenuOpen(false); }}>📘 CEC Guide</button>
          <button className="mobile-menu-link" onClick={() => { navigate('/gckey-setup-guide'); setMobileMenuOpen(false); }}>🔑 GCKey Setup Guide</button>
          
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '8px', display: 'flex', gap: '12px' }}>
            {!isSignedIn ? (
              <>
                <SignInButton mode="modal" forceRedirectUrl={window.location.pathname} signUpForceRedirectUrl={window.location.pathname}>
                  <button className="btn btn-ghost" style={{ flex: 1, fontSize: '0.9rem' }}>Login</button>
                </SignInButton>
                <SignUpButton mode="modal" forceRedirectUrl={window.location.pathname}>
                  <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.9rem' }}>Sign Up</button>
                </SignUpButton>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                <button 
                  className="mobile-menu-link" 
                  onClick={() => { navigate('/my-profile'); setMobileMenuOpen(false); }}
                  style={{ fontWeight: 600 }}
                >
                  👤 My Profile
                </button>
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

