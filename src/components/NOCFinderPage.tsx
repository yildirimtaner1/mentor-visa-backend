import { type FC, useState, useRef, useEffect } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';
import { findNOCCode, fetchUserCredits, createCheckoutSession, consumeCreditToUnlock } from '../services/api';
import { SEO } from './common/SEO';
import { DynamicLoader } from './common/DynamicLoader';

interface AlternativeNOC {
  noc_code: string;
  noc_title: string;
  match_score: number;
  explanation: string;
}

interface DutyMatch {
  applicant_duty: string;
  official_noc_duty: string;
  overlap_description: string;
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
  matched_duties: DutyMatch[];
  cec_eligible: boolean;
  location_of_experience?: 'canada' | 'outside_canada' | 'unknown';
  stored_file_id?: string;
  is_premium_unlocked?: boolean;
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
    "price": "9.90",
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

  // Monetization State
  const [credits, setCredits] = useState<number>(0);
  const [isBuying, setIsBuying] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    const loadCredits = async () => {
       if (isSignedIn) {
           const tk = await getToken();
           if (tk) {
               const c = await fetchUserCredits(tk);
               setCredits(c.find_noc_credits || 0);
           }
       }
    };
    loadCredits();
  }, [isSignedIn, getToken]);

  // Persist result to sessionStorage whenever it changes
  useEffect(() => {
    if (result) {
      sessionStorage.setItem('nocFinderResult', JSON.stringify(result));
    }
  }, [result]);

  // Auto-unlock when returning from Stripe with ?payment_success=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
      // Clean URL immediately
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('payment_success');
      window.history.replaceState({}, '', cleanUrl.toString());

      const pollAndUnlock = async () => {
        const savedRaw = sessionStorage.getItem('nocFinderResult');
        if (!savedRaw) return;
        const saved: NOCResult = JSON.parse(savedRaw);
        if (saved.is_premium_unlocked || !saved.stored_file_id) return;

        const tk = await getToken();
        if (!tk) return;

        for (let i = 0; i < 10; i++) {
          await new Promise(res => setTimeout(res, 1500));
          try {
            const creditData = await fetchUserCredits(tk);
            const hasCredits = (creditData.find_noc_credits || 0) > 0;
            if (hasCredits) {
              const res = await consumeCreditToUnlock(saved.stored_file_id, 'finder', tk);
              setCredits(res.remaining_finder);
              const unlocked = { ...saved, is_premium_unlocked: true };
              setResult(unlocked);
              sessionStorage.setItem('nocFinderResult', JSON.stringify(unlocked));
              return;
            }
          } catch (e: any) {
            console.warn('Poll attempt failed:', e.message);
          }
        }
        console.error('Payment processed but credits never appeared. Check Stripe webhook.');
      };

      pollAndUnlock();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll and auto-save when the user successfully signs in
  const prevSignedIn = useRef(isSignedIn);
  useEffect(() => {
    if (!prevSignedIn.current && isSignedIn && result) {
      setTimeout(() => {
        document.getElementById('primary-match-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

      // Silently save to their account
      getToken().then((token) => {
        if (token) {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
          fetch(`${API_BASE_URL}/api/v1/evaluations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ...result, evaluation_type: 'noc_finder' })
          }).catch(console.error);
        }
      });
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn, result, getToken]);

  const handleCheckout = async () => {
    setIsBuying(true);
    try {
        const tk = await getToken();
        if (!tk) return;
        if (result) {
          sessionStorage.setItem('nocFinderResult', JSON.stringify(result));
        }
        const url = await createCheckoutSession('finder', tk, '/find-my-noc');
        window.location.href = url;
    } catch (e: any) {
        alert("Failed to initiate checkout: " + (e.message || "Unknown error"));
        setIsBuying(false);
    }
  };

  const handleUnlock = async () => {
    if (!result?.stored_file_id) return;
    setIsUnlocking(true);
    try {
        const tk = await getToken();
        if (!tk) return;
        const res = await consumeCreditToUnlock(result.stored_file_id, 'finder', tk);
        setCredits(res.remaining_finder);
        const unlocked = {...result, is_premium_unlocked: true};
        setResult(unlocked);
        sessionStorage.setItem('nocFinderResult', JSON.stringify(unlocked));
        const url = new URL(window.location.href);
        url.searchParams.delete('payment_success');
        window.history.replaceState({}, '', url.toString());
    } catch (e: any) {
        alert(e.message || "Failed to unlock insights.");
    } finally {
        setIsUnlocking(false);
    }
  };


  const processInput = async (inputFile: File | null, inputTitle: string = '', inputDuties: string = '', targetNoc: string = '') => {
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
    } else {
      setTargetNocOverride(null);
      setResult(null);
      sessionStorage.removeItem('nocFinderResult'); // clear stale cache on new search
    }

    try {
      let rawData;
      if (inputFile) {
        rawData = await findNOCCode(undefined, undefined, inputFile, targetNoc);
      } else {
        rawData = await findNOCCode(inputTitle.trim(), inputDuties.trim(), undefined, targetNoc);
      }
      
      if (rawData.document_valid && rawData.noc_analysis) {
        const ana = rawData.noc_analysis;
        // TEER = second digit of the 5-digit NOC code (e.g. NOC 42101 → TEER 2)
        const teer = ana.detected_code.charAt(1);
        const cec = ['0', '1', '2', '3'].includes(teer);
        
        const dutiesList: DutyMatch[] = ana.duties_match 
          ? ana.duties_match.map((d: any) => ({
              applicant_duty: d.applicant_duty || '',
              official_noc_duty: d.official_noc_duty || '',
              overlap_description: d.overlap_description || ''
            }))
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
          matched_duties: dutiesList,
          cec_eligible: cec,
          location_of_experience: ana.location_of_experience,
          stored_file_id: rawData.stored_file_id,
          is_premium_unlocked: !!rawData.is_premium_unlocked
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
                <div style={{ marginTop: '32px' }}>
                  {targetNocOverride ? (
                    <div style={{ padding: '40px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Re-evaluating against NOC {targetNocOverride}...</h3>
                      <p style={{ color: 'var(--text-muted)' }}>Mapping your duties strictly against this target code.</p>
                    </div>
                  ) : (
                    <DynamicLoader tool="noc" />
                  )}
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
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Match Score (How Strong Your Case Is)</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>See how closely your duties align with the NOC</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💡</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Why This NOC Fits Your Duties</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clear explanation of why this NOC was chosen</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔄</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Backup NOC Options (If Needed)</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Other NOC codes that could also apply</div>
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

            {/* Result */}
            {result && result.document_valid && (
              <div id="primary-match-section" className="result-card" style={{ marginTop: '32px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--text-color)', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  Top NOC Match Identified
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

                {/* Strategic uncertainty + move explanation behind paywall */}
                <div style={{ 
                  padding: '14px 16px', 
                  background: '#FFFBEB', 
                  border: '1px solid #FDE68A', 
                  borderRadius: '10px', 
                  marginBottom: '20px',
                  fontSize: '0.88rem',
                  color: '#92400E',
                  lineHeight: 1.6
                }}>
                  ⚠️ This is your strongest match based on your duties — but IRCC approval depends on detailed duty-to-NOC alignment. Unlock the full analysis below to confirm this is the right code for your application.
                </div>

                {/* --- PREMIUM LOCKED SECTION --- */}
                <div style={{ position: 'relative', marginTop: '20px' }}>
                  <div style={!(result.is_premium_unlocked) ? { filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 } : {}}>
                    {/* Explanation — now premium */}
                    {result.explanation && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '8px' }}>Why This NOC Fits Your Duties:</h4>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{result.explanation}</p>
                      </div>
                    )}
                    {result.matched_duties && result.matched_duties.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Duty-by-Duty Alignment</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {result.matched_duties.map((duty, i) => (
                            <div key={i} style={{
                              background: '#F8FAFC',
                              border: '1px solid var(--border-color)',
                              borderRadius: '12px',
                              padding: '16px 18px',
                              fontSize: '0.88rem',
                              lineHeight: 1.6
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ 
                                  background: 'var(--primary-color)', color: 'white', 
                                  borderRadius: '50%', width: '22px', height: '22px', minWidth: '22px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.7rem', fontWeight: 700, marginTop: '1px'
                                }}>{i + 1}</span>
                                <div>
                                  <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '3px' }}>Your Duty</div>
                                  <div style={{ color: 'var(--text-color)', fontWeight: 500 }}>{duty.applicant_duty}</div>
                                </div>
                              </div>
                              <div style={{ borderLeft: '2px solid #C7D2FE', paddingLeft: '14px', marginLeft: '10px' }}>
                                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4338CA', fontWeight: 600, marginBottom: '3px' }}>Matching Official NOC Duty</div>
                                <div style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>{duty.official_noc_duty}</div>
                                <div style={{ 
                                  fontSize: '0.82rem', color: '#059669', fontStyle: 'italic',
                                  background: '#F0FDF4', padding: '8px 12px', borderRadius: '8px',
                                  border: '1px solid #BBF7D0'
                                }}>
                                  💡 {duty.overlap_description}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {result.alternative_nocs && result.alternative_nocs.length > 0 && (
                      <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>Other Potential Matches:</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Not sure about the primary match? Click any code below to re-evaluate your duties strictly against that target NOC.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {result.alternative_nocs.map((alt, i) => (
                            <div 
                              key={i} 
                              onClick={() => processInput(file, jobTitle, duties, alt.noc_code)}
                              className="alternative-noc-card"
                              style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>NOC {alt.noc_code} — {alt.noc_title}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ fontWeight: 700, color: getScoreColor(alt.match_score), fontSize: '0.9rem' }}>{alt.match_score}% Match</div>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }} className="target-btn">Re-evaluate →</span>
                                </div>
                              </div>
                              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{alt.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div> {/* End Blurred Area */}
                  
                  {/* Paywall Overlay */}
                  {!(result.is_premium_unlocked) && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none' }}>
                      <div style={{ position: 'sticky', top: '25vh', display: 'flex', justifyContent: 'center', pointerEvents: 'auto', padding: '0 20px' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '500px', background: 'white', border: '2px solid var(--primary-color)', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🛡️</div>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>Don't Submit Until You're Sure</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5, fontSize: '0.93rem' }}>
                          A wrong NOC code can get your application refused. Unlock the full analysis to:
                        </p>
                        <ul style={{ textAlign: 'left', listStyleType: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '0.9rem', display: 'grid', gap: '8px' }}>
                          <li>✅ Confirm this NOC is safe for your PR application</li>
                          <li>✅ See exactly why it matches your duties</li>
                          <li>✅ Identify risks or weak alignment before submission</li>
                          <li>✅ Discover backup NOC options (if applicable)</li>
                        </ul>
                        
                        {!isSignedIn ? (
                          <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                            <button className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
                              Get Confidence Before Submitting
                            </button>
                          </SignInButton>
                        ) : credits > 0 ? (
                          <button className="btn btn-primary" onClick={handleUnlock} disabled={isUnlocking} style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}>
                            {isUnlocking ? 'Unlocking...' : `Unlock Full Analysis (1 Credit — ${credits} left)`}
                          </button>
                        ) : (
                          <button className="btn btn-primary" onClick={handleCheckout} disabled={isBuying} style={{ width: '100%', padding: '14px', fontSize: '1.05rem', background: '#10b981', borderColor: '#10b981' }}>
                            {isBuying ? 'Redirecting to Stripe...' : 'Avoid Costly Mistakes — $9.90 CAD'}
                          </button>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>One-time purchase. 2 full analyses included. No subscription.</p>
                      </div>
                      </div>
                    </div>
                  )}
                </div>

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

                {/* Cross-sell CTA */}
                <div style={{ 
                  marginTop: '24px', 
                  padding: '28px', 
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)',
                  borderRadius: '14px',
                  border: '1px solid #C7D2FE'
                }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', color: '#312E81' }}>Next Step: Audit Your Employment Letter</h4>
                  <p style={{ fontSize: '0.9rem', color: '#4338CA', marginBottom: '16px', lineHeight: 1.5 }}>
                    Now that you know your NOC code, make sure your letter has all 9 IRCC mandatory requirements. Missing even one can delay your application.
                  </p>
                  <button className="btn btn-primary btn-lg" onClick={() => onNavigate('audit-employment-letter')}>
                    📄 Audit My Employment Letter
                  </button>
                </div>
              </div>
            )}

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
                  No sign-up required. Initial NOC match + score shown before purchase.
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
