import { type FC, useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SEO } from './common/SEO';

interface DutyGroup {
  sub_title: string | null;
  duties: string[];
}

interface NOCData {
  code: string;
  title: string;
  lead_statement: string;
  duties: string[];
  duty_groups?: DutyGroup[];
}

const TEER_INFO: Record<string, { label: string; description: string; color: string }> = {
  '0': { label: 'Management', description: 'Management occupations typically require extensive experience leading organizations. These are senior executive, director, and C-suite roles. All TEER 0 occupations qualify for Express Entry (CEC and FSWP).', color: '#6366f1' },
  '1': { label: 'Professional', description: 'Professional occupations usually require a university degree (bachelor\'s, master\'s, or doctorate). These are roles in science, engineering, healthcare, law, and education. All TEER 1 occupations qualify for Express Entry (CEC and FSWP).', color: '#3b82f6' },
  '2': { label: 'Technical / Skilled Trades', description: 'Technical occupations and skilled trades typically require a college diploma, apprenticeship training, or supervisory/safety responsibilities. TEER 2 includes roles like electricians, plumbers, technicians, and paramedics. All TEER 2 occupations qualify for Express Entry (CEC and FSWP).', color: '#10b981' },
  '3': { label: 'Intermediate', description: 'Intermediate occupations usually require a high school diploma and/or job-specific training. TEER 3 includes roles like dental assistants, heavy equipment operators, and bakers. TEER 3 occupations qualify for CEC but require more CRS points to be competitive.', color: '#f59e0b' },
  '4': { label: 'Labour', description: 'Labour occupations typically require on-the-job training. TEER 4 includes roles like retail salespersons, food counter attendants, and home support workers. TEER 4 is NOT eligible for Express Entry (CEC or FSWP).', color: '#ef4444' },
  '5': { label: 'Entry-Level Labour', description: 'Entry-level labour occupations require minimal formal education and brief work demonstration. TEER 5 includes harvesting labourers, cleaners, and other entry-level roles. TEER 5 is NOT eligible for Express Entry.', color: '#94a3b8' },
};

const CATEGORY_LABELS: Record<string, string> = {
  '0': 'Legislative & Senior Management',
  '1': 'Business, Finance & Administration',
  '2': 'Natural & Applied Sciences',
  '3': 'Health',
  '4': 'Education, Law, Social & Government',
  '5': 'Art, Culture, Recreation & Sport',
  '6': 'Sales & Service',
  '7': 'Trades, Transport & Equipment',
  '8': 'Natural Resources & Agriculture',
  '9': 'Manufacturing & Utilities',
};

