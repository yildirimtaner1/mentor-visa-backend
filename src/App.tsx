import { useState } from 'react';
import type { AnalysisResponse } from './types';
import { LandingPage } from './components/LandingPage';
import { Uploader } from './components/Uploader';
import { Dashboard } from './components/Dashboard';
import './components/LandingPage.css';
import './App.css';

type AppPage = 'landing' | 'audit' | 'results';

function App() {
  const [page, setPage] = useState<AppPage>('landing');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse | null>(null);

  const handleGetStarted = () => {
    setPage('audit');
    window.scrollTo(0, 0);
  };

  const handleAnalysisResult = (result: AnalysisResponse) => {
    setAnalysisResult(result);
    setPage('results');
    window.scrollTo(0, 0);
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setPage('audit');
    window.scrollTo(0, 0);
  };

  const handleBackToHome = () => {
    setAnalysisResult(null);
    setPage('landing');
    window.scrollTo(0, 0);
  };

  if (page === 'landing') {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
          <span 
            className="landing-logo" 
            style={{ cursor: 'pointer', fontSize: '1.6rem' }} 
            onClick={handleBackToHome}
          >
            <span className="landing-logo-icon">🍁</span>
            <span className="landing-logo-text">Mentor Visa</span>
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>CEC Express Entry — AI-Powered Document Auditor</p>
      </header>
      
      <main className="main-content">
        {page === 'audit' ? (
          <Uploader onAnalysisResult={handleAnalysisResult} />
        ) : (
          analysisResult && <Dashboard data={analysisResult} onReset={handleReset} />
        )}
      </main>

      <footer style={{ textAlign: 'center', marginTop: '60px', color: 'var(--text-muted)', fontSize: '13px', paddingBottom: '24px' }}>
        <p>&copy; 2026 Mentor Visa Services. All rights reserved.</p>
        <p style={{ marginTop: '4px', fontSize: '11px' }}>This tool is for informational purposes only and does not constitute legal or immigration advice.</p>
      </footer>
    </div>
  );
}

export default App;
