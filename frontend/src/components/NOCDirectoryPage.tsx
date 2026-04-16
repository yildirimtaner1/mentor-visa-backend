import { type FC, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SEO } from './common/SEO';

interface NOCEntry {
  code: string;
  title: string;
  teer: string;
}

const TEER_COLORS: Record<string, string> = {
  '0': '#6366f1',
  '1': '#3b82f6',
  '2': '#10b981',
  '3': '#f59e0b',
  '4': '#ef4444',
  '5': '#94a3b8',
};

const TEER_CARDS: { teer: string; title: string; emoji: string; education: string; eligible: boolean; gradient: string }[] = [
  { teer: '0', title: 'Management occupations', emoji: '💼', education: 'Management / Senior Leadership', eligible: true, gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
  { teer: '1', title: 'Professional occupations (usually require university degree)', emoji: '🎓', education: 'University Degree', eligible: true, gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  { teer: '2', title: 'Occupations usually requiring college diploma or apprenticeship', emoji: '🔧', education: 'College Diploma or Apprenticeship', eligible: true, gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  { teer: '3', title: 'Occupations usually requiring secondary school and/or occupation-specific training', emoji: '📘', education: 'Secondary School / Occupation-Specific Training', eligible: true, gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  { teer: '4', title: 'Occupations usually requiring on-the-job training', emoji: '🛠️', education: 'On-the-Job Training', eligible: false, gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  { teer: '5', title: 'Occupations usually requiring short work demonstration or no formal education', emoji: '🧹', education: 'Short Work Demonstration or No Formal Education', eligible: false, gradient: 'linear-gradient(135deg, #94a3b8, #64748b)' },
];

const CATEGORY_CARDS: { cat: string; title: string; emoji: string; gradient: string }[] = [
  { cat: '0', title: 'Legislative & Senior Management', emoji: '🏛️', gradient: 'linear-gradient(135deg, #312e81, #4338ca)' },
  { cat: '1', title: 'Business, Finance & Administration', emoji: '📊', gradient: 'linear-gradient(135deg, #1e3a5f, #2563eb)' },
  { cat: '2', title: 'Natural & Applied Sciences', emoji: '🔬', gradient: 'linear-gradient(135deg, #064e3b, #059669)' },
  { cat: '3', title: 'Health', emoji: '🏥', gradient: 'linear-gradient(135deg, #7f1d1d, #dc2626)' },
  { cat: '4', title: 'Education, Law, Social & Government', emoji: '⚖️', gradient: 'linear-gradient(135deg, #713f12, #ca8a04)' },
  { cat: '5', title: 'Art, Culture, Recreation & Sport', emoji: '🎭', gradient: 'linear-gradient(135deg, #701a75, #c026d3)' },
  { cat: '6', title: 'Sales & Service', emoji: '🛒', gradient: 'linear-gradient(135deg, #0e7490, #06b6d4)' },
  { cat: '7', title: 'Trades, Transport & Equipment', emoji: '🚛', gradient: 'linear-gradient(135deg, #92400e, #d97706)' },
  { cat: '8', title: 'Natural Resources & Agriculture', emoji: '🌾', gradient: 'linear-gradient(135deg, #14532d, #22c55e)' },
  { cat: '9', title: 'Manufacturing & Utilities', emoji: '🏭', gradient: 'linear-gradient(135deg, #44403c, #78716c)' },
];

export const NOCDirectoryPage: FC<{ onNavigate: (v:string)=>void }> = () => {
  const [allNocs, setAllNocs] = useState<NOCEntry[]>([]);
  const [search, setSearch] = useState('');
  const [teerFilter, setTeerFilter] = useState<string>('all');
  const [cecOnly, setCecOnly] = useState(false);
  const [expandedTeers, setExpandedTeers] = useState<Record<string, boolean>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/noc-directory.json')
      .then(r => r.json())
      .then((data: NOCEntry[]) => setAllNocs(data))
      .catch(() => {});
  }, []);

  const teerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allNocs.forEach(n => { counts[n.teer] = (counts[n.teer] || 0) + 1; });
    return counts;
  }, [allNocs]);

  const teerGroups = useMemo(() => {
    const groups: Record<string, NOCEntry[]> = {};
    allNocs.forEach(n => {
      if (!groups[n.teer]) groups[n.teer] = [];
      groups[n.teer].push(n);
    });
    return groups;
  }, [allNocs]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allNocs.forEach(n => { const c = n.code.charAt(0); counts[c] = (counts[c] || 0) + 1; });
    return counts;
  }, [allNocs]);

  const catGroups = useMemo(() => {
    const groups: Record<string, NOCEntry[]> = {};
    allNocs.forEach(n => {
      const c = n.code.charAt(0);
      if (!groups[c]) groups[c] = [];
      groups[c].push(n);
    });
    return groups;
  }, [allNocs]);

  // Search results (only shown when search is active)
  const searchResults = useMemo(() => {
    if (!search && teerFilter === 'all' && !cecOnly) return [];
    return allNocs.filter(noc => {
      const matchSearch = search === '' || 
        noc.code.includes(search) || 
        noc.title.toLowerCase().includes(search.toLowerCase());
      const matchTeer = teerFilter === 'all' || noc.teer === teerFilter;
      const matchCec = !cecOnly || ['0', '1', '2', '3'].includes(noc.teer);
      return matchSearch && matchTeer && matchCec;
    });
  }, [allNocs, search, teerFilter, cecOnly]);

  const isSearchActive = search !== '' || teerFilter !== 'all' || cecOnly;

  const schemaData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "NOC 2021 Code Directory",
    "description": "Complete directory of all 516 NOC 2021 occupation codes used in Canadian Express Entry",
    "numberOfItems": allNocs.length,
    "url": "https://mentorvisa.com/noc-codes"
  });

  return (
    <div>
      <SEO 
        title="Complete NOC 2021 Code Directory — All 516 Occupations | Mentor Visa"
        description="Browse all 516 NOC 2021 occupation codes used in Canadian Express Entry. Filter by TEER category, search by job title, and check CEC eligibility instantly."
        canonical="/noc-codes"
        keywords="NOC codes 2021, NOC directory, Express Entry occupations, TEER categories, CEC eligible NOC, NOC code list Canada"
        schema={schemaData}
      />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">📚 NOC 2021 Encyclopedia</div>
          <h1>Express Entry<br /><span className="hero-highlight">NOC Directory</span></h1>
          <p>Browse all {allNocs.length} NOC 2021 occupation codes. Filter by TEER category, search by job title or code, and check CEC eligibility.</p>
        </div>
      </section>
      
      <div className="page-container">
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>

          {/* Search & Filters — moved to top */}
          <section className="page-section" style={{ paddingBottom: '0' }}>
            <div style={{ 
              display: 'flex', flexWrap: 'wrap', gap: '12px',
              padding: '20px', background: 'white', borderRadius: '12px', 
              border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
            }}>
              <input
                type="text"
                placeholder="Search by code or job title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ 
                  flex: '1 1 250px', padding: '10px 14px', borderRadius: '8px', 
                  border: '1px solid var(--border-color)', fontSize: '0.95rem',
                  outline: 'none'
                }}
              />
              <select
                value={teerFilter}
                onChange={e => setTeerFilter(e.target.value)}
                style={{ 
                  padding: '10px 14px', borderRadius: '8px', 
                  border: '1px solid var(--border-color)', fontSize: '0.95rem',
                  background: 'white', cursor: 'pointer'
                }}
              >
                <option value="all">All TEER Categories</option>
                {['0','1','2','3','4','5'].map(t => (
                  <option key={t} value={t}>TEER {t}</option>
                ))}
              </select>
              <label style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', 
                fontSize: '0.9rem', cursor: 'pointer', padding: '0 8px',
                whiteSpace: 'nowrap'
              }}>
                <input
                  type="checkbox"
                  checked={cecOnly}
                  onChange={e => setCecOnly(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                CEC-eligible only
              </label>
            </div>
          </section>

          {/* Search Results (shown when filter/search is active) */}
          {isSearchActive && (
            <section className="page-section" style={{ paddingBottom: '0' }}>
              <div style={{ marginBottom: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Showing <strong style={{ color: 'var(--text-color)' }}>{searchResults.length}</strong> of {allNocs.length} occupations
                {cecOnly && <span style={{ marginLeft: '8px', padding: '2px 8px', background: '#DCFCE7', color: '#16a34a', borderRadius: '12px', fontSize: '0.8rem' }}>CEC ✓</span>}
              </div>
              <div style={{ display: 'grid', gap: '6px', maxHeight: '400px', overflowY: 'auto', padding: '2px' }}>
                {searchResults.slice(0, 50).map(noc => (
                  <Link 
                    key={noc.code} 
                    to={`/noc-codes/${noc.code}`}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', background: 'white', borderRadius: '8px', 
                      border: '1px solid var(--border-color)', textDecoration: 'none', color: 'inherit',
                      transition: 'transform 0.15s, box-shadow 0.15s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.04)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: TEER_COLORS[noc.teer] || '#666', flexShrink: 0 }}>{noc.code}</span>
                      <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noc.title}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 6px', borderRadius: '5px', background: `${TEER_COLORS[noc.teer]}14`, color: TEER_COLORS[noc.teer] }}>TEER {noc.teer}</span>
                      {['0','1','2','3'].includes(noc.teer) && <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 5px', borderRadius: '5px', background: '#DCFCE7', color: '#16a34a' }}>CEC</span>}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
                    </div>
                  </Link>
                ))}
                {searchResults.length > 50 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '8px' }}>
                    Showing first 50 of {searchResults.length} results. Refine your search to see more.
                  </p>
                )}
                {searchResults.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    <p>No matching occupations found. Try a different search term or remove filters.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Browse by TEER Level */}
          <section className="page-section" style={{ paddingBottom: '0' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Browse by TEER Level</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Canada's NOC 2021 classifies every occupation into one of six TEER levels.
                Your TEER level directly determines Express Entry eligibility.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {TEER_CARDS.map(card => {
                const count = teerCounts[card.teer] || 0;
                const isExpanded = expandedTeers[card.teer] || false;
                const occupations = teerGroups[card.teer] || [];
                return (
                  <div key={card.teer} style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: 'white' }}>
                    <div style={{ background: card.gradient, padding: '16px 18px', color: 'white', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{card.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>TEER {card.teer}</div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.3 }}>{card.title}</div>
                      </div>
                      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>{count}</span>
                    </div>
                    <div style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span>🎓</span><span>{card.education}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.82rem' }}>
                        {card.eligible
                          ? <><span style={{ color: '#16a34a' }}>✓</span><span style={{ color: '#16a34a', fontWeight: 600 }}>Express Entry eligible</span></>
                          : <><span style={{ color: '#dc2626' }}>✗</span><span style={{ color: '#dc2626', fontWeight: 600 }}>Not eligible for Express Entry FSW</span></>
                        }
                      </div>
                      <button
                        onClick={() => setExpandedTeers(prev => ({ ...prev, [card.teer]: !prev[card.teer] }))}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', border: 'none', borderTop: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: TEER_COLORS[card.teer], fontWeight: 600 }}
                      >
                        <span>Browse occupations</span>
                        <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </button>
                      {isExpanded && (
                        <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                          {occupations.map(occ => (
                            <Link key={occ.code} to={`/noc-codes/${occ.code}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '0.8rem', textDecoration: 'none', color: 'var(--text-color)', borderRadius: '4px', transition: 'background 0.15s' }}
                              onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
                            >
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: TEER_COLORS[card.teer], fontSize: '0.75rem', flexShrink: 0 }}>{occ.code}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{occ.title}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Browse by Broad Occupational Category */}
          <section className="page-section" style={{ paddingBottom: '0' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Browse by Occupational Category</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                The first digit of a NOC code indicates its broad occupational category.
                Find your industry sector below.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {CATEGORY_CARDS.map(card => {
                const count = catCounts[card.cat] || 0;
                const isExpanded = expandedCats[card.cat] || false;
                const occupations = catGroups[card.cat] || [];
                // Count how many are CEC eligible
                const cecCount = occupations.filter(o => ['0','1','2','3'].includes(o.teer)).length;

                return (
                  <div key={card.cat} style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', background: 'white' }}>
                    <div style={{ background: card.gradient, padding: '16px 18px', color: 'white', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{card.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Category {card.cat}</div>
                        <div style={{ fontSize: '0.92rem', fontWeight: 600, lineHeight: 1.3 }}>{card.title}</div>
                      </div>
                      <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '10px', padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>{count}</span>
                    </div>
                    <div style={{ padding: '12px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span>📋</span><span>{count} occupations total</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', fontSize: '0.82rem' }}>
                        <span style={{ color: '#16a34a' }}>✓</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{cecCount} CEC-eligible</span>
                        {count - cecCount > 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>• {count - cecCount} not eligible</span>
                        )}
                      </div>
                      <button
                        onClick={() => setExpandedCats(prev => ({ ...prev, [card.cat]: !prev[card.cat] }))}
                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', border: 'none', borderTop: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', fontSize: '0.82rem', color: card.gradient.includes('#') ? card.gradient.split(',')[1]?.trim().split(')')[0] || '#3b82f6' : '#3b82f6', fontWeight: 600 }}
                      >
                        <span>Browse occupations</span>
                        <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                      </button>
                      {isExpanded && (
                        <div style={{ maxHeight: '250px', overflowY: 'auto', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                          {occupations.map(occ => (
                            <Link key={occ.code} to={`/noc-codes/${occ.code}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 4px', fontSize: '0.8rem', textDecoration: 'none', color: 'var(--text-color)', borderRadius: '4px', transition: 'background 0.15s' }}
                              onMouseOver={e => { e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseOut={e => { e.currentTarget.style.background = 'none'; }}
                            >
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: TEER_COLORS[occ.teer], fontSize: '0.75rem', flexShrink: 0 }}>{occ.code}</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{occ.title}</span>
                              {['0','1','2','3'].includes(occ.teer) && <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '1px 4px', borderRadius: '4px', background: '#DCFCE7', color: '#16a34a', flexShrink: 0 }}>CEC</span>}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CTA */}
          <section className="page-section">
            <div style={{ padding: '32px', background: 'linear-gradient(135deg, #EFF6FF, #F8FAFC)', borderRadius: '16px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '12px' }}>Not sure which NOC fits your duties?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
                Our AI analyzes your job responsibilities and matches them to the best NOC code automatically.
              </p>
              <Link to="/find-my-noc" className="btn btn-primary">
                🎯 Find My NOC Code
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};
