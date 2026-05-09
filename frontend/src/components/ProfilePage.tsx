/**
 * My Profile Page — PR Dashboard
 * 
 * Three-tier smart hub:
 * 1. Command Center (CRS score, status, programs, completion)
 * 2. Next Actions (prioritized task list)
 * 3. Smart Profile Sections (edit-in-place with contextual microcopy)
 */

import { type FC, useState } from 'react';
import { useUser, SignInButton } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import { useJourneyStore } from '../stores/journeyStore';
import type { ProfileState } from '../stores/journeyStore';
import { SEO } from './common/SEO';
import { COUNTRIES, EDUCATION_LEVELS, LANGUAGE_TESTS } from '../data/eligibilityRules';
import { ChevronDown, ChevronRight } from 'lucide-react';
import './ProfilePage.css';

// ── Helpers ──

const EDUCATION_LABELS: Record<string, string> = {};
EDUCATION_LEVELS.forEach(e => { EDUCATION_LABELS[e.value] = e.label; });
const CRS_EDU_LABELS: Record<string, string> = {
  'none': 'Less than secondary (high school)',
  'secondary': 'Secondary diploma (high school)',
  'one-year': 'One-year program',
  'two-year': 'Two-year program',
  'bachelors': "Bachelor's degree (3 or more years)",
  'two-or-more': 'Two or more certificates/degrees',
  'masters': "Master's degree or professional degree",
  'doctoral': 'Doctoral level (PhD)',
};
Object.assign(EDUCATION_LABELS, CRS_EDU_LABELS);

const LANG_TEST_LABELS: Record<string, string> = {};
LANGUAGE_TESTS.forEach(t => { LANG_TEST_LABELS[t.value] = t.label; });

const MARITAL_LABELS: Record<string, string> = {
  single: 'Single / Never married',
  married: 'Married',
  common_law: 'Common-law partner',
  divorced: 'Divorced / Separated',
  widowed: 'Widowed',
};

function formatBool(val: boolean | null | undefined): string {
  if (val === true) return 'Yes';
  if (val === false) return 'No';
  return '—';
}

// ── Next Actions Engine ──

interface ActionItem {
  priority: 'critical' | 'opportunity' | 'suggested';
  text: string;
  hint: string;
  icon: string;
  link: string;
}

function computeNextActions(
  profile: ProfileState,
  eligibility: any,
  noc: any,
  crs: any,
  documents: any[],
  isCrsStale: boolean
): ActionItem[] {
  const actions: ActionItem[] = [];
  const hasSpouse = (profile.maritalStatus === 'married' || profile.maritalStatus === 'common_law') && profile.spouseAccompanying;

  // Critical: Missing core journey steps
  if (!eligibility.completedAt)
    actions.push({ priority: 'critical', text: 'Complete your eligibility assessment', hint: 'Required to determine which Express Entry programs you qualify for', icon: '🚀', link: '/get-started' });
  if (!noc.code)
    actions.push({ priority: 'critical', text: 'Find your NOC code', hint: 'Your occupation code determines program eligibility and CRS scoring', icon: '🎯', link: '/find-my-noc' });
  if (crs.score == null)
    actions.push({ priority: 'critical', text: 'Calculate your CRS score', hint: 'Know exactly where you stand against recent draw cutoffs', icon: '📊', link: '/crs-calculator' });
  if (!profile.primaryOccupation)
    actions.push({ priority: 'critical', text: 'Set your primary occupation', hint: 'Required to match your NOC code for CRS scoring', icon: '💼', link: '/find-my-noc' });

  // Opportunity: Score improvements  
  if (isCrsStale)
    actions.push({ priority: 'opportunity', text: 'Your profile changed — recalculate CRS', hint: 'Your score may have changed since your last calculation', icon: '⚠️', link: '/crs-calculator' });
  if (hasSpouse && !profile.spouseLanguage)
    actions.push({ priority: 'opportunity', text: 'Add spouse language test for potential CRS boost', hint: 'Spouse language scores can add up to 20 CRS points', icon: '🗣️', link: '#spouse' });
  if (!profile.primaryLanguage)
    actions.push({ priority: 'critical', text: 'Add your language test scores', hint: 'Language is the single largest CRS factor — up to 160 points', icon: '🗣️', link: '#language' });
  if (profile.educationLevel == null)
    actions.push({ priority: 'critical', text: 'Set your education level', hint: 'Education affects both eligibility and CRS score', icon: '🎓', link: '#education' });

  // Suggested: Next steps
  if (documents.length === 0 && eligibility.completedAt)
    actions.push({ priority: 'suggested', text: 'Start your document checklist', hint: 'Track all required documents for your application', icon: '📋', link: '/documents' });
  if (crs.score != null && crs.score < 500)
    actions.push({ priority: 'suggested', text: 'Explore the CRS Point Simulator', hint: 'Find the fastest ways to increase your score', icon: '📈', link: '/crs-calculator' });

  return actions;
}

