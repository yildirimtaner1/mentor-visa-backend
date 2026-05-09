import { type FC, useState, useMemo, useEffect, useRef } from 'react';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { saveCRSEvaluation, generateITAStrategy, createCheckoutSession, fetchUserCredits } from '../services/api';
import './common/PaywallGate.css';
import { SEO } from './common/SEO';
import { DynamicLoader } from './common/DynamicLoader';
import { CRSWarRoom } from './CRSWarRoom';
import { useJourneyStore } from '../stores/journeyStore';
import {
  getAgePoints, getEducationPoints, getLanguageAbilityPoints,
  getSpouseLanguagePoints, getSecondLanguagePoints, getSpouseEducationPoints,
  getSpouseCanadianWorkPoints, getCanadianWorkPoints, extractCLB, getLangOptions,
  calculateCRSScore, type CRSInputs
} from '../lib/crs-math';

interface CRSCalculatorPageProps {
  onNavigate: (page: string) => void;
}

import { ScoreVsCutoff } from './ScoreVsCutoff';

const crsSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Mentor Visa Express Entry AI Strategist",
  "operatingSystem": "Web",
  "applicationCategory": "WebApplication",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "CAD" },
  "description": "Calculate your Comprehensive Ranking System (CRS) score and generate a personalized AI strategy for Canadian Express Entry."
});

