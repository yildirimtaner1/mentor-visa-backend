import { useState, useRef, useEffect } from 'react';
import type { DragEvent, ChangeEvent, FC } from 'react';
import type { AnalysisResponse } from '../types';
import { uploadDocument, reevaluateDocument, saveEvaluation } from '../services/api';
import { SEO } from './common/SEO';
import { DynamicLoader } from './common/DynamicLoader';
import { Dashboard } from './Dashboard';
import { useAuth } from '@clerk/clerk-react';
import { useLocation } from 'react-router-dom';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff',
  'image/webp',
];

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.doc,.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp';

const uploaderSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa Employment Letter Auditor",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": {
    "@type": "Offer",
    "price": "24.90",
    "priceCurrency": "CAD"
  },
  "description": "Upload your Express Entry employment letter and check for missing IRCC requirements and NOC code alignment mistakes instantly."
});

export const AuditorPage: FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isSignedIn, getToken } = useAuth();
  
  // State for holding the analysis result
  const [result, setResult] = useState<AnalysisResponse | null>(() => {
    try {
      const saved = sessionStorage.getItem('mentorVisaAnalysisResult');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const location = useLocation();

  useEffect(() => {
    // If navigating from NOC Finder with an already stored file
    if (location.state?.fileId) {
      const performAutoAudit = async () => {
        setLoading(true);
        setError(null);
        try {
          const token = await getToken() || '';
          
          // Always use 'auto' for a fresh, unbiased audit
          const res = await reevaluateDocument(
            location.state.fileId, 
            'auto', 
            token
          );
          
          setResult(res);
          sessionStorage.setItem('mentorVisaAnalysisResult', JSON.stringify(res));
          // Backend reevaluate endpoint already saves the record — no need to double-save
        } catch (err) {
          const message = err instanceof Error ? err.message : 'An error occurred during auto-analysis.';
          setError(message);
        } finally {
          setLoading(false);
          // Clear history state to prevent looping on page refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };

      performAutoAudit();
    }
  }, [location.state, getToken, isSignedIn]);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const isValidFile = (file: File): boolean => {
    if (ACCEPTED_TYPES.includes(file.type)) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['pdf', 'docx', 'doc', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp'].includes(ext || '');
  };

  const processFile = async (selectedFile: File) => {
    if (!selectedFile || !isValidFile(selectedFile)) {
      setError('Please upload a valid document (PDF, Word, or Image).');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File is too large. The maximum file size allowed is 5MB.');
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await uploadDocument(selectedFile);
      setResult(res);
      sessionStorage.setItem('mentorVisaAnalysisResult', JSON.stringify(res));

      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token) await saveEvaluation(res, token);
        } catch (e) {
          console.error("Failed to auto-save evaluation:", e);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred during analysis. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      processFile(droppedFile);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const handleReset = () => {
    sessionStorage.removeItem('mentorVisaAnalysisResult');
    setResult(null);
    setFile(null);
  };

  return (
    <div>
      <SEO 
        title="Audit Express Entry Employment Letter | IRCC Checklist Checker" 
        description="Upload your employment reference letter to check for missing IRCC requirements. Identify missing job duties, incorrect formatting, and NOC mismatch risks instantly."
        canonical="/audit-employment-letter"
        schema={uploaderSchema}
      />
      
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📄 AI-Powered Letter Auditor</div>
          <h1>One Missing Sentence =<br /><span className="hero-highlight">PR Refusal.</span></h1>
          
          <div style={{ fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-main)', marginTop: '-8px', marginBottom: '16px', opacity: 0.9 }}>(or an Additional Document Request, if you're lucky)</div>
          <p>IRCC rejects thousands of applications yearly because of a single missing sentence or formatting error on the employment reference letter. Drop your document below to instantly audit it against all 9 mandatory IRCC requirements.</p>
          
          {!result && !loading && (
             <>
                <a href="#audit-input" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>
                  Audit My Letter Now
                </a>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px', marginBottom: 0 }}>Takes less than 60 seconds. No sign-up required.</p>
             </>
          )}
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            
            {/* Input Card */}
            <div id="audit-input" className="info-card" style={{ padding: '36px 32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px' }}>Upload your employment letter</h3>
                <p style={{ fontSize: '0.9rem', color: '#64748B', marginBottom: '16px' }}>
                  Drag and drop your PDF, Word doc, or image to begin the audit.
                </p>
                <div 
                  onClick={() => !loading && fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    border: isDragActive ? '2px dashed var(--primary-color)' : '2px dashed var(--border-color)',
                    borderRadius: '12px',
                    padding: '40px 20px',
                    textAlign: 'center',
                    cursor: loading ? 'default' : 'pointer',
                    background: isDragActive ? 'var(--primary-light)' : (file ? '#F8FAFC' : 'white'),
                    transition: 'all 0.2s ease',
                    boxShadow: isDragActive ? '0 0 10px rgba(0,0,0,0.05) inset' : 'none'
                  }}
                >
                  <input type="file" accept={ACCEPTED_EXTENSIONS} ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} disabled={loading} />
                  <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
                  {file ? (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>{file.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 600, color: 'var(--text-color)', marginBottom: '8px' }}>Click to browse or drag and drop</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>PDF, Word, JPG, PNG</div>
                    </>
                  )}
                </div>
              </div>

              {error && (
                <div style={{ color: '#DC2626', fontSize: '0.9rem', marginBottom: '16px', padding: '10px 16px', background: '#FEF2F2', borderRadius: '8px' }}>
                  ⚠️ {error}
                </div>
              )}

              {loading ? (
                <div style={{ marginTop: '32px' }}>
                  <DynamicLoader tool="audit" />
                </div>
              ) : !file && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '14px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ No sign-up required</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Instant verification of headers, duties, and signatures</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>✅ Highlights NOC code discrepancies</span>
                  </div>
                  
                  <div style={{ marginTop: '24px', padding: '16px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.2rem' }}>🛡️</span>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#065F46', marginBottom: '4px' }}>100% Official IRCC Data. Zero Hallucinations.</div>
                        <div style={{ fontSize: '0.8rem', color: '#047857', lineHeight: 1.5 }}>
                          Our auditor specifically checks your document against the highly rigid Express Entry R10 completeness requirements. We use no generic AI models. If it passes our audit, it meets IRCC's exact legal formatting instructions.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!loading && !result && (
              <div style={{ marginTop: '32px', padding: '28px 24px', background: '#F8FAFC', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>What The AI Checks</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📝</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Formatting Integrity</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Missing letterheads, signatures, and contact info</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>💼</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>Employment Details</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Missing hours, salary, and employment dates</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>NOC Alignment Risk</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Detects conflicts between your duties and claimed NOC</div>
                    </div>
                  </div>
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
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '12px', color: 'white' }}>Don't Risk Your PR Application — Get It Audited</h3>
                <p style={{ fontSize: '0.95rem', opacity: 0.85, marginBottom: '24px', lineHeight: 1.6 }}>
                  A single missing requirement in your employment letter can cost you your filing fee and months of waiting. Ensure your letter is IRCC-compliant now.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button 
                    className="btn btn-lg" 
                    onClick={() => document.getElementById('audit-input')?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ background: 'white', color: '#1E3A8A', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                  >
                    Audit My Letter Now
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '16px', marginBottom: 0 }}>
                  No sign-up required. Initial audit score shown before purchase.
                </p>
              </div>
            )}
          </div>
        </section>

        {result && !loading && (
          <section className="page-section" style={{ paddingTop: '20px' }}>
            <Dashboard 
              data={result} 
              onReset={handleReset} 
              onUpdate={(res) => {
                setResult(res);
                sessionStorage.setItem('mentorVisaAnalysisResult', JSON.stringify(res));
              }} 
            />
          </section>
        )}
      </div>
    </div>
  );
};
