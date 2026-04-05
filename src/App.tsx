import { useState } from 'react';
import type { AnalysisResponse } from './types';
import { LandingPage } from './components/LandingPage';
import { Uploader } from './components/Uploader';
import { Dashboard } from './components/Dashboard';
import { MyEvaluations } from './components/MyEvaluations';
import { CECGuidePage } from './components/CECGuidePage';
import { NOCFinderPage } from './components/NOCFinderPage';
import { CECChecklistPage } from './components/CECChecklistPage';
import { CRSCalculatorPage } from './components/CRSCalculatorPage';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { saveEvaluation } from './services/api';
import { useSmartNav } from './hooks/useSmartNav';
import './components/LandingPage.css';
import './components/Pages.css';
import './App.css';

type AppPage = 'landing' | 'audit' | 'results' | 'history' | 'cec-guide' | 'noc-finder' | 'checklist' | 'crs-calculator';

// Pages that render their own hero/layout (like landing)
const FULL_PAGES = new Set<AppPage>(['cec-guide', 'noc-finder', 'checklist', 'crs-calculator', 'audit']);

function App() {
  const { isSignedIn, getToken } = useAuth();
  const { scrolled, hidden } = useSmartNav();
  
  const [page, setPage] = useState<AppPage>(() => {
    if (sessionStorage.getItem('mentorVisaAnalysisResult')) return 'results';
    return 'landing';
  });
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(() => {
    const saved = sessionStorage.getItem('mentorVisaAnalysisResult');
    return saved ? JSON.parse(saved) : null;
  });

  const handleGetStarted = () => {
    setPage('audit');
    window.scrollTo(0, 0);
  };

  const handleNavigate = (target: string) => {
    setPage(target as AppPage);
    window.scrollTo(0, 0);
  };

  const handleAnalysisResult = async (result: AnalysisResponse, isNew: boolean = false) => {
    sessionStorage.setItem('mentorVisaAnalysisResult', JSON.stringify(result));
    setAnalysisResult(result);
    setPage('results');
    window.scrollTo(0, 0);
    
    if (isNew && isSignedIn) {
      try {
        const token = await getToken();
        if (token) await saveEvaluation(result, token);
      } catch (e) {
        console.error("Failed to auto-save evaluation:", e);
      }
    }
  };

  const handleReset = () => {
    sessionStorage.removeItem('mentorVisaAnalysisResult');
    sessionStorage.removeItem('pendingPdfDownload');
    setAnalysisResult(null);
    setPage('audit');
    window.scrollTo(0, 0);
  };

  const handleBackToHome = () => {
    setPage('landing');
    window.scrollTo(0, 0);
  };

  // Landing page has its own full layout
  if (page === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} onNavigate={handleNavigate} />;
  }

  // Full-page layouts (CEC Guide, NOC Finder, etc.) with shared nav
  if (FULL_PAGES.has(page)) {
    return (
      <div className="landing">
        {/* Shared Nav */}
        <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''} ${hidden ? 'nav-hidden' : ''}`}>
          <div className="landing-nav-inner">
            <div className="landing-logo" style={{ cursor: 'pointer' }} onClick={handleBackToHome}>
              <span className="landing-logo-icon">🍁</span>
              <span className="landing-logo-text">Mentor Visa</span>
            </div>
            <div className="nav-links-desktop">
              <button className={`nav-link ${page === 'audit' ? 'active' : ''}`} onClick={handleGetStarted}>Audit Employment Letter</button>
              <button className={`nav-link ${page === 'noc-finder' ? 'active' : ''}`} onClick={() => handleNavigate('noc-finder')}>Find My NOC</button>
              <button className={`nav-link ${page === 'cec-guide' ? 'active' : ''}`} onClick={() => handleNavigate('cec-guide')}>Express Entry CEC Guide</button>
              <button className={`nav-link ${page === 'crs-calculator' ? 'active' : ''}`} onClick={() => handleNavigate('crs-calculator')}>CRS Calculator</button>
              <button className={`nav-link ${page === 'checklist' ? 'active' : ''}`} onClick={() => handleNavigate('checklist')}>CEC Application Checklist</button>
              <div className="nav-auth">
                {isSignedIn ? <UserButton /> : null}
              </div>
            </div>
          </div>
        </nav>

        {page === 'cec-guide' && <CECGuidePage onNavigate={handleNavigate} />}
        {page === 'noc-finder' && <NOCFinderPage onNavigate={handleNavigate} />}
        {page === 'checklist' && <CECChecklistPage onNavigate={handleNavigate} />}
        {page === 'crs-calculator' && <CRSCalculatorPage onNavigate={handleNavigate} />}
        {page === 'audit' && <Uploader onAnalysisResult={(result) => handleAnalysisResult(result, true)} />}

        {/* Shared Footer */}
        <footer className="landing-footer">
          <div className="landing-footer-inner">
            <div className="landing-footer-brand">
              <span className="landing-logo-icon">🍁</span>
              <span>Mentor Visa</span>
            </div>
            <p className="landing-footer-disclaimer">
              © 2026 Mentor Visa Services. All rights reserved.<br />
              This tool is for informational purposes only and does not constitute legal or immigration advice.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Inner app pages (Audit, Results, History)
  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span 
              className="landing-logo" 
              style={{ cursor: 'pointer', fontSize: '1.6rem', color: 'var(--primary-dark)' }} 
              onClick={handleBackToHome}
            >
              <span className="landing-logo-icon">🍁</span>
              <span className="landing-logo-text">Mentor Visa</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             {isSignedIn && (
                <button 
                  onClick={() => setPage('history')}
                  className="btn btn-outline" 
                  style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                >
                  My Past Audits
                </button>
             )}
             <UserButton />
          </div>
        </div>
      </header>
      
      <main className="main-content">

        {page === 'history' && <MyEvaluations onSelectEvaluation={(result) => handleAnalysisResult(result, false)} />}
        {page === 'results' && analysisResult && <Dashboard data={analysisResult} onReset={handleReset} />}
      </main>

      <footer style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)', fontSize: '13px', paddingBottom: '24px' }}>
        <p>&copy; 2026 Mentor Visa Services. All rights reserved.</p>
        <p style={{ marginTop: '4px', fontSize: '11px' }}>This tool is for informational purposes only and does not constitute legal or immigration advice.</p>
      </footer>
    </div>
  );
}

export default App;
