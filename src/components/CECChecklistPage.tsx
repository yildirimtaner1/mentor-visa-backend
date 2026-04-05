import { type FC, useState, useEffect } from 'react';

interface CECChecklistPageProps {
  onNavigate: (page: string) => void;
}

interface ChecklistItem {
  id: string;
  text: string;
  hint?: string;
  optional?: boolean;
}

interface ChecklistCategory {
  id: string;
  icon: string;
  title: string;
  items: ChecklistItem[];
}

const CHECKLIST_DATA: ChecklistCategory[] = [
  {
    id: 'work',
    icon: '💼',
    title: 'Work Experience',
    items: [
      { id: 'work-1', text: 'I have at least 1 year (1,560 hours) of skilled Canadian work experience', hint: 'Must be within the last 3 years, paid, and in TEER 0/1/2/3' },
      { id: 'work-2', text: 'My work experience was gained with valid work authorization' },
      { id: 'work-3', text: 'My occupation is classified under TEER 0, 1, 2, or 3 in NOC 2021' },
      { id: 'work-4', text: 'I know my 5-digit NOC code', hint: 'Use our Find My NOC tool if you\'re unsure' },
    ]
  },
  {
    id: 'language',
    icon: '🗣️',
    title: 'Language Test',
    items: [
      { id: 'lang-1', text: 'I have taken an approved English test (IELTS General Training or CELPIP-General)', hint: 'Or French: TEF Canada or TCF Canada' },
      { id: 'lang-2', text: 'My test results are less than 2 years old' },
      { id: 'lang-3', text: 'TEER 0/1: I meet CLB 7 in all four abilities (or higher)', hint: 'IELTS: 6.0 in each band' },
      { id: 'lang-4', text: 'TEER 2/3: I meet CLB 5 in all four abilities (or higher)', hint: 'IELTS: 5.0 in each band' },
    ]
  },
  {
    id: 'education',
    icon: '🎓',
    title: 'Education (Crucial for CRS Points)',
    items: [
      { id: 'edu-1', text: 'I have my official degree/diploma certificates for all post-secondary education' },
      { id: 'edu-2', text: 'I have official transcripts for all my post-secondary education' },
      { id: 'edu-3', text: 'For foreign degrees: I have a valid Educational Credential Assessment (ECA) report', hint: 'E.g., through WES. Must be less than 5 years old.' },
      { id: 'edu-4', text: 'For Canadian degrees: I have proof of graduation from a Designated Learning Institution (DLI)', optional: true },
    ]
  },
  {
    id: 'documents',
    icon: '📂',
    title: 'Employment Documents',
    items: [
      { id: 'doc-1', text: 'I have a reference letter from each employer (covering 1+ year total)' },
      { id: 'doc-2', text: 'Reference letter(s) include: my name, job title, and dates of employment' },
      { id: 'doc-3', text: 'Reference letter(s) include: hours per week, salary, and a detailed list of main duties' },
      { id: 'doc-4', text: 'I have audited my letter(s) using the Mentor Visa AI Auditor', hint: 'Catches NOC mismatches and missing IRCC requirements', optional: true },
      { id: 'doc-5', text: 'I have my T4 tax information slips for the period of employment' },
      { id: 'doc-6', text: 'I have Notices of Assessment (NOA) from the CRA', hint: 'Provides strong proof of Canadian earnings' },
      { id: 'doc-7', text: 'I have payslips/pay stubs covering the period of my experience' },
      { id: 'doc-8', text: 'I have bank statements showing payroll deposits', hint: 'Cross-reference with payslips for bulletproof evidence' },
      { id: 'doc-9', text: 'I have verified my exact 5-digit NOC code matches my documents', hint: 'Crucial: IRCC officers scrutinize NOC code alignment' },
      { id: 'doc-10', text: 'I have a Copy of my Employment Contract(s)', optional: true },
    ]
  },
  {
    id: 'identity',
    icon: '🛂',
    title: 'Identity & Travel Documents',
    items: [
      { id: 'id-1', text: 'I have a valid passport (not expiring within 6 months)' },
      { id: 'id-2', text: 'I have digital copies of my passport bio page' },
      { id: 'id-3', text: 'I have passport-sized photos meeting IRCC specifications' },
    ]
  },
  {
    id: 'police',
    icon: '🔍',
    title: 'Police & Medical',
    items: [
      { id: 'police-1', text: 'I have obtained police clearance certificates', hint: 'From every country I\'ve lived in for 6+ months since age 18' },
      { id: 'police-2', text: 'I have completed my IRCC medical exam', hint: 'Must be done by a designated panel physician' },
    ]
  },
  {
    id: 'profile',
    icon: '💻',
    title: 'Express Entry Profile',
    items: [
      { id: 'ee-1', text: 'I have created my Express Entry online profile' },
      { id: 'ee-3', text: 'I have received my CRS score' },
      { id: 'ee-4', text: 'I have checked recent draw cutoff scores to gauge my chances', optional: true },
    ]
  },
  {
    id: 'optional',
    icon: '⭐',
    title: 'Optional (Bonus Points)',
    items: [
      { id: 'opt-1', text: 'I have applied for a Provincial Nominee Program (PNP)', hint: '+600 CRS points — virtually guarantees an ITA', optional: true },
      { id: 'opt-2', text: 'I have a valid LMIA-backed job offer', hint: '+50 or +200 CRS points depending on NOC', optional: true },
      { id: 'opt-3', text: 'I have taken a French language test for bonus points', hint: 'Up to +50 CRS points for bilingual candidates', optional: true },
      { id: 'opt-4', text: 'I have completed a Canadian post-secondary credential', hint: '+15 to +30 CRS points', optional: true },
    ]
  }
];

