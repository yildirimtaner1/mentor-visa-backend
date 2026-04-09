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
import { PrivacyPolicyPage } from './components/PrivacyPolicyPage';
import { TermsOfServicePage } from './components/TermsOfServicePage';
import { RefundPolicyPage } from './components/RefundPolicyPage';
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
          <p className="landing-footer-disclaimer" style={{ marginBottom: '12px' }}>
            © 2026 Mentor Visa Services. All rights reserved.<br />
            This tool is for informational purposes only and does not constitute legal or immigration advice.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px', flexWrap: 'wrap' }}>
            <a href="/privacy-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms-of-service" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</a>
            <a href="/refund-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</a>
          </div>
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
                  My Past Evaluations
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
        <p style={{ marginTop: '4px', fontSize: '11px', marginBottom: '12px' }}>This tool is for informational purposes only and does not constitute legal or immigration advice.</p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px', flexWrap: 'wrap' }}>
          <a href="/privacy-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms-of-service" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/refund-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</a>
        </div>
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

  const handleHistorySelection = (ev: any) => {
    if (ev.document_type === "NOC Finder Query") {
      let rawData = ev.payload;
      if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch(e) {}
      }

      if (rawData) {
        let nocResult;
        
        if (typeof rawData.noc_code === 'string') {
          // Payload is already flattened NOCResult from frontend autosave
          nocResult = {
            ...rawData,
            stored_file_id: rawData.stored_file_id || ev.stored_file_id,
            is_premium_unlocked: rawData.is_premium_unlocked || ev.is_premium_unlocked
          };
        } else {
          // Payload is raw Gemini NOCFinderResponseSchema from backend direct save
          const ana = rawData.noc_analysis || {};
          const teer = ana.detected_code ? ana.detected_code.charAt(1) : '';
          const cec = ['0', '1', '2', '3'].includes(teer);
          const dutiesStrList = ana.duties_match 
            ? ana.duties_match.map((d: any) => `• ${d.applicant_duty} → NOC: ${d.official_noc_duty} (${d.overlap_description})`)
            : [];
            
          nocResult = {
            document_valid: rawData.document_valid !== false,
            rejection_reason: rawData.rejection_reason || '',
            noc_code: ana.detected_code || '',
            noc_title: ana.detected_title || '',
            teer_category: teer,
            match_score: ana.match_score || 0,
            alternative_nocs: ana.alternative_nocs || [],
            explanation: ana.notes || '',
            matched_duties: dutiesStrList,
            cec_eligible: cec,
            location_of_experience: ana.location_of_experience || 'unknown',
            stored_file_id: rawData.stored_file_id || ev.stored_file_id,
            is_premium_unlocked: rawData.is_premium_unlocked || ev.is_premium_unlocked
          };
        }
        sessionStorage.setItem('nocFinderResult', JSON.stringify(nocResult));
        navigate('/find-my-noc');
        
        // Slight delay to allow navigation to complete before triggering a refresh 
        // to ensure NOCFinderPage mounts with the newly set sessionStorage
        setTimeout(() => window.location.reload(), 50);
      }
    } else {
      let payload = ev.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch(e) {}
      }
      payload = { ...payload, is_premium_unlocked: ev.is_premium_unlocked };
      handleAnalysisResult(payload, false);
    }
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

      {/* Legal Pages */}
      <Route path="/privacy-policy" element={<SharedLayout><PrivacyPolicyPage /></SharedLayout>} />
      <Route path="/terms-of-service" element={<SharedLayout><TermsOfServicePage /></SharedLayout>} />
      <Route path="/refund-policy" element={<SharedLayout><RefundPolicyPage /></SharedLayout>} />

      {/* App Layout Routes (Dashboard/Results) */}
      <Route path="/dashboard" element={<AppLayout><MyEvaluations onSelectEvaluation={handleHistorySelection} /></AppLayout>} />
      <Route path="/results" element={
        <AppLayout>
          {analysisResult ? <Dashboard data={analysisResult} onReset={handleReset} onUpdate={(res) => handleAnalysisResult(res, true)} /> : <div style={{textAlign: 'center', padding: '40px'}}>No result found. <button onClick={() => navigate('/audit-employment-letter')} className="btn btn-primary" style={{marginLeft: '10px'}}>Audit a new letter</button></div>}
        </AppLayout>
      } />
    </Routes>
  );
}

export default App;
