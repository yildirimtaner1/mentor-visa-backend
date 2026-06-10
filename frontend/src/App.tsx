import { useState, useEffect } from 'react';
import type { AnalysisResponse } from './types';
import { GridPattern } from './components/ui/grid-pattern';
import { cn } from './lib/utils';
import { LandingPage } from './components/LandingPage';
import { AuditorPage } from './components/AuditorPage';
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
// import { LetterBuilderPage } from './components/LetterBuilderPage'; // Set aside for redesign
import { GCKeyGuidePage } from './components/GCKeyGuidePage';
import { GlossaryPage } from './components/GlossaryPage';
import { DrawResultsPage } from './components/DrawResultsPage';
import { EligibilityWizardPage } from './components/EligibilityWizardPage';
import { DocumentsPage } from './components/DocumentsPage';
import { PricingPage } from './components/PricingPage';
import { ProfilePage } from './components/ProfilePage';
import ProfileBuilderPage from './components/ProfileBuilderPage';
import { useAuth, UserButton } from '@clerk/clerk-react';
import { saveEvaluation, cancelPaymentEvent } from './services/api';
import { useJourneySync } from './hooks/useJourneySync';
import { usePageTracking } from './hooks/usePageTracking';
import { Navbar } from './components/common/Navbar';
import { Routes, Route, useNavigate } from 'react-router-dom';
import './components/LandingPage.css';
import './components/Pages.css';
import './App.css';

// A wrapper for pages that share the unified navbar and footer (e.g. NOC Finder, CRS Calc)
const SharedLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="landing relative min-h-screen">
      <GridPattern
        width={30}
        height={30}
        x={-1}
        y={-1}
        strokeDasharray="4 2"
        className={cn(
          "[mask-image:radial-gradient(1500px_circle_at_center,white,transparent)]",
          "fixed inset-0 z-0 opacity-40 mix-blend-multiply"
        )}
      />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        <div className="flex-grow" style={{ paddingTop: '72px' }}>
          {children}
        </div>
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
              <a href="/glossary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Immigration Glossary</a>
              <a href="/noc-codes" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>NOC Directory</a>
              <a href="/privacy-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</a>
              <a href="/terms-of-service" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</a>
              <a href="/refund-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

// A wrapper for the dashboard / inner app pages
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-container relative min-h-screen">
      <GridPattern
        width={30}
        height={30}
        x={-1}
        y={-1}
        strokeDasharray={"4 2"}
        className={cn(
          "[mask-image:radial-gradient(1500px_circle_at_center,white,transparent)]",
          "fixed inset-0 z-0 opacity-40 mix-blend-multiply"
        )}
      />
      <div className="relative z-10 flex flex-col min-h-screen">
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
          <a href="/glossary" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Immigration Glossary</a>
          <a href="/noc-codes" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>NOC Directory</a>
          <a href="/draw-results" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Draw Results</a>
          <a href="/privacy-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms-of-service" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Terms of Service</a>
          <a href="/refund-policy" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Refund Policy</a>
        </div>
      </footer>
      </div>
    </div>
  );
};

import ReactGA from 'react-ga4';

