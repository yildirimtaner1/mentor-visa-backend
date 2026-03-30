import type { FC } from 'react';
import type { AnalysisResponse, Risk } from '../types';

interface DashboardProps {
  data: AnalysisResponse;
  onReset: () => void;
}

export const Dashboard: FC<DashboardProps> = ({ data, onReset }) => {

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Analysis Result: <span style={{ color: 'var(--primary-light)' }}>{data.document_type}</span></h2>
        <button className="btn btn-outline" onClick={onReset}>Upload New Document</button>
      </div>
      
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
    </div>
  );
};
