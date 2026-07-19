import { type FC, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { SEO } from './common/SEO';
import { fetchNocDuties, analyzeDuty, generateLetter, createCheckoutSession, fetchUserCredits } from '../services/api';
import { CheckCircle2, X } from 'lucide-react';
import './common/PaywallGate.css';
import './PricingPage.css';

function Feature({ 
  children, 
  included = false, 
  highlight = false 
}: { 
  children: React.ReactNode; 
  included?: boolean;
  highlight?: boolean;
}) {
  return (
    <li className={`pricing-feature ${highlight ? 'highlight' : ''}`}>
      {included ? (
        <CheckCircle2 size={16} className="feature-check" />
      ) : (
        <X size={16} className="feature-x" />
      )}
      <span>{children}</span>
    </li>
  );
}

// ── Types ──

interface NOCDutyItem {
  duty_text: string;
  index: number;
}

interface EmploymentDetails {
  applicant_name: string;
  company_name: string;
  company_address: string;
  job_title: string;
  start_date: string;
  end_date: string;
  hours_per_week: string;
  employment_type: string;
  salary_amount: string;
  salary_currency: string;
  salary_period: string;
  work_city: string;
  work_country: string;
  supervisor_name: string;
  supervisor_title: string;
  supervisor_contact: string;
}

interface DutyAnalysis {
  alignment: 'strong' | 'partial' | 'weak' | 'none';
  matched_noc_duty: string;
  match_confidence: number;
  feedback: string;
  coaching_questions: string[];
  ircc_ready: boolean;
}

interface ApprovedDuty {
  text: string;
  analysis: DutyAnalysis | null;
}

const STORAGE_KEY = 'letterBuilderData';

const INITIAL_DETAILS: EmploymentDetails = {
  applicant_name: '', company_name: '', company_address: '', job_title: '',
  start_date: '', end_date: '', hours_per_week: '', employment_type: 'Full-time',
  salary_amount: '', salary_currency: 'CAD', salary_period: 'annually',
  work_city: '', work_country: 'Canada',
  supervisor_name: '', supervisor_title: '', supervisor_contact: '',
};

const STEPS = [
  { label: 'Employment Info', icon: '📋' },
  { label: 'NOC Selection', icon: '🎯' },
  { label: 'Duty Workshop', icon: '🔨' },
  { label: 'Review & Download', icon: '📄' },
];

const FREE_DUTY_LIMIT = 2;

// Schema.org structured data
const builderSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa Interactive Employment Letter Builder",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": { "@type": "Offer", "price": "14.90", "priceCurrency": "CAD" },
  "description": "AI-guided tool that helps you write an IRCC-compliant employment letter for Express Entry, with real-time NOC duty alignment coaching."
});