export const NOCDetailsPage: FC = () => {
  const { code } = useParams<{ code: string }>();
  const [noc, setNoc] = useState<NOCData | null>(null);
  const [allNocs, setAllNocs] = useState<Record<string, NOCData>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/noc-data.json')
      .then(r => r.json())
      .then((data: Record<string, NOCData>) => {
        setAllNocs(data);
        if (code && data[code]) {
          setNoc(data[code]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [code]);

  const teer = code ? code.charAt(1) : '';
  const teerInfo = TEER_INFO[teer] || TEER_INFO['5'];
  const cecEligible = ['0', '1', '2', '3'].includes(teer);
  const broadCat = code ? code.charAt(0) : '';
  const catLabel = CATEGORY_LABELS[broadCat] || '';

  // Related occupations — same broad category (first 2 digits)
  const related = useMemo(() => {
    if (!code || Object.keys(allNocs).length === 0) return [];
    const prefix = code.substring(0, 2);
    return Object.values(allNocs)
      .filter(n => n.code.startsWith(prefix) && n.code !== code)
      .slice(0, 6);
  }, [allNocs, code]);

  if (loading) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <div className="spinner" style={{ margin: '0 auto 20px' }} />
        <p>Loading NOC data...</p>
      </div>
    );
  }

  if (!noc) {
    return (
      <div className="page-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <h2>NOC {code} Not Found</h2>
        <p style={{ marginBottom: '24px' }}>This NOC code doesn't exist in our database.</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/noc-codes" className="btn btn-outline">📚 Browse NOC Directory</Link>
          <Link to="/find-my-noc" className="btn btn-primary">🎯 Find My NOC Code</Link>
        </div>
      </div>
    );
  }

  const schemaData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `NOC ${code} — ${noc.title}`,
    "description": `Express Entry guide for NOC ${code} (${noc.title}). TEER ${teer} occupation. ${cecEligible ? 'Eligible for CEC and FSWP.' : 'Not eligible for Express Entry.'}`,
    "url": `https://mentorvisa.com/noc-codes/${code}`,
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mentorvisa.com" },
        { "@type": "ListItem", "position": 2, "name": "NOC Directory", "item": "https://mentorvisa.com/noc-codes" },
        { "@type": "ListItem", "position": 3, "name": `NOC ${code}` }
      ]
    }
  });

  return (
    <div>
      <SEO 
        title={`NOC ${code} — ${noc.title} | TEER ${teer} | Mentor Visa`}
        description={`${cecEligible ? 'Eligible for Express Entry.' : 'Not CEC eligible.'} View official duties, immigration eligibility, TEER ${teer} info, and related occupations for NOC ${code} (${noc.title}).`}
        canonical={`/noc-codes/${code}`}
        keywords={`NOC ${code}, ${noc.title}, TEER ${teer}, Express Entry, CEC eligible, NOC duties, employment letter`}
        schema={schemaData}
      />

      {/* Hero */}
      <section className="page-hero">
        <div className="page-hero-content">
          {/* Breadcrumb */}
          <nav style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
            <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Home</Link>
            <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>/</span>
            <Link to="/noc-codes" style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 500 }}>NOC Directory</Link>
            <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-color)', fontWeight: 500 }}>{code}</span>
          </nav>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span className="page-hero-badge">NOC {code}</span>
            <span className="page-hero-badge" style={{ background: `${teerInfo.color}14`, border: `1px solid ${teerInfo.color}33`, color: teerInfo.color }}>
              TEER {teer} — {teerInfo.label}
            </span>
            {cecEligible ? (
              <span className="page-hero-badge" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', color: '#15803d' }}>✓ CEC Eligible</span>
            ) : (
              <span className="page-hero-badge" style={{ background: '#FEE2E2', border: '1px solid #FECACA', color: '#dc2626' }}>✗ Not CEC Eligible</span>
            )}
          </div>
          <h1 style={{ fontSize: '2rem' }}><span className="hero-highlight">{noc.title}</span></h1>
          <p>{catLabel}</p>
        </div>
      </section>
      
      <div className="page-container">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* Immigration Eligibility */}
          <section className="page-section" style={{ marginBottom: '0' }}>
            <h2 style={{ marginBottom: '16px' }}>🛂 Immigration Eligibility</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ 
                padding: '16px 20px', borderRadius: '10px', 
                background: cecEligible ? '#F0FDF4' : '#FEF2F2', 
                border: `1px solid ${cecEligible ? '#BBF7D0' : '#FECACA'}`,
                display: 'flex', alignItems: 'flex-start', gap: '12px'
              }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{cecEligible ? '✅' : '❌'}</span>
                <div>
                  <strong>Express Entry (CEC & FSWP)</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {cecEligible 
                      ? `TEER ${teer} occupations qualify for the Federal Skilled Worker Program (FSWP) and Canadian Experience Class (CEC).`
                      : `TEER ${teer} occupations are NOT eligible for Express Entry under CEC or FSWP.`
                    }
                  </p>
                </div>
              </div>

              <div style={{ 
                padding: '16px 20px', borderRadius: '10px', background: '#F8FAFC', 
                border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'flex-start', gap: '12px'
              }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>📋</span>
                <div>
                  <strong>LMIA / Work Permits</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Canadian employers can obtain an LMIA to hire a foreign worker for this occupation.
                  </p>
                </div>
              </div>

              <div style={{ 
                padding: '16px 20px', borderRadius: '10px', background: '#F8FAFC', 
                border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'flex-start', gap: '12px'
              }}>
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🏛️</span>
                <div>
                  <strong>Provincial Nominee Programs (PNP)</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Many provinces have PNP streams that accept TEER {teer} occupations. Alberta, BC, Ontario, and other provinces run occupation-specific draws.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Official Definition */}
          <section className="page-section" style={{ marginBottom: '0' }}>
            <h2 style={{ marginBottom: '16px' }}>📖 Official Definition</h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-color)', lineHeight: 1.7, padding: '20px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              {noc.lead_statement}
            </p>
          </section>

          {/* Main Duties */}
          <section className="page-section" style={{ marginBottom: '0' }}>
            <h2 style={{ marginBottom: '8px' }}>📝 Main Duties</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
              Your employment reference letter must demonstrate that you performed a substantial number of these duties to claim NOC {code}:
            </p>

            {noc.duty_groups && noc.duty_groups.length > 1 ? (
              /* Grouped duties by sub-occupation */
              <div style={{ display: 'grid', gap: '16px' }}>
                {noc.duty_groups.map((group, gIdx) => (
                  <div key={gIdx} style={{
                    background: 'white', borderRadius: '12px',
                    border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    overflow: 'hidden'
                  }}>
                    {group.sub_title && (
                      <div style={{
                        padding: '12px 20px',
                        background: `${teerInfo.color}08`,
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', gap: '8px'
                      }}>
                        <span style={{ fontSize: '0.85rem', color: teerInfo.color }}>◆</span>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-color)' }}>
                          {group.sub_title}
                        </h3>
                      </div>
                    )}
                    <ul style={{ padding: '16px 20px 16px 40px', margin: 0 }}>
                      {group.duties.map((duty, dIdx) => (
                        <li key={dIdx} style={{ marginBottom: '10px', lineHeight: 1.7, fontSize: '0.93rem', color: 'var(--text-color)' }}>{duty}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              /* Flat duties (no sub-categories) */
              <ul style={{
                background: 'white', padding: '24px 24px 24px 40px', borderRadius: '12px',
                border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                {noc.duties.map((duty, idx) => (
                  <li key={idx} style={{ marginBottom: '12px', lineHeight: 1.7, fontSize: '0.95rem', color: 'var(--text-color)' }}>{duty}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Warning Box */}
          <div style={{ 
            padding: '20px 24px', borderRadius: '12px', marginBottom: '32px',
            background: '#FEF3C7', border: '1px solid #FDE68A',
            display: 'flex', gap: '12px', alignItems: 'flex-start'
          }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <strong style={{ color: '#92400E' }}>Don't Copy These Duties Word-for-Word</strong>
              <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#78350F', lineHeight: 1.6 }}>
                Immigration officers regularly reject applications that plagiarize the NOC directory verbatim. Your employment letter must describe these duties in your employer's own words, showing how YOUR specific role aligns with the occupation.
              </p>
            </div>
          </div>

          {/* TEER Explained */}
          <section className="page-section" style={{ marginBottom: '0' }}>
            <h2 style={{ marginBottom: '16px' }}>📊 TEER {teer} Explained</h2>
            <div style={{ 
              padding: '20px 24px', borderRadius: '12px', 
              background: `${teerInfo.color}08`, border: `1px solid ${teerInfo.color}22`
            }}>
              <p style={{ margin: 0, lineHeight: 1.7, fontSize: '0.95rem' }}>{teerInfo.description}</p>
            </div>
          </section>

          {/* Jobs in Canada */}
          <section className="page-section" style={{ marginBottom: '0' }}>
            <h2 style={{ marginBottom: '16px' }}>💼 Jobs in Canada</h2>
            <div style={{ 
              padding: '20px 24px', borderRadius: '12px', background: '#F8FAFC', 
              border: '1px solid var(--border-color)', textAlign: 'center'
            }}>
              <p style={{ marginBottom: '16px', fontSize: '0.95rem' }}>
                Search active job listings for this occupation on the Government of Canada Job Bank.
              </p>
              <a 
                href={`https://www.jobbank.gc.ca/jobsearch/jobsearch?searchstring=${code}&sort=D`}
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                🔍 Search Jobs on Job Bank ↗
              </a>
              <p style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Job listings are from the Government of Canada Job Bank. Mentor Visa is not affiliated with Job Bank or ESDC.
              </p>
            </div>
          </section>

          {/* Related Occupations */}
          {related.length > 0 && (
            <section className="page-section" style={{ marginBottom: '0' }}>
              <h2 style={{ marginBottom: '8px' }}>🔗 Related Occupations</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '0.9rem' }}>
                Other occupations in {catLabel}
              </p>
              <div style={{ display: 'grid', gap: '8px' }}>
                {related.map(r => {
                  const rTeer = r.code.charAt(1);
                  const rColor = TEER_INFO[rTeer]?.color || '#666';
                  return (
                    <Link 
                      key={r.code} 
                      to={`/noc-codes/${r.code}`}
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '14px 20px', background: 'white', borderRadius: '10px', 
                        border: '1px solid var(--border-color)', textDecoration: 'none', color: 'inherit',
                        transition: 'transform 0.15s, box-shadow 0.15s'
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.04)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: rColor, flexShrink: 0 }}>{r.code}</span>
                        <span style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: `${rColor}14`, color: rColor, flexShrink: 0, marginLeft: '12px' }}>
                        TEER {rTeer}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* CTAs */}
          <section className="page-section">
            <h2 style={{ marginBottom: '20px', textAlign: 'center' }}>Ready to Prepare Your Application?</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <Link to="/audit-employment-letter" style={{
                padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--border-color)',
                textAlign: 'center', textDecoration: 'none', color: 'inherit',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📄</div>
                <strong>Audit Your Letter</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>Check if your employment letter matches NOC {code} duties</p>
              </Link>

              <Link to="/documents" style={{
                padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--border-color)',
                textAlign: 'center', textDecoration: 'none', color: 'inherit',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📋</div>
                <strong>Track Your Documents</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>Avoid the 12 most common mistakes that get applications refused</p>
              </Link>

              <Link to="/crs-calculator" style={{
                padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--border-color)',
                textAlign: 'center', textDecoration: 'none', color: 'inherit',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.06)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🧮</div>
                <strong>Calculate CRS Score</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>See your Comprehensive Ranking System score</p>
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
