import { type FC, useState, useRef } from 'react';
import { findNOCCode } from '../services/api';
import { SEO } from './common/SEO';
import { DynamicLoader } from './common/DynamicLoader';

interface AlternativeNOC {
  noc_code: string;
  noc_title: string;
  match_score: number;
  explanation: string;
}

interface NOCResult {
  document_valid: boolean;
  rejection_reason: string;
  noc_code: string;
  noc_title: string;
  teer_category: string;
  match_score: number;
  alternative_nocs: AlternativeNOC[];
  explanation: string;
  matched_duties: string[];
  cec_eligible: boolean;
  location_of_experience?: 'canada' | 'outside_canada' | 'unknown';
}

interface NOCFinderPageProps {
  onNavigate: (page: string) => void;
}

const nocSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa NOC Matcher AI",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "CAD"
  },
  "description": "An AI-powered tool to automatically find and match your job duties to official Canadian NOC 2021 codes for Express Entry."
});

export const NOCFinderPage: FC<NOCFinderPageProps> = ({ onNavigate }) => {
  const [jobTitle, setJobTitle] = useState('');
  const [duties, setDuties] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NOCResult | null>(null);
  const [error, setError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processInput = async (inputFile: File | null, inputTitle: string = '', inputDuties: string = '') => {
    if (!inputFile && (!inputTitle.trim() || !inputDuties.trim())) {
      setError('Please either upload a document OR fill in your job title and duties.');
      return;
    }
    
    setError('');
    setLoading(true);
    setResult(null);
    try {
      let rawData;
      if (inputFile) {
        rawData = await findNOCCode(undefined, undefined, inputFile);
      } else {
        rawData = await findNOCCode(inputTitle.trim(), inputDuties.trim());
      }
      
      if (rawData.document_valid && rawData.noc_analysis) {
        const ana = rawData.noc_analysis;
        const firstDigit = ana.detected_code.charAt(0);
        const secondDigit = ana.detected_code.charAt(1);
        let teer = firstDigit;
        if (secondDigit === '0' || secondDigit === '1') teer = '0';
        const cec = ['0', '1', '2', '3'].includes(teer);
        
        const dutiesStrList = ana.duties_match 
          ? ana.duties_match.map((d: any) => `• ${d.applicant_duty} → NOC: ${d.official_noc_duty} (${d.overlap_description})`)
          : [];

        setResult({
          document_valid: true,
          rejection_reason: '',
          noc_code: ana.detected_code,
          noc_title: ana.detected_title,
          teer_category: teer,
          match_score: ana.match_score,
          alternative_nocs: ana.alternative_nocs || [],
          explanation: ana.notes || '',
          matched_duties: dutiesStrList,
          cec_eligible: cec,
          location_of_experience: ana.location_of_experience
        });
      } else {
        setResult({
          document_valid: false,
          rejection_reason: rawData.rejection_reason || 'Could not validate input.',
          noc_code: '',
          noc_title: '',
          teer_category: '',
          match_score: 0,
          alternative_nocs: [],
          explanation: '',
          matched_duties: [],
          cec_eligible: false,
          location_of_experience: 'unknown'
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setJobTitle('');
      setDuties('');
      setError('');
      processInput(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setJobTitle('');
      setDuties('');
      setError('');
      processInput(droppedFile);
    }
  };

  const handleSubmit = () => {
    processInput(file, jobTitle, duties);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#059669'; // Green
    if (score >= 65) return '#D97706'; // Orange
    return '#DC2626'; // Red
  };

  return (
    <div>
      <SEO 
        title="Find My NOC Code 2021 | Free AI Matching Tool for Canada PR" 
        description="Not sure what your Express Entry NOC code is? Paste your job duties and our AI will automatically match them to the correct NOC 2021 TEER category instantly."
        canonical="/find-my-noc"
        schema={nocSchema}
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🎯 AI-Powered NOC Detection</div>
          <h1>Find Your<br /><span className="hero-highlight">NOC Code</span></h1>
          <p>Upload your employment letter or paste your duties. Our AI will analyze the contents to find your precise NOC 2021 code from all 516 unit groups.</p>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            <div className="info-card" style={{ padding: '36px 32px' }}>
              
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Option 1: Upload Document</h3>
                <p style={{ fontSize: '0.95rem', color: '#64748B', marginBottom: '16px' }}>
                  Upload your official employment letter (PDF, Word, or Image). We'll extract the duties automatically.
                </p>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: isDragActive ? '2px dashed var(--primary-color)' : '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragActive ? 'var(--primary-light)' : (file ? '#F8FAFC' : 'white'),
                    transition: 'all 0.2s ease',
                    boxShadow: isDragActive ? '0 0 10px rgba(0,0,0,0.05) inset' : 'none'
                  }}
                >
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
                  {file ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>{file.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                      <button style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--primary-color)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Change File</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px' }}>Click to browse or drag and drop</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>PDF, Word, JPG, PNG</div>
                    </>
                  )}
                </div>
              </div>

              {!file && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', margin: '32px 0' }}>
                    <div style={{ flex: 1, backgroundColor: 'var(--border-color)', height: '1px' }}></div>
                    <div style={{ padding: '0 16px', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '1px' }}>OR</div>
                    <div style={{ flex: 1, backgroundColor: 'var(--border-color)', height: '1px' }}></div>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Option 2: Type Manually</h3>
                    <p style={{ fontSize: '0.95rem', color: '#64748B', marginBottom: '20px' }}>
                      If you don't have a document handy, you can paste the information manually. 
                    </p>
                    <div className="form-group">
                      <label className="form-label">Job Title</label>
                      <input 
                        type="text"
                        className="form-input"
                        placeholder="e.g., Software Developer, Marketing Manager, Electrician"
                        value={jobTitle}
                        onChange={e => { setJobTitle(e.target.value); setFile(null); }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Main Duties & Responsibilities
                        <span className="form-label-hint"> — paste the exact duties written on your letter</span>
                      </label>
                      <textarea 
                        className="form-textarea"
                        placeholder="Paste the duties exactly as they appear on your employment letter here..."
                        value={duties}
                        onChange={e => { setDuties(e.target.value); setFile(null); }}
                        rows={6}
                      />
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.9rem', marginBottom: '16px', padding: '10px 16px', background: '#FEF2F2', borderRadius: '8px' }}>
                  ⚠️ {error}
                </div>
              )}

              {loading ? (
                <div style={{ marginTop: '32px' }}>
                  <DynamicLoader tool="noc" />
                </div>
              ) : !file && (
                <button 
                  className="btn btn-primary btn-lg" 
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  🔍 Find My NOC Code
                </button>
              )}
            </div>

            {/* Rejection Warning */}
            {result && !result.document_valid && (
              <div style={{ 
                marginTop: '32px', 
                padding: '28px', 
                background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', 
                borderRadius: '14px', 
                border: '1px solid #F59E0B',
                boxShadow: '0 4px 16px rgba(245, 158, 11, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#92400E', margin: 0 }}>
                    Document Could Not Be Processed
                  </h3>
                </div>
                <p style={{ fontSize: '0.95rem', color: '#78350F', lineHeight: 1.7, margin: 0 }}>
                  {result.rejection_reason}
                </p>
              </div>
            )}

            {/* Result */}
            {result && result.document_valid && (
              <div className="result-card" style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  Primary match
                </h3>
                  
                <div className="result-card-header" style={{ marginBottom: '20px' }}>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Match Score</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: getScoreColor(result.match_score) }}>
                      {result.match_score}%
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Why this NOC matches:</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{result.explanation}</p>
                </div>

                {result.matched_duties && result.matched_duties.length > 0 && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Matched Official Duties:</h4>
                    <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7 }}>
                      {result.matched_duties.map((duty, i) => <li key={i}>{duty}</li>)}
                    </ul>
                  </div>
                )}
                
                {result.alternative_nocs && result.alternative_nocs.length > 0 && (
                  <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Other Potential Matches:</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {result.alternative_nocs.map((alt, i) => (
                        <div key={i} style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>NOC {alt.noc_code} — {alt.noc_title}</div>
                            <div style={{ fontWeight: 700, color: getScoreColor(alt.match_score), fontSize: '0.9rem' }}>{alt.match_score}% Match</div>
                          </div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{alt.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className={`highlight-box ${result.cec_eligible ? 'highlight-box-blue' : ''}`}>
                  {!result.cec_eligible ? (
                    /* TEER 4 or 5 — not eligible regardless of location */
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ⚠️ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      Occupations in TEER 4 or 5 are generally <strong>NOT</strong> eligible for core Express Entry CRS points or the Canadian Experience Class. You may need to look into targeted Provincial Nominee Programs (PNPs) or specific industry pilots.
                    </p>
                  ) : file && result.location_of_experience === 'canada' ? (
                    /* File uploaded + Canadian experience detected */
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      This occupation is eligible for the <strong>Canadian Experience Class (CEC)</strong> (Provided you have legally accumulated at least 1,560 hours of total qualifying Canadian experience in TEER 0, 1, 2, or 3 occupations).
                    </p>
                  ) : file && result.location_of_experience === 'outside_canada' ? (
                    /* File uploaded + Foreign experience detected */
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      This foreign experience is highly valuable! While it does not count towards the Canadian Experience Class (CEC), having 1 to 3+ years of verifiable foreign work experience in TEER 0, 1, 2, or 3 can <strong>significantly increase your baseline Comprehensive Ranking System (CRS) score.</strong>
                    </p>
                  ) : (
                    /* Manual entry OR location unknown — show both possibilities */
                    <div style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      <p style={{ margin: '0 0 8px 0' }}>
                        ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                        This skilled occupation is highly valuable for Express Entry.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li><strong>If this was inside Canada:</strong> It counts toward your Canadian Experience Class (CEC) eligibility.</li>
                        <li><strong>If this was outside Canada:</strong> It can significantly increase your baseline Comprehensive Ranking System (CRS) score.</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '24px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    Now that you have your NOC code possibilities, make sure your letter complies with all IRCC formatting requirements:
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={() => onNavigate('audit-employment-letter')}>
                    📄 Audit Employment Letter
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
