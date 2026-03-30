import type { FC } from 'react';
import { useUser, SignInButton } from '@clerk/clerk-react';
import { usePDF } from 'react-to-pdf';
import type { AnalysisResponse, Risk } from '../types';

interface DashboardProps {
  data: AnalysisResponse;
  onReset: () => void;
}

export const Dashboard: FC<DashboardProps> = ({ data, onReset }) => {
  const { isSignedIn } = useUser();
  const { toPDF, targetRef } = usePDF({filename: 'MentorVisa-AuditReport.pdf'});

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Analysis Result: <span style={{ color: 'var(--primary-light)' }}>{data.document_type}</span></h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isSignedIn ? (
            <button onClick={() => toPDF()} className="btn" style={{ background: 'var(--success-color)', borderColor: 'var(--success-color)', color: 'white' }}>
              📥 Download PDF Report
            </button>
          ) : (
            <SignInButton mode="modal" forceRedirectUrl={window.location.href}>
              <button className="btn" style={{ background: '#4285F4', borderColor: '#4285F4', color: 'white' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', verticalAlign: 'middle', display: 'inline' }}>
                   <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M23.04 12.2614C23.04 11.4459 22.9668 10.662 22.8339 9.91016H12V14.3575H18.1891C17.9224 15.7949 17.1114 17.006 15.8943 17.8202V20.7135H19.6105C21.7855 18.7118 23.04 15.7618 23.04 12.2614Z" fill="white"/>
                   <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M12 24C15.105 24 17.7082 22.9705 19.6105 20.7135L15.8943 17.8202C14.8643 18.5109 13.5457 18.9255 12 18.9255C9.00477 18.9255 6.46955 16.9016 5.56432 14.185H1.7225V17.1636C3.615 20.9232 7.50455 24 12 24Z" fill="white"/>
                   <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M5.56432 14.1851C5.33318 13.4944 5.20364 12.7584 5.20364 12.0001C5.20364 11.2418 5.33318 10.5058 5.56432 9.81514V6.83655H1.7225C0.942727 8.38973 0.5 10.1424 0.5 12.0001C0.5 13.8578 0.942727 15.6106 1.7225 17.1638L5.56432 14.1851Z" fill="white"/>
                   <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M12 5.07455C13.6909 5.07455 15.2082 5.65727 16.4027 6.79364L20.0168 3.17955C17.7082 1.02955 15.105 0 12 0C7.50455 0 3.615 3.07682 1.7225 6.83636L5.56432 9.81495C6.46955 7.09841 9.00477 5.07455 12 5.07455Z" fill="white"/>
                </svg>
                Sign in to Download PDF
              </button>
            </SignInButton>
          )}
          <button className="btn btn-outline" onClick={onReset}>Upload New</button>
        </div>
      </div>
      
      <div ref={targetRef} style={{ background: 'var(--bg-color)', padding: '20px', borderRadius: '8px' }}>
        <div className="dashboard">
          {/* Left Column */}
          <div>
            <div className="card">
            <h3 className="card-title">Overall Assessment {renderBadge(data.compliance_status)}</h3>
            <p>{data.summary}</p>
            {data.strengths.length > 0 && (
               <div style={{ marginTop: '16px' }}>
                 <strong style={{ color: 'var(--success-color)' }}>✅ Strengths:</strong>
                 <ul style={{ paddingLeft: '20px', marginTop: '8px', fontSize: '14px' }}>
                   {data.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                 </ul>
               </div>
            )}
          </div>

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

        {/* Right Column */}
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
              <strong>Match Level: </strong> 
              {data.noc_analysis.match_level === 'high' ? <span className="badge badge-success">High</span> : 
               data.noc_analysis.match_level === 'medium' ? <span className="badge badge-warning">Medium</span> : 
               <span className="badge badge-danger">Low</span>}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{data.noc_analysis.notes}</p>
          </div>

          <div className="card">
            <h3 className="card-title">✍️ Suggested Wording</h3>
             {data.suggested_wording.map((text, idx) => (
                <div key={idx} className="recommendation-box" style={{ fontStyle: 'italic', color: 'var(--primary-dark)' }}>
                  "{text}"
                </div>
              ))}
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
      </div>

      {/* New Section: NOC Alignment Sheet */}
      {data.noc_analysis?.duties_match && data.noc_analysis.duties_match.length > 0 && (
         <div className="card" style={{ marginTop: '30px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px', borderBottom: '2px solid var(--primary-light)', paddingBottom: '8px' }}>
              NOC Alignment Sheet (For IRCC Officer)
            </h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
              This comparison sheet demonstrates how the duties in your employment letter align with the official NOC 2021 database requirements for <strong>{data.noc_analysis.detected_code} - {data.noc_analysis.detected_title}</strong>.
            </p>
            
            {/* Lead Statement Table */}
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

            {/* Main Duties Table */}
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

            {/* Mandatory Document Checklist */}
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
      )}
      </div>
    </div>
  );
};
