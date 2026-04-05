import { type FC, useState } from 'react';
import { findNOCCode } from '../services/api';

interface NOCFinderPageProps {
  onNavigate: (page: string) => void;
}

interface NOCResult {
  noc_code: string;
  noc_title: string;
  teer_category: string;
  match_confidence: string;
  explanation: string;
  matched_duties: string[];
  cec_eligible: boolean;
}

export const NOCFinderPage: FC<NOCFinderPageProps> = ({ onNavigate }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [duties, setDuties] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NOCResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!jobTitle.trim() || !duties.trim()) {
      setError('Please fill in both your job title and duties.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const data = await findNOCCode(jobTitle.trim(), duties.trim());
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🎯 AI-Powered NOC Detection</div>
          <h1>Find Your<br /><span className="hero-highlight">NOC Code</span></h1>
          <p>Describe your job and duties — our AI will match you to the best NOC 2021 code from all 516 unit groups in seconds.</p>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="info-card" style={{ padding: '36px 32px' }}>
              <h2 className="page-section-title" style={{ fontSize: '1.4rem', marginBottom: '24px' }}>Tell us about your job</h2>
              
              <div className="form-group">
                <label className="form-label">Job Title</label>
                <input 
                  type="text"
                  className="form-input"
                  placeholder="e.g., Software Developer, Marketing Manager, Electrician"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Main Duties & Responsibilities
                  <span className="form-label-hint"> — describe what you actually do at work</span>
                </label>
                <textarea 
                  className="form-textarea"
                  placeholder={"For example:\n• Design and develop web applications using React and Node.js\n• Write unit tests and perform code reviews\n• Collaborate with product managers to define requirements\n• Deploy applications to cloud infrastructure (AWS)"}
                  value={duties}
                  onChange={e => setDuties(e.target.value)}
                  rows={6}
                />
              </div>

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.9rem', marginBottom: '16px', padding: '10px 16px', background: '#FEF2F2', borderRadius: '8px' }}>
                  ⚠️ {error}
                </div>
              )}

              <button 
                className="btn btn-primary btn-lg" 
                onClick={handleSubmit}
                disabled={loading}
                style={{ width: '100%', marginTop: '8px' }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <span className="spinner" style={{ width: '18px', height: '18px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Analyzing against 516 NOC codes...
                  </span>
                ) : (
                  '🔍 Find My NOC Code'
                )}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div className="result-card">
                <div className="result-card-header">
                  <div className="result-card-icon">🎯</div>
                  <div>
                    <div className="result-card-title">NOC {result.noc_code}</div>
                    <div className="result-card-subtitle">{result.noc_title}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ padding: '14px', background: 'white', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>TEER Category</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{result.teer_category}</div>
                  </div>
                  <div style={{ padding: '14px', background: 'white', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Match Confidence</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: result.match_confidence === 'High' ? '#059669' : result.match_confidence === 'Medium' ? '#D97706' : '#DC2626' }}>
                      {result.match_confidence}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Why this NOC matches:</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{result.explanation}</p>
                </div>

                {result.matched_duties.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Matched Official Duties:</h4>
                    <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                      {result.matched_duties.map((duty, i) => <li key={i}>{duty}</li>)}
                    </ul>
                  </div>
                )}

                <div className={`highlight-box ${result.cec_eligible ? 'highlight-box-blue' : ''}`}>
                  <p>
                    {result.cec_eligible 
                      ? `✅ Great news! NOC ${result.noc_code} (${result.teer_category}) is eligible for the Canadian Experience Class. You can use this code for your Express Entry application.`
                      : `⚠️ NOC ${result.noc_code} (${result.teer_category}) may not be eligible for CEC. CEC requires TEER 0, 1, 2, or 3 occupations. Consider consulting an immigration professional.`
                    }
                  </p>
                </div>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Now that you know your NOC code, make sure your employment letter properly aligns with it:
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={() => onNavigate('audit')}>
                    📄 Audit My Employment Letter
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
