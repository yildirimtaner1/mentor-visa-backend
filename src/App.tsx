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
import { NOCDirectoryPage } from './components/NOCDirectoryPage';
import { NOCDetailsPage } from './components/NOCDetailsPage';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { saveEvaluation } from './services/api';
import { Navbar } from './components/common/Navbar';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './components/LandingPage.css';
import './components/Pages.css';
import './App.css';

// A wrapper for pages that share the unified navbar and footer (e.g. NOC Finder, CRS Calc)
const SharedLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="landing">
      <Navbar />
      {children}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/logo.png" alt="Mentor Visa" style={{ height: '28px', width: '28px', objectFit: 'contain' }} />
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
};

// A wrapper for the dashboard / inner app pages
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span 
              className="landing-logo" 
              style={{ cursor: 'pointer', fontSize: '1.6rem', color: 'var(--primary-dark)' }} 
              onClick={() => navigate('/')}
            >
              <img src="/logo.png" alt="Mentor Visa" className="landing-logo-icon" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />
              <span className="landing-logo-text">Mentor Visa</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             {isSignedIn && (
                <button 
                  onClick={() => navigate('/dashboard')}
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
        {children}
      </main>

      <footer style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)', fontSize: '13px', paddingBottom: '24px' }}>
        <p>&copy; 2026 Mentor Visa Services. All rights reserved.</p>
        <p style={{ marginTop: '4px', fontSize: '11px' }}>This tool is for informational purposes only and does not constitute legal or immigration advice.</p>
      </footer>
    </div>
  );
};

function App() {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(() => {
    const saved = sessionStorage.getItem('mentorVisaAnalysisResult');
    return saved ? JSON.parse(saved) : null;
  });

  const handleAnalysisResult = async (result: AnalysisResponse, isNew: boolean = false) => {
    sessionStorage.setItem('mentorVisaAnalysisResult', JSON.stringify(result));
    setAnalysisResult(result);
    navigate('/results');
    
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
    navigate('/audit-employment-letter');
  };

  return (
    <Routes>
      {/* Landing Page Route */}
      <Route path="/" element={<LandingPage onGetStarted={() => navigate('/audit-employment-letter')} onNavigate={(page) => navigate(`/${page}`)} />} />

      {/* Shared Nav Routes (Tools) */}
      <Route path="/audit-employment-letter" element={<SharedLayout><Uploader onAnalysisResult={(result) => handleAnalysisResult(result, true)} /></SharedLayout>} />
      <Route path="/find-my-noc" element={<SharedLayout><NOCFinderPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/express-entry-cec-guide" element={<SharedLayout><CECGuidePage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/crs-calculator" element={<SharedLayout><CRSCalculatorPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/cec-checklist" element={<SharedLayout><CECChecklistPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      
      {/* Content Silos */}
      <Route path="/noc-codes" element={<SharedLayout><NOCDirectoryPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/noc-codes/:code" element={<SharedLayout><NOCDetailsPage /></SharedLayout>} />

      {/* App Layout Routes (Dashboard/Results) */}
      <Route path="/dashboard" element={<AppLayout><MyEvaluations onSelectEvaluation={(result) => handleAnalysisResult(result, false)} /></AppLayout>} />
      <Route path="/results" element={
        <AppLayout>
          {analysisResult ? <Dashboard data={analysisResult} onReset={handleReset} /> : <div style={{textAlign: 'center', padding: '40px'}}>No result found. <button onClick={() => navigate('/audit-employment-letter')} className="btn btn-primary" style={{marginLeft: '10px'}}>Audit a new letter</button></div>}
        </AppLayout>
      } />
    </Routes>
  );
}

export default App;
