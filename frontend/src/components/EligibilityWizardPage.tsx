/**
 * Eligibility Wizard Page
 * 
 * Multi-step form that answers "Can I even apply for Canada PR?"
 * 5 screens, one question per screen, progress bar at top.
 * All logic runs client-side — results are instant.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneyStore } from '../stores/journeyStore';
import { SEO } from './common/SEO';
import {
  runEligibilityAssessment,
  type EligibilityProfile,
  type EligibilityResult,
  type ProgramEligibility,
} from '../utils/eligibilityLogic';
import {
  COUNTRIES,
} from '../data/eligibilityRules';
import { extractCLB, getLangOptions } from '../lib/crs-math';
import './EligibilityWizard.css';

// ── CRS-aligned option data ──

const EDUCATION_OPTIONS = [
  { val: '', label: 'Select education level' },
  { val: 'none', label: 'None, or less than secondary' },
  { val: 'secondary', label: 'Secondary diploma (high school)' },
  { val: 'one-year', label: 'One-year program' },
  { val: 'two-year', label: 'Two-year program' },
  { val: 'bachelors', label: "Bachelor's degree (3 or more years)" },
  { val: 'two-or-more', label: 'Two or more certificates/degrees' },
  { val: 'masters', label: "Master's degree or professional degree" },
  { val: 'doctoral', label: 'Doctoral level (PhD)' },
];

const LANG_TEST_OPTIONS = [
  { val: '', label: 'Select test type' },
  { val: 'CELPIP-General (English)', label: 'CELPIP-General (English)' },
  { val: 'IELTS General Training (English)', label: 'IELTS General Training (English)' },
  { val: 'PTE Core (English)', label: 'PTE Core (English)' },
  { val: 'TEF Canada (French)', label: 'TEF Canada (French)' },
  { val: 'TCF Canada (French)', label: 'TCF Canada (French)' },
  { val: 'none', label: "I haven't taken a test yet" },
];

const CANADIAN_WORK_OPTIONS = [
  { val: '', label: 'Select years...' },
  { val: 'None or less than a year', label: 'None or less than a year' },
  { val: '1 year', label: '1 year' },
  { val: '2 years', label: '2 years' },
  { val: '3 years', label: '3 years' },
  { val: '4 years', label: '4 years' },
  { val: '5 years or more', label: '5 years or more' },
];

const FOREIGN_WORK_OPTIONS = [
  { val: '', label: 'Select years...' },
  { val: 'None or less than a year', label: 'None or less than a year' },
  { val: '1 year', label: '1 year' },
  { val: '2 years', label: '2 years' },
  { val: '3 years or more', label: '3 years or more' },
];

const MARITAL_OPTIONS = ['Never Married / Single', 'Married', 'Common-Law', 'Divorced / Separated', 'Widowed'];

// Display name → store key
const testKeyMap: Record<string, string> = {
  'IELTS General Training (English)': 'ielts_general',
  'CELPIP-General (English)': 'celpip',
  'PTE Core (English)': 'pte_core',
  'TEF Canada (French)': 'tef',
  'TCF Canada (French)': 'tcf',
};
// Store key → display name
const reverseTestKeyMap: Record<string, string> = Object.fromEntries(
  Object.entries(testKeyMap).map(([k, v]) => [v, k])
);

const maritalToStore: Record<string, string> = {
  'Never Married / Single': 'single',
  'Married': 'married',
  'Common-Law': 'common_law',
  'Divorced / Separated': 'divorced',
  'Widowed': 'widowed',
};
const storeToMarital: Record<string, string> = Object.fromEntries(
  Object.entries(maritalToStore).map(([k, v]) => [v, k])
);

const parseYears = (str: string): number => {
  if (!str || str === 'None or less than a year') return 0;
  const m = str.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

const mapWorkYears = (y: number, isForeign = false): string => {
  if (y <= 0) return 'None or less than a year';
  if (isForeign) return y >= 3 ? '3 years or more' : y === 1 ? '1 year' : '2 years';
  if (y === 1) return '1 year';
  if (y === 2) return '2 years';
  if (y === 3) return '3 years';
  if (y === 4) return '4 years';
  return '5 years or more';
};

const clbToDropdownValue = (clb: number | undefined): string => {
  if (clb == null || clb <= 0) return '';
  if (clb < 4) return '< 4';
  if (clb >= 10) return '10-12';
  return String(clb);
};

// Reusable option card component (same as CRS Calculator)
const OptionCard = ({ selected, onClick, title }: { selected: boolean, onClick: () => void, title: string }) => (
  <div
    onClick={onClick}
    style={{
      cursor: 'pointer', padding: '14px 18px', borderRadius: '12px',
      border: `2px solid ${selected ? 'var(--primary-color)' : '#cbd5e1'}`,
      background: selected ? 'rgba(30, 58, 138, 0.05)' : '#ffffff',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex', alignItems: 'center', gap: '14px',
      transform: selected ? 'translateY(-1px)' : 'none',
      boxShadow: selected ? '0 4px 12px rgba(30, 58, 138, 0.08)' : '0 1px 2px rgba(0, 0, 0, 0.02)',
      flex: 1
    }}
  >
    <div style={{
      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${selected ? 'var(--primary-color)' : '#94a3b8'}`,
      background: selected ? 'var(--primary-color)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s',
      boxShadow: selected ? 'inset 0 0 0 3px white' : 'none'
    }} />
    <span style={{ fontWeight: selected ? 700 : 500, fontSize: '0.95rem', color: selected ? 'var(--primary-color)' : 'var(--text-muted)' }}>{title}</span>
  </div>
);

type Step = 1 | 2 | 3 | 4 | 5 | 'results';

export function EligibilityWizardPage() {
  const navigate = useNavigate();
  const { setProfileSilent, setEligibility, setPhase, noc, profile } = useJourneyStore();
  const [step, setStep] = useState<Step>(1);
  const [result, setResult] = useState<EligibilityResult | null>(null);

  // ── Pre-fill helpers: map journey store → form values ──
  const prefillCanadianWork = profile.canadianExperienceYears != null ? mapWorkYears(profile.canadianExperienceYears) : '';
  const prefillForeignWork = (profile.totalSkilledExperienceYears != null && profile.canadianExperienceYears != null)
    ? mapWorkYears(Math.max(0, profile.totalSkilledExperienceYears - profile.canadianExperienceYears), true) : '';

  // ── Form State (pre-filled from journey store) ──
  const [age, setAge] = useState<number | ''>(profile.age ?? '');
  const [citizenship, setCitizenship] = useState(profile.countryOfCitizenship ?? '');
  const [residence, setResidence] = useState(profile.countryOfResidence ?? '');

  const [education, setEducation] = useState(profile.educationLevel ?? '');
  const [educationInCanada, setEducationInCanada] = useState<boolean | null>(profile.educationInCanada ?? null);
  const [hasEca, setHasEca] = useState<boolean | null>(profile.hasEca ?? null);

  const [primaryTest, setPrimaryTest] = useState(profile.primaryLanguage?.test ? (reverseTestKeyMap[profile.primaryLanguage.test] || '') : '');
  const [lang1S, setLang1S] = useState(profile.primaryLanguage ? clbToDropdownValue(profile.primaryLanguage.speaking) : '');
  const [lang1L, setLang1L] = useState(profile.primaryLanguage ? clbToDropdownValue(profile.primaryLanguage.listening) : '');
  const [lang1R, setLang1R] = useState(profile.primaryLanguage ? clbToDropdownValue(profile.primaryLanguage.reading) : '');
  const [lang1W, setLang1W] = useState(profile.primaryLanguage ? clbToDropdownValue(profile.primaryLanguage.writing) : '');
  const [secondaryTest, setSecondaryTest] = useState(
    profile.secondaryLanguage?.test ? (reverseTestKeyMap[profile.secondaryLanguage.test] || 'None / Not Applicable') : 'None / Not Applicable'
  );
  const [lang2S, setLang2S] = useState(profile.secondaryLanguage ? clbToDropdownValue(profile.secondaryLanguage.speaking) : '');
  const [lang2L, setLang2L] = useState(profile.secondaryLanguage ? clbToDropdownValue(profile.secondaryLanguage.listening) : '');
  const [lang2R, setLang2R] = useState(profile.secondaryLanguage ? clbToDropdownValue(profile.secondaryLanguage.reading) : '');
  const [lang2W, setLang2W] = useState(profile.secondaryLanguage ? clbToDropdownValue(profile.secondaryLanguage.writing) : '');

  const [canadianWork, setCanadianWork] = useState(prefillCanadianWork);
  const [foreignWork, setForeignWork] = useState(prefillForeignWork);
  const [occupation, setOccupation] = useState(profile.primaryOccupation ?? '');

  const [hasJobOffer, setHasJobOffer] = useState<boolean | null>(profile.hasJobOffer ?? null);
  const [hasNomination, setHasNomination] = useState<boolean | null>(profile.hasProvincialNomination ?? null);
  const [hasRelativeInCanada, setHasRelativeInCanada] = useState<boolean | null>(profile.hasRelativeInCanada ?? null);
  const [canadianExperienceRecent, setCanadianExperienceRecent] = useState<boolean | null>(profile.canadianExperienceRecent ?? null);
  const [maritalStatus, setMaritalStatus] = useState(profile.maritalStatus ? (storeToMarital[profile.maritalStatus] || '') : '');
  const [spouseAccompanying, setSpouseAccompanying] = useState<boolean | null>(profile.spouseAccompanying ?? null);

  // ── Determine TEER from NOC (if user already used NOC Finder) ──
  const teerCategory = useMemo(() => {
    if (noc.code && noc.code.length >= 2) {
      return noc.code[1];
    }
    return null;
  }, [noc.code]);

  const totalSteps = 5;
  const progress = step === 'results' ? 100 : ((step - 1) / totalSteps) * 100;

  const canProceed = useCallback((): boolean => {
    switch (step) {
      case 1: return age !== '' && citizenship !== '' && residence !== '';
      case 2: return education !== '';
      case 3: return primaryTest !== '';
      case 4: return canadianWork !== '' && foreignWork !== '';
      case 5: return true;
      default: return false;
    }
  }, [step, age, citizenship, residence, education, primaryTest, canadianWork, foreignWork]);

  const handleNext = useCallback(() => {
    if (step === 5) {
      // Parse work years from CRS strings
      const caYears = parseYears(canadianWork);
      const forYears = parseYears(foreignWork);
      const totalYears = caYears + forYears;
      const storeTestKey = testKeyMap[primaryTest] || '';
      const storeSecTestKey = testKeyMap[secondaryTest] || '';
      const storeMarital = maritalToStore[maritalStatus] || null;
      const isMarried = maritalStatus === 'Married' || maritalStatus === 'Common-Law';

      // Build CLB scores from dropdown values
      const primaryClb = (primaryTest && primaryTest !== 'none') ? {
        speaking: extractCLB(lang1S), listening: extractCLB(lang1L),
        reading: extractCLB(lang1R), writing: extractCLB(lang1W),
      } : null;
      const secondaryClb = (secondaryTest && secondaryTest !== 'None / Not Applicable') ? {
        speaking: extractCLB(lang2S), listening: extractCLB(lang2L),
        reading: extractCLB(lang2R), writing: extractCLB(lang2W),
      } : null;

      // Run assessment with CLB values directly
      const assessmentProfile: EligibilityProfile = {
        age: typeof age === 'number' ? age : null,
        educationLevel: education || null,
        educationInCanada: educationInCanada,
        hasEca: hasEca,
        primaryLanguageTest: storeTestKey || null,
        primaryScores: primaryClb,
        secondaryLanguageTest: storeSecTestKey || null,
        secondaryScores: secondaryClb,
        totalSkilledExperienceYears: totalYears,
        canadianExperienceYears: caYears,
        teerCategory,
        hasJobOffer: hasJobOffer,
        hasProvincialNomination: hasNomination,
        hasRelativeInCanada: hasRelativeInCanada,
        canadianExperienceRecent: canadianExperienceRecent,
        maritalStatus: storeMarital,
        spouseAccompanying: spouseAccompanying,
        familySize: isMarried ? 2 : 1,
      };

      const assessmentResult = runEligibilityAssessment(assessmentProfile);
      setResult(assessmentResult);

      // Save to journey store (CRS-compatible format)
      setProfileSilent({
        age: typeof age === 'number' ? age : null,
        countryOfCitizenship: citizenship,
        countryOfResidence: residence,
        educationLevel: education || null,
        educationInCanada: educationInCanada,
        hasEca: hasEca,
        primaryLanguage: primaryClb ? { test: storeTestKey, ...primaryClb } : null,
        secondaryLanguage: secondaryClb ? { test: storeSecTestKey, ...secondaryClb } : null,
        totalSkilledExperienceYears: totalYears,
        canadianExperienceYears: caYears,
        primaryOccupation: occupation || null,
        hasJobOffer: hasJobOffer ?? false,
        hasProvincialNomination: hasNomination ?? false,
        hasRelativeInCanada: hasRelativeInCanada,
        canadianExperienceRecent: canadianExperienceRecent,
        maritalStatus: storeMarital,
        spouseAccompanying: spouseAccompanying ?? false,
      });

      setEligibility({
        completedAt: new Date().toISOString(),
        fswpEligible: assessmentResult.fswp.eligible,
        cecEligible: assessmentResult.cec.eligible,
        fstpEligible: assessmentResult.fstp.eligible,
        fswpScore: assessmentResult.fswp.score ?? null,
        recommendedProgram: assessmentResult.recommendedProgram,
      });

      if (assessmentResult.fswp.eligible || assessmentResult.cec.eligible || assessmentResult.fstp.eligible) {
        setPhase(2);
      }

      setStep('results');
    } else {
      setStep(((step as number) + 1) as Step);
    }
  }, [step, age, citizenship, residence, education, educationInCanada, hasEca,
    primaryTest, lang1S, lang1L, lang1R, lang1W, secondaryTest, lang2S, lang2L, lang2R, lang2W,
    canadianWork, foreignWork, canadianExperienceRecent, occupation, teerCategory,
    hasJobOffer, hasNomination, hasRelativeInCanada, maritalStatus, spouseAccompanying,
    setProfileSilent, setEligibility, setPhase]);

  const handleBack = useCallback(() => {
    if (step === 'results') setStep(5);
    else if ((step as number) > 1) setStep(((step as number) - 1) as Step);
  }, [step]);

  return (
    <div>
      <SEO
        title="Am I Eligible for Canada PR? Free Express Entry Check | Mentor Visa"
        description="Free eligibility assessment for Express Entry (FSWP, CEC, FSTP). Find out if you qualify for Canada Permanent Residence in under 3 minutes."
        keywords="am I eligible for Canada PR, Express Entry eligibility check, FSWP requirements, CEC eligibility, FSTP eligibility, do I qualify for Express Entry"
        canonical="/get-started"
      />

      {/* ── Page Hero ── */}
      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🚀 Express Entry Eligibility</div>
          <h1>Am I Eligible for<br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>Canada PR?</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Find out if you qualify for the Federal Skilled Worker Program (FSWP), Canadian Experience Class (CEC), or Federal Skilled Trades Program (FSTP) — in under 3 minutes.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>⚡ <span style={{ color: 'var(--primary-light)' }}>Under 3 Minutes</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🎯 FSWP · CEC · FSTP</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🔓 No Account Required</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <div className="eligibility-wizard">
          {/* Progress bar */}
          <div className="wizard-progress">
            <div className="wizard-progress-bar" style={{ width: `${progress}%` }} />
            <div className="wizard-progress-text">
              {step === 'results' ? 'Results' : `Step ${step} of ${totalSteps}`}
            </div>
          </div>

          <div className="wizard-card">
            <div className="wizard-container">
        {/* ── Step 1: Basic Info ── */}
        {step === 1 && (
          <div className="wizard-step">
            <h2 className="wizard-step-title">Let's start with the basics</h2>
            <p className="wizard-step-subtitle">This takes under 3 minutes. No account needed.</p>

            <div className="wizard-field">
              <label htmlFor="age">How old are you?</label>
              <select
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                className="wizard-select"
              >
                <option value="">Select your age</option>
                {Array.from({ length: 38 }, (_, i) => i + 18).map(a => (
                  <option key={a} value={a}>{a} years old</option>
                ))}
              </select>
            </div>

            <div className="wizard-field">
              <label htmlFor="citizenship">Country of citizenship</label>
              <select
                id="citizenship"
                value={citizenship}
                onChange={(e) => setCitizenship(e.target.value)}
                className="wizard-select"
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="wizard-field">
              <label htmlFor="residence">Where do you currently live?</label>
              <select
                id="residence"
                value={residence}
                onChange={(e) => setResidence(e.target.value)}
                className="wizard-select"
              >
                <option value="">Select country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── Step 2: Education ── */}
        {step === 2 && (
          <div className="wizard-step">
            <h2 className="wizard-step-title">Education</h2>
            <p className="wizard-step-subtitle">Your highest completed level of education.</p>

            <div className="wizard-field">
              <label htmlFor="education">Highest education level</label>
              <select id="education" value={education} onChange={(e) => setEducation(e.target.value)} className="wizard-select">
                {EDUCATION_OPTIONS.map(e => (
                  <option key={e.val} value={e.val}>{e.label}</option>
                ))}
              </select>
            </div>

            <div className="wizard-field">
              <label>Was your education completed in Canada?</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <OptionCard title="Yes" selected={educationInCanada === true} onClick={() => setEducationInCanada(true)} />
                <OptionCard title="No" selected={educationInCanada === false} onClick={() => setEducationInCanada(false)} />
              </div>
            </div>

            {educationInCanada === false && (
              <div className="wizard-field">
                <label>
                  Have you obtained an ECA?
                  <span className="wizard-tooltip" title="Educational Credential Assessment — a report that verifies your foreign education is equivalent to a Canadian credential. Required for Express Entry.">
                    ❓ What's this?
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <OptionCard title="Yes" selected={hasEca === true} onClick={() => setHasEca(true)} />
                  <OptionCard title="No / Not yet" selected={hasEca === false} onClick={() => setHasEca(false)} />
                </div>
                {hasEca === false && (
                  <div className="wizard-info-box">
                    <strong>📋 You'll need an ECA.</strong> An Educational Credential Assessment from WES or another IRCC-approved organization typically takes 4-8 weeks. Start early!
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Language ── */}
        {step === 3 && (
          <div className="wizard-step">
            <h2 className="wizard-step-title">Language Proficiency</h2>
            <p className="wizard-step-subtitle">Your language test results in English and/or French.</p>

            <div className="wizard-field">
              <label htmlFor="primary-test">Primary language test</label>
              <select id="primary-test" value={primaryTest} onChange={(e) => setPrimaryTest(e.target.value)} className="wizard-select">
                {LANG_TEST_OPTIONS.map(t => (
                  <option key={t.val} value={t.val}>{t.label}</option>
                ))}
              </select>
            </div>

            {primaryTest && primaryTest !== 'none' && primaryTest !== '' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                {(['Listening', 'Speaking', 'Reading', 'Writing'] as const).map(skill => {
                  const val = skill === 'Listening' ? lang1L : skill === 'Speaking' ? lang1S : skill === 'Reading' ? lang1R : lang1W;
                  const setVal = skill === 'Listening' ? setLang1L : skill === 'Speaking' ? setLang1S : skill === 'Reading' ? setLang1R : setLang1W;
                  return (
                    <div key={skill}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary-color)', marginBottom: '4px' }}>{skill}</label>
                      <select className="wizard-select" style={{ padding: '8px 12px', fontSize: '0.88rem' }} value={val} onChange={e => setVal(e.target.value)}>
                        <option value="">Score</option>
                        {getLangOptions(primaryTest, skill).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            {primaryTest === 'none' && (
              <div className="wizard-info-box">
                <strong>📋 You'll need a language test.</strong> IELTS General Training, CELPIP-General, or PTE Core for English; TEF or TCF for French. Book your test early — spots can fill up quickly.
              </div>
            )}

            <div className="wizard-field" style={{ marginTop: '1.5rem' }}>
              <label htmlFor="secondary-test">Second official language test</label>
              <select id="secondary-test" value={secondaryTest} onChange={(e) => setSecondaryTest(e.target.value)} className="wizard-select">
                <option value="None / Not Applicable">None / Not Applicable</option>
                {LANG_TEST_OPTIONS.filter(t => t.val !== '' && t.val !== 'none' && t.val !== primaryTest).map(t => (
                  <option key={t.val} value={t.val}>{t.label}</option>
                ))}
              </select>
            </div>

            {secondaryTest && secondaryTest !== 'None / Not Applicable' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                {(['Listening', 'Speaking', 'Reading', 'Writing'] as const).map(skill => {
                  const val = skill === 'Listening' ? lang2L : skill === 'Speaking' ? lang2S : skill === 'Reading' ? lang2R : lang2W;
                  const setVal = skill === 'Listening' ? setLang2L : skill === 'Speaking' ? setLang2S : skill === 'Reading' ? setLang2R : setLang2W;
                  return (
                    <div key={skill}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#059669', marginBottom: '4px' }}>{skill}</label>
                      <select className="wizard-select" style={{ padding: '8px 12px', fontSize: '0.88rem' }} value={val} onChange={e => setVal(e.target.value)}>
                        <option value="">Score</option>
                        {getLangOptions(secondaryTest, skill).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: Work Experience ── */}
        {step === 4 && (
          <div className="wizard-step">
            <h2 className="wizard-step-title">Work Experience</h2>
            <p className="wizard-step-subtitle">Your skilled work experience history.</p>

            <div className="wizard-field">
              <label htmlFor="canada-work">Years of Canadian skilled work experience</label>
              <select id="canada-work" value={canadianWork} onChange={(e) => setCanadianWork(e.target.value)} className="wizard-select">
                {CANADIAN_WORK_OPTIONS.map(o => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="wizard-field">
              <label htmlFor="foreign-work">Years of foreign skilled work experience</label>
              <select id="foreign-work" value={foreignWork} onChange={(e) => setForeignWork(e.target.value)} className="wizard-select">
                {FOREIGN_WORK_OPTIONS.map(o => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="wizard-field">
              <label htmlFor="occupation">
                Primary occupation
                {noc.code && (
                  <span className="wizard-noc-badge">NOC {noc.code} auto-filled ✓</span>
                )}
              </label>
              {noc.code ? (
                <div className="wizard-prefilled">
                  <span className="wizard-prefilled-text">{noc.title || noc.code}</span>
                  <span className="wizard-prefilled-source">From NOC Finder — TEER {teerCategory}</span>
                </div>
              ) : (
                <input id="occupation" type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} className="wizard-input" placeholder="e.g. Software Engineer, Registered Nurse, Electrician" />
              )}
            </div>

            {/* CEC recency check — only if they have Canadian experience */}
            {parseYears(canadianWork) >= 1 && (
              <div className="wizard-field">
                <label>
                  Was your Canadian work experience within the last 3 years?
                  <span className="wizard-tooltip" title="CEC requires your Canadian experience to have been gained within the last 3 years before you apply.">
                    ❓ Why does this matter?
                  </span>
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <OptionCard title="Yes" selected={canadianExperienceRecent === true} onClick={() => setCanadianExperienceRecent(true)} />
                  <OptionCard title="No" selected={canadianExperienceRecent === false} onClick={() => setCanadianExperienceRecent(false)} />
                </div>
                {canadianExperienceRecent === false && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#D97706', background: '#FFFBEB', padding: '10px 14px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                    ⚠️ CEC requires Canadian work experience within the last 3 years. You may still qualify for FSWP or FSTP.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 5: Additional Factors ── */}
        {step === 5 && (
          <div className="wizard-step">
            <h2 className="wizard-step-title">Additional Factors</h2>
            <p className="wizard-step-subtitle">These can significantly impact your eligibility and CRS score.</p>

            <div className="wizard-field">
              <label>Do you have a valid Canadian job offer?</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <OptionCard title="Yes" selected={hasJobOffer === true} onClick={() => setHasJobOffer(true)} />
                <OptionCard title="No" selected={hasJobOffer === false} onClick={() => setHasJobOffer(false)} />
              </div>
            </div>

            <div className="wizard-field">
              <label>
                Do you have a provincial nomination?
                <span className="wizard-tooltip" title="A provincial nomination through a Provincial Nominee Program (PNP) adds 600 CRS points — virtually guaranteeing an ITA.">
                  ❓ What's this?
                </span>
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <OptionCard title="Yes" selected={hasNomination === true} onClick={() => setHasNomination(true)} />
                <OptionCard title="No" selected={hasNomination === false} onClick={() => setHasNomination(false)} />
              </div>
            </div>

            <div className="wizard-field">
              <label>
                Do you have a close relative in Canada who is a citizen or permanent resident?
                <span className="wizard-tooltip" title="Parent, grandparent, child, grandchild, sibling, aunt, uncle, niece, or nephew. Adds 5 adaptability points for FSWP.">
                  ❓ Who counts?
                </span>
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <OptionCard title="Yes" selected={hasRelativeInCanada === true} onClick={() => setHasRelativeInCanada(true)} />
                <OptionCard title="No" selected={hasRelativeInCanada === false} onClick={() => setHasRelativeInCanada(false)} />
              </div>
            </div>

            <div className="wizard-field">
              <label>Marital status</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {MARITAL_OPTIONS.map(status => (
                  <OptionCard key={status} title={status} selected={maritalStatus === status} onClick={() => setMaritalStatus(status)} />
                ))}
              </div>
            </div>

            {(maritalStatus === 'Married' || maritalStatus === 'Common-Law') && (
              <div className="wizard-field">
                <label>Will your spouse/partner accompany you to Canada?</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <OptionCard title="Yes" selected={spouseAccompanying === true} onClick={() => setSpouseAccompanying(true)} />
                  <OptionCard title="No" selected={spouseAccompanying === false} onClick={() => setSpouseAccompanying(false)} />
                </div>
              </div>
            )}
          </div>
        )}



        {/* ── Results ── */}
        {step === 'results' && result && (
          <div className="wizard-step wizard-results">
            <h2 className="wizard-step-title">Your Eligibility Results</h2>
            <p className="wizard-step-subtitle">Assessment complete. Here's what we found:</p>

            <div className="wizard-programs">
              <ProgramCard program={result.cec} />
              <ProgramCard program={result.fswp} />
              <ProgramCard program={result.fstp} />
            </div>

            {result.estimatedCrsRange && (
              <div className="wizard-crs-estimate">
                <h3>📊 Estimated CRS Score</h3>
                <div className="wizard-crs-range">
                  <span className="wizard-crs-number">{result.estimatedCrsRange[0]}</span>
                  <span className="wizard-crs-dash">–</span>
                  <span className="wizard-crs-number">{result.estimatedCrsRange[1]}</span>
                </div>
                <p className="wizard-crs-note">
                  {result.estimatedCrsRange[0] !== result.estimatedCrsRange[1]
                    ? <>Low end assumes no spouse CRS contribution. High end assumes your spouse maximizes education, language, and Canadian work experience. Use the <strong>CRS Calculator</strong> for your exact score.</>
                    : <>Based on the official CRS formula. Use the <strong>CRS Calculator</strong> for a detailed breakdown.</>
                  }
                </p>
              </div>
            )}

            {result.recommendedProgram && (
              <div className="wizard-recommended">
                <h3>🎯 Recommended Path</h3>
                <p>{result.recommendedProgram} via Express Entry</p>
              </div>
            )}

            <div className="wizard-next-steps">
              <h3>📋 What's Next?</h3>
              <div className="wizard-next-actions">
                <button
                  className="wizard-action-btn primary"
                  onClick={() => navigate('/documents')}
                >
                  Check Your Documents →
                  <span className="wizard-action-subtitle">Are you making any of the 12 costly mistakes?</span>
                </button>
                <button
                  className="wizard-action-btn secondary"
                  onClick={() => navigate('/crs-calculator')}
                >
                  Calculate Exact CRS Score →
                  <span className="wizard-action-subtitle">See where you stand against recent draws</span>
                </button>
                {!noc.code && (
                  <button
                    className="wizard-action-btn secondary"
                    onClick={() => navigate('/find-my-noc')}
                  >
                    Find Your NOC Code →
                    <span className="wizard-action-subtitle">Match your job to the right NOC 2021 code</span>
                  </button>
                )}
              </div>
            </div>

            <div className="wizard-disclaimer">
              This tool is for informational purposes only and does not constitute legal or immigration advice.
              Always verify information against the official IRCC website (canada.ca) and consult a licensed professional for complex cases.
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        {step !== 'results' && (
          <div className="wizard-nav">
            {step > 1 && (
              <button
                className="wizard-nav-btn back"
                onClick={handleBack}
              >
                ← Back
              </button>
            )}
            <button
              className="wizard-nav-btn next"
              onClick={handleNext}
              disabled={!canProceed()}
            >
              {step === 5 ? 'See My Results' : 'Continue →'}
            </button>
          </div>
        )}
            </div>{/* wizard-container */}
          </div>{/* wizard-card */}
        </div>{/* eligibility-wizard */}
      </div>{/* page-container */}
    </div>
  );
}


// ── Program Eligibility Card ──

function ProgramCard({ program }: { program: ProgramEligibility }) {
  const statusIcon = program.eligible ? '✅' : program.mayQualify ? '⚠️' : '❌';
  const statusText = program.eligible
    ? 'You appear to meet all minimum requirements'
    : program.mayQualify
      ? 'You MAY qualify — check the items below'
      : 'You do not appear to qualify';
  const statusClass = program.eligible ? 'eligible' : program.mayQualify ? 'may-qualify' : 'not-eligible';

  const PROGRAM_NAMES: Record<string, string> = {
    FSWP: 'Federal Skilled Worker Program',
    CEC: 'Canadian Experience Class',
    FSTP: 'Federal Skilled Trades Program',
  };

  return (
    <div className={`wizard-program-card ${statusClass}`}>
      <div className="wizard-program-header">
        <span className="wizard-program-icon">{statusIcon}</span>
        <div>
          <h4 className="wizard-program-name">{program.program}</h4>
          <span className="wizard-program-fullname">{PROGRAM_NAMES[program.program]}</span>
        </div>
      </div>
      <p className="wizard-program-status">{statusText}</p>
      {program.score !== undefined && program.passingScore !== undefined && (
        <div className="wizard-program-score">
          Score: <strong>{program.score}</strong> / {program.passingScore} required
        </div>
      )}
      <ul className="wizard-requirements">
        {program.requirements.map((req, i) => (
          <li key={i} className={`wizard-req ${req.met === true ? 'met' : req.met === false ? 'not-met' : 'unknown'}`}>
            <span className="wizard-req-icon">
              {req.met === true ? '✅' : req.met === false ? '❌' : '❓'}
            </span>
            <div>
              <span className="wizard-req-label">{req.label}</span>
              <span className="wizard-req-detail">{req.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
