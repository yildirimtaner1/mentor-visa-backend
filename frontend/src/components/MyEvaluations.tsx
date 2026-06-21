import { type FC, useEffect, useState, useMemo } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { getEvaluations } from '../services/api';
import './MyEvaluations.css';

interface MyEvaluationsProps {
  onSelectEvaluation: (data: any) => void;
}

// Simple time-ago formatter
function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export const MyEvaluations: FC<MyEvaluationsProps> = ({ onSelectEvaluation }) => {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'audit' | 'crs' | 'noc'>('all');

  useEffect(() => {
    async function loadData() {
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");
        const data = await getEvaluations(token);
        // Sort descending by timestamp
        const sorted = (data.evaluations || []).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setEvaluations(sorted);
      } catch (err: any) {
        setError(err.message || 'Failed to load evaluations');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [getToken]);

  // Derived metrics
  const totalAudits = evaluations.filter(ev => ev.document_type !== 'CRS Calculator' && ev.document_type !== "NOC Finder Query").length;
  const highestCrs = useMemo(() => {
    const crsEvals = evaluations.filter(ev => ev.document_type === 'CRS Calculator' || ev.payload?.evaluation_type === 'crs_calculator');
    if (crsEvals.length === 0) return 0;
    return Math.max(...crsEvals.map(ev => parseInt(ev.payload?.score?.total || '0', 10) || 0));
  }, [evaluations]);
  const unlockedReports = evaluations.filter(ev => ev.is_premium_unlocked).length;

  const filteredEvaluations = useMemo(() => {
    if (activeTab === 'all') return evaluations;
    return evaluations.filter(ev => {
      const isCRS = ev.document_type === 'CRS Calculator' || ev.payload?.evaluation_type === 'crs_calculator';
      const isNOC = ev.document_type === "NOC Finder Query";
      if (activeTab === 'crs') return isCRS;
      if (activeTab === 'noc') return isNOC;
      if (activeTab === 'audit') return !isCRS && !isNOC;
      return true;
    });
  }, [evaluations, activeTab]);

  const greetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', flexDirection: 'column', gap: '16px' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #E5E7EB', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      <div style={{ color: '#6B7280', fontWeight: 500 }}>Loading your PR command center...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: '#DC2626' }}>⚠️ {error}</div>;

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          {greetingTime()}, {user?.firstName || 'there'}!
        </h1>
        <p className="dashboard-subtitle">Manage your evaluations and track your journey to Canadian PR.</p>
      </div>

      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon blue">📄</div>
          <div className="metric-info">
            <span className="metric-value">{totalAudits}</span>
            <span className="metric-label">Letters Audited</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon green">📊</div>
          <div className="metric-info">
            <span className="metric-value">{highestCrs > 0 ? highestCrs : '—'}</span>
            <span className="metric-label">Highest CRS Score</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-icon purple">🔓</div>
          <div className="metric-info">
            <span className="metric-value">{unlockedReports}</span>
            <span className="metric-label">Premium Reports Unlocked</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="actions-grid">
          <a href="/audit-employment-letter" className="action-card">
            <div className="action-card-icon">➕</div>
            <div className="action-card-text">New Letter Audit</div>
          </a>
          <a href="/crs-calculator" className="action-card">
            <div className="action-card-icon">🧮</div>
            <div className="action-card-text">Calculate CRS Score</div>
          </a>
          <a href="/find-my-noc" className="action-card">
            <div className="action-card-icon">🔍</div>
            <div className="action-card-text">Find NOC Code</div>
          </a>
        </div>
      </div>

      {/* Evaluations Section */}
      <div className="evaluations-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>My Saved Evaluations</h2>
        </div>

        {evaluations.length > 0 && (
          <div className="dashboard-tabs">
            <button className={`dashboard-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All ({evaluations.length})</button>
            <button className={`dashboard-tab ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>Audits</button>
            <button className={`dashboard-tab ${activeTab === 'crs' ? 'active' : ''}`} onClick={() => setActiveTab('crs')}>CRS Scores</button>
            <button className={`dashboard-tab ${activeTab === 'noc' ? 'active' : ''}`} onClick={() => setActiveTab('noc')}>NOC Checks</button>
          </div>
        )}
        
        {filteredEvaluations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No evaluations found</h3>
            <p>You haven't saved any evaluations in this category yet. Start using our tools to build your PR profile.</p>
            <a href="/audit-employment-letter" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>Get Started</a>
          </div>
        ) : (
          <div className="evaluations-list">
            {filteredEvaluations.map((ev) => {
              const isCRS = ev.document_type === 'CRS Calculator' || ev.payload?.evaluation_type === 'crs_calculator';
              const isNOC = ev.document_type === "NOC Finder Query";
              const isLocked = !ev.is_premium_unlocked;

              return (
                <div 
                  key={ev.id} 
                  className={`eval-row ${isLocked ? 'locked' : ''}`}
                  onClick={() => onSelectEvaluation(ev)}
                >
                  <div className="eval-main">
                    <div className="eval-header">
                      {isCRS ? (
                        <span className="eval-type-badge crs">CRS Score</span>
                      ) : isNOC ? (
                        <span className="eval-type-badge noc">NOC Check</span>
                      ) : (
                        <span className="eval-type-badge audit">Letter Audit</span>
                      )}
                      
                      {!isCRS && ev.payload?.reevaluated_against_noc && (
                        <span className="eval-type-badge" style={{ background: '#FEF3C7', color: '#92400E' }}>
                          {isLocked ? 'vs NOC 🔒' : `vs NOC ${ev.payload.reevaluated_against_noc}`}
                        </span>
                      )}

                      {isLocked && <span title="Premium Locked" style={{ fontSize: '0.9rem' }}>🔒</span>}
                    </div>

                    <h3 className="eval-title">
                      {isCRS ? (
                        `CRS Score Profile`
                      ) : (
                        `${ev.role_name && ev.role_name !== 'Unknown Role' ? ev.role_name : 'Unknown Role'} - ${ev.company_name && ev.company_name !== 'N/A' ? ev.company_name : 'Unknown Company'}`
                      )}
                    </h3>

                    <div className="eval-meta">
                      <span className="meta-tag">
                        🕒 {timeAgo(ev.timestamp)}
                      </span>
                      {!isCRS && ev.payload?.noc_analysis?.detected_code && !isLocked && (
                        <span className="meta-tag">
                          NOC {ev.payload.noc_analysis.detected_code}
                        </span>
                      )}
                      {isCRS && ev.payload?.score && (
                        <span style={{ fontSize: '0.8rem' }}>
                          Core: {ev.payload.score.core} • Spouse: {ev.payload.score.spouse} • Transfer: {ev.payload.score.transferability}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="eval-actions">
                    {/* Status / Score Pill */}
                    {isCRS ? (
                      <span className="status-pill success" style={{ fontSize: '1.1rem' }}>
                        {ev.payload?.score?.total ?? '—'} pts
                      </span>
                    ) : ev.payload?.noc_analysis?.applicable === false ? (
                      <span className="status-pill warning">Rejected</span>
                    ) : isNOC ? (
                      <span className="status-pill neutral">NOC Match</span>
                    ) : (
                      <>
                        {ev.compliance_status === 'ACCEPT' && <span className="status-pill success">Accepted</span>}
                        {ev.compliance_status === 'PFL_RISK' && <span className="status-pill warning">PFL Risk</span>}
                        {ev.compliance_status === 'REFUSE' && <span className="status-pill danger">Refused</span>}
                        {/* Legacy */}
                        {ev.compliance_status === 'compliant' && <span className="status-pill success">Compliant</span>}
                        {ev.compliance_status === 'risk' && <span className="status-pill warning">Risk</span>}
                        {ev.compliance_status === 'non_compliant' && <span className="status-pill danger">Non-Compliant</span>}
                      </>
                    )}

                    {/* Unlock CTA (shows instead of just a lock icon if locked) */}
                    {isLocked && (
                      <button className="unlock-btn" onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvaluation(ev);
                      }}>
                        Unlock Report
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
