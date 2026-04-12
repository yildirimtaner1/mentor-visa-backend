import { type FC, useState, useRef, useEffect } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';
import { findNOCCode, reevaluateDocument } from '../services/api';
import { SEO } from './common/SEO';
import { DynamicLoader } from './common/DynamicLoader';

interface AlternativeNOC {
  code: string;
  title: string;
  confidence: number;
}

interface NOCResult {
  document_valid: boolean;
  rejection_reason: string;
  result_type: 'STRONG_MATCH' | 'MODERATE_MATCH' | 'NO_MATCH';
  noc_code: string;
  noc_title: string;
  confidence: number;
  teer_category: string;
  cec_eligible: boolean;
  confidence_level: 'high' | 'medium' | 'low';
  why_this_noc: string;
  key_matches: string[];
  key_gaps: string[];
  alternatives: AlternativeNOC[];
  input_reliability: 'high' | 'medium' | 'low';
  location_of_experience?: 'canada' | 'outside_canada' | 'unknown';
  important_note: string;
  next_step: string;
  stored_file_id?: string;
  is_signed_in?: boolean;
}

interface NOCFinderPageProps {
  onNavigate: (page: string, state?: any) => void;
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
  "description": "AI-powered tool that matches your job duties to the correct Canadian NOC 2021 code for Express Entry. Analyzes all 516 unit groups in seconds."
});