function App() {
  const { isSignedIn, getToken } = useAuth();
  const navigate = useNavigate();
  
  // Initialize GA4 page tracking
  usePageTracking();
  
  // Initialize journey sync — fetches from backend on sign-in, debounced sync on changes
  useJourneySync();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Handle payment cancel
    if (params.get('payment_canceled') === 'true') {
      const sessionId = params.get('session_id');
      if (sessionId) {
        cancelPaymentEvent(sessionId);
      }
      // Clean up the URL quietly without reloading
      const url = new URL(window.location.href);
      url.searchParams.delete('payment_canceled');
      url.searchParams.delete('session_id');
      window.history.replaceState({}, '', url);
    }
    
    // Handle payment success globally for GA4 tracking
    if (params.get('payment_success') === 'true') {
      // Fire GA4 purchase event
      ReactGA.event("purchase", {
        currency: "CAD",
        transaction_id: params.get('session_id') || `tx_${Date.now()}`,
        value: 49, // Placeholder, actual value would depend on tier, but 49 is a safe baseline
        items: [{
          item_id: "mentor_visa_purchase",
          item_name: "Mentor Visa Purchase",
        }]
      });
      // We don't remove payment_success from URL here because individual components (like Dashboard) 
      // rely on it to unlock features. They will clean it up.
    }
  }, []);
  
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
    // ── CRS Calculator evaluations ──
    const isCRS = ev.document_type === 'CRS Calculator' || ev.payload?.evaluation_type === 'crs_calculator';
    if (isCRS) {
      let payload = ev.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch(e) { /* ignore */ }
      }
      // Restore the raw inputs to sessionStorage so CRSCalculatorPage picks them up
      if (payload?.raw_inputs) {
        const restored = {
          ...payload.raw_inputs,
          currentPhaseIndex: 4, // Jump straight to the results/summary phase
          _savedAt: new Date().toISOString(),
        };
        sessionStorage.setItem('crsCalculatorData', JSON.stringify(restored));
      }
      navigate('/crs-calculator');
      return;
    }

    if (ev.document_type === "NOC Finder Query") {
      let rawData = ev.payload;
      if (typeof rawData === 'string') {
        try { rawData = JSON.parse(rawData); } catch(e) { /* ignore */ }
      }

      if (rawData) {
        let nocResult;
        
        if (typeof rawData.noc_code === 'string') {
          // Payload is already flattened NOCResult from frontend autosave
          nocResult = {
            ...rawData,
            stored_file_id: rawData.stored_file_id || ev.stored_file_id,
            is_premium_unlocked: rawData.is_premium_unlocked || ev.is_premium_unlocked,
            is_signed_in: true
          };
        } else if (rawData.recommended_noc) {
          // New v2 NOCFinderResponseSchema from backend
          const noc_code = rawData.recommended_noc?.code || '';
          const teer = noc_code.length >= 2 ? noc_code.charAt(1) : '';
          const cec = ['0', '1', '2', '3'].includes(teer);
          nocResult = {
            document_valid: rawData.document_valid !== false,
            rejection_reason: rawData.rejection_reason || '',
            result_type: rawData.result_type || 'NO_MATCH',
            noc_code,
            noc_title: rawData.recommended_noc?.title || '',
            confidence: rawData.recommended_noc?.confidence || 0,
            teer_category: teer,
            cec_eligible: cec,
            confidence_level: rawData.confidence_level || 'low',
            why_this_noc: rawData.why_this_noc || '',
            key_matches: rawData.key_matches || [],
            key_gaps: rawData.key_gaps || [],
            alternatives: (rawData.alternatives || []).map((a: any) => ({
              code: a.code || '',
              title: a.title || '',
              confidence: a.confidence || 0,
            })),
            input_reliability: rawData.input_reliability || 'medium',
            location_of_experience: rawData.location_of_experience || 'unknown',
            important_note: rawData.important_note || '',
            next_step: rawData.next_step || '',
            stored_file_id: rawData.stored_file_id || ev.stored_file_id,
            is_premium_unlocked: rawData.is_premium_unlocked || ev.is_premium_unlocked,
            is_signed_in: true
          };
        } else if (rawData.noc_analysis) {
          // Legacy old schema from backend — convert to v2 format
          const ana = rawData.noc_analysis;
          const noc_code = ana.detected_code || '';
          const teer = noc_code.length >= 2 ? noc_code.charAt(1) : '';
          const cec = ['0', '1', '2', '3'].includes(teer);
          // NOC-match confidence: prefer the backend's noc_match_confidence so the Auditor shows the
          // SAME number as the NOC Finder. Fall back to match_score for pre-existing records.
          const nocConf = (ana.noc_match_confidence ?? ana.match_score) || 0;
          nocResult = {
            document_valid: rawData.document_valid !== false,
            rejection_reason: rawData.rejection_reason || '',
            result_type: nocConf >= 70 ? 'STRONG_MATCH' : nocConf >= 45 ? 'MODERATE_MATCH' : 'NO_MATCH',
            noc_code,
            noc_title: ana.detected_title || '',
            confidence: nocConf,
            teer_category: teer,
            cec_eligible: cec,
            confidence_level: nocConf >= 70 ? 'high' : nocConf >= 45 ? 'medium' : 'low',
            why_this_noc: ana.notes || '',
            key_matches: (ana.duties_match || []).map((d: any) => d.applicant_duty || '').filter(Boolean),
            key_gaps: [],
            alternatives: (ana.alternative_nocs || []).map((a: any) => ({
              code: a.noc_code || a.code || '',
              title: a.noc_title || a.title || '',
              confidence: a.match_score || a.confidence || 0,
            })),
            input_reliability: 'medium' as const,
            location_of_experience: ana.location_of_experience || 'unknown',
            important_note: '',
            next_step: '',
            stored_file_id: rawData.stored_file_id || ev.stored_file_id,
            is_premium_unlocked: rawData.is_premium_unlocked || ev.is_premium_unlocked,
            is_signed_in: true
          };
        }
        sessionStorage.setItem('nocFinderResult', JSON.stringify(nocResult));
        navigate('/find-my-noc', { state: { fromHistory: Date.now() } });
      }
    } else {
      let payload = ev.payload;
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch(e) { /* ignore */ }
      }
      payload = { ...payload, is_premium_unlocked: ev.is_premium_unlocked };
      // Store in sessionStorage so AuditorPage picks it up with full hero/upload context
      sessionStorage.setItem('mentorVisaAnalysisResult', JSON.stringify(payload));
      setAnalysisResult(payload);
      navigate('/audit-employment-letter');
      // Slight delay to allow navigation, then scroll to results
      setTimeout(() => {
        document.getElementById('primary-match-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

  return (
    <Routes>
      {/* Landing Page Route */}
      <Route path="/" element={<LandingPage onGetStarted={() => navigate('/audit-employment-letter')} onNavigate={(page) => navigate(`/${page}`)} />} />

      {/* Shared Nav Routes (Tools) */}
      <Route path="/audit-employment-letter" element={<SharedLayout><AuditorPage /></SharedLayout>} />
      <Route path="/find-my-noc" element={<SharedLayout><NOCFinderPage onNavigate={(p, state) => navigate(`/${p}`, { state })} /></SharedLayout>} />
      <Route path="/express-entry-cec-guide" element={<SharedLayout><CECGuidePage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/crs-calculator" element={<SharedLayout><CRSCalculatorPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/cec-checklist" element={<SharedLayout><CECChecklistPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      {/* Letter Builder route removed — set aside for redesign */}
      <Route path="/gckey-setup-guide" element={<SharedLayout><GCKeyGuidePage /></SharedLayout>} />

      {/* PR Journey Routes */}
      <Route path="/get-started" element={<SharedLayout><EligibilityWizardPage /></SharedLayout>} />
      <Route path="/documents" element={<SharedLayout><DocumentsPage /></SharedLayout>} />
      <Route path="/pricing" element={<SharedLayout><PricingPage /></SharedLayout>} />
      <Route path="/my-profile" element={<SharedLayout><ProfilePage /></SharedLayout>} />
      <Route path="/ai-profile-assistant" element={<SharedLayout><ProfileBuilderPage /></SharedLayout>} />
      
      {/* Content Silos */}
      <Route path="/noc-codes" element={<SharedLayout><NOCDirectoryPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />
      <Route path="/noc-codes/:code" element={<SharedLayout><NOCDetailsPage /></SharedLayout>} />
      <Route path="/glossary" element={<SharedLayout><GlossaryPage /></SharedLayout>} />
      <Route path="/draw-results" element={<SharedLayout><DrawResultsPage onNavigate={(p) => navigate(`/${p}`)} /></SharedLayout>} />

      {/* Legal Pages */}
      <Route path="/privacy-policy" element={<SharedLayout><PrivacyPolicyPage /></SharedLayout>} />
      <Route path="/terms-of-service" element={<SharedLayout><TermsOfServicePage /></SharedLayout>} />
      <Route path="/refund-policy" element={<SharedLayout><RefundPolicyPage /></SharedLayout>} />

      {/* App Layout Routes (Dashboard/Results) */}
      <Route path="/dashboard" element={<AppLayout><MyEvaluations onSelectEvaluation={handleHistorySelection} /></AppLayout>} />
      <Route path="/results" element={
        <AppLayout>
          {analysisResult ? <Dashboard data={analysisResult} onReset={handleReset} onUpdate={(res) => handleAnalysisResult(res, false)} /> : <div style={{textAlign: 'center', padding: '40px'}}>No result found. <button onClick={() => navigate('/audit-employment-letter')} className="btn btn-primary" style={{marginLeft: '10px'}}>Audit a new letter</button></div>}
        </AppLayout>
      } />
    </Routes>
  );
}

export default App;
