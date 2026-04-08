import { type FC, useEffect, useState, useRef } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';
import { usePDF } from 'react-to-pdf';
import type { AnalysisResponse, Risk } from '../types';
import { reevaluateDocument } from '../services/api';

interface DashboardProps {
  data: AnalysisResponse;
  onReset: () => void;
  onUpdate?: (newResult: AnalysisResponse) => void;
}

export const Dashboard: FC<DashboardProps> = ({ data, onReset, onUpdate }) => {
  const { isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { toPDF: toFullPDF, targetRef: fullTargetRef } = usePDF({filename: 'MentorVisa-AuditReport.pdf', page: { margin: 15 }});
  const { toPDF: toNocPDF, targetRef: nocTargetRef } = usePDF({filename: 'MentorVisa-NOC-Alignment-Sheet.pdf', page: { margin: 15 }});
  const [showToast, setShowToast] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [isReevaluating, setIsReevaluating] = useState<string | null>(null);
  
  const isPremiumUnlocked = !!isSignedIn;
  const breakSpacerRef = useRef<HTMLDivElement>(null);
  



  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  const handleDownloadOriginal = async () => {
    if (!data.stored_file_id) return;
    try {
      const token = await getToken();
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/api/v1/documents/${data.stored_file_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.original_filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download original document:', err);
    }
  };

  const handleReevaluate = async (targetNoc: string) => {
    if (!data.stored_file_id || !onUpdate) {
        alert("Cannot re-evaluate right now. Please re-upload your document.");
        return;
    }
    const tk = await getToken();
    try {
        setIsReevaluating(targetNoc);
        const newResult = await reevaluateDocument(data.stored_file_id, targetNoc, tk || '');
        onUpdate(newResult);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
        alert(e.message || "Failed to re-evaluate document.");
    } finally {
        setIsReevaluating(null);
    }
  };

  // Auto-scroll when the user successfully signs in
  const prevSignedIn = useRef(isSignedIn);
  useEffect(() => {
    // If user just transitioned from signed out to signed in, and we have data
    if (!prevSignedIn.current && isSignedIn && data) {
      setTimeout(() => {
        document.getElementById('primary-match-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);

      // Auto-save the evaluation to their profile silently
      getToken().then((token) => {
         if (token) {
            import('../services/api').then(({ saveEvaluation }) => {
               saveEvaluation(data, token).catch(console.error);
            });
         }
      });
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn, data, getToken]);

  const handleDownloadFull = async () => {
    const originalWidth = fullTargetRef.current?.style.width || '';
    const originalMaxWidth = fullTargetRef.current?.style.maxWidth || '';

    if (fullTargetRef.current) {
       fullTargetRef.current.style.width = '1024px';
       fullTargetRef.current.style.maxWidth = '1024px';
    }

    // Force layout recalculation before measurement
    await new Promise(resolve => setTimeout(resolve, 50));

    if (fullTargetRef.current && breakSpacerRef.current) {
      const fullBounds = fullTargetRef.current.getBoundingClientRect();
      const spacerBounds = breakSpacerRef.current.getBoundingClientRect();
      const offset = spacerBounds.top - fullBounds.top;
      
      const width = fullTargetRef.current.clientWidth;
      // react-to-pdf uses A4 (210x297mm). With 15mm margin, printable is 180x267mm.
      const pageHeight = width * (267 / 180); 
      
      const remainder = offset % pageHeight;
      // Add a small 2px overflow to guarantee it breaks exactly onto the next page
      const paddingNeeded = pageHeight - remainder + 2; 
      
      breakSpacerRef.current.style.height = `${paddingNeeded}px`;
    }
    
    // Yield to browser to paint new layout
    await new Promise(resolve => setTimeout(resolve, 100));
    toFullPDF();
    
    // Clean up
    setTimeout(() => {
      if (breakSpacerRef.current) breakSpacerRef.current.style.height = '0px';
      if (fullTargetRef.current) {
        fullTargetRef.current.style.width = originalWidth;
        fullTargetRef.current.style.maxWidth = originalMaxWidth;
      }
    }, 500);
  };

  const handleDownloadNoc = async () => {
    if (!nocTargetRef.current) return;
    const originalWidth = nocTargetRef.current.style.width;
    const originalMaxWidth = nocTargetRef.current.style.maxWidth;
    
    nocTargetRef.current.style.width = '1024px';
    nocTargetRef.current.style.maxWidth = '1024px';
    
    await new Promise(resolve => setTimeout(resolve, 100));
    toNocPDF();
    
    setTimeout(() => {
      if (nocTargetRef.current) {
        nocTargetRef.current.style.width = originalWidth;
        nocTargetRef.current.style.maxWidth = originalMaxWidth;
      }
    }, 500);
  };

  useEffect(() => {
    if (isSignedIn) {
      const pending = sessionStorage.getItem('pendingPdfDownload');
      if (pending) {
        sessionStorage.removeItem('pendingPdfDownload');
        
        // The main auth hook already handled saving the evaluation.

        if (pending === 'noc') {
          setTimeout(() => handleDownloadNoc(), 1000);
        } else {
          setTimeout(() => handleDownloadFull(), 1000);
        }
      }
    }
  }, [isSignedIn, toFullPDF, toNocPDF, getToken, data]);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && scrolled / total > 0.25 && !toastDismissed) {
        setShowToast(true);
      } else {
        setShowToast(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [toastDismissed]);

  const renderBadge = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'ready':
        return <span className="badge badge-success">Compliant</span>;
      case 'risk':
      case 'revise_minor':
        return <span className="badge badge-warning">Risk / Minor Revision</span>;
      case 'non_compliant':
      case 'revise_major':
        return <span className="badge badge-danger">Non-Compliant / Major Revision</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  if (isReevaluating) {
    return (
      <div style={{ maxWidth: '900px', margin: '40px auto', padding: '40px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)', textAlign: 'center' }}>
         <div style={{ display: 'inline-block', width: '50px', height: '50px', border: '3px solid var(--primary-light)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
         <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
           Re-evaluating explicitly against NOC {isReevaluating}...
         </h2>
         <p style={{ color: 'var(--text-muted)' }}>We are securely re-analyzing your original file against the {isReevaluating} structural guidelines.</p>
      </div>
    );
  }

  if (!data || !data.noc_analysis?.applicable) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', background: '#FEF2F2', borderRadius: '12px', textAlign: 'center', border: '1px solid #FCA5A5' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#991b1b', marginBottom: '12px' }}>Document Validation Failed</h2>
        <p style={{ color: '#7f1d1d' }}>{data?.summary || 'We could not process this document.'}</p>
        <button className="btn" style={{ marginTop: '20px', background: '#dc2626', borderColor: '#dc2626' }} onClick={onReset}>Try Another Document</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
          Analysis Result: <span style={{ color: 'var(--primary-light)' }}>
            {data.role_name && data.company_name && data.role_name !== "Unknown Role" && data.company_name !== "Unknown Company" 
              ? `${data.role_name} - ${data.company_name}` 
              : data.document_type}
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {data.noc_analysis?.applicable && (
            isSignedIn ? (
              <>
                {isPremiumUnlocked ? (
                  <>
                    <button onClick={() => handleDownloadNoc()} className="btn" style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)', color: 'white' }}>
                      📄 Download NOC Sheet
                    </button>
                    <button onClick={() => handleDownloadFull()} className="btn btn-outline" style={{ borderColor: 'var(--text-muted)' }}>
                      📥 Download Full Audit
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => document.getElementById('paywall-overlay')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="btn" style={{ background: '#9ca3af', borderColor: '#9ca3af', color: 'white' }}>
                      🔒 Download NOC Sheet
                    </button>
                    <button onClick={() => document.getElementById('paywall-overlay')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="btn btn-outline" style={{ borderColor: '#9ca3af', color: '#9ca3af' }}>
                      🔒 Download Full Audit
                    </button>
                  </>
                )}
                {data.stored_file_id && (
                  <button onClick={handleDownloadOriginal} className="btn btn-outline" style={{ borderColor: '#10b981', color: '#10b981' }}>
                    📎 Original Letter
                  </button>
                )}
              </>
            ) : (
              <div onClickCapture={() => sessionStorage.setItem('pendingPdfDownload', 'noc')}>
                <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                  <button className="btn" style={{ background: '#4285F4', borderColor: '#4285F4', color: 'white' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }}>
                       <path fill="white" fillRule="evenodd" clipRule="evenodd" d="M23.04 12.2614C23.04 11.4459 22.9668 10.662 22.8339 9.91016H12V14.3575H18.1891C17.9224 15.7949 17.1114 17.006 15.8943 17.8202V20.7135H19.6105C21.7855 18.7118 23.04 15.7618 23.04 12.2614Z" />
                       <path fill="white" fillRule="evenodd" clipRule="evenodd" d="M12 24C15.105 24 17.7082 22.9705 19.6105 20.7135L15.8943 17.8202C14.8643 18.5109 13.5457 18.9255 12 18.9255C9.00477 18.9255 6.46955 16.9016 5.56432 14.185H1.7225V17.1636C3.615 20.9232 7.50455 24 12 24Z" />
                       <path fill="white" fillRule="evenodd" clipRule="evenodd" d="M5.56432 14.1851C5.33318 13.4944 5.20364 12.7584 5.20364 12.0001C5.20364 11.2418 5.33318 10.5058 5.56432 9.81514V6.83655H1.7225C0.942727 8.38973 0.5 10.1424 0.5 12.0001C0.5 13.8578 0.942727 15.6106 1.7225 17.1638L5.56432 14.1851Z" />
                       <path fill="white" fillRule="evenodd" clipRule="evenodd" d="M12 5.07455C13.6909 5.07455 15.2082 5.65727 16.4027 6.79364L20.0168 3.17955C17.7082 1.02955 15.105 0 12 0C7.50455 0 3.615 3.07682 1.7225 6.83636L5.56432 9.81495C6.46955 7.09841 9.00477 5.07455 12 5.07455Z" />
                    </svg>
                    Sign in to Save
                  </button>
                </SignInButton>
              </div>
            )
          )}
          <button className="btn btn-outline" onClick={onReset}>Upload New</button>
        </div>
      </div>
      
      {!data.noc_analysis?.applicable ? (
        <div className="card" style={{ 
          marginTop: '20px', 
          padding: '40px', 
          textAlign: 'center', 
          background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', 
          border: '1px solid #F59E0B',
          boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.2)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#92400E', marginBottom: '16px' }}>
            Document Rejected: {data.document_type}
          </h2>
          <div style={{ 
            maxWidth: '650px', 
            margin: '0 auto', 
            fontSize: '1.1rem', 
            color: '#78350F', 
            lineHeight: 1.6, 
            textAlign: 'left',
            background: 'rgba(255, 255, 255, 0.5)',
            padding: '24px',
            borderRadius: '12px'
          }}>
            <p style={{ marginTop: 0 }}><strong>Why this happened:</strong></p>
            <p>{data.summary}</p>
            
            {data.risks.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>Action Required:</p>
                <div className="risk-item high" style={{ background: 'white', border: '1px solid #ef4444' }}>
                  <div className="risk-title">{data.risks[0].issue}</div>
                  <div className="risk-impact">{data.risks[0].recommendation}</div>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '32px' }}>
            <button className="btn btn-primary btn-lg" onClick={onReset} style={{ padding: '12px 32px' }}>
              Upload Correct Document
            </button>
            <p style={{ fontSize: '0.85rem', color: '#92400E', marginTop: '16px' }}>
              Only official employment/reference letters with job duties can be audited.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div id="primary-match-section" ref={fullTargetRef} style={{ background: 'var(--bg-color)', padding: '20px', borderRadius: '8px' }}>
            <div className="dashboard">
              <div>
                <div className="card">
                  <h3 className="card-title">Overall Assessment {renderBadge(data.compliance_status)}</h3>
                  <p>{data.summary}</p>
                </div>
              </div>

              <div>
                <div className="card">
                  <h3 className="card-title">NOC Compliance Analysis</h3>
                  <div style={{ background: 'var(--bg-color)', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Detected NOC Code</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                      {data.noc_analysis.detected_code}
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginTop: '4px' }}>
                      {data.noc_analysis.detected_title}
                    </div>
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <strong>Match Score: </strong> 
                    <span className={`badge ${data.noc_analysis.match_score >= 80 ? 'badge-success' : data.noc_analysis.match_score >= 65 ? 'badge-warning' : 'badge-danger'}`}>
                      {data.noc_analysis.match_score}% Match
                    </span>
                  </div>
                </div>
                
                <div className="card" style={{ background: 'var(--bg-color)', border: '2px solid var(--primary-color)' }}>
                  <h3 className="card-title">🟢 Final Verdict</h3>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '10px' }}>
                    {data.final_verdict === 'ready' ? 'Ready to Submit' : 
                     data.final_verdict === 'revise_minor' ? 'Minor Revisions Recommended' : 
                     'Major Issues Must Be Resolved Before Submission'}
                  </p>
                  {renderBadge(data.final_verdict)}
                  <p style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    * This review is for informational purposes only and does not constitute legal advice.
                  </p>
                </div>
              </div>
            </div> {/* End Free Dashboard Grid */}

            {/* --- PREMIUM LOCKED SECTION --- */}
            <div style={{ position: 'relative', marginTop: '20px' }}>
              <div style={!isPremiumUnlocked ? { filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 } : {}}>
                <div className="dashboard">
                  <div>
                    {data.strengths.length > 0 && (
                      <div className="card">
                        <h3 className="card-title">✅ Strengths</h3>
                        <ul style={{ paddingLeft: '20px', fontSize: '14px' }}>
                          {data.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="card">
                      <h3 className="card-title">⚠️ Identified Risks ({data.risks.length})</h3>
                      {data.risks.length === 0 ? <p>No significant risks found in the document.</p> : null}
                      {data.risks.map((risk: Risk, idx: number) => (
                        <div key={idx} className={`risk-item ${risk.severity === 'high' ? 'high' : ''}`}>
                          <div className="risk-title">{risk.issue}</div>
                          <div className="risk-impact">Impact: {risk.impact}</div>
                          <strong>Recommendation:</strong> {risk.recommendation}
                        </div>
                      ))}
                    </div>

                    <div className="card">
                      <h3 className="card-title">❌ Missing Elements</h3>
                      {data.missing_elements.length > 0 ? (
                        <ul className="missing-elements">
                          {data.missing_elements.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      ) : <p>All essential elements are present in the document.</p>}
                    </div>
                    
                    <div className="card">
                      <h3 className="card-title">🔧 Recommended Fixes</h3>
                      <ul style={{ paddingLeft: '20px' }}>
                        {data.recommended_fixes.map((fix, idx) => (
                          <li key={idx} style={{ marginBottom: '8px' }}>{fix}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div>
                    <div className="card">
                      {data.noc_analysis.alternative_nocs && data.noc_analysis.alternative_nocs.length > 0 && (
                        <div style={{ background: 'white', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                          <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-muted)' }}>ALTERNATIVE NOC CODES:</h4>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Want to apply under one of these instead? Click a NOC below to run the audit against it.</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {data.noc_analysis.alternative_nocs.map((alt, i) => (
                              <div 
                                key={i} 
                                onClick={() => handleReevaluate(alt.noc_code)}
                                className="alternative-noc-card"
                                style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: alt.explanation ? '8px' : '0' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>NOC {alt.noc_code} — {alt.noc_title}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ fontWeight: 700, color: alt.match_score >= 80 ? '#059669' : '#D97706', fontSize: '0.9rem' }}>{alt.match_score}% Match</div>
                                    {onUpdate && (
                                      <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)', fontWeight: 600 }} className="target-btn">Re-evaluate →</span>
                                    )}
                                  </div>
                                </div>
                                {alt.explanation && (
                                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>{alt.explanation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '12px' }}>{data.noc_analysis.notes}</p>
                    </div>

                    <div className="card">
                      <h3 className="card-title">✍️ Suggested Wording</h3>
                      {data.suggested_wording.map((text, idx) => (
                        <div key={idx} className="recommendation-box" style={{ fontStyle: 'italic', color: 'var(--primary-dark)' }}>
                          "{text}"
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div> {/* End Blurred Section */}

              {/* Paywall Overlay */}
              {!isPremiumUnlocked && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none' }}>
                  <div style={{ position: 'sticky', top: '25vh', display: 'flex', justifyContent: 'center', pointerEvents: 'auto', padding: '0 20px' }}>
                    <div id="paywall-overlay" className="card" style={{ maxWidth: '500px', background: 'white', border: '2px solid var(--primary-color)', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🔒</div>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '12px' }}>Premium Audit Locked</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
                      Unlock detailed risk analysis, missing elements, recommended fixes, alternative NOC mappings, suggested wordings, and the official alignment sheet.
                    </p>
                    <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                      <button className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}>
                        Sign In to Unlock Insights
                      </button>
                    </SignInButton>
                  </div>
                  </div>
                </div>
              )}
            </div>

            {data.noc_analysis?.duties_match && data.noc_analysis.duties_match.length > 0 && (
               <div style={!isPremiumUnlocked ? { filter: 'blur(8px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.6 } : {}}>
                 <div ref={breakSpacerRef} style={{ transition: 'height 0.1s ease-in-out' }}></div>
                 <div style={{ pageBreakBefore: 'always', margin: '40px 0 0 0' }} className="html2pdf__page-break"></div>
                 <div ref={nocTargetRef} className="card" style={{ marginTop: '0' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px', borderBottom: '2px solid var(--primary-light)', paddingBottom: '8px' }}>
                      NOC Alignment Sheet (For IRCC Officer)
                    </h2>
                    
                    <h3 style={{ fontSize: '1.2rem', marginTop: '20px', marginBottom: '12px', color: 'var(--primary-dark)' }}>1. Lead Statement Alignment</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)', marginBottom: '30px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                            <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', width: '33%' }}>Official NOC Description</th>
                            <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', width: '33%' }}>Evidence in Employment Letter</th>
                            <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', width: '33%' }}>Overlap Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.95rem' }}>"{data.noc_analysis.lead_statement_official}"</td>
                            <td style={{ padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', fontWeight: 500, fontSize: '0.95rem' }}>"{data.noc_analysis.lead_statement_applicant}"</td>
                            <td style={{ padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', color: 'var(--primary-dark)', fontSize: '0.95rem' }}>{data.noc_analysis.lead_statement_overlap}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', marginTop: '10px', marginBottom: '12px', color: 'var(--primary-dark)' }}>2. Main Duties Comparison</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-color)' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-color)' }}>
                            <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', width: '33%' }}>Official NOC Documented Duty</th>
                            <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', width: '33%' }}>Applicant's Duty (from letter)</th>
                            <th style={{ padding: '12px', border: '1px solid var(--border-color)', textAlign: 'left', width: '33%' }}>Overlap Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.noc_analysis.duties_match.map((duty, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', color: 'var(--text-muted)', fontSize: '0.95rem' }}>{duty.official_noc_duty}</td>
                              <td style={{ padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', fontWeight: 500, fontSize: '0.95rem' }}>"{duty.applicant_duty}"</td>
                              <td style={{ padding: '12px', border: '1px solid var(--border-color)', verticalAlign: 'top', color: 'var(--primary-dark)', fontSize: '0.95rem' }}>{duty.overlap_description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', marginTop: '20px', marginBottom: '12px', color: 'var(--primary-dark)' }}>3. Mandatory Document Checklist (Verified)</h3>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '12px' }}>
                      The attached employment letter has been evaluated for the following mandatory elements required by IRCC:
                    </p>
                    <div style={{ background: 'var(--bg-color)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.company_letterhead ? '✅' : '❌'} <span>Printed on official company letterhead</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.applicant_name ? '✅' : '❌'} <span>Applicant's full name is clearly stated</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.contact_information ? '✅' : '❌'} <span>Includes company contact information</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.job_title ? '✅' : '❌'} <span>Job title(s) are explicitly stated</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.dates_of_employment ? '✅' : '❌'} <span>States the exact dates of employment</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.hours_worked ? '✅' : '❌'} <span>States the number of hours worked per week</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.salary_compensation ? '✅' : '❌'} <span>States the applicant's compensation / salary</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {data.mandatory_requirements?.signatory ? '✅' : '❌'} <span>Signed by the immediate supervisor or HR officer</span>
                        </li>
                      </ul>
                    </div>
                 </div>
               </div>
            )}
          </div>

          <div data-html2canvas-ignore="true" style={{ marginTop: '40px', background: 'var(--surface-color)', padding: '40px 30px', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.75rem', marginBottom: '12px', color: 'var(--primary-dark)', fontWeight: 'bold' }}>Ready to submit?</h3>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '16px', borderRadius: '8px', maxWidth: '700px', margin: '0 auto 24px auto', textAlign: 'left' }}>
              <p style={{ color: '#1E3A8A', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
                💡 <strong>Pro Tip for Application:</strong> We strongly recommend submitting the <strong>"NOC Sheet Only"</strong> completely separately as the very first page of your employment records. IRCC officers process hundreds of records a week and they absolutely love seeing clear, structured alignment sheets. It drastically reduces processing time and ambiguity!
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {isPremiumUnlocked ? (
                  <>
                    <button onClick={() => handleDownloadNoc()} className="btn btn-lg" style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)', color: 'white', padding: '12px 32px' }}>
                      📄 Download NOC Sheet
                    </button>
                    <button onClick={() => handleDownloadFull()} className="btn btn-lg btn-outline" style={{ padding: '12px 32px' }}>
                      📥 Download Full Audit
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => document.getElementById('paywall-overlay')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="btn btn-lg" style={{ background: '#9ca3af', borderColor: '#9ca3af', color: 'white', padding: '12px 32px' }}>
                      🔒 Download NOC Sheet
                    </button>
                    <button onClick={() => document.getElementById('paywall-overlay')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="btn btn-lg btn-outline" style={{ color: '#9ca3af', borderColor: '#9ca3af', padding: '12px 32px' }}>
                      🔒 Download Full Audit
                    </button>
                  </>
                )}
            </div>
            {!isPremiumUnlocked && (
              <p style={{ marginTop: '16px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Unlock the premium audit above to download your custom PDFs.</p>
            )}
          </div>

          {!isSignedIn && showToast && !toastDismissed && (
            <div className="sticky-toast" style={{ 
              position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', 
              background: 'white', padding: '16px 24px', borderRadius: '12px', 
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.14)', 
              border: '1px solid rgba(0,0,0,0.05)', zIndex: 50, display: 'flex', 
              alignItems: 'center', gap: '20px', maxWidth: '90vw', width: 'max-content', 
              animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' 
            }}>
              <div>
                <div style={{ fontWeight: 600, color: '#1f2937', marginBottom: '4px', fontSize: '1rem' }}>Don't lose this report!</div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Sign in to save your analysis and track your progress.</div>
              </div>
              <div>
                <SignInButton mode="modal" forceRedirectUrl={window.location.href} signUpForceRedirectUrl={window.location.href}>
                  <button className="btn" style={{ background: '#4285F4', borderColor: '#4285F4', color: 'white', padding: '8px 20px', fontSize: '0.95rem', fontWeight: 500 }}>
                    Sign in
                  </button>
                </SignInButton>
              </div>
              <button onClick={() => setToastDismissed(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', marginLeft: '-8px' }} aria-label="Dismiss">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