export const NOCFinderPage: FC<NOCFinderPageProps> = ({ onNavigate }) => {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [jobTitle, setJobTitle] = useState('');
  const [duties, setDuties] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  // Initialize from sessionStorage so result survives a Stripe redirect
  const [result, setResult] = useState<NOCResult | null>(() => {
    const saved = sessionStorage.getItem('nocFinderResult');
    return saved ? JSON.parse(saved) : null;
  });
  const [error, setError] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);
  const [targetNocOverride, setTargetNocOverride] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up any stale payment_success params in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('payment_success');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
  }, []);

  // Auto-unblur, auto-scroll, and auto-save when the user successfully signs in
  const prevSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (!prevSignedIn.current && isSignedIn) {
      // Restore result from sessionStorage if it was lost during sign-in redirect
      let currentResult = result;
      if (!currentResult) {
        const saved = sessionStorage.getItem('nocFinderResult');
        if (saved) {
          currentResult = JSON.parse(saved);
        }
      }
      if (currentResult) {
        // 1. Unblur results immediately
        const unblurred = { ...currentResult, is_signed_in: true };
        setResult(unblurred);
        sessionStorage.setItem('nocFinderResult', JSON.stringify(unblurred));

        // 2. Auto-scroll to the result card
        setTimeout(() => {
          document.getElementById('primary-match-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);

        // 3. Save to their account (UPSERT claims anonymous record)
        getToken().then((token) => {
          if (token) {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            fetch(`${API_BASE_URL}/api/v1/evaluations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ ...unblurred, evaluation_type: 'noc_finder', document_type: 'NOC Finder Query' })
            }).catch(console.error);
          }
        });
      }
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn, result, getToken]);

  /** Map raw backend v2 response to our local NOCResult interface */
  const mapApiResponse = (rawData: any): NOCResult => {
    const noc_code = rawData.recommended_noc?.code || '';
    const teer = noc_code.length >= 2 ? noc_code.charAt(1) : '';
    const cec = ['0', '1', '2', '3'].includes(teer);

    return {
      document_valid: rawData.document_valid,
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
        code: a.code || a.noc_code || '',
        title: a.title || a.noc_title || '',
        confidence: a.confidence || a.match_score || 0,
      })),
      input_reliability: rawData.input_reliability || 'medium',
      location_of_experience: rawData.location_of_experience || 'unknown',
      important_note: rawData.important_note || '',
      next_step: rawData.next_step || '',
      stored_file_id: rawData.stored_file_id,
      is_signed_in: !!rawData.is_signed_in,
    };
  };

  const processInput = async (inputFile: File | null, inputTitle: string = '', inputDuties: string = '', targetNoc: string = '') => {
    // If we have a stored file from a previous analysis and no local file/text, use the reevaluate endpoint
    if (!inputFile && (!inputTitle.trim() || !inputDuties.trim()) && targetNoc && result?.stored_file_id) {
      return reEvaluateWithStoredFile(result.stored_file_id, targetNoc);
    }
    
    if (!inputFile && (!inputTitle.trim() || !inputDuties.trim())) {
      setError('Please either upload a document OR fill in your job title and duties.');
      return;
    }
    
    if (inputFile && inputFile.size > 5 * 1024 * 1024) {
      setError('File is too large. The maximum file size allowed is 5MB.');
      return;
    }

    setError('');
    setLoading(true);
    if (targetNoc) {
      setTargetNocOverride(targetNoc);
      // Scroll to the loading/results area so the user sees progress
      setTimeout(() => {
        document.getElementById('noc-results-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      setTargetNocOverride(null);
      setResult(null);
    }

    try {
      const token = isSignedIn ? (await getToken() || '') : '';
      let rawData;
      if (inputFile) {
        rawData = await findNOCCode(undefined, undefined, inputFile, targetNoc, token);
      } else {
        rawData = await findNOCCode(inputTitle.trim(), inputDuties.trim(), undefined, targetNoc, token);
      }
      
      if (rawData.document_valid && rawData.recommended_noc) {
        const mapped = mapApiResponse(rawData);
        setResult(mapped);
        sessionStorage.setItem('nocFinderResult', JSON.stringify(mapped));
        // Save to user's account if signed in
        if (isSignedIn) {
          getToken().then((token) => {
            if (token) {
              const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
              fetch(`${API_BASE_URL}/api/v1/evaluations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ ...mapped, evaluation_type: 'noc_finder', document_type: 'NOC Finder Query' })
              }).catch(console.error);
            }
          });
        }
      } else {
        setResult({
          document_valid: false,
          rejection_reason: rawData.rejection_reason || 'Could not validate input.',
          result_type: 'NO_MATCH',
          noc_code: '',
          noc_title: '',
          confidence: 0,
          teer_category: '',
          cec_eligible: false,
          confidence_level: 'low',
          why_this_noc: '',
          key_matches: [],
          key_gaps: [],
          alternatives: [],
          input_reliability: 'low',
          location_of_experience: 'unknown',
          important_note: '',
          next_step: '',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const reEvaluateWithStoredFile = async (fileId: string, targetNoc: string) => {
    setError('');
    setLoading(true);
    setTargetNocOverride(targetNoc);
    // Scroll to the loading/results area so the user sees progress
    setTimeout(() => {
      document.getElementById('noc-results-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    try {
      const token = await getToken() || '';
      const rawData = await reevaluateDocument(fileId, targetNoc, token, 'noc_finder');
      
      if (rawData.recommended_noc || rawData.noc_analysis) {
        const mapped = mapApiResponse(rawData);
        mapped.stored_file_id = rawData.stored_file_id || fileId;
        mapped.is_signed_in = !!rawData.is_signed_in || !!result?.is_signed_in;
        setResult(mapped);
        // Re-evaluations are already saved by backend, no need to double-save
      } else {
        setError('Re-evaluation returned no NOC analysis. Please try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-evaluation failed. Please try again.');
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

  // Helpers for match styling
  const getMatchBadge = (type: string) => {
    switch (type) {
      case 'STRONG_MATCH': return { label: 'Strong Match', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', icon: '✅' };
      case 'MODERATE_MATCH': return { label: 'Moderate Match', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: '⚠️' };
      default: return { label: 'Weak Match', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: '❌' };
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return '#059669';
      case 'medium': return '#D97706';
      default: return '#DC2626';
    }
  };

  return (
    <div>
      <SEO 
        title="Find My NOC Code 2021 | AI NOC Matching Tool for Canada PR" 
        description="Don't guess your NOC code. Paste your job duties and our AI matches them to the correct NOC 2021 code for Express Entry. Results in under 60 seconds."
        canonical="/find-my-noc"
        schema={nocSchema}
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🎯 Trusted by Express Entry applicants</div>
          <h1>Wrong NOC Code =<br /><span className="hero-highlight">PR Refusal.</span></h1>
          <p>IRCC doesn't match your NOC by job title — they match it by your actual duties. If the duties on your letter don't align with the code you claim, your application gets refused. Paste your duties below and find the right code in under 60 seconds.</p>
          <a href="#noc-input" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>
            Find My NOC Now
          </a>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>Takes less than 60 seconds. No sign-up required.</p>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>

            {/* Input Card */}
            <div id="noc-input" className="info-card" style={{ padding: '36px 32px' }}>
              
              <div style={{ marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Upload your employment letter <span style={{ fontWeight: 400, color: '#64748B', fontSize: '0.9rem' }}>(fastest & most accurate)</span></h3>
                <p style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '16px' }}>
                  We'll automatically extract your job title and duties for the most accurate NOC match.
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
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Or paste your job duties</h3>
                    <p style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '20px' }}>
                      Don't have your letter handy? Just type your title and paste your duties. 
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
                        <span className="form-label-hint"> — paste the exact duties from your letter</span>
                      </label>
                      <textarea 
                        className="form-textarea"
                        placeholder="Paste your job duties here (from your employment letter if available)..."
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
                <div id="noc-results-area" style={{ marginTop: '32px' }}>
                  <DynamicLoader tool={targetNocOverride ? 'noc_retarget' : 'noc'} targetNoc={targetNocOverride || undefined} />
                </div>
              ) : !file && (
                <div>
                  <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: '8px', marginTop: '16px' }}>
                    Get your NOC code + match score instantly
                  </p>
                  <button 
                    className="btn btn-primary btn-lg" 
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{ width: '100%', padding: '16px', fontSize: '1.05rem' }}
                  >
                    🔍 Find My NOC Now
                  </button>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ No sign-up required</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Results in under 60 seconds</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Built for Express Entry applications</span>
                  </div>
                  <div style={{ marginTop: '24px', padding: '16px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065F46', marginBottom: '4px' }}>100% Official IRCC Data. Zero Hallucinations.</div>
                        <div style={{ fontSize: '0.8rem', color: '#047857', lineHeight: 1.5 }}>
                          Our model strictly cross-references your duties against the official NOC 2021 Version 1.0 Matrix.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* What You'll Get — shown only before a result */}
            {!result && !loading && (
              <div style={{ marginTop: '32px', padding: '28px 24px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>What You'll Get</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🎯</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Your Correct NOC Code</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>The single most accurate code for your duties</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📊</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Match Strength + Confidence</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>See how closely your duties align with the NOC</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Key Matches & Gaps</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Know exactly what aligns and what's weak</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔄</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Alternative NOC Options</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backup codes you can re-evaluate against</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* === RESULT CARD === */}
            {result && result.document_valid && (() => {
              const badge = getMatchBadge(result.result_type);
              return (
              <div id="primary-match-section" className="result-card" style={{ marginTop: '32px' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-color)' }}>
                      NOC Match Result
                    </h3>
                    {result.input_reliability !== 'high' && (
                      <span style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '4px', display: 'block' }}>
                        ⚠️ Input reliability: {result.input_reliability} — results based on a resume/manual input may be less precise
                      </span>
                    )}
                  </div>
                  <span style={{ 
                    padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700,
                    background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                    whiteSpace: 'nowrap'
                  }}>
                    {badge.icon} {badge.label}
                  </span>
                </div>

                {/* NOC Code + Title */}
                <div className="result-card-header" style={{ marginBottom: '20px' }}>
                  <div className="result-card-icon">🎯</div>
                  <div>
                    <div className="result-card-title">NOC {result.noc_code}</div>
                    <div className="result-card-subtitle">{result.noc_title}</div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ padding: '14px', background: 'white', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>TEER Category</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{result.teer_category}</div>
                  </div>
                  <div style={{ padding: '14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>NOC Confidence</div>
                      <span style={{ position: 'relative', display: 'inline-flex' }}>
                        <span 
                          className="noc-confidence-bulb"
                          style={{ fontSize: '0.85rem', cursor: 'help', lineHeight: 1 }}
                          tabIndex={0}
                        >💡</span>
                        <span className="noc-confidence-tooltip">
                          How closely your duties match this NOC's official IRCC requirements.
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: getConfidenceColor(result.confidence_level) }}>
                      {result.confidence}%
                    </div>
                  </div>
                </div>

                {/* Why This NOC */}
                {result.why_this_noc && (
                  <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>Why This NOC</div>
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-color)' }}>{result.why_this_noc}</p>
                  </div>
                )}

                {/* Key Matches */}
                {result.key_matches && result.key_matches.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#059669' }}>✅</span> Aligned Responsibilities
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {result.key_matches.map((match, i) => (
                        <div key={i} style={{ padding: '10px 14px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0', fontSize: '0.88rem', lineHeight: 1.5 }}>
                          {match}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Gaps — behind paywall */}
                <div style={{ position: 'relative' }}>
                  <div style={!(result.is_signed_in) ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 } : {}}>
                    {result.key_gaps && result.key_gaps.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#DC2626' }}>⚠️</span> Gaps / Missing Areas
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {result.key_gaps.map((gap, i) => (
                            <div key={i} style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '0.88rem', lineHeight: 1.5 }}>
                              {gap}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Alternatives */}
                    {result.alternatives && result.alternatives.length > 0 && (
                      <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Other Potential Matches:</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Not sure about the primary match? Click any code below to re-evaluate against that NOC.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {result.alternatives.map((alt, i) => {
                            const altBadge = getMatchBadge(
                              alt.confidence >= 75 ? 'STRONG_MATCH' : alt.confidence >= 60 ? 'MODERATE_MATCH' : 'NO_MATCH'
                            );
                            return (
                            <div 
                              key={i} 
                              onClick={() => processInput(file, jobTitle, duties, alt.code)}
                              className="alternative-noc-card"
                              style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>NOC {alt.code} — {alt.title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <span style={{ fontWeight: 600, color: altBadge.color, fontSize: '0.8rem', background: altBadge.bg, padding: '4px 10px', borderRadius: '6px' }}>{altBadge.label}</span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }} className="target-btn">Re-evaluate →</span>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sign-in Gate — NOC Finder is free for signed-in users */}
                  {!(result.is_signed_in) && !isSignedIn && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none' }}>
                      <div style={{ position: 'sticky', top: '25vh', display: 'flex', justifyContent: 'center', pointerEvents: 'auto', padding: '0 20px' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', background: 'white', border: '2px solid var(--primary-color)', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔓</div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>Sign In to See Your Full Results</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5, fontSize: '0.93rem' }}>
                          The NOC Finder is <strong>100% free</strong> for signed-in users. Create an account in seconds to:
                        </p>
                        <ul style={{ textAlign: 'left', listStyleType: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '0.9rem', display: 'grid', gap: '8px' }}>
                          <li>✅ See the {result.key_gaps?.length || 0} gap(s) IRCC may flag in your application</li>
                          <li>✅ Confirm this NOC is safe for your PR submission</li>
                          <li>✅ Discover backup NOC options (if applicable)</li>
                          <li>✅ Re-evaluate against any alternative NOC</li>
                        </ul>
                        
                        <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                          <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
                            Sign In — It's Free
                          </button>
                        </SignInButton>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>Free forever. No credit card required.</p>
                      </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* CEC Eligibility Info */}
                <div className={`highlight-box ${result.cec_eligible ? 'highlight-box-blue' : ''}`}>
                  {!result.cec_eligible ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ⚠️ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      Occupations in TEER 4 or 5 are generally <strong>NOT</strong> eligible for core Express Entry CRS points or the Canadian Experience Class.
                    </p>
                  ) : file && result.location_of_experience === 'canada' ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      This occupation is eligible for the <strong>Canadian Experience Class (CEC)</strong> (Provided you have at least 1,560 hours of qualifying Canadian experience).
                    </p>
                  ) : file && result.location_of_experience === 'outside_canada' ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                      This foreign experience doesn't count for CEC, but 1-3+ years of verifiable foreign work in TEER 0-3 can <strong>significantly increase your CRS score.</strong>
                    </p>
                  ) : (
                    <div style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                      <p style={{ margin: '0 0 8px 0' }}>
                        ✅ <strong>NOC {result.noc_code} falls under TEER {result.teer_category}.</strong><br />
                        This skilled occupation is highly valuable for Express Entry.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li><strong>If inside Canada:</strong> Counts toward CEC eligibility.</li>
                        <li><strong>If outside Canada:</strong> Can significantly increase your CRS score.</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Important Note */}
                {result.important_note && (
                  <div style={{ padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', marginTop: '16px', fontSize: '0.85rem', color: '#92400E', lineHeight: 1.6 }}>
                    ⚠️ {result.important_note}
                  </div>
                )}

                {/* Cross-sell CTA to Auditor */}
                <div style={{ 
                  marginTop: '24px', 
                  padding: '28px', 
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                  borderRadius: '14px',
                  border: '1px solid #F59E0B'
                }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', color: '#92400E' }}>
                    Your NOC is {result.noc_code}. But does your employment letter actually prove it?
                  </h4>
                  <p style={{ fontSize: '0.9rem', color: '#78350F', marginBottom: '16px', lineHeight: 1.5 }}>
                    {result.next_step || 'Run a full Employment Letter Audit to confirm eligibility and reduce refusal risk.'}
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={() => onNavigate('audit-employment-letter', { fileId: result.stored_file_id, targetNoc: 'auto' })} style={{ background: '#D97706', borderColor: '#D97706' }}>
                    📄 Audit My Letter — $24.90 CAD
                  </button>
                  <p style={{ fontSize: '0.75rem', color: '#92400E', marginTop: '10px', marginBottom: 0 }}>One-time purchase. Instant results.</p>
                </div>
              </div>
              );
            })()}

            {/* Bottom CTA — only shown when no result yet */}
            {!result && !loading && (
              <div style={{ 
                marginTop: '48px', 
                padding: '36px 28px', 
                textAlign: 'center',
                background: 'linear-gradient(135deg, #0F172A, #1E3A8A)',
                borderRadius: '16px',
                color: 'white'
              }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px', color: 'white' }}>Don't Risk Your PR Application — Get Your NOC Right</h3>
                <p style={{ fontSize: '0.95rem', opacity: 0.85, marginBottom: '24px', lineHeight: 1.6 }}>
                  A wrong NOC code can cost you your filing fee and months of waiting. Your duties determine your NOC — not your job title. Find the right one now.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-lg" 
                    onClick={() => document.getElementById('noc-input')?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ background: 'white', color: '#1E3A8A', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Find My NOC Now
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '16px', marginBottom: 0 }}>
                  100% free for signed-in users. No credit card required.
                </p>
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
