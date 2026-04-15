import { type FC } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from './common/SEO';

const ALL_NOCS = [
  { code: '21231', title: 'Software engineers and designers', teer: '1' },
  { code: '11202', title: 'Professional occupations in advertising, marketing and public relations', teer: '1' },
  { code: '10011', title: 'Financial managers', teer: '0' }
];

export const NOCDirectoryPage: FC<{ onNavigate: (v:string)=>void }> = () => {
  return (
    <div>
      <SEO 
        title="Express Entry NOC Code Directory 2021 | Mentor Visa"
        description="Browse the comprehensive list of NOC 2021 codes eligible for Canadian Express Entry. View main duties, TEER categories, and requirements."
        canonical="/noc-codes"
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📚 NOC 2021 Encyclopedia</div>
          <h1>Express Entry<br /><span className="hero-highlight">NOC Directory</span></h1>
          <p>Browse our detailed guides for popular Express Entry professions. Learn exactly what duties IRCC expects to see on your employment letter.</p>
        </div>
      </section>
      
      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Popular Express Entry Occupations</h2>
            <div style={{ display: 'grid', gap: '16px' }}>
              {ALL_NOCS.map(noc => (
                <Link 
                  key={noc.code} 
                  to={`/noc-codes/${noc.code}`}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '24px', 
                    background: 'white', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)',
                    textDecoration: 'none',
                    color: 'inherit',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.05)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--primary-color)', fontWeight: 700, marginBottom: '6px' }}>
                      NOC {noc.code} • TEER {noc.teer}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-color)' }}>
                      {noc.title}
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>➔</div>
                </Link>
              ))}
            </div>

            <div style={{ marginTop: '40px', padding: '32px', background: 'linear-gradient(135deg, #EFF6FF, #F8FAFC)', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '12px' }}>Don't see your profession?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
                Use our AI to automatically find your NOC code based on your job duties.
              </p>
              <Link to="/find-my-noc" className="btn btn-primary">
                🎯 Match My Duties
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