const STORAGE_KEY = 'mentorVisa_checklist';

export const CECChecklistPage: FC<CECChecklistPageProps> = ({ onNavigate }) => {
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  }, [checked]);

  const toggle = (id: string) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const allItems = CHECKLIST_DATA.flatMap(c => c.items);
  const requiredItems = allItems.filter(i => !i.optional);
  const checkedRequiredCount = requiredItems.filter(i => checked[i.id]).length;
  const progress = requiredItems.length > 0 ? Math.round((checkedRequiredCount / requiredItems.length) * 100) : 0;

  return (
    <div>
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">✅ Interactive Tracker</div>
          <h1>CEC Application<br /><span className="hero-highlight">Checklist</span></h1>
          <p>Track every document and requirement for your Canadian Experience Class application. Your progress is saved automatically.</p>
        </div>
      </section>

      <div className="page-container">
        <section className="page-section">
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            {/* Progress */}
            <div className="progress-bar-container">
              <div className="progress-bar-label">
                <span>Application Readiness</span>
                <span style={{ color: progress === 100 ? '#059669' : 'var(--primary-color)', fontWeight: 800, fontSize: '1.1rem' }}>
                  {progress}%
                </span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                  <span>{checkedRequiredCount} of {requiredItems.length} required items completed</span>
                  {showConfirmReset ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 500 }}>Clear all data?</span>
                      <button onClick={() => { setChecked({}); setShowConfirmReset(false); }} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>Yes</button>
                      <button onClick={() => setShowConfirmReset(false)} style={{ background: '#e2e8f0', color: 'var(--text-main)', border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowConfirmReset(true)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: 'var(--text-muted)', 
                        fontSize: '0.85rem', 
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Clear All
                    </button>
                  )}
                </div>
            </div>

            {/* Checklists */}
            {CHECKLIST_DATA.map(category => (
              <div key={category.id} className="checklist-category">
                <div className="checklist-category-header">
                  <span className="checklist-category-icon">{category.icon}</span>
                  <span className="checklist-category-title">{category.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {category.items.filter(i => checked[i.id]).length}/{category.items.length}
                  </span>
                </div>
                {category.items.map(item => (
                  <label key={item.id} className={`checklist-item ${checked[item.id] ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={() => toggle(item.id)}
                    />
                    <div>
                      <div className="checklist-item-text">{item.text}</div>
                      {item.hint && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                          {item.hint}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            ))}

            {/* CTA */}
            <div style={{ textAlign: 'center', marginTop: '40px', padding: '32px', background: 'linear-gradient(135deg, #EFF6FF, #F8FAFC)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ marginBottom: '12px' }}>Need help with your employment letters?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>
                Our AI auditor checks your letter against all 9 IRCC requirements and 516 NOC codes.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => onNavigate('audit')}>
                  📄 Audit Employment Letter
                </button>
                <button className="btn btn-outline" onClick={() => onNavigate('noc-finder')}>
                  🎯 Find My NOC Code
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