// ── CRS Status ──

function getCrsStatus(score: number | null): { label: string; className: string } | null {
  if (score == null) return null;
  if (score >= 500) return { label: '🟢 Strong', className: 'strong' };
  if (score >= 450) return { label: '🟡 Competitive', className: 'competitive' };
  return { label: '🔴 Needs Improvement', className: 'needs-improvement' };
}

// ── Profile Completion ──

function getCompletionScore(profile: ProfileState): number {
  const fields = [
    profile.age, profile.countryOfCitizenship, profile.countryOfResidence,
    profile.maritalStatus, profile.educationLevel, profile.hasEca,
    profile.primaryLanguage, profile.totalSkilledExperienceYears,
    profile.canadianExperienceYears, profile.primaryOccupation,
    profile.hasJobOffer, profile.hasProvincialNomination, profile.hasRelativeInCanada,
  ];
  const filled = fields.filter(f => f != null).length;
  return Math.round((filled / fields.length) * 100);
}

// ── Section Component ──

interface SectionProps {
  icon: string;
  title: string;
  subtitle: string;
  isComplete: boolean;
  children: React.ReactNode;
}

function ProfileSection({ icon, title, subtitle, isComplete, children }: SectionProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="profile-section">
      <div className="profile-section-header" onClick={() => setOpen(!open)}>
        <div className="profile-section-header-left">
          <div className="profile-section-icon">{icon}</div>
          <div>
            <div className="profile-section-title">{title}</div>
            <div className="profile-section-subtitle">{subtitle}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`profile-section-badge ${isComplete ? 'complete' : 'incomplete'}`}>
            {isComplete ? '✓ Complete' : 'Incomplete'}
          </span>
          <span className={`profile-section-chevron ${open ? 'open' : ''}`}>
            <ChevronDown size={18} />
          </span>
        </div>
      </div>
      <div className={`profile-section-body ${open ? 'open' : ''}`}>
        {children}
      </div>
    </div>
  );
}

// ── Field Display ──

function DisplayField({ label, value, hint }: { label: string; value: string | number | null | undefined; hint?: string }) {
  const display = value != null && value !== '' ? String(value) : null;
  return (
    <div className="profile-field">
      <div className="profile-field-label">{label}</div>
      <div className={`profile-field-value ${!display ? 'empty' : ''}`}>
        {display || 'Not set'}
      </div>
      {hint && <div className="profile-field-hint">{hint}</div>}
    </div>
  );
}

// ── Main Component ──

