import { type FC, useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getEvaluations } from '../services/api';


interface MyEvaluationsProps {
  onSelectEvaluation: (data: any) => void;
}

export const MyEvaluations: FC<MyEvaluationsProps> = ({ onSelectEvaluation }) => {
  const { getToken } = useAuth();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        const data = await getEvaluations(token);
        setEvaluations(data.evaluations || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load evaluations');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [getToken]);

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading your documents...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>Error: {error}</div>;

  return (
    <div className="card" style={{ maxWidth: '800px', margin: '0 auto', background: 'white' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>My Saved Evaluations</h2>
      
      {evaluations.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>No saved evaluations found. Upload a document to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {evaluations.map((ev) => (
            <div 
              key={ev.id} 
              onClick={() => onSelectEvaluation(ev)}
              style={{
                border: '1px solid var(--border-color)',
                padding: '16px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {ev.is_premium_unlocked ? <span title="Premium Unlocked">🔓</span> : <span title="Premium Locked">🔒</span>}
                    
                    {ev.document_type === "NOC Finder Query" ? (
                      <span style={{ fontSize: '0.8rem', background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>🎯 NOC Check</span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', background: '#f3e8ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>📄 Letter Audit</span>
                    )}

                    {ev.role_name !== 'Unknown Role' && ev.company_name !== 'Unknown Company' && ev.company_name !== 'N/A' 
                      ? `${ev.role_name} - ${ev.company_name}` 
                      : ev.role_name && ev.company_name === 'N/A' ? ev.role_name 
                      : ev.document_type}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Analyzed on: {new Date(ev.timestamp).toLocaleDateString()} at {new Date(ev.timestamp).toLocaleTimeString()}
                </div>
              </div>
              <div>
                {ev.payload?.noc_analysis?.applicable === false ? (
                  <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #F59E0B' }}>Rejected</span>
                ) : ev.document_type === "NOC Finder Query" ? (
                  <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>NOC Match</span>
                ) : (
                  <>
                    {ev.compliance_status === 'compliant' && <span className="badge badge-success">Compliant</span>}
                    {ev.compliance_status === 'risk' && <span className="badge badge-warning">Risk Match</span>}
                    {ev.compliance_status === 'non_compliant' && <span className="badge badge-danger">Non-Compliant</span>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