// Reusable option card component
const OptionCard = ({ selected, onClick, title, description }: { selected: boolean, onClick: () => void, title: string, description?: string }) => (
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
    <div>
      <span style={{ fontWeight: selected ? 700 : 500, fontSize: '0.95rem', color: selected ? 'var(--primary-color)' : 'var(--text-muted)' }}>{title}</span>
      {description && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0', lineHeight: 1.4 }}>{description}</p>}
    </div>
  </div>
);

export const CRSCalculatorPage: FC<CRSCalculatorPageProps> = ({ onNavigate: _onNavigate }) => {
  const { isSignedIn, getToken } = useAuth();
  const hasSavedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedEvalId, setSavedEvalId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [credits, setCredits] = useState<any>(null);

  // Fetch credits on mount if signed in
  useEffect(() => {
    if (isSignedIn) {
      fetchUserCredits().then(res => {
        if (res && typeof res.ita_strategy_credits === 'number') {
          setCredits(res);
        }
      }).catch(err => console.error("Failed to fetch credits:", err));
    }
  }, [isSignedIn]);

  // If score doesn't exist but profile is somewhat complete, run a silent calculation
  const { tier, setCRS, setProfileSilent, profile, profileUpdatedAt } = useJourneyStore();

  // ITA Strategy state
  const [strategyReport, setStrategyReport] = useState<any>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [itaCredits, setItaCredits] = useState(0);
  const [userTier, setUserTier] = useState<string>('free');

  // ── Session persistence: restore saved CRS inputs after Clerk sign-in ──
  const CRS_STORAGE_KEY = 'crsCalculatorData';
  const getSaved = (): any => {
    try { const s = sessionStorage.getItem(CRS_STORAGE_KEY); return s ? JSON.parse(s) : {}; } catch { return {}; }
  };
  const saved = useRef(getSaved());

  // ── Invalidate stale session cache if profile was updated more recently ──
  if (Object.keys(saved.current).length > 0 && profileUpdatedAt) {
    const cacheTime = saved.current._savedAt;
    if (!cacheTime || new Date(profileUpdatedAt) > new Date(cacheTime)) {
      sessionStorage.removeItem(CRS_STORAGE_KEY);
      saved.current = {};  // Force re-read from journey store
    }
  }

  // ── Pre-fill from journey store if no session data ──
  const journeyFallback = useRef<any>({});
  if (Object.keys(saved.current).length === 0 && profile.age) {
    // Map profile education keys → CRS Calculator <option> values.
    // Accepts both Eligibility Wizard keys (underscore) and CRS write-back keys (hyphen).
    const eduMap: Record<string, string> = {
      // Eligibility Wizard keys
      'secondary': 'secondary',
      'one_year_post_secondary': 'one-year',
      'two_year_post_secondary': 'two-year',
      'three_year_post_secondary': 'bachelors',
      'two_credentials': 'two-or-more',
      'masters': 'masters',
      'doctoral': 'doctoral',
      // CRS Calculator keys (pass-through)
      'none': 'none',
      'one-year': 'one-year',
      'two-year': 'two-year',
      'bachelors': 'bachelors',
      'two-or-more': 'two-or-more',
    };
    const maritalMap: Record<string, string> = {
      'single': 'Never Married / Single',
      'married': 'Married',
      'common_law': 'Common-Law',
      'divorced': 'Divorced / Separated',
      'widowed': 'Widowed',
    };
    // Map profile language test keys → exact CRS form <option> values
    const langTestMap: Record<string, string> = {
      'ielts_general': 'IELTS General Training (English)',
      'celpip': 'CELPIP-General (English)',
      'pte_core': 'PTE Core (English)',
      'tef': 'TEF Canada (French)',
      'tcf': 'TCF Canada (French)',
    };

    const pLang = profile.primaryLanguage;
    const sLang = profile.secondaryLanguage;
    const canExp = profile.canadianExperienceYears ?? 0;
    const totalExp = profile.totalSkilledExperienceYears ?? 0;
    const foreignExp = Math.max(0, totalExp - canExp);

    // Map years to CRS option strings
    const mapWorkYears = (y: number): string => {
      if (y <= 0) return 'None or less than a year';
      if (y === 1) return '1 year';
      if (y === 2) return '2 years';
      if (y === 3) return '3 years';
      if (y === 4) return '4 years';
      return '5 years or more';
    };

    // Convert CLB number to the CRS form dropdown value
    // Dropdown values: '10-12', '9', '8', '7', '6', '5', '4', '< 4'
    const clbToDropdownValue = (clb: number | undefined): string => {
      if (clb == null || clb <= 0) return '';
      if (clb < 4) return '< 4';
      if (clb >= 10) return '10-12';
      return String(clb); // 4-9 map directly
    };

    journeyFallback.current = {
      age: profile.age,
      maritalStatus: maritalMap[profile.maritalStatus || ''] || '',
      education: eduMap[profile.educationLevel || ''] || '',
      hasCanadianEducation: profile.educationInCanada ? 'Yes' : profile.educationInCanada === false ? 'No' : '',
      lang1Test: pLang ? (langTestMap[pLang.test] || '') : '',
      lang1R: pLang ? clbToDropdownValue(pLang.reading) : '',
      lang1W: pLang ? clbToDropdownValue(pLang.writing) : '',
      lang1L: pLang ? clbToDropdownValue(pLang.listening) : '',
      lang1S: pLang ? clbToDropdownValue(pLang.speaking) : '',
      lang2Test: sLang ? (langTestMap[sLang.test] || 'None / Not Applicable') : 'None / Not Applicable',
      lang2R: sLang ? clbToDropdownValue(sLang.reading) : '',
      lang2W: sLang ? clbToDropdownValue(sLang.writing) : '',
      lang2L: sLang ? clbToDropdownValue(sLang.listening) : '',
      lang2S: sLang ? clbToDropdownValue(sLang.speaking) : '',
      canadianWork: mapWorkYears(canExp),
      foreignWork: mapWorkYears(foreignExp),
      provincialNom: profile.hasProvincialNomination ? 'Yes' : profile.hasProvincialNomination === false ? 'No' : '',
      siblingInCanada: profile.hasRelativeInCanada ? 'Yes' : profile.hasRelativeInCanada === false ? 'No' : '',
    };
    // Merge into saved so downstream state initializers use it
    saved.current = journeyFallback.current;
  }

  // Phase 1: Personal
  const [age, setAge] = useState<number | ''>(saved.current.age ?? '');
  const [maritalStatus, setMaritalStatus] = useState<string>(saved.current.maritalStatus ?? '');
  const [spouseIsPR, setSpouseIsPR] = useState<string>(saved.current.spouseIsPR ?? '');
  const [spouseAccompanying, setSpouseAccompanying] = useState<string>(saved.current.spouseAccompanying ?? '');

  const isMarriedObj = maritalStatus === 'Married' || maritalStatus === 'Common-Law';
  const hasSpouseForMath = isMarriedObj && spouseIsPR === 'No' && spouseAccompanying === 'Yes';
  
  // Phase 2: Education & Language
  const [education, setEducation] = useState(saved.current.education ?? '');
  const [hasCanadianEducation, setHasCanadianEducation] = useState(saved.current.hasCanadianEducation ?? '');
  const [canadianEducation, setCanadianEducation] = useState(saved.current.canadianEducation ?? '');

  const [lang1Test, setLang1Test] = useState(saved.current.lang1Test ?? '');
  const [lang1R, setLang1R] = useState(saved.current.lang1R ?? '');
  const [lang1W, setLang1W] = useState(saved.current.lang1W ?? '');
  const [lang1L, setLang1L] = useState(saved.current.lang1L ?? '');
  const [lang1S, setLang1S] = useState(saved.current.lang1S ?? '');

  const [lang2Test, setLang2Test] = useState(saved.current.lang2Test ?? 'None / Not Applicable');
  const [lang2R, setLang2R] = useState(saved.current.lang2R ?? '');
  const [lang2W, setLang2W] = useState(saved.current.lang2W ?? '');
  const [lang2L, setLang2L] = useState(saved.current.lang2L ?? '');
  const [lang2S, setLang2S] = useState(saved.current.lang2S ?? '');

  const clbReading = extractCLB(lang1R);
  const clbWriting = extractCLB(lang1W);
  const clbListening = extractCLB(lang1L);
  const clbSpeaking = extractCLB(lang1S);

  // Phase 3: Work & Additional
  const [canadianWork, setCanadianWork] = useState(saved.current.canadianWork ?? '');
  const [foreignWork, setForeignWork] = useState(saved.current.foreignWork ?? '');
  const [provincialNom, setProvincialNom] = useState(saved.current.provincialNom ?? '');
  const [siblingInCanada, setSiblingInCanada] = useState(saved.current.siblingInCanada ?? '');
  const [certOfQualification, setCertOfQualification] = useState(saved.current.certOfQualification ?? '');
  
  // Phase 4: Spouse
  const [spouseEducation, setSpouseEducation] = useState(saved.current.spouseEducation ?? '');
  const [spLangTest, setSpLangTest] = useState(saved.current.spLangTest ?? 'None / Not Applicable');
  const [spR, setSpR] = useState(saved.current.spR ?? '');
  const [spW, setSpW] = useState(saved.current.spW ?? '');
  const [spL, setSpL] = useState(saved.current.spL ?? '');
  const [spS, setSpS] = useState(saved.current.spS ?? '');
  const [spouseCanadianWork, setSpouseCanadianWork] = useState(saved.current.spouseCanadianWork ?? '');
  
  // Score Derivation — delegates to the single-source-of-truth calculateCRSScore()
  const crsInputs: CRSInputs = useMemo(() => {
    const parseYears = (str: string) => {
      if (!str || str === 'None or less than a year') return 0;
      if (str.startsWith('1')) return 1;
      if (str.startsWith('2')) return 2;
      if (str.startsWith('3')) return 3;
      if (str.startsWith('4')) return 4;
      if (str.startsWith('5')) return 5;
      return 0;
    };

    return {
      age: age === '' ? 28 : (age as number),
      education,
      hasSpouseForMath,
      clbReading, clbWriting, clbListening, clbSpeaking,
      clb2Reading: extractCLB(lang2R), clb2Writing: extractCLB(lang2W),
      clb2Listening: extractCLB(lang2L), clb2Speaking: extractCLB(lang2S),
      canadianWorkYears: parseYears(canadianWork),
      foreignWorkYears: parseYears(foreignWork),
      spouseEducation,
      spClbReading: extractCLB(spR), spClbWriting: extractCLB(spW),
      spClbListening: extractCLB(spL), spClbSpeaking: extractCLB(spS),
      spouseCanadianWorkYears: parseYears(spouseCanadianWork),
      provincialNomination: provincialNom === 'Yes',
      hasCanadianEducation: hasCanadianEducation === 'Yes',
      canadianEducationType: canadianEducation,
      siblingInCanada: siblingInCanada === 'Yes',
      certOfQualification: certOfQualification === 'Yes',
      primaryLangIsFrench: lang1Test.includes('French'),
      secondaryLangIsFrench: lang2Test.includes('French'),
      primaryLangIsEnglish: lang1Test.includes('English'),
      secondaryLangIsEnglish: lang2Test.includes('English'),
    };
  }, [age, education, canadianWork, foreignWork, hasSpouseForMath, clbReading, clbWriting, clbListening, clbSpeaking, spouseEducation, spR, spW, spL, spS, spouseCanadianWork, provincialNom, canadianEducation, hasCanadianEducation, lang1Test, lang2Test, lang2R, lang2W, lang2L, lang2S, siblingInCanada, certOfQualification]);

  const score = useMemo(() => calculateCRSScore(crsInputs), [crsInputs]);

  // Phase Definitions
  const phases = [
    { id: 'personal', title: 'Personal', icon: '👤' },
    { id: 'education_lang', title: 'Education & Language', icon: '🎓' },
    { id: 'work_extra', title: 'Work & Additional', icon: '💼' },
    ...(hasSpouseForMath ? [{ id: 'spouse', title: 'Spouse Factors', icon: '💗' }] : []),
    { id: 'results', title: 'Summary', icon: '📊' }
  ];

  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(() => {
    const s = getSaved();
    return s.currentPhaseIndex ?? 0;
  });

  // ── Persist all CRS inputs to sessionStorage on every change ──
  useEffect(() => {
    sessionStorage.setItem(CRS_STORAGE_KEY, JSON.stringify({
      _savedAt: new Date().toISOString(),
      age, maritalStatus, spouseIsPR, spouseAccompanying,
      education, hasCanadianEducation, canadianEducation,
      lang1Test, lang1R, lang1W, lang1L, lang1S,
      lang2Test, lang2R, lang2W, lang2L, lang2S,
      canadianWork, foreignWork, provincialNom, siblingInCanada, certOfQualification,
      spouseEducation, spLangTest, spR, spW, spL, spS, spouseCanadianWork,
      currentPhaseIndex,
    }));
  }, [
    age, maritalStatus, spouseIsPR, spouseAccompanying,
    education, hasCanadianEducation, canadianEducation,
    lang1Test, lang1R, lang1W, lang1L, lang1S,
    lang2Test, lang2R, lang2W, lang2L, lang2S,
    canadianWork, foreignWork, provincialNom, siblingInCanada, certOfQualification,
    spouseEducation, spLangTest, spR, spW, spL, spS, spouseCanadianWork,
    currentPhaseIndex,
  ]);
  
  // Validation Logic grouped by Phase
  const canAdvance = () => {
    const p = phases[currentPhaseIndex];
    if (p.id === 'personal') {
      if (age === '' || maritalStatus === '') return false;
      if (isMarriedObj && spouseIsPR === '') return false;
      if (isMarriedObj && spouseIsPR === 'No' && spouseAccompanying === '') return false;
      return true;
    }
    if (p.id === 'education_lang') {
      if (education === '' || hasCanadianEducation === '') return false;
      if (hasCanadianEducation === 'Yes' && canadianEducation === '') return false;
      if (lang1Test === '' || lang1R === '' || lang1W === '' || lang1L === '' || lang1S === '') return false;
      if (lang2Test !== 'None / Not Applicable' && (lang2R === '' || lang2W === '' || lang2L === '' || lang2S === '')) return false;
      return true;
    }
    if (p.id === 'work_extra') {
      if (canadianWork === '' || foreignWork === '') return false;
      if (provincialNom === '' || siblingInCanada === '' || certOfQualification === '') return false;
      return true;
    }
    if (p.id === 'spouse') {
      if (spouseEducation === '' || spouseCanadianWork === '') return false;
      if (spLangTest !== 'None / Not Applicable' && (spR === '' || spW === '' || spL === '' || spS === '')) return false;
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (canAdvance() && currentPhaseIndex < phases.length - 1) {
      setCurrentPhaseIndex((i: number) => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentPhaseIndex > 0) {
      setCurrentPhaseIndex((i: number) => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const p = phases[currentPhaseIndex];
  const isResults = p.id === 'results';
  // progress could be: ((currentPhaseIndex + 1) / phases.length) * 100

  // Save CRS Evaluation when user signs in and is on the results phase
  // Reset the save guard whenever we leave the results phase
  useEffect(() => {
    if (!isResults) {
      hasSavedRef.current = false;
    }
  }, [isResults]);

  // Write CRS score to journey store whenever user reaches results
  useEffect(() => {
    if (isResults && score.total > 0) {
      setCRS({
        score: score.total,
        calculatedAt: new Date().toISOString(),
        inputs: crsInputs,
      });
    }
  }, [isResults, score.total, setCRS]);

  // Store CRSInputs so the simulator (War Room) can read them
  useEffect(() => {
    if (isResults && score.total > 0) {
      try { sessionStorage.setItem('crsSimulatorInputs', JSON.stringify(crsInputs)); } catch {}
    }
  }, [isResults, score.total, crsInputs]);

  // ── Bug 2 fix: Write full profile data to journey store on results ──
  useEffect(() => {
    if (!isResults || score.total <= 0) return;

    // Map CRS calculator test name → journey store test key
    const testKeyMap: Record<string, string> = {
      'IELTS General Training (English)': 'ielts_general',
      'CELPIP-General (English)': 'celpip',
      'PTE Core (English)': 'pte_core',
      'TEF Canada (French)': 'tef',
      'TCF Canada (French)': 'tcf',
    };
    // Map CRS calculator education label → journey store education key
    const eduKeyMap: Record<string, string> = {
      'none': 'none',
      'secondary': 'secondary',
      'one-year': 'one-year',
      'two-year': 'two-year',
      'bachelors': 'bachelors',
      'two-or-more': 'two-or-more',
      'masters': 'masters',
      'doctoral': 'doctoral',
    };
    const maritalMap: Record<string, string> = {
      'Never Married / Single': 'single',
      'Married': 'married',
      'Common-Law': 'common_law',
      'Divorced / Separated': 'divorced',
      'Widowed': 'widowed',
    };
    const parseYearsForProfile = (str: string): number => {
      if (!str || str === 'None or less than a year') return 0;
      const m = str.match(/\d+/);
      return m ? parseInt(m[0], 10) : 0;
    };

    const primaryTest = testKeyMap[lang1Test] || '';
    const secondaryTest = testKeyMap[lang2Test] || '';
    const caYears = parseYearsForProfile(canadianWork);
    const forYears = parseYearsForProfile(foreignWork);

    setProfileSilent({
      age: typeof age === 'number' ? age : null,
      maritalStatus: maritalMap[maritalStatus] || null,
      spouseAccompanying: spouseAccompanying === 'Yes',
      educationLevel: eduKeyMap[education] || null,
      educationInCanada: hasCanadianEducation === 'Yes' ? true : hasCanadianEducation === 'No' ? false : null,
      primaryLanguage: primaryTest ? {
        test: primaryTest,
        speaking: clbSpeaking,
        listening: clbListening,
        reading: clbReading,
        writing: clbWriting,
      } : null,
      secondaryLanguage: (secondaryTest && lang2Test !== 'None / Not Applicable') ? {
        test: secondaryTest,
        speaking: extractCLB(lang2S),
        listening: extractCLB(lang2L),
        reading: extractCLB(lang2R),
        writing: extractCLB(lang2W),
      } : null,
      canadianExperienceYears: caYears,
      totalSkilledExperienceYears: caYears + forYears,
      hasProvincialNomination: provincialNom === 'Yes',
      hasJobOffer: false, // IRCC removed job offer points March 2025
      hasRelativeInCanada: siblingInCanada === 'Yes',
      spouseEducationLevel: hasSpouseForMath ? (eduKeyMap[spouseEducation] || null) : null,
      spouseLanguage: (hasSpouseForMath && spLangTest !== 'None / Not Applicable') ? {
        test: testKeyMap[spLangTest] || '',
        speaking: extractCLB(spS),
        listening: extractCLB(spL),
        reading: extractCLB(spR),
        writing: extractCLB(spW),
      } : null,
      spouseCanadianExperienceYears: hasSpouseForMath ? parseYearsForProfile(spouseCanadianWork) : 0,
    });
  }, [isResults, score.total]);

  useEffect(() => {
    if (isSignedIn && isResults && !hasSavedRef.current) {
      const saveToDb = async () => {
        setIsSaving(true);
        try {
          const token = await getToken();
          if (token) {
            hasSavedRef.current = true;
            const result = await saveCRSEvaluation({
              evaluation_type: 'crs_calculator',
              score: {
                total: score.total,
                core: score.core,
                spouse: score.spouse,
                transferability: score.transferability,
                additional: score.additional,
              },
              breakdown: score.breakdown,
              raw_inputs: {
                age, maritalStatus, spouseIsPR, spouseAccompanying,
                education, hasCanadianEducation, canadianEducation,
                canadianWork, foreignWork, provincialNom, siblingInCanada, certOfQualification,
                lang1Test, lang1R, lang1W, lang1L, lang1S,
                lang2Test, lang2R, lang2W, lang2L, lang2S,
                spouseEducation, spLangTest, spR, spW, spL, spS, spouseCanadianWork
              }
            }, token);
            if (result?.id) setSavedEvalId(result.id);

            // Fetch ITA strategy credits
            const credits = await fetchUserCredits(token);
            setItaCredits(credits.ita_strategy_credits || 0);
            setUserTier(credits.subscription_tier || 'free');
          }
        } catch (e) {
          console.error('Failed to save CRS score:', e);
          hasSavedRef.current = false; // allow retry
        } finally {
          setIsSaving(false);
        }
      };
      saveToDb();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, isResults, getToken, score, age, maritalStatus, education, hasCanadianEducation, canadianEducation, canadianWork, foreignWork, provincialNom, siblingInCanada, certOfQualification, lang1Test, lang1R, lang1W, lang1L, lang1S, lang2Test, lang2R, lang2W, lang2L, lang2S]);

  // Breakdown bars for results
  const breakdownBars = [
    { label: 'Core / Human Capital', val: score.core, max: hasSpouseForMath ? 460 : 500, color: '#4F46E5' },
    ...(hasSpouseForMath ? [{ label: 'Spouse Factors', val: score.spouse, max: 40, color: '#EC4899' }] : []),
    { label: 'Skill Transferability', val: score.transferability, max: 100, color: '#059669' },
    { label: 'Additional Points', val: score.additional, max: 600, color: '#D97706' }
  ];

  // Helper: Render select field
  const renderSelect = (label: string, value: string, onChange: (v: string) => void, options: { val: string; label: string }[], required = false) => (
    <div className="form-group">
      <label className="form-label">{label} {required && <span style={{ color: '#DC2626' }}>*</span>}</label>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>
    </div>
  );

  // Helper: Lang score selects (2x2 grid)
  const renderLangGrid = (test: string, L: string, S: string, R: string, W: string, setL: (v: string) => void, setS: (v: string) => void, setR: (v: string) => void, setW: (v: string) => void, accentColor: string) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
      {(['Listening', 'Speaking', 'Reading', 'Writing'] as const).map(skill => {
        const val = skill === 'Listening' ? L : skill === 'Speaking' ? S : skill === 'Reading' ? R : W;
        const setVal = skill === 'Listening' ? setL : skill === 'Speaking' ? setS : skill === 'Reading' ? setR : setW;
        return (
          <div key={skill}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: accentColor, marginBottom: '4px' }}>{skill}</label>
            <select className="form-select" style={{ padding: '8px 12px', fontSize: '0.88rem' }} value={val} onChange={e => setVal(e.target.value)}>
              <option value="">Score</option>
              {getLangOptions(test, skill as any).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );

  return (
    <div>
      <SEO 
        title="Canada Express Entry AI Strategist 2026 | Score & Strategy Builder" 
        description="Calculate your exact CRS score and unlock a personalized AI strategy to maximize your points for Canadian Permanent Residency."
        keywords="CRS calculator, Express Entry points, Canada PR score, CEC eligibility, PR strategy"
        canonical="/crs-calculator"
        schema={crsSchema}
      />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
      </div>

      <section className="page-hero">
        <div className="page-hero-content">
          <div className="page-hero-badge">🎯 Express Entry AI Strategist</div>
          <h1>Turn Your Score Into an <br /><span className="hero-highlight" style={{ color: 'var(--primary-light)' }}>Invitation to Apply</span></h1>
          <p style={{ maxWidth: '700px', margin: '0 auto 24px auto', fontSize: '1.1rem', lineHeight: '1.6' }}>
            Stop guessing your PR chances. Calculate your exact CRS score instantly and unlock a personalized, AI-driven roadmap to maximize your points, discover hidden PNP pathways, and secure your Canadian Permanent Residency.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>⚡ <span style={{ color: 'var(--primary-light)' }}>Takes 2 Minutes</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📈 Find Missing Points</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🗺️ PNP Pathway Matches</span>
          </div>
        </div>
      </section>

      <div className="page-container">
        <div className="crs-wizard">
          {/* ── Sidebar ── */}
          <div className="crs-sidebar">
            <div style={{ padding: '8px 16px', marginBottom: '8px' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Progress</div>
            </div>
            {phases.map((step, i) => (
              <div
                key={step.id}
                className={`crs-sidebar-item ${currentPhaseIndex === i ? 'active' : ''} ${currentPhaseIndex > i ? 'completed' : ''}`}
                onClick={() => { if (i < currentPhaseIndex) setCurrentPhaseIndex(i); }}
                style={{ cursor: i < currentPhaseIndex ? 'pointer' : 'default' }}
              >
                <span className="crs-item-icon">{step.icon}</span>
                <span>{step.title}</span>
                <span className="crs-item-status">{currentPhaseIndex > i ? '✓' : ''}</span>
              </div>
            ))}

            {/* Live Score Widget */}
            <div style={{
              marginTop: '24px', padding: '20px', textAlign: 'center', position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(135deg, #0F172A, #1E3A8A)', borderRadius: '12px', color: 'white',
            }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.7, marginBottom: '4px' }}>Live CRS Score</div>
              <div style={{ fontSize: '2.8rem', fontWeight: 900, lineHeight: 1, marginBottom: '4px' }}>
                {(!isSignedIn && (canadianWork !== '' || foreignWork !== '')) ? (
                  <span style={{ filter: 'blur(8px)', opacity: 0.6, userSelect: 'none' }}>{score.total}</span>
                ) : (
                  score.total
                )}
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>/ 1200 possible</div>

              {(!isSignedIn && (canadianWork !== '' || foreignWork !== '')) && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.2)' }}>
                  <div style={{ fontSize: '1.2rem', marginBottom: '2px' }}>🔒</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E2E8F0', letterSpacing: '0.5px' }}>LOCKED</div>
                </div>
              )}
            </div>

            {/* Mini breakdown in sidebar */}
            <div style={{ marginTop: '16px', padding: '16px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px' }}>Breakdown</div>
              
              <div style={(!isSignedIn && (canadianWork !== '' || foreignWork !== '')) ? { filter: 'blur(5px)', opacity: 0.4, userSelect: 'none', pointerEvents: 'none' } : {}}>
                {[
                  { label: 'Core', val: score.core, color: '#4F46E5' },
                  ...(hasSpouseForMath ? [{ label: 'Spouse', val: score.spouse, color: '#EC4899' }] : []),
                  { label: 'Transfer.', val: score.transferability, color: '#059669' },
                  { label: 'Additional', val: score.additional, color: '#D97706' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                    <span style={{ fontWeight: 600, color: s.color }}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Main Content ── */}
          <div className="crs-main">
            
            {/* ════════════ PHASE 1: PERSONAL ════════════ */}
            {p.id === 'personal' && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>👤 Personal Information</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Answer the questions below to start estimating your CRS score.</p>

                {renderSelect('How old are you?', String(age), v => setAge(v === '' ? '' : +v), [
                  { val: '', label: 'Select your age' },
                  { val: '17', label: '17 years or less' },
                  ...Array.from({ length: 27 }, (_, i) => ({ val: String(i + 18), label: `${i + 18} years` })),
                  { val: '45', label: '45 years or more' },
                ], true)}

                <div className="form-group" style={{ marginTop: '24px' }}>
                  <label className="form-label">What is your marital status? <span style={{ color: '#DC2626' }}>*</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {['Never Married / Single', 'Married', 'Common-Law', 'Divorced / Separated', 'Widowed'].map(status => (
                      <OptionCard
                        key={status} title={status}
                        selected={maritalStatus === status}
                        onClick={() => { setMaritalStatus(status); setSpouseIsPR(''); setSpouseAccompanying(''); }}
                      />
                    ))}
                  </div>
                </div>

                {isMarriedObj && (
                  <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                    <div className="form-group">
                      <label className="form-label">Is your spouse/partner a PR or Citizen of Canada?</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <OptionCard title="Yes" selected={spouseIsPR === 'Yes'} onClick={() => { setSpouseIsPR('Yes'); setSpouseAccompanying(''); }} />
                        <OptionCard title="No" selected={spouseIsPR === 'No'} onClick={() => setSpouseIsPR('No')} />
                      </div>
                    </div>

                    {spouseIsPR === 'No' && (
                      <div className="form-group" style={{ marginTop: '16px' }}>
                        <label className="form-label">Will your spouse/partner come with you to Canada?</label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <OptionCard title="Yes" selected={spouseAccompanying === 'Yes'} onClick={() => setSpouseAccompanying('Yes')} />
                          <OptionCard title="No" selected={spouseAccompanying === 'No'} onClick={() => setSpouseAccompanying('No')} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="crs-nav-buttons">
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={!canAdvance()} style={{ opacity: canAdvance() ? 1 : 0.5 }}>
                    Next Step →
                  </button>
                </div>
              </div>
            )}

            {/* ════════════ PHASE 2: EDUCATION & LANGUAGE ════════════ */}
            {p.id === 'education_lang' && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>🎓 Education & Language</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Your education and language proficiency contribute significantly to your CRS score.</p>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>📚 Education Background</h3>

                {renderSelect('Highest level of education', education, setEducation, [
                  { val: '', label: 'Select level...' },
                  { val: 'none', label: 'None, or less than secondary' },
                  { val: 'secondary', label: 'Secondary diploma (high school)' },
                  { val: 'one-year', label: 'One-year program' },
                  { val: 'two-year', label: 'Two-year program' },
                  { val: 'bachelors', label: "Bachelor's degree (3 or more years)" },
                  { val: 'two-or-more', label: 'Two or more certificates/degrees' },
                  { val: 'masters', label: "Master's degree or professional degree" },
                  { val: 'doctoral', label: 'Doctoral level (PhD)' },
                ], true)}

                <div className="form-group">
                  <label className="form-label">Do you have a Canadian degree/diploma? <span style={{ color: '#DC2626' }}>*</span></label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <OptionCard title="Yes" selected={hasCanadianEducation === 'Yes'} onClick={() => setHasCanadianEducation('Yes')} />
                    <OptionCard title="No" selected={hasCanadianEducation === 'No'} onClick={() => { setHasCanadianEducation('No'); setCanadianEducation(''); }} />
                  </div>
                </div>

                {hasCanadianEducation === 'Yes' && (
                  <div className="highlight-box" style={{ marginBottom: '24px' }}>
                    <p><strong>To confirm eligibility</strong>, ensure your program qualifies for a post-graduation work permit, was taken at a Canadian institution with full-time enrollment for at least 8 months, and was not primarily ESL/FSL courses.</p>
                    <div style={{ marginTop: '12px' }}>
                      {renderSelect('Describe your Canadian education', canadianEducation, setCanadianEducation, [
                        { val: '', label: 'Select type...' },
                        { val: 'one-two', label: '1 or 2-year diploma or certificate' },
                        { val: 'three-plus', label: "Degree/diploma of 3+ years, Master's, or PhD" },
                      ])}
                    </div>
                  </div>
                )}

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>🗣️ Language Tests</h3>

                <div className="highlight-box highlight-box-blue" style={{ marginBottom: '20px' }}>
                  <p><strong>Official Languages:</strong> English and French are Canada's official languages. Submit test results less than 2 years old. Choose the approved test you have taken or plan to take.</p>
                </div>

                {/* Primary Language Test */}
                <div style={{ padding: '20px', borderRadius: '12px', border: '2px solid #BFDBFE', background: '#EFF6FF', marginBottom: '20px' }}>
                  <h4 style={{ fontWeight: 700, color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563EB', color: 'white', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
                    Primary Language Test
                  </h4>
                  <select className="form-select" value={lang1Test} onChange={e => {
                    setLang1Test(e.target.value);
                    setLang1L(''); setLang1S(''); setLang1R(''); setLang1W('');
                    if (e.target.value.includes('English') && lang2Test.includes('English')) setLang2Test('None / Not Applicable');
                    if (e.target.value.includes('French') && lang2Test.includes('French')) setLang2Test('None / Not Applicable');
                  }}>
                    <option value="">Select primary test...</option>
                    <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                    <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                    <option value="PTE Core (English)">PTE Core (English)</option>
                    <option value="TEF Canada (French)">TEF Canada (French)</option>
                    <option value="TCF Canada (French)">TCF Canada (French)</option>
                  </select>
                  {lang1Test && renderLangGrid(lang1Test, lang1L, lang1S, lang1R, lang1W, setLang1L, setLang1S, setLang1R, setLang1W, '#1E40AF')}
                </div>

                {/* Secondary Language Test */}
                {lang1Test && (
                  <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--surface-color)' }}>
                    <h4 style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#94A3B8', color: 'white', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>2</span>
                      Secondary Test (Optional)
                    </h4>
                    <select className="form-select" value={lang2Test} onChange={e => { setLang2Test(e.target.value); setLang2L(''); setLang2S(''); setLang2R(''); setLang2W(''); }}>
                      <option value="None / Not Applicable">None / Not Applicable</option>
                      {!lang1Test.includes('English') && <option value="CELPIP-General (English)">CELPIP-General (English)</option>}
                      {!lang1Test.includes('English') && <option value="IELTS General Training (English)">IELTS General Training (English)</option>}
                      {!lang1Test.includes('English') && <option value="PTE Core (English)">PTE Core (English)</option>}
                      {!lang1Test.includes('French') && <option value="TEF Canada (French)">TEF Canada (French)</option>}
                      {!lang1Test.includes('French') && <option value="TCF Canada (French)">TCF Canada (French)</option>}
                    </select>
                    {lang2Test !== 'None / Not Applicable' && renderLangGrid(lang2Test, lang2L, lang2S, lang2R, lang2W, setLang2L, setLang2S, setLang2R, setLang2W, '#475569')}
                  </div>
                )}

                <div className="crs-nav-buttons">
                  <button className="btn btn-outline" onClick={handleBack}>← Back</button>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={!canAdvance()} style={{ opacity: canAdvance() ? 1 : 0.5 }}>
                    Next Step →
                  </button>
                </div>
              </div>
            )}

            {/* ════════════ PHASE 3: WORK & ADDITIONAL ════════════ */}
            {p.id === 'work_extra' && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>💼 Work & Additional Factors</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Your work experience and additional factors can significantly boost your score.</p>

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>🏢 Work Experience</h3>

                <div className="highlight-box" style={{ background: '#FAF5FF', borderColor: '#E9D5FF', marginBottom: '20px' }}>
                  <p style={{ color: '#4C1D95' }}><strong style={{ color: '#7E22CE' }}>Hours Calculation:</strong> Working 30 hours/week for 12 months = 1 year full-time (1,560 hours). Part-time work of 15 hours/week for 24 months also equals 1 year. Hours beyond 30/week are not counted.</p>
                </div>

                {renderSelect('Years of skilled work experience in Canada (NOC TEER 0, 1, 2, or 3)', canadianWork, setCanadianWork, [
                  { val: '', label: 'Select years...' },
                  { val: 'None or less than a year', label: 'None or less than a year' },
                  { val: '1 year', label: '1 year' }, { val: '2 years', label: '2 years' },
                  { val: '3 years', label: '3 years' }, { val: '4 years', label: '4 years' },
                  { val: '5 years or more', label: '5 years or more' },
                ], true)}

                {renderSelect('Years of foreign skilled work experience (outside Canada)', foreignWork, setForeignWork, [
                  { val: '', label: 'Select years...' },
                  { val: 'None or less than a year', label: 'None or less than a year' },
                  { val: '1 year', label: '1 year' }, { val: '2 years', label: '2 years' },
                  { val: '3 years or more', label: '3 years or more' },
                ], true)}

                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginTop: '32px' }}>⭐ Additional Factors</h3>

                <div className="form-group">
                  <label className="form-label">Do you have a certificate of qualification from a Canadian province?</label>
                  <div className="highlight-box" style={{ marginBottom: '12px' }}>
                    <p><strong>Definition:</strong> A certificate of qualification shows that a person is qualified to work in a particular skilled trade in Canada — they passed a certification test and meet all requirements for that province/territory.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <OptionCard title="Yes" selected={certOfQualification === 'Yes'} onClick={() => setCertOfQualification('Yes')} />
                    <OptionCard title="No" selected={certOfQualification === 'No'} onClick={() => setCertOfQualification('No')} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Do you have a sibling living in Canada who is a citizen or PR?</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <OptionCard title="Yes" selected={siblingInCanada === 'Yes'} onClick={() => setSiblingInCanada('Yes')} />
                    <OptionCard title="No" selected={siblingInCanada === 'No'} onClick={() => setSiblingInCanada('No')} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Do you have a valid Provincial Nomination?</label>
                  <div className="highlight-box" style={{ marginBottom: '12px' }}>
                    <p><strong>Note:</strong> A provincial nomination certificate is issued by a Canadian province or territory through their PNP. This gives you 600 additional points and virtually guarantees an invitation to apply.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <OptionCard title="Yes" selected={provincialNom === 'Yes'} onClick={() => setProvincialNom('Yes')} />
                    <OptionCard title="No" selected={provincialNom === 'No'} onClick={() => setProvincialNom('No')} />
                  </div>
                </div>

                <div className="crs-nav-buttons">
                  <button className="btn btn-outline" onClick={handleBack}>← Back</button>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={!canAdvance()} style={{ opacity: canAdvance() ? 1 : 0.5 }}>
                    {currentPhaseIndex === phases.length - 2 ? "See Result →" : "Next Step →"}
                  </button>
                </div>
              </div>
            )}

            {/* ════════════ PHASE 4: SPOUSE ════════════ */}
            {p.id === 'spouse' && (
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '4px' }}>💗 Spouse / Partner Factors</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Your spouse's qualifications can contribute additional CRS points.</p>

                {renderSelect("Spouse's Highest Level of Education", spouseEducation, setSpouseEducation, [
                  { val: '', label: 'Select level...' },
                  { val: 'none', label: 'None, or less than secondary' },
                  { val: 'secondary', label: 'Secondary diploma (high school)' },
                  { val: 'one-year', label: 'One-year program' },
                  { val: 'two-year', label: 'Two-year program' },
                  { val: 'bachelors', label: "Bachelor's degree or 3+ year program" },
                  { val: 'two-or-more', label: 'Two or more certificates (one being 3+ years)' },
                  { val: 'masters', label: "Master's degree or professional degree" },
                  { val: 'doctoral', label: 'Doctoral degree' },
                ], true)}

                {renderSelect("Spouse's Canadian Work Experience", spouseCanadianWork, setSpouseCanadianWork, [
                  { val: '', label: 'Select years...' },
                  { val: 'None or less than a year', label: 'None or less than a year' },
                  { val: '1 year', label: '1 year' }, { val: '2 years', label: '2 years' },
                  { val: '3 years', label: '3 years' }, { val: '4 years', label: '4 years' },
                  { val: '5 years or more', label: '5 years or more' },
                ], true)}

                {/* Spouse Language Test */}
                <div style={{ padding: '20px', borderRadius: '12px', border: '2px solid #FBCFE8', background: '#FFF1F2', marginTop: '20px' }}>
                  <h4 style={{ fontWeight: 700, color: '#9D174D', marginBottom: '12px' }}>Spouse's Language Test</h4>
                  <select className="form-select" value={spLangTest} onChange={e => { setSpLangTest(e.target.value); setSpL(''); setSpS(''); setSpR(''); setSpW(''); }}>
                    <option value="None / Not Applicable">None / Not Applicable</option>
                    <option value="CELPIP-General (English)">CELPIP-General (English)</option>
                    <option value="IELTS General Training (English)">IELTS General Training (English)</option>
                    <option value="PTE Core (English)">PTE Core (English)</option>
                    <option value="TEF Canada (French)">TEF Canada (French)</option>
                    <option value="TCF Canada (French)">TCF Canada (French)</option>
                  </select>
                  {spLangTest !== 'None / Not Applicable' && renderLangGrid(spLangTest, spL, spS, spR, spW, setSpL, setSpS, setSpR, setSpW, '#9D174D')}
                </div>

                <div className="crs-nav-buttons">
                  <button className="btn btn-outline" onClick={handleBack}>← Back</button>
                  <div style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={!canAdvance()} style={{ opacity: canAdvance() ? 1 : 0.5 }}>
                    See Result →
                  </button>
                </div>
              </div>
            )}

            {/* ════════════ PHASE 5: RESULTS ════════════ */}
            {isResults && !isSignedIn && (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 100%)', borderRadius: '16px', border: '1px solid #DBEAFE', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -20, left: -20, fontSize: '8rem', opacity: 0.03, transform: 'rotate(-15deg)' }}>🎯</div>
                <div style={{ position: 'absolute', bottom: -20, right: -20, fontSize: '8rem', opacity: 0.03, transform: 'rotate(15deg)' }}>📈</div>

                <div style={{ display: 'inline-block', padding: '4px 12px', background: '#DC2626', color: 'white', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '20px', marginBottom: '24px' }}>
                  Wait — Your Score is Ready
                </div>
                
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px', lineHeight: 1.2 }}>
                  Your score may be below the Express Entry cutoff.
                </h2>
                
                <p style={{ fontSize: '1.05rem', color: '#475569', marginBottom: '32px', maxWidth: '520px', margin: '0 auto 32px auto', lineHeight: 1.6 }}>
                  Don't lose your chance at Canadian PR over a few missing points. Unlock your exact breakdown to see the gap and discover the fastest ways to improve it.
                </p>

                {/* The "Blur" Reveal */}
                <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #E2E8F0', maxWidth: '380px', margin: '0 auto 32px auto', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Your Calculated CRS Score</div>
                  <div style={{ fontSize: '4.5rem', fontWeight: 900, color: '#1E3A8A', letterSpacing: '4px', lineHeight: 1 }}>
                    {String(score.total).charAt(0)}<span style={{ filter: 'blur(8px)', opacity: 0.6 }}>XX</span>
                  </div>
                </div>

                <div style={{ maxWidth: '380px', margin: '0 auto 32px auto', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#DBEAFE', color: '#1D4ED8', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>✓</div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>See your exact CRS score out of 1200</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#DBEAFE', color: '#1D4ED8', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>✓</div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>Find your points gap to the PR cutoff</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#DBEAFE', color: '#1D4ED8', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem' }}>✓</div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>Get personalized actions to improve</span>
                  </div>
                </div>

                <SignInButton mode="modal">
                  <button className="btn btn-primary btn-lg" style={{ width: '100%', maxWidth: '380px', fontSize: '1.05rem', padding: '16px 24px', boxShadow: '0 8px 20px rgba(37, 99, 235, 0.25)' }}>
                    Unlock My Score & Improvement Plan
                  </button>
                </SignInButton>
                
                <div style={{ marginTop: '20px', fontSize: '0.85rem', color: '#64748B', display: 'flex', justifyContent: 'center', gap: '20px', fontWeight: 500 }}>
                  <span>✨ Free</span>
                  <span>⚡ Takes 10 seconds</span>
                  <span>📄 No documents required</span>
                </div>
                
                <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: '1px solid #E2E8F0', fontSize: '0.85rem', color: '#94A3B8', fontWeight: 500 }}>
                  Loved by thousands of Express Entry applicants.
                </div>
              </div>
            )}

            {isResults && isSignedIn && (
              <div>
                {isSaving && (
                  <div style={{ padding: '8px 12px', background: '#DBEAFE', color: '#1D4ED8', fontSize: '0.85rem', borderRadius: '8px', marginBottom: '24px', textAlign: 'center' }}>
                    ⏳ Saving results to your dashboard...
                  </div>
                )}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px' }}>Calculation Complete</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Your estimated Comprehensive Ranking System score is ready.</p>

                  <div className="score-display" style={{ maxWidth: '400px', margin: '0 auto', marginBottom: '32px' }}>
                    <div className="score-number">{score.total}</div>
                    <div className="score-label">Total CRS Score / 1200</div>
                  </div>
                </div>

                <div style={{ marginBottom: '40px' }}>
                  <ScoreVsCutoff userScore={score.total} onOpenWarRoom={() => {
                    const el = document.getElementById('war-room-paywall');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }
                  }} />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, marginBottom: '4px' }}>Score Breakdown</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>This breakdown mirrors the official IRCC scoring grid.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                  {breakdownBars.map(sec => (
                    <div key={sec.label} style={{ padding: '16px 20px', background: '#FAFAFA', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{sec.label}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{sec.val} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {sec.max}</span></span>
                      </div>
                      <div style={{ height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min((sec.val / sec.max) * 100, 100)}%`, background: sec.color, borderRadius: '4px', transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Comprehensive Breakdown Table</h3>
                <div style={{ borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Factor</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '0.78rem', color: '#3730A3', textTransform: 'uppercase', letterSpacing: '0.5px' }}>A. Core/human capital factors</td></tr>
                      {[
                        ['Age', score.breakdown.core.age],
                        ['Level of education', score.breakdown.core.education],
                        ['Official languages', score.breakdown.core.officialLanguages],
                        ['Canadian work experience', score.breakdown.core.canadianWorkExperience],
                      ].map(([label, val]) => (
                        <tr key={label as string} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 16px 8px 32px', color: 'var(--text-muted)' }}>{label}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>{val}</td>
                        </tr>
                      ))}

                      {hasSpouseForMath && (
                        <>
                          <tr><td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '0.78rem', color: '#9D174D', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border-color)' }}>B. Spouse factors</td></tr>
                          {[
                            ['Level of education', score.breakdown.spouse.education],
                            ['Official languages', score.breakdown.spouse.firstOfficialLanguages],
                            ['Canadian work experience', score.breakdown.spouse.canadianWorkExperience],
                          ].map(([label, val]) => (
                            <tr key={label as string} style={{ borderTop: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 16px 8px 32px', color: 'var(--text-muted)' }}>{label}</td>
                              <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>{val}</td>
                            </tr>
                          ))}
                        </>
                      )}

                      <tr><td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '0.78rem', color: '#115E59', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border-color)' }}>C. Skill transferability factors</td></tr>
                      {[
                        ['Education', score.breakdown.transferability.education.subtotal],
                        ['Foreign work experience', score.breakdown.transferability.foreignWork.subtotal],
                        ['Certificate of qualification', score.breakdown.transferability.certificateOfQualification],
                      ].map(([label, val]) => (
                        <tr key={label as string} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 16px 8px 32px', color: 'var(--text-muted)' }}>{label}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>{val}</td>
                        </tr>
                      ))}

                      <tr><td colSpan={2} style={{ padding: '10px 16px', fontWeight: 700, fontSize: '0.78rem', color: '#B45309', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: '1px solid var(--border-color)' }}>D. Additional points</td></tr>
                      {[
                        ['Provincial nomination', score.breakdown.additional.provincialNomination],
                        ['Job offer', 0],
                        ['Study in Canada', score.breakdown.additional.studyInCanada],
                        ['Sibling in Canada', score.breakdown.additional.siblingInCanada],
                        ['French-language skills', score.breakdown.additional.frenchLanguageSkills],
                      ].map(([label, val]) => (
                        <tr key={label as string} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '8px 16px 8px 32px', color: 'var(--text-muted)' }}>{label}</td>
                          <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600 }}>{val}</td>
                        </tr>
                      ))}

                      <tr style={{ background: '#FAFAFA', borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.82rem' }}>Grand Total</td>
                        <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, fontSize: '1.3rem' }}>{score.total}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="crs-nav-buttons">
                  <button className="btn btn-outline" onClick={handleBack}>← Back</button>
                </div>


                {/* ═══════ ITA STRATEGY REPORT (hidden — redesign pending) ═══════ */}
                {false && strategyReport && (
                  <div style={{ marginTop: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>🎯 Your Personalized ITA Strategy</h3>
                      <button
                        className="btn btn-outline"
                        style={{ fontSize: '0.82rem' }}
                        onClick={() => {
                          const printDiv = document.getElementById('ita-strategy-print');
                          if (printDiv) {
                            const w = window.open('', '_blank');
                            if (w) {
                              w.document.write('<html><head><title>ITA Strategy Report</title><style>body{font-family:system-ui,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#1e293b;line-height:1.6}h2{color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:8px}h3{color:#0f172a;margin-top:24px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:10px 14px;border:1px solid #e2e8f0;text-align:left;font-size:14px}th{background:#f8fafc;font-weight:700}.badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700}</style></head><body>');
                              w.document.write(printDiv.innerHTML);
                              w.document.write('</body></html>');
                              w.document.close();
                              w.print();
                            }
                          }
                        }}
                      >
                        📄 Download PDF
                      </button>
                    </div>

                    <div id="ita-strategy-print">
                      {/* Overall Assessment */}
                      <div style={{ padding: '24px', background: 'linear-gradient(135deg, #EFF6FF, #F0FDF4)', borderRadius: '12px', border: '1px solid #DBEAFE', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>Your Score</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1E3A8A' }}>{strategyReport.current_score}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>Cutoff</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#059669' }}>~{strategyReport.estimated_cutoff}</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, letterSpacing: '0.5px' }}>Gap</div>
                            <div style={{ fontSize: '2rem', fontWeight: 900, color: strategyReport.gap > 0 ? '#DC2626' : '#059669' }}>{strategyReport.gap > 0 ? `-${strategyReport.gap}` : '+' + Math.abs(strategyReport.gap)}</div>
                          </div>
                        </div>
                        <p style={{ fontSize: '0.95rem', color: '#334155', textAlign: 'center', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
                          {strategyReport.overall_assessment}
                        </p>
                      </div>

                      {/* Ranked Actions */}
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>📋 Ranked Actions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                        {(strategyReport.actions || []).map((action: any) => (
                          <div key={action.rank} style={{ padding: '20px', background: '#FAFAFA', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1E3A8A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, flexShrink: 0 }}>{action.rank}</span>
                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>{action.title}</span>
                              </div>
                              <span style={{ padding: '4px 12px', background: '#DBEAFE', color: '#1D4ED8', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>{action.potential_points}</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, marginBottom: '12px' }}>{action.description}</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem' }}>
                              <span style={{ padding: '2px 10px', background: action.priority === 'Critical' ? '#FEE2E2' : action.priority === 'High' ? '#FEF3C7' : '#F0FDF4', color: action.priority === 'Critical' ? '#991B1B' : action.priority === 'High' ? '#92400E' : '#166534', borderRadius: '8px', fontWeight: 600 }}>{action.priority}</span>
                              <span style={{ color: '#64748B' }}>⏱️ {action.estimated_timeline}</span>
                              <span style={{ color: '#64748B' }}>💰 {action.estimated_cost}</span>
                              <span style={{ color: '#64748B' }}>📈 {action.effort_level} effort</span>
                            </div>
                            {action.specific_targets && (
                              <div style={{ marginTop: '10px', padding: '10px 14px', background: '#EFF6FF', borderRadius: '8px', fontSize: '0.85rem', color: '#1E40AF', fontWeight: 500 }}>
                                🎯 Target: {action.specific_targets}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Language Optimization */}
                      {strategyReport.language_optimization && (
                        <>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>🗣️ Language Score Optimization</h3>
                          <div style={{ padding: '20px', background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FDE68A', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <span style={{ fontWeight: 600 }}>Current 1st language points</span>
                              <span style={{ fontWeight: 700 }}>{strategyReport.language_optimization.current_first_language_points}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <span style={{ fontWeight: 600 }}>Maximum possible</span>
                              <span style={{ fontWeight: 700, color: '#059669' }}>{strategyReport.language_optimization.max_first_language_points}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                              <span style={{ fontWeight: 600 }}>Points you can gain</span>
                              <span style={{ fontWeight: 700, color: '#1D4ED8' }}>+{strategyReport.language_optimization.improvement_possible}</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: '#92400E', lineHeight: 1.6 }}><strong>Target scores:</strong> {strategyReport.language_optimization.specific_targets}</p>
                            {strategyReport.language_optimization.second_language_recommendation && (
                              <p style={{ fontSize: '0.9rem', color: '#92400E', lineHeight: 1.6, marginTop: '8px' }}><strong>2nd language:</strong> {strategyReport.language_optimization.second_language_recommendation}</p>
                            )}
                          </div>
                        </>
                      )}

                      {/* PNP Recommendations */}
                      {strategyReport.pnp_recommendations?.length > 0 && (
                        <>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>🗺️ Provincial Nominee Programs (PNP)</h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
                            {strategyReport.pnp_recommendations.map((pnp: any, i: number) => (
                              <div key={i} style={{ padding: '20px', background: '#F0FDF4', borderRadius: '12px', border: '1px solid #BBF7D0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span style={{ fontWeight: 700 }}>{pnp.province} — {pnp.stream}</span>
                                  <span style={{ padding: '4px 12px', background: '#059669', color: 'white', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>{pnp.points_impact}</span>
                                </div>
                                <p style={{ fontSize: '0.9rem', color: '#166534', lineHeight: 1.6, marginBottom: '8px' }}>{pnp.why_suitable}</p>
                                <p style={{ fontSize: '0.82rem', color: '#15803D' }}><strong>Key requirements:</strong> {pnp.requirements_summary}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Timeline Summary */}
                      {strategyReport.timeline_summary && (
                        <div style={{ padding: '20px', background: '#EFF6FF', borderRadius: '12px', border: '1px solid #BFDBFE', marginBottom: '24px' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', color: '#1E3A8A' }}>⏱️ Recommended Timeline</h3>
                          <p style={{ fontSize: '0.9rem', color: '#1E40AF', lineHeight: 1.6 }}>{strategyReport.timeline_summary}</p>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.78rem', color: '#94A3B8', lineHeight: 1.5, fontStyle: 'italic' }}>
                        {strategyReport.disclaimer || 'This report provides general guidance based on publicly available CRS criteria. It is not legal advice. For personalized legal advice, consult a Regulated Canadian Immigration Consultant (RCIC) or immigration lawyer.'}
                      </div>
                    </div>
                  </div>
                )}
                {/* ══════ CRS War Room ══════ */}
                <CRSWarRoom 
                  userScore={score.total} 
                  tier={tier} 
                  hasWarRoomAccess={tier !== 'free' || (credits?.ita_strategy_credits > 0)}
                  crsInputs={crsInputs} 
                  unlockCTA={undefined} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