export const ProfilePage: FC = () => {
  const { isSignedIn, user } = useUser();
  const { profile, noc, crs, eligibility, documents, setProfile, profileUpdatedAt } = useJourneyStore();
  const navigate = useNavigate();

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<ProfileState>>({});

  const startEdit = (section: string) => { setDraft({ ...profile }); setEditingSection(section); };
  const cancelEdit = () => { setEditingSection(null); setDraft({}); };
  const saveEdit = () => { setProfile(draft); setEditingSection(null); setDraft({}); };
  const updateDraft = (key: keyof ProfileState, value: any) => { setDraft(prev => ({ ...prev, [key]: value })); };

  if (!isSignedIn) {
    return (
      <div>
        <SEO title="My Profile — Mentor Visa" description="View and edit your immigration profile." />
        <section className="page-hero">
          <div className="profile-auth-gate">
            <div className="profile-auth-gate-icon">👤</div>
            <h2>Sign In to Access Your Profile</h2>
            <p>Your profile keeps all your immigration details in one place — eligibility, NOC code, CRS score, and documents.</p>
            <SignInButton mode="modal"><button className="btn btn-primary btn-lg">Sign In to Continue</button></SignInButton>
          </div>
        </section>
      </div>
    );
  }

  // ── Computed values ──
  const personalComplete = profile.age != null && profile.countryOfCitizenship != null;
  const educationComplete = profile.educationLevel != null;
  const languageComplete = profile.primaryLanguage != null;
  const workComplete = profile.totalSkilledExperienceYears != null;
  const additionalComplete = profile.hasJobOffer != null;

  const docsDone = documents.filter(d => d.status === 'obtained').length;
  const docsTotal = documents.length;

  const toUtc = (s: string) => s.endsWith('Z') || s.includes('+') || s.includes('-', 11) ? s : s + 'Z';
  const isCrsStale = crs.score != null && profileUpdatedAt != null
    && (!crs.calculatedAt || new Date(toUtc(profileUpdatedAt)) > new Date(toUtc(crs.calculatedAt)));

  const completionScore = getCompletionScore(profile);
  const crsStatus = getCrsStatus(crs.score);
  const nextActions = computeNextActions(profile, eligibility, noc, crs, documents, isCrsStale);

  const programs = [
    { label: 'CEC', eligible: eligibility.cecEligible },
    { label: 'FSWP', eligible: eligibility.fswpEligible },
    { label: 'FSTP', eligible: eligibility.fstpEligible },
  ];

  return (
    <div>
      <SEO title="My Profile — Mentor Visa" description="Your PR Dashboard — track your immigration journey." />

      {/* ── Tier 1: Command Center Hero ── */}
      <section className="profile-hero">
        <div className="profile-hero-content">
          <div className="profile-hero-user">
            <div className="profile-hero-avatar">{user?.firstName?.[0]?.toUpperCase() || '👤'}</div>
            <div className="profile-hero-user-info">
              <h1>{user?.fullName || 'My Profile'}</h1>
              <p>{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>

          <div className="profile-command-grid">
            {/* CRS Score */}
            <Link to="/crs-calculator" className="profile-command-card clickable">
              <div className="profile-command-label">CRS Score</div>
              {crs.score != null ? (
                <>
                  <div className="profile-command-value">{crs.score}</div>
                  {crsStatus && <div className={`profile-status-badge ${crsStatus.className}`}>{crsStatus.label}</div>}
                </>
              ) : (
                <div className="profile-command-value empty">Not calculated →</div>
              )}
            </Link>

            {/* Eligibility */}
            <Link to="/get-started" className="profile-command-card clickable">
              <div className="profile-command-label">Eligibility</div>
              {eligibility.completedAt ? (
                <>
                  <div className="profile-command-value" style={{ fontSize: '1.3rem' }}>{eligibility.recommendedProgram || 'Assessed'}</div>
                  <div className="profile-program-chips">
                    {programs.map(p => (
                      <span key={p.label} className={`profile-program-chip ${p.eligible ? '' : 'inactive'}`}>
                        {p.label} {p.eligible ? '✓' : '✗'}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="profile-command-value empty">Not assessed →</div>
              )}
            </Link>

            {/* NOC Code */}
            <Link to="/find-my-noc" className="profile-command-card clickable">
              <div className="profile-command-label">NOC Code</div>
              {noc.code ? (
                <>
                  <div className="profile-command-value" style={{ fontSize: '1.3rem' }}>NOC {noc.code}</div>
                  <div className="profile-command-sub">{noc.title} · TEER {noc.teerCategory}</div>
                </>
              ) : (
                <div className="profile-command-value empty">Not found →</div>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Completion Bar ── */}
      <div className="profile-completion-section">
        <div className="profile-completion-inner">
          <div className="profile-completion-header">
            <span className="profile-completion-label">Profile Completion</span>
            <span className="profile-completion-percent">{completionScore}%</span>
          </div>
          <div className="profile-completion-track">
            <div className="profile-completion-fill" style={{ width: `${completionScore}%` }} />
          </div>
        </div>
      </div>

      <div className="profile-container">
        {/* CRS Recalculate Banner */}
        {isCrsStale && (
          <div className="profile-recalculate-banner">
            <div className="profile-recalculate-text">
              <div className="profile-recalculate-title">⚠️ Your profile has changed since your last CRS calculation</div>
              <div className="profile-recalculate-sub">Your score of {crs.score} points may no longer be accurate.</div>
            </div>
            <button className="profile-recalculate-btn" onClick={() => { sessionStorage.removeItem('crsCalculatorData'); navigate('/crs-calculator'); }}>
              Recalculate CRS →
            </button>
          </div>
        )}

        {/* ── Tier 2: Next Actions ── */}
        {nextActions.length > 0 ? (
          <div className="profile-actions-section">
            <div className="profile-actions-title">What Should You Do Next?</div>
            <div className="profile-actions-subtitle">Prioritized steps to strengthen your PR application</div>
            <div className="profile-actions-list">
              {nextActions.map((action, i) => (
                <Link key={i} to={action.link} className="profile-action-item">
                  <div className={`profile-action-icon ${action.priority}`}>{action.icon}</div>
                  <div className="profile-action-body">
                    <div className="profile-action-text">{action.text}</div>
                    <div className="profile-action-hint">{action.hint}</div>
                  </div>
                  <span className={`profile-action-priority ${action.priority}`}>
                    {action.priority === 'critical' ? 'Required' : action.priority === 'opportunity' ? 'Opportunity' : 'Suggested'}
                  </span>
                  <ChevronRight size={16} className="profile-action-arrow" />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="profile-actions-section">
            <div className="profile-actions-title">What Should You Do Next?</div>
            <div className="profile-actions-done">
              <span className="profile-actions-done-icon">🎉</span>
              <span className="profile-actions-done-text">Looking great! Your profile is complete and up to date.</span>
            </div>
          </div>
        )}

        {/* ── Snapshot Cards ── */}
        <div className="profile-snapshot-grid">
          <Link to="/documents" className="profile-snapshot-card">
            <div className="profile-snapshot-header">
              <span className="profile-snapshot-icon">📋</span>
              <span className="profile-snapshot-label">Documents</span>
            </div>
            {docsTotal > 0 ? (
              <>
                <div className="profile-snapshot-value">{docsDone} / {docsTotal}</div>
                <div className="profile-snapshot-sub">documents obtained</div>
              </>
            ) : (
              <div className="profile-snapshot-value empty">No checklist yet →</div>
            )}
          </Link>
          <Link to="/crs-calculator" className={`profile-snapshot-card ${isCrsStale ? 'stale' : ''}`}>
            <div className="profile-snapshot-header">
              <span className="profile-snapshot-icon">📊</span>
              <span className="profile-snapshot-label">CRS Details</span>
            </div>
            {crs.score != null ? (
              <>
                <div className="profile-snapshot-value">{crs.score} points</div>
                {isCrsStale ? (
                  <div className="profile-snapshot-stale">⚠️ Score may have changed</div>
                ) : (
                  <div className="profile-snapshot-sub">{crs.calculatedAt ? `Calculated ${new Date(crs.calculatedAt).toLocaleDateString()}` : ''}</div>
                )}
              </>
            ) : (
              <div className="profile-snapshot-value empty">Calculate your score →</div>
            )}
          </Link>
        </div>

        {/* ── Tier 3: Smart Profile Sections ── */}

        {/* Section 1: Personal Info */}
        <ProfileSection icon="👤" title="Personal Information" subtitle="Age, citizenship, residence, marital status" isComplete={personalComplete}>
          {editingSection === 'personal' ? (
            <>
              <div className="profile-fields-grid">
                <div className="profile-field">
                  <label className="profile-field-label">Age</label>
                  <select className="profile-select" value={draft.age ?? ''} onChange={e => updateDraft('age', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select age</option>
                    {Array.from({ length: 38 }, (_, i) => i + 18).map(a => (<option key={a} value={a}>{a}</option>))}
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Marital Status</label>
                  <select className="profile-select" value={draft.maritalStatus ?? ''} onChange={e => updateDraft('maritalStatus', e.target.value || null)}>
                    <option value="">Select</option>
                    {Object.entries(MARITAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Country of Citizenship</label>
                  <select className="profile-select" value={draft.countryOfCitizenship ?? ''} onChange={e => updateDraft('countryOfCitizenship', e.target.value || null)}>
                    <option value="">Select</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Country of Residence</label>
                  <select className="profile-select" value={draft.countryOfResidence ?? ''} onChange={e => updateDraft('countryOfResidence', e.target.value || null)}>
                    <option value="">Select</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {(draft.maritalStatus === 'married' || draft.maritalStatus === 'common_law') && (
                  <div className="profile-field">
                    <label className="profile-field-label">Spouse Accompanying?</label>
                    <select className="profile-select" value={draft.spouseAccompanying == null ? '' : draft.spouseAccompanying ? 'yes' : 'no'} onChange={e => updateDraft('spouseAccompanying', e.target.value === '' ? null : e.target.value === 'yes')}>
                      <option value="">Select</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="profile-section-actions">
                <button className="profile-save-btn" onClick={saveEdit}>Save Changes</button>
                <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-fields-grid">
                <DisplayField label="Age" value={profile.age} hint={profile.age != null ? (profile.age <= 29 ? '✓ Maximum age points (110/110)' : profile.age <= 35 ? 'Strong age bracket for CRS' : 'Age points decrease after 30 — act soon') : undefined} />
                <DisplayField label="Marital Status" value={profile.maritalStatus ? MARITAL_LABELS[profile.maritalStatus] : null} />
                <DisplayField label="Country of Citizenship" value={profile.countryOfCitizenship} />
                <DisplayField label="Country of Residence" value={profile.countryOfResidence} />
                {(profile.maritalStatus === 'married' || profile.maritalStatus === 'common_law') && (
                  <DisplayField label="Spouse Accompanying?" value={formatBool(profile.spouseAccompanying)} hint={profile.spouseAccompanying ? 'Spouse factors included in CRS calculation' : undefined} />
                )}
              </div>
              <div className="profile-section-actions">
                <button className="profile-edit-btn" onClick={() => startEdit('personal')}>✏️ Edit</button>
              </div>
            </>
          )}
        </ProfileSection>

        {/* Section 2: Education */}
        <ProfileSection icon="🎓" title="Education & Credentials" subtitle="Highest credential, Canadian education, ECA status" isComplete={educationComplete}>
          {editingSection === 'education' ? (
            <>
              <div className="profile-fields-grid">
                <div className="profile-field">
                  <label className="profile-field-label">Highest Education</label>
                  <select className="profile-select" value={draft.educationLevel ?? ''} onChange={e => updateDraft('educationLevel', e.target.value || null)}>
                    <option value="">Select</option>
                    {Object.entries(CRS_EDU_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Education in Canada?</label>
                  <select className="profile-select" value={draft.educationInCanada == null ? '' : draft.educationInCanada ? 'yes' : 'no'} onChange={e => updateDraft('educationInCanada', e.target.value === '' ? null : e.target.value === 'yes')}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Educational Credential Assessment (ECA)</label>
                  <select className="profile-select" value={draft.hasEca == null ? '' : draft.hasEca ? 'yes' : 'no'} onChange={e => updateDraft('hasEca', e.target.value === '' ? null : e.target.value === 'yes')}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div className="profile-section-actions">
                <button className="profile-save-btn" onClick={saveEdit}>Save Changes</button>
                <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-fields-grid">
                <DisplayField label="Highest Education" value={profile.educationLevel ? EDUCATION_LABELS[profile.educationLevel] : null} hint={profile.educationLevel ? undefined : 'Education level affects both eligibility and CRS score'} />
                <DisplayField label="Education in Canada?" value={formatBool(profile.educationInCanada)} hint={profile.educationInCanada ? '✓ Canadian education bonus (15-30 CRS points)' : undefined} />
                <DisplayField label="ECA" value={formatBool(profile.hasEca)} hint={!profile.hasEca ? 'Required for foreign credentials to count toward CRS' : undefined} />
              </div>
              <div className="profile-section-actions">
                <button className="profile-edit-btn" onClick={() => startEdit('education')}>✏️ Edit</button>
              </div>
            </>
          )}
        </ProfileSection>

        {/* Section 3: Language */}
        <ProfileSection icon="🗣️" title="Language Proficiency" subtitle="Test scores — the single largest CRS factor" isComplete={languageComplete}>
          {editingSection === 'language' ? (
            <>
              <div className="profile-fields-grid">
                <div className="profile-field full-width">
                  <label className="profile-field-label">Primary Language Test</label>
                  <select className="profile-select" value={draft.primaryLanguage?.test ?? ''} onChange={e => {
                    const test = e.target.value || null;
                    if (!test) { updateDraft('primaryLanguage', null); return; }
                    updateDraft('primaryLanguage', { test, speaking: draft.primaryLanguage?.speaking ?? 0, listening: draft.primaryLanguage?.listening ?? 0, reading: draft.primaryLanguage?.reading ?? 0, writing: draft.primaryLanguage?.writing ?? 0 });
                  }}>
                    <option value="">Select</option>
                    {LANGUAGE_TESTS.filter(t => t.value !== 'none').map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {draft.primaryLanguage?.test && (
                  <div className="profile-field full-width">
                    <label className="profile-field-label">Primary Scores</label>
                    <div className="profile-lang-scores">
                      {(['speaking', 'listening', 'reading', 'writing'] as const).map(skill => (
                        <div key={skill} className="profile-lang-score-item">
                          <span className="profile-lang-score-label">{skill}</span>
                          <input type="number" className="profile-input" step={draft.primaryLanguage?.test === 'ielts_general' ? '0.5' : '1'} min="0" value={draft.primaryLanguage?.[skill] || ''} onChange={e => updateDraft('primaryLanguage', { ...draft.primaryLanguage!, [skill]: parseFloat(e.target.value) || 0 })} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="profile-field full-width">
                  <label className="profile-field-label">Secondary Language Test</label>
                  <select className="profile-select" value={draft.secondaryLanguage?.test ?? ''} onChange={e => {
                    const test = e.target.value || null;
                    if (!test) { updateDraft('secondaryLanguage', null); return; }
                    updateDraft('secondaryLanguage', { test, speaking: draft.secondaryLanguage?.speaking ?? 0, listening: draft.secondaryLanguage?.listening ?? 0, reading: draft.secondaryLanguage?.reading ?? 0, writing: draft.secondaryLanguage?.writing ?? 0 });
                  }}>
                    <option value="">None</option>
                    {LANGUAGE_TESTS.filter(t => t.value !== 'none' && t.value !== draft.primaryLanguage?.test).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {draft.secondaryLanguage?.test && (
                  <div className="profile-field full-width">
                    <label className="profile-field-label">Secondary Scores</label>
                    <div className="profile-lang-scores">
                      {(['speaking', 'listening', 'reading', 'writing'] as const).map(skill => (
                        <div key={skill} className="profile-lang-score-item">
                          <span className="profile-lang-score-label">{skill}</span>
                          <input type="number" className="profile-input" step={draft.secondaryLanguage?.test === 'ielts_general' ? '0.5' : '1'} min="0" value={draft.secondaryLanguage?.[skill] || ''} onChange={e => updateDraft('secondaryLanguage', { ...draft.secondaryLanguage!, [skill]: parseFloat(e.target.value) || 0 })} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="profile-section-actions">
                <button className="profile-save-btn" onClick={saveEdit}>Save Changes</button>
                <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-fields-grid">
                <DisplayField label="Primary Test" value={profile.primaryLanguage?.test ? LANG_TEST_LABELS[profile.primaryLanguage.test] : null} hint={!profile.primaryLanguage ? 'Language is worth up to 160 CRS points — the biggest factor' : undefined} />
                {profile.primaryLanguage && (
                  <div className="profile-field">
                    <div className="profile-field-label">Primary Scores</div>
                    <div className="profile-field-value">
                      S: {profile.primaryLanguage.speaking} · L: {profile.primaryLanguage.listening} · R: {profile.primaryLanguage.reading} · W: {profile.primaryLanguage.writing}
                    </div>
                  </div>
                )}
                <DisplayField label="Secondary Test" value={profile.secondaryLanguage?.test ? LANG_TEST_LABELS[profile.secondaryLanguage.test] : null} hint={!profile.secondaryLanguage ? 'A second official language can add up to 24 bonus points' : undefined} />
                {profile.secondaryLanguage && (
                  <div className="profile-field">
                    <div className="profile-field-label">Secondary Scores</div>
                    <div className="profile-field-value">
                      S: {profile.secondaryLanguage.speaking} · L: {profile.secondaryLanguage.listening} · R: {profile.secondaryLanguage.reading} · W: {profile.secondaryLanguage.writing}
                    </div>
                  </div>
                )}
              </div>
              <div className="profile-section-actions">
                <button className="profile-edit-btn" onClick={() => startEdit('language')}>✏️ Edit</button>
              </div>
            </>
          )}
        </ProfileSection>

        {/* Section 4: Work Experience */}
        <ProfileSection icon="💼" title="Work Experience" subtitle="Skilled work history and occupation" isComplete={workComplete}>
          {editingSection === 'work' ? (
            <>
              <div className="profile-fields-grid">
                <div className="profile-field">
                  <label className="profile-field-label">Total Skilled Experience (years)</label>
                  <select className="profile-select" value={draft.totalSkilledExperienceYears ?? ''} onChange={e => updateDraft('totalSkilledExperienceYears', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select</option>
                    {Array.from({ length: 16 }, (_, i) => i).map(y => (<option key={y} value={y}>{y === 0 ? 'None' : `${y} year${y > 1 ? 's' : ''}`}</option>))}
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Canadian Experience (years)</label>
                  <select className="profile-select" value={draft.canadianExperienceYears ?? ''} onChange={e => updateDraft('canadianExperienceYears', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select</option>
                    {Array.from({ length: 11 }, (_, i) => i).map(y => (<option key={y} value={y}>{y === 0 ? 'None' : `${y} year${y > 1 ? 's' : ''}`}</option>))}
                  </select>
                </div>
                <div className="profile-field full-width">
                  <label className="profile-field-label">Primary Occupation</label>
                  <input type="text" className="profile-input" value={draft.primaryOccupation ?? ''} onChange={e => updateDraft('primaryOccupation', e.target.value || null)} placeholder="e.g. Software Developer" />
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Canadian Experience Recent? (within 3 years)</label>
                  <select className="profile-select" value={draft.canadianExperienceRecent == null ? '' : draft.canadianExperienceRecent ? 'yes' : 'no'} onChange={e => updateDraft('canadianExperienceRecent', e.target.value === '' ? null : e.target.value === 'yes')}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div className="profile-section-actions">
                <button className="profile-save-btn" onClick={saveEdit}>Save Changes</button>
                <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-fields-grid">
                <DisplayField label="Total Skilled Experience" value={profile.totalSkilledExperienceYears != null ? `${profile.totalSkilledExperienceYears} year${profile.totalSkilledExperienceYears !== 1 ? 's' : ''}` : null} />
                <DisplayField label="Canadian Experience" value={profile.canadianExperienceYears != null ? `${profile.canadianExperienceYears} year${profile.canadianExperienceYears !== 1 ? 's' : ''}` : null} hint={profile.canadianExperienceYears != null && profile.canadianExperienceYears >= 1 ? '✓ Meets CEC minimum requirement' : profile.canadianExperienceYears === 0 ? 'Canadian experience unlocks CEC eligibility and cross-factor bonuses' : undefined} />
                <DisplayField label="Primary Occupation" value={profile.primaryOccupation} hint={!profile.primaryOccupation ? 'Required to match your NOC code' : undefined} />
                <DisplayField label="Canadian Experience Recent?" value={formatBool(profile.canadianExperienceRecent)} />
              </div>
              <div className="profile-section-actions">
                <button className="profile-edit-btn" onClick={() => startEdit('work')}>✏️ Edit</button>
              </div>
            </>
          )}
        </ProfileSection>

        {/* Section 5: Additional Factors */}
        <ProfileSection icon="⚡" title="Additional Factors" subtitle="Job offer, provincial nomination, family ties" isComplete={additionalComplete}>
          {editingSection === 'additional' ? (
            <>
              <div className="profile-fields-grid">
                <div className="profile-field">
                  <label className="profile-field-label">Job Offer in Canada?</label>
                  <select className="profile-select" value={draft.hasJobOffer == null ? '' : draft.hasJobOffer ? 'yes' : 'no'} onChange={e => updateDraft('hasJobOffer', e.target.value === '' ? null : e.target.value === 'yes')}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Provincial Nomination?</label>
                  <select className="profile-select" value={draft.hasProvincialNomination == null ? '' : draft.hasProvincialNomination ? 'yes' : 'no'} onChange={e => updateDraft('hasProvincialNomination', e.target.value === '' ? null : e.target.value === 'yes')}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label className="profile-field-label">Relative in Canada?</label>
                  <select className="profile-select" value={draft.hasRelativeInCanada == null ? '' : draft.hasRelativeInCanada ? 'yes' : 'no'} onChange={e => updateDraft('hasRelativeInCanada', e.target.value === '' ? null : e.target.value === 'yes')}>
                    <option value="">Select</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div className="profile-section-actions">
                <button className="profile-save-btn" onClick={saveEdit}>Save Changes</button>
                <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-fields-grid">
                <DisplayField label="Job Offer" value={formatBool(profile.hasJobOffer)} />
                <DisplayField label="Provincial Nomination" value={formatBool(profile.hasProvincialNomination)} hint={!profile.hasProvincialNomination ? 'A PNP adds 600 CRS points — virtually guarantees an ITA' : '✓ +600 CRS points secured'} />
                <DisplayField label="Relative in Canada" value={formatBool(profile.hasRelativeInCanada)} hint={profile.hasRelativeInCanada ? '✓ +15 CRS bonus points' : undefined} />
              </div>
              <div className="profile-section-actions">
                <button className="profile-edit-btn" onClick={() => startEdit('additional')}>✏️ Edit</button>
              </div>
            </>
          )}
        </ProfileSection>

        {/* Section 6: Spouse (conditional) */}
        {(profile.maritalStatus === 'married' || profile.maritalStatus === 'common_law') && profile.spouseAccompanying && (
          <ProfileSection icon="💗" title="Spouse Details" subtitle="Education, language, and work — affects your CRS" isComplete={profile.spouseEducationLevel != null}>
            {editingSection === 'spouse' ? (
              <>
                <div className="profile-fields-grid">
                  <div className="profile-field">
                    <label className="profile-field-label">Spouse Education</label>
                    <select className="profile-select" value={draft.spouseEducationLevel ?? ''} onChange={e => updateDraft('spouseEducationLevel', e.target.value || null)}>
                      <option value="">Select</option>
                      {EDUCATION_LEVELS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </div>
                  <div className="profile-field">
                    <label className="profile-field-label">Spouse Canadian Experience (years)</label>
                    <select className="profile-select" value={draft.spouseCanadianExperienceYears ?? ''} onChange={e => updateDraft('spouseCanadianExperienceYears', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Select</option>
                      {Array.from({ length: 11 }, (_, i) => i).map(y => (<option key={y} value={y}>{y === 0 ? 'None' : `${y} year${y > 1 ? 's' : ''}`}</option>))}
                    </select>
                  </div>
                  <div className="profile-field full-width">
                    <label className="profile-field-label">Spouse Language Test</label>
                    <select className="profile-select" value={draft.spouseLanguage?.test ?? ''} onChange={e => {
                      const test = e.target.value || null;
                      if (!test) { updateDraft('spouseLanguage', null); return; }
                      updateDraft('spouseLanguage', { test, speaking: draft.spouseLanguage?.speaking ?? 0, listening: draft.spouseLanguage?.listening ?? 0, reading: draft.spouseLanguage?.reading ?? 0, writing: draft.spouseLanguage?.writing ?? 0 });
                    }}>
                      <option value="">None</option>
                      {LANGUAGE_TESTS.filter(t => t.value !== 'none').map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {draft.spouseLanguage?.test && (
                    <div className="profile-field full-width">
                      <label className="profile-field-label">Spouse Language Scores</label>
                      <div className="profile-lang-scores">
                        {(['speaking', 'listening', 'reading', 'writing'] as const).map(skill => (
                          <div key={skill} className="profile-lang-score-item">
                            <span className="profile-lang-score-label">{skill}</span>
                            <input type="number" className="profile-input" min="0" value={draft.spouseLanguage?.[skill] || ''} onChange={e => updateDraft('spouseLanguage', { ...draft.spouseLanguage!, [skill]: parseFloat(e.target.value) || 0 })} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="profile-section-actions">
                  <button className="profile-save-btn" onClick={saveEdit}>Save Changes</button>
                  <button className="profile-cancel-btn" onClick={cancelEdit}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="profile-fields-grid">
                  <DisplayField label="Spouse Education" value={profile.spouseEducationLevel ? EDUCATION_LABELS[profile.spouseEducationLevel] : null} />
                  <DisplayField label="Spouse Canadian Experience" value={profile.spouseCanadianExperienceYears != null ? `${profile.spouseCanadianExperienceYears} year${profile.spouseCanadianExperienceYears !== 1 ? 's' : ''}` : null} />
                  <DisplayField label="Spouse Language Test" value={profile.spouseLanguage?.test ? LANG_TEST_LABELS[profile.spouseLanguage.test] : null} hint={!profile.spouseLanguage ? 'Spouse language scores can add up to 20 CRS points' : undefined} />
                  {profile.spouseLanguage && (
                    <div className="profile-field">
                      <div className="profile-field-label">Spouse Scores</div>
                      <div className="profile-field-value">
                        S: {profile.spouseLanguage.speaking} · L: {profile.spouseLanguage.listening} · R: {profile.spouseLanguage.reading} · W: {profile.spouseLanguage.writing}
                      </div>
                    </div>
                  )}
                </div>
                <div className="profile-section-actions">
                  <button className="profile-edit-btn" onClick={() => startEdit('spouse')}>✏️ Edit</button>
                </div>
              </>
            )}
          </ProfileSection>
        )}

      </div>
    </div>
  );
};