export const LetterBuilderPage: FC = () => {
  const { isSignedIn, getToken } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [details, setDetails] = useState<EmploymentDetails>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved).details || INITIAL_DETAILS; } catch { /* ignore */ }
    }
    return INITIAL_DETAILS;
  });

  // NOC state
  const [nocCode, setNocCode] = useState(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) { try { return JSON.parse(saved).nocCode || ''; } catch { /* ignore */ } }
    return '';
  });
  const [nocTitle, setNocTitle] = useState('');
  const [nocDuties, setNocDuties] = useState<NOCDutyItem[]>([]);
  const [nocSearch, setNocSearch] = useState('');
  const [nocError, setNocError] = useState('');
  const [nocLoading, setNocLoading] = useState(false);

  // Duty workshop state
  const [duties, setDuties] = useState<ApprovedDuty[]>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) { try { return JSON.parse(saved).duties || []; } catch { /* ignore */ } }
    return [];
  });
  const [currentDutyText, setCurrentDutyText] = useState('');
  const [analyzingDuty, setAnalyzingDuty] = useState(false);
  const [dutyError, setDutyError] = useState('');

  // Payment state
  const [isPaid, setIsPaid] = useState(false);
  const [_credits, setCredits] = useState(0);
  const [userTier, setUserTier] = useState<string>('free');
  const [_checkingCredits, setCheckingCredits] = useState(false);

  // Letter generation state
  const [letterResult, setLetterResult] = useState<any>(null);
  const [generatingLetter, setGeneratingLetter] = useState(false);
  const [letterError, setLetterError] = useState('');
  const [copied, setCopied] = useState(false);

  // Form validation
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const dutyInputRef = useRef<HTMLTextAreaElement>(null);

  // Persist state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      details, nocCode, duties, isPaid, currentStep,
    }));
  }, [details, nocCode, duties, isPaid, currentStep]);

  const checkCreditsAsync = useCallback(async () => {
    if (!isSignedIn) return;
    setCheckingCredits(true);
    try {
      const token = await getToken();
      if (token) {
        const data = await fetchUserCredits(token);
        setCredits(data.letter_builder_credits || 0);
        setUserTier(data.subscription_tier || 'free');
        // Execute tier users get unlimited Letter Builder access
        if (data.subscription_tier === 'complete' || data.letter_builder_credits > 0) setIsPaid(true);
      }
    } catch { /* ignore */ }
    setCheckingCredits(false);
  }, [isSignedIn, getToken]);

  // Check credits on sign-in
  useEffect(() => {
    if (isSignedIn) {
      checkCreditsAsync();
    }
  }, [isSignedIn, checkCreditsAsync]);

  // Check for payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
      setIsPaid(true);
      checkCreditsAsync();
      const url = new URL(window.location.href);
      url.searchParams.delete('payment_success');
      window.history.replaceState({}, '', url);
    }
  }, [checkCreditsAsync]);

  // ── Step 1: Validation ──
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!details.applicant_name.trim()) errors.applicant_name = 'Required';
    if (!details.company_name.trim()) errors.company_name = 'Required';
    if (!details.company_address.trim()) errors.company_address = 'Required';
    if (!details.job_title.trim()) errors.job_title = 'Required';
    if (!details.start_date.trim()) errors.start_date = 'Required';
    if (!details.hours_per_week.trim()) errors.hours_per_week = 'Required';
    if (!details.salary_amount.trim()) errors.salary_amount = 'Required';
    if (!details.work_city.trim()) errors.work_city = 'Required';
    if (!details.supervisor_name.trim()) errors.supervisor_name = 'Required';
    if (!details.supervisor_title.trim()) errors.supervisor_title = 'Required';
    if (!details.supervisor_contact.trim()) errors.supervisor_contact = 'Required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Step 2: Load NOC duties ──
  const loadNocDuties = async (code: string) => {
    setNocError('');
    setNocLoading(true);
    try {
      const data = await fetchNocDuties(code);
      setNocCode(code);
      setNocTitle(data.noc_title);
      setNocDuties(data.duties);
      setNocSearch(code);
    } catch (e) {
      setNocError(e instanceof Error ? e.message : 'NOC code not found');
    }
    setNocLoading(false);
  };

  // ── Step 3: Analyze a duty ──
  const handleAnalyzeDuty = async () => {
    if (!currentDutyText.trim()) return;
    setDutyError('');
    setAnalyzingDuty(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const analysis = await analyzeDuty(currentDutyText.trim(), nocCode, token);
      const newDuty: ApprovedDuty = { text: currentDutyText.trim(), analysis };
      setDuties(prev => [...prev, newDuty]);
      setCurrentDutyText('');
      dutyInputRef.current?.focus();
    } catch (e) {
      setDutyError(e instanceof Error ? e.message : 'Analysis failed');
    }
    setAnalyzingDuty(false);
  };

  const removeDuty = (index: number) => {
    setDuties(prev => prev.filter((_, i) => i !== index));
  };

  // Coverage calculation
  const coveredDuties = new Set(
    duties.filter(d => d.analysis && ['strong', 'partial'].includes(d.analysis.alignment))
      .map(d => d.analysis!.matched_noc_duty)
  );
  const coverageCount = coveredDuties.size;
  const totalNocDuties = nocDuties.length;
  const coveragePercent = totalNocDuties > 0 ? Math.round((coverageCount / totalNocDuties) * 100) : 0;

  // Payment gate check
  const needsPayment = duties.length >= FREE_DUTY_LIMIT && !isPaid;

  // ── Step 4: Generate letter ──
  const handleGenerateLetter = async () => {
    setLetterError('');
    setGeneratingLetter(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      const result = await generateLetter(
        details as unknown as Record<string, string>,
        nocCode, nocTitle,
        duties.map(d => ({
          text: d.text,
          alignment: d.analysis?.alignment || 'none',
          matched_noc_duty: d.analysis?.matched_noc_duty || '',
        })),
        token
      );
      setLetterResult(result);
    } catch (e) {
      setLetterError(e instanceof Error ? e.message : 'Generation failed');
    }
    setGeneratingLetter(false);
  };

  const handleCopyLetter = () => {
    if (letterResult?.letter_full_text) {
      navigator.clipboard.writeText(letterResult.letter_full_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePurchase = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await createCheckoutSession('letter_builder', token, '/build-employment-letter');
      if (result?.session_url) window.location.href = result.session_url;
    } catch (e) {
      setDutyError(e instanceof Error ? e.message : 'Payment failed');
    }
  };

  // ── Helper: alignment badge ──
  const getAlignmentBadge = (alignment: string) => {
    switch (alignment) {
      case 'strong': return { label: 'Strong', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', icon: '✅' };
      case 'partial': return { label: 'Partial', bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: '⚠️' };
      case 'weak': return { label: 'Weak', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: '⚠️' };
      default: return { label: 'No Match', bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0', icon: '❌' };
    }
  };

  // ── Helper: form field ──
  const renderField = (
    key: keyof EmploymentDetails, label: string,
    opts: { type?: string; placeholder?: string; half?: boolean; options?: string[] } = {}
  ) => (
    <div className="form-group" style={opts.half ? { flex: '1 1 48%', minWidth: '200px' } : {}}>
      <label className="form-label">{label} {formErrors[key] && <span style={{ color: '#DC2626', fontSize: '0.8rem' }}>— {formErrors[key]}</span>}</label>
      {opts.options ? (
        <select className="form-select" value={details[key]} onChange={e => setDetails(prev => ({ ...prev, [key]: e.target.value }))}>
          {opts.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          className="form-input"
          type={opts.type || 'text'}
          placeholder={opts.placeholder || ''}
          value={details[key]}
          onChange={e => setDetails(prev => ({ ...prev, [key]: e.target.value }))}
          style={formErrors[key] ? { borderColor: '#DC2626' } : {}}
        />
      )}
    </div>
  );

  // ── Render ──
  if (!isSignedIn) {
    return (
      <div>
        <SEO title="Interactive Employment Letter Builder | Mentor Visa" description="Build an IRCC-compliant employment letter with AI-guided duty alignment coaching. Step-by-step interactive builder for Express Entry." canonical="/build-employment-letter" schema={builderSchema} />
        <section className="page-hero">
          <div className="page-hero-content">
            <div className="page-hero-badge">🔨 Interactive Letter Builder</div>
            <h1>Write an Employment Letter <br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>IRCC Will Accept</span></h1>
            <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>A single mismatched duty can cause an Express Entry rejection. Build your letter with real-time AI coaching that ensures your experience aligns perfectly with the official NOC requirements.</p>
            <SignInButton mode="modal" fallbackRedirectUrl="/build-employment-letter">
              <button className="btn btn-primary btn-lg" style={{ marginBottom: '12px' }}>
                Start Building Now
              </button>
            </SignInButton>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🤖 <span style={{ color: 'var(--primary-light)' }}>Live AI Coaching</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🎯 Exact NOC Match</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✅ IRCC-Ready Format</span>
            </div>
          </div>
        </section>
        <div className="page-container">
          <div style={{ maxWidth: '500px', margin: '40px auto', textAlign: 'center' }}>
            <div className="info-card" style={{ padding: '40px 32px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔒</div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>Sign In to Get Started</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                The Interactive Letter Builder requires a signed-in account to save your progress and generate your letter.
              </p>
              <SignInButton mode="modal" fallbackRedirectUrl="/build-employment-letter">
                <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>Sign In to Start Building</button>
              </SignInButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SEO title="Interactive Employment Letter Builder | Mentor Visa" description="Build an IRCC-compliant employment letter with AI-guided duty alignment coaching." canonical="/build-employment-letter" schema={builderSchema} />
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🔨 Interactive Letter Builder</div>
          <h1>Write an Employment Letter <br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>IRCC Will Accept</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>A single mismatched duty can cause an Express Entry rejection. Build your letter with real-time AI coaching that ensures your experience aligns perfectly with the official NOC requirements.</p>
          <button className="btn btn-primary btn-lg" onClick={() => document.querySelector('.page-container')?.scrollIntoView({ behavior: 'smooth' })} style={{ marginBottom: '12px' }}>
            Start Building Now
          </button>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🤖 <span style={{ color: 'var(--primary-light)' }}>Live AI Coaching</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🎯 Exact NOC Match</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>✅ IRCC-Ready Format</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <div className="crs-wizard">
          {/* Sidebar */}
          <div className="crs-sidebar">
            <div style={{ padding: '8px 16px', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Progress</div>
            </div>
            {STEPS.map((step, i) => (
              <div
                key={i}
                className={`crs-sidebar-item ${currentStep === i + 1 ? 'active' : ''} ${currentStep > i + 1 ? 'completed' : ''}`}
                onClick={() => { if (i + 1 < currentStep) setCurrentStep(i + 1); }}
                style={{ cursor: i + 1 < currentStep ? 'pointer' : 'default' }}
              >
                <span className="crs-item-icon">{step.icon}</span>
                <span>{step.label}</span>
                <span className="crs-item-status">{currentStep > i + 1 ? '✓' : ''}</span>
              </div>
            ))}

            {nocCode && (
              <div style={{ marginTop: '24px', padding: '16px', background: '#F0FDF4', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#065F46', fontWeight: 600, marginBottom: '4px' }}>Target NOC</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>NOC {nocCode}</div>
                <div style={{ fontSize: '0.8rem', color: '#047857' }}>{nocTitle}</div>
              </div>
            )}

            {currentStep >= 3 && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>Duty Coverage</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, color: coveragePercent >= 60 ? '#059669' : '#D97706' }}>{coveragePercent}%</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({coverageCount}/{totalNocDuties})</span>
                </div>
                <div style={{ height: '6px', background: '#E2E8F0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${coveragePercent}%`, background: coveragePercent >= 60 ? '#059669' : '#D97706', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>{duties.length} duties added</div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="crs-main">
            {/* ════════════════ STEP 1: EMPLOYMENT INFO ════════════════ */}
            {currentStep === 1 && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>Employment Information</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Enter the details exactly as they should appear on the letter.</p>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>👤 Applicant</h3>
                {renderField('applicant_name', 'Full Legal Name', { placeholder: 'e.g., John Michael Smith' })}

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>🏢 Company</h3>
                {renderField('company_name', 'Company Legal Name', { placeholder: 'e.g., Acme Technologies Inc.' })}
                {renderField('company_address', 'Company Full Address', { placeholder: 'e.g., 123 Bay Street, Toronto, ON M5H 2T6' })}

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>💼 Position Details</h3>
                {renderField('job_title', 'Job Title', { placeholder: 'e.g., Software Developer' })}
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {renderField('start_date', 'Start Date', { placeholder: 'e.g., January 15, 2022', half: true })}
                  {renderField('end_date', 'End Date', { placeholder: 'Leave empty if ongoing', half: true })}
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {renderField('hours_per_week', 'Hours per Week', { placeholder: 'e.g., 40', half: true })}
                  {renderField('employment_type', 'Employment Type', { options: ['Full-time', 'Part-time'], half: true })}
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>💰 Compensation</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {renderField('salary_amount', 'Salary Amount', { placeholder: 'e.g., 85,000', half: true })}
                  {renderField('salary_currency', 'Currency', { options: ['CAD', 'USD', 'EUR', 'GBP', 'INR', 'Other'], half: true })}
                </div>
                {renderField('salary_period', 'Pay Period', { options: ['annually', 'monthly', 'biweekly', 'weekly', 'hourly'] })}

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>📍 Work Location</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {renderField('work_city', 'City', { placeholder: 'e.g., Toronto', half: true })}
                  {renderField('work_country', 'Country', { placeholder: 'e.g., Canada', half: true })}
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>✍️ Supervisor / Signatory</h3>
                {renderField('supervisor_name', 'Supervisor / HR Name', { placeholder: 'e.g., Jane Doe' })}
                {renderField('supervisor_title', 'Their Title', { placeholder: 'e.g., Director of Engineering' })}
                {renderField('supervisor_contact', 'Contact (Email or Phone)', { placeholder: 'e.g., jane.doe@acme.com or +1-416-555-0100' })}

                <div className="crs-nav-buttons">
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-lg" onClick={() => { if (validateStep1()) setCurrentStep(2); }}>
                    Continue to NOC Selection →
                  </button>
                </div>
              </div>
            )}

            {/* ════════════════ STEP 2: NOC SELECTION ════════════════ */}
            {currentStep === 2 && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>Select Your NOC Code</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Enter the 5-digit NOC 2021 code for this position. This determines which official duties your letter will be aligned against.</p>

                <div className="form-group">
                  <label className="form-label">NOC Code</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="e.g., 21232"
                      value={nocSearch}
                      onChange={e => setNocSearch(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      maxLength={5}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => loadNocDuties(nocSearch)}
                      disabled={nocSearch.length !== 5 || nocLoading}
                    >
                      {nocLoading ? 'Loading...' : 'Look Up'}
                    </button>
                  </div>
                  {nocError && <div style={{ color: '#DC2626', fontSize: '0.85rem', marginTop: '8px' }}>⚠️ {nocError}</div>}
                </div>

                <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span>💡</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Don't know your NOC code?</span>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                    Use our free <a href="/find-my-noc" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>NOC Finder tool</a> to match your job duties to the correct NOC code. Come back here once you have it.
                  </p>
                </div>

                {nocDuties.length > 0 && (
                  <div style={{ marginTop: '32px' }}>
                    <div style={{ padding: '20px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1.3rem' }}>✅</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>NOC {nocCode} — {nocTitle}</div>
                          <div style={{ fontSize: '0.8rem', color: '#047857' }}>{nocDuties.length} official duties loaded</div>
                        </div>
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>Official Main Duties for This NOC:</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {nocDuties.map((d, i) => (
                        <div key={i} style={{ padding: '10px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-muted)', marginRight: '8px' }}>{i + 1}.</span>
                          {d.duty_text}
                        </div>
                      ))}
                    </div>

                    <div className="crs-nav-buttons">
                      <button className="btn btn-outline" onClick={() => setCurrentStep(1)}>← Back</button>
                      <div style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-lg" onClick={() => setCurrentStep(3)}>
                        Start Duty Workshop →
                      </button>
                    </div>
                  </div>
                )}

                {!nocDuties.length && (
                  <div className="crs-nav-buttons">
                    <button className="btn btn-outline" onClick={() => setCurrentStep(1)}>← Back</button>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════ STEP 3: DUTY WORKSHOP ════════════════ */}
            {currentStep === 3 && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>Duty Workshop</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
                  Write your job duties one at a time. Our AI will analyze each duty against NOC {nocCode} and coach you to make them IRCC-compliant.
                </p>

                {/* Existing duties */}
                {duties.map((duty, i) => {
                  const badge = duty.analysis ? getAlignmentBadge(duty.analysis.alignment) : null;
                  return (
                    <div key={i} className="lb-duty-card" style={{
                      padding: '20px', background: 'white', borderRadius: '12px',
                      border: `1px solid ${badge?.border || 'var(--border-color)'}`,
                      marginBottom: '16px', animation: 'fadeInUp 0.3s ease-out',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duty #{i + 1}</span>
                          {badge && (
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                              {badge.icon} {badge.label}
                            </span>
                          )}
                        </div>
                        <button onClick={() => removeDuty(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', color: '#DC2626' }}>Remove</button>
                      </div>

                      <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 12px 0', fontStyle: 'italic', color: '#1E293B' }}>"{duty.text}"</p>

                      {duty.analysis && (
                        <>
                          {duty.analysis.matched_noc_duty && (
                            <div style={{ fontSize: '0.82rem', color: '#047857', background: '#F0FDF4', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px' }}>
                              <strong>Matches:</strong> {duty.analysis.matched_noc_duty}
                            </div>
                          )}
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 8px 0' }}>{duty.analysis.feedback}</p>

                          {duty.analysis.coaching_questions.length > 0 && (
                            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px 14px', marginTop: '8px' }}>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#92400E', marginBottom: '6px' }}>💡 To make this duty stronger:</div>
                              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                {duty.analysis.coaching_questions.map((q, qi) => (
                                  <li key={qi} style={{ fontSize: '0.82rem', color: '#78350F', lineHeight: 1.5, marginBottom: '2px' }}>{q}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Payment Gate */}
                {needsPayment && (
                  <div className="pricing-grid-2" style={{ marginTop: '2rem', marginBottom: '2rem', width: '100%', margin: '2rem auto' }}>
                    {/* A la carte Option */}
                    <div className="pricing-card" style={{ background: '#ffffff', maxWidth: '350px' }}>
                      <div className="pricing-card-header">
                        <h3>Unlock the Full Builder</h3>
                        <div className="pricing-price">$14<span>.90</span> <span>CAD</span></div>
                        <p className="pricing-desc">Unlock just this one letter.</p>
                      </div>
                      <ul className="pricing-features">
                        <Feature included>Unlimited duty coaching</Feature>
                        <Feature included>Full NOC duty coverage tracking</Feature>
                        <Feature included>Complete letter generation</Feature>
                        <Feature included>Download-ready format</Feature>
                        <Feature highlight>No Optimize Features Included</Feature>
                      </ul>
                      <div className="pricing-card-footer">
                        <button className="pricing-btn secondary" style={{ width: '100%' }} onClick={handlePurchase}>
                          {userTier === 'complete' ? 'Buy 1 More Use — $14.90 CAD' : 'Buy Single Pass — $14.90 CAD'}
                        </button>
                      </div>
                    </div>

                    {/* Subscription Option */}
                    {userTier !== 'complete' && (
                      <div className="pricing-card featured animate-reveal delay-1" style={{ maxWidth: '350px' }}>
                        <div className="pricing-popular-badge">⭐ BEST VALUE</div>
                        <div className="pricing-card-header">
                          <h3>Optimize</h3>
                          <div className="pricing-price">$49 <span>CAD</span></div>
                          <p className="pricing-desc">Everything you need to perfect your profile.</p>
                        </div>
                        <ul className="pricing-features">
                          <Feature included>20 Question Credits - Express Entry AI Assistant</Feature>
                          <Feature included>Unlimited Employment Letter Audits</Feature>
                          <Feature included>Unlimited CRS Point Simulator (What-If Scenarios)</Feature>
                          <Feature included>Personalized Document Checklist</Feature>
                          <Feature included>Document Expiry Tracking</Feature>
                          <Feature included>1 Free GCMS Notes Order + AI Analysis ($34.80 value)</Feature>
                        </ul>
                        <div className="pricing-card-footer">
                          <button className="pricing-btn primary" style={{ width: '100%' }} onClick={() => window.location.href = '/pricing?upgrade=complete'}>
                            Get Optimize — $49 CAD
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Add duty input — only if paid or under limit */}
                {!needsPayment && (
                  <div style={{ padding: '24px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                    <label className="form-label" style={{ marginBottom: '8px' }}>
                      Write a duty statement
                      <span className="form-label-hint"> — describe what you actually do in this role</span>
                    </label>
                    <textarea
                      ref={dutyInputRef}
                      className="form-textarea"
                      placeholder="e.g., Develop and maintain web applications using React and Node.js, collaborating with cross-functional teams to deliver features on schedule."
                      value={currentDutyText}
                      onChange={e => setCurrentDutyText(e.target.value)}
                      rows={3}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && currentDutyText.trim()) { e.preventDefault(); handleAnalyzeDuty(); } }}
                    />
                    {dutyError && <div style={{ color: '#DC2626', fontSize: '0.85rem', marginTop: '8px' }}>⚠️ {dutyError}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Press Enter or click to analyze</span>
                      <button
                        className="btn btn-primary"
                        onClick={handleAnalyzeDuty}
                        disabled={!currentDutyText.trim() || analyzingDuty}
                      >
                        {analyzingDuty ? '⏳ Analyzing...' : '🔍 Analyze Duty'}
                      </button>
                    </div>
                  </div>
                )}

                {/* NOC duties reference panel */}
                {nocDuties.length > 0 && (
                  <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      📋 Official NOC {nocCode} Duties
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>— reference</span>
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {nocDuties.map((d, i) => {
                        const isCovered = coveredDuties.has(d.duty_text);
                        return (
                          <div key={i} style={{
                            padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', lineHeight: 1.5,
                            background: isCovered ? '#F0FDF4' : '#FFF',
                            border: `1px solid ${isCovered ? '#BBF7D0' : 'var(--border-color)'}`,
                            display: 'flex', alignItems: 'flex-start', gap: '8px',
                          }}>
                            <span style={{ flexShrink: 0, fontSize: '0.9rem' }}>{isCovered ? '✅' : '⬜'}</span>
                            <span>{d.duty_text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="crs-nav-buttons">
                  <button className="btn btn-outline" onClick={() => setCurrentStep(2)}>← Back</button>
                  <div style={{ flex: 1 }} />
                  {isPaid && duties.length >= 4 && (
                    <button className="btn btn-primary btn-lg" onClick={() => setCurrentStep(4)}>
                      Review & Generate Letter →
                    </button>
                  )}
                </div>

                {isPaid && duties.length > 0 && duties.length < 4 && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '0.85rem', color: '#92400E' }}>
                    ⚠️ IRCC expects at least 4 meaningful duties. You have {duties.length} so far. Keep going!
                  </div>
                )}
              </div>
            )}

            {/* ════════════════ STEP 4: REVIEW & DOWNLOAD ════════════════ */}
            {currentStep === 4 && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>Review & Download</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Review your letter and download when ready.</p>

                {!letterResult && !generatingLetter && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📄</div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Ready to Generate Your Letter</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>
                      Your letter will be assembled from the information you provided. Every word is yours — we just format it.
                    </p>
                    {letterError && <div style={{ color: '#DC2626', fontSize: '0.85rem', marginBottom: '16px' }}>⚠️ {letterError}</div>}
                    <button className="btn btn-primary btn-lg" onClick={handleGenerateLetter}>
                      ✨ Generate My Letter
                    </button>
                  </div>
                )}

                {generatingLetter && (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '16px', animation: 'pulse 1.5s ease-in-out infinite' }}>📄</div>
                    <p style={{ fontWeight: 600 }}>Assembling your letter...</p>
                  </div>
                )}

                {letterResult && (
                  <div>
                    {letterResult.warnings?.length > 0 && (
                      <div style={{ marginBottom: '24px' }}>
                        {letterResult.warnings.map((w: string, i: number) => (
                          <div key={i} style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontSize: '0.85rem', color: '#92400E', marginBottom: '8px' }}>
                            ⚠️ {w}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{
                      padding: '40px', background: 'white', borderRadius: '12px', border: '2px solid var(--primary-color)',
                      fontFamily: "'Times New Roman', Georgia, serif", fontSize: '0.95rem', lineHeight: 1.8,
                      whiteSpace: 'pre-wrap', boxShadow: '0 4px 24px rgba(37, 99, 235, 0.1)',
                    }}>
                      {letterResult.letter_full_text}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-lg" onClick={handleCopyLetter}>
                        {copied ? '✅ Copied!' : '📋 Copy to Clipboard'}
                      </button>
                      <button className="btn btn-outline btn-lg" onClick={() => {
                        const blob = new Blob([letterResult.letter_full_text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Employment_Letter_${details.applicant_name.replace(/\s+/g, '_')}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}>
                        💾 Download as Text
                      </button>
                    </div>

                    <div style={{ marginTop: '32px', padding: '24px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0', textAlign: 'center' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#065F46', marginBottom: '8px' }}>✅ What To Do Next</h4>
                      <ol style={{ textAlign: 'left', maxWidth: '480px', margin: '0 auto', fontSize: '0.9rem', lineHeight: 1.7, color: '#047857' }}>
                        <li>Print this letter on your company's official letterhead</li>
                        <li>Have your supervisor ({details.supervisor_name}) sign it</li>
                        <li>Before submitting, <a href="/audit-employment-letter" style={{ color: '#059669', fontWeight: 600 }}>run a full audit</a> to verify compliance</li>
                      </ol>
                    </div>
                  </div>
                )}

                <div className="crs-nav-buttons">
                  <button className="btn btn-outline" onClick={() => { setLetterResult(null); setCurrentStep(3); }}>← Back to Duties</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
};
