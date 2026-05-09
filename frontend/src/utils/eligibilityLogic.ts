/**
 * Eligibility Assessment Logic
 * 
 * Pure functions — no API calls, no side effects.
 * All calculations run client-side for instant results and zero API cost.
 * 
 * Implements:
 * - FSWP 67-point selection grid
 * - CEC eligibility check
 * - FSTP eligibility check
 * - Rough CRS range estimate
 */

import {
  getFSWPAgePoints,
  getFSWPLanguagePoints,
  getFSWPSecondLanguagePoints,
  getFSWPExperiencePoints,
  getMinClb,
  getRequiredFunds,
  EDUCATION_LEVELS,
  isTeerEligibleForCEC,
  type CLBScores,
} from '../data/eligibilityRules';

// Map CRS-format education keys → eligibility keys for EDUCATION_LEVELS lookup
const CRS_TO_ELIG_EDU: Record<string, string> = {
  'one-year': 'one_year_post_secondary',
  'two-year': 'two_year_post_secondary',
  'bachelors': 'three_year_post_secondary',
  'two-or-more': 'two_credentials',
  // These are the same in both systems:
  'none': 'none',
  'secondary': 'secondary',
  'masters': 'masters',
  'doctoral': 'doctoral',
};

// ── Types ──

export interface EligibilityProfile {
  age: number | null;
  educationLevel: string | null;
  educationInCanada: boolean | null;
  hasEca: boolean | null;
  
  primaryLanguageTest: string | null;
  primaryScores: CLBScores | null;  // CLB levels (already converted from raw test scores)
  secondaryLanguageTest: string | null;
  secondaryScores: CLBScores | null;  // CLB levels (already converted)

  totalSkilledExperienceYears: number | null;
  canadianExperienceYears: number | null;
  teerCategory: string | null; // from NOC code eg "1"

  hasJobOffer: boolean | null;
  hasProvincialNomination: boolean | null;
  hasRelativeInCanada: boolean | null;
  canadianExperienceRecent: boolean | null; // within last 3 years
  maritalStatus: string | null;
  spouseAccompanying: boolean | null;
  familySize: number | null; // for proof of funds calculation
}

export interface ProgramEligibility {
  program: 'FSWP' | 'CEC' | 'FSTP';
  eligible: boolean;
  mayQualify: boolean; // true if they might qualify with more info
  score?: number; // for FSWP 67-point grid
  passingScore?: number; // 67 for FSWP
  requirements: RequirementCheck[];
}

export interface RequirementCheck {
  label: string;
  met: boolean | null; // null = unable to determine
  detail: string;
  critical: boolean; // if false, this is a warning not a must-have
}

export interface EligibilityResult {
  fswp: ProgramEligibility;
  cec: ProgramEligibility;
  fstp: ProgramEligibility;
  estimatedCrsRange: [number, number] | null; // [low, high]
  recommendedProgram: string | null;
}


// ── FSWP Assessment ──

export function assessFSWP(profile: EligibilityProfile): ProgramEligibility {
  const requirements: RequirementCheck[] = [];
  let totalPoints = 0;

  // 1. Education (max 25 pts)
  const eduKey = profile.educationLevel ? (CRS_TO_ELIG_EDU[profile.educationLevel] || profile.educationLevel) : null;
  const educationEntry = EDUCATION_LEVELS.find(e => e.value === eduKey);
  const educationPoints = educationEntry?.fswpPoints ?? 0;
  totalPoints += educationPoints;
  requirements.push({
    label: `Education: ${educationPoints}/25 points`,
    met: educationPoints > 0,
    detail: educationEntry ? educationEntry.label : 'No education level provided',
    critical: true,
  });

  // 2. Language — First Official Language (max 24 pts)
  let primaryClb: CLBScores = { speaking: 0, listening: 0, reading: 0, writing: 0 };
  let languagePoints = 0;
  if (profile.primaryLanguageTest && profile.primaryScores && profile.primaryLanguageTest !== 'none') {
    primaryClb = profile.primaryScores;  // Already CLB values
    languagePoints = getFSWPLanguagePoints(primaryClb);
  }
  totalPoints += languagePoints;

  const minPrimaryClb = getMinClb(primaryClb);
  requirements.push({
    label: `First language: ${languagePoints}/24 points (min CLB ${minPrimaryClb})`,
    met: minPrimaryClb >= 7,
    detail: minPrimaryClb >= 7
      ? `CLB ${minPrimaryClb}+ in all abilities ✓`
      : `Minimum CLB 7 required in all abilities. Your lowest is CLB ${minPrimaryClb}.`,
    critical: true,
  });

  // 3. Language — Second Official Language (max 4 pts)
  let secondaryClb: CLBScores | null = null;
  let secondLanguagePoints = 0;
  if (profile.secondaryLanguageTest && profile.secondaryScores && profile.secondaryLanguageTest !== 'none') {
    secondaryClb = profile.secondaryScores;  // Already CLB values
    secondLanguagePoints = getFSWPSecondLanguagePoints(secondaryClb);
  }
  totalPoints += secondLanguagePoints;
  if (secondLanguagePoints > 0) {
    requirements.push({
      label: `Second language: ${secondLanguagePoints}/4 points`,
      met: true,
      detail: 'CLB 5+ in all abilities of a second official language',
      critical: false,
    });
  }

  // 4. Work Experience (max 15 pts)
  const expYears = profile.totalSkilledExperienceYears ?? 0;
  const experiencePoints = getFSWPExperiencePoints(expYears);
  totalPoints += experiencePoints;
  requirements.push({
    label: `Work experience: ${experiencePoints}/15 points`,
    met: expYears >= 1,
    detail: expYears >= 1
      ? `${expYears} year(s) of continuous skilled work experience`
      : 'At least 1 year of continuous full-time (or equivalent) skilled work experience required',
    critical: true,
  });

  // 5. Age (max 12 pts)
  const agePoints = profile.age ? getFSWPAgePoints(profile.age) : 0;
  totalPoints += agePoints;
  requirements.push({
    label: `Age: ${agePoints}/12 points`,
    met: agePoints > 0,
    detail: profile.age ? `Age ${profile.age}` : 'Age not provided',
    critical: false,
  });

  // 6. Arranged Employment (max 10 pts)
  const employmentPoints = profile.hasJobOffer ? 10 : 0;
  totalPoints += employmentPoints;
  if (profile.hasJobOffer) {
    requirements.push({
      label: `Arranged employment: ${employmentPoints}/10 points`,
      met: true,
      detail: 'Valid Canadian job offer supported by LMIA',
      critical: false,
    });
  }

  // 7. Adaptability (max 10 pts)
  let adaptabilityPoints = 0;
  const adaptabilityDetails: string[] = [];
  if (profile.educationInCanada) {
    adaptabilityPoints += 5;
    adaptabilityDetails.push('Canadian education (+5)');
  }
  if (profile.canadianExperienceYears && profile.canadianExperienceYears >= 1) {
    adaptabilityPoints += 10;
    adaptabilityDetails.push('Canadian work experience (+10)');
  }
  if (profile.hasRelativeInCanada) {
    adaptabilityPoints += 5;
    adaptabilityDetails.push('Relative in Canada (+5)');
  }
  if (profile.hasJobOffer) {
    adaptabilityPoints += 5;
    adaptabilityDetails.push('Arranged employment (+5)');
  }
  adaptabilityPoints = Math.min(adaptabilityPoints, 10);
  totalPoints += adaptabilityPoints;
  requirements.push({
    label: `Adaptability: ${adaptabilityPoints}/10 points`,
    met: adaptabilityPoints > 0 ? true : null,
    detail: adaptabilityDetails.length > 0
      ? adaptabilityDetails.join(', ') + ` (capped at 10)`
      : 'No adaptability points. Consider: Canadian education, work experience, relatives in Canada, or a job offer.',
    critical: false,
  });

  // Proof of funds requirement
  const familySize = profile.familySize ?? 1;
  const requiredFunds = getRequiredFunds(familySize);
  const fundsExempt = profile.hasJobOffer || (profile.canadianExperienceYears && profile.canadianExperienceYears >= 1);
  requirements.push({
    label: 'Proof of funds',
    met: fundsExempt ? true : null,
    detail: fundsExempt
      ? 'Not required — you have a valid job offer or current Canadian work experience'
      : `You must show at least $${requiredFunds.toLocaleString()} CAD for a family of ${familySize}. Amount changes annually.`,
    critical: true,
  });

  // Eligible occupation
  const teerOk = profile.teerCategory ? ['0', '1', '2', '3'].includes(profile.teerCategory) : null;
  requirements.push({
    label: 'Skilled occupation (TEER 0, 1, 2, or 3)',
    met: teerOk,
    detail: teerOk === null
      ? 'Complete the NOC Finder to determine your TEER category'
      : teerOk
        ? `TEER ${profile.teerCategory} ✓`
        : `TEER ${profile.teerCategory} — not eligible for FSWP`,
    critical: true,
  });

  const eligible = totalPoints >= 67 && minPrimaryClb >= 7 && expYears >= 1;
  const mayQualify = totalPoints >= 55 && !eligible; // Close but not there

  return {
    program: 'FSWP',
    eligible,
    mayQualify,
    score: totalPoints,
    passingScore: 67,
    requirements,
  };
}


// ── CEC Assessment ──

export function assessCEC(profile: EligibilityProfile): ProgramEligibility {
  const requirements: RequirementCheck[] = [];

  // 1. Canadian work experience
  const canadaExp = profile.canadianExperienceYears ?? 0;
  const hasMinExp = canadaExp >= 1;

  // Recency check — CEC requires experience within last 3 years
  const isRecent = profile.canadianExperienceRecent;
  const recencyMet = isRecent === true || isRecent === null; // null = not asked, assume OK

  requirements.push({
    label: '1+ year of Canadian skilled work experience (within last 3 years)',
    met: hasMinExp && recencyMet ? hasMinExp : false,
    detail: !hasMinExp
      ? 'CEC requires at least 1 year of skilled work experience in Canada within the last 3 years'
      : isRecent === false
        ? '⚠️ Your Canadian experience must be within the last 3 years to qualify for CEC'
        : `${canadaExp} year(s) of Canadian skilled work experience ✓`,
    critical: true,
  });

  // 2. Language (CLB depends on TEER)
  let primaryClb: CLBScores = { speaking: 0, listening: 0, reading: 0, writing: 0 };
  if (profile.primaryLanguageTest && profile.primaryScores && profile.primaryLanguageTest !== 'none') {
    primaryClb = profile.primaryScores;  // Already CLB values
  }
  const minClb = getMinClb(primaryClb);

  // TEER 0, 1 → CLB 7   |   TEER 2, 3 → CLB 5
  const teer = profile.teerCategory;
  let requiredClb = 7; // default to higher requirement
  if (teer === '2' || teer === '3') requiredClb = 5;

  const clbMet = minClb >= requiredClb;
  requirements.push({
    label: `Language: CLB ${requiredClb}+ in all abilities`,
    met: profile.primaryLanguageTest === 'none' ? null : clbMet,
    detail: profile.primaryLanguageTest === 'none'
      ? 'Take a language test (IELTS General or CELPIP) to check this requirement'
      : clbMet
        ? `CLB ${minClb} in all abilities ✓ (required: CLB ${requiredClb} for TEER ${teer || '0/1'})`
        : `Your minimum CLB is ${minClb}. Requires CLB ${requiredClb} for TEER ${teer || '0/1'}.`,
    critical: true,
  });

  // 3. TEER category
  const teerOk = teer ? isTeerEligibleForCEC(teer) : null;
  requirements.push({
    label: 'TEER 0, 1, 2, or 3 occupation',
    met: teerOk,
    detail: teerOk === null
      ? 'Complete the NOC Finder to determine your TEER category'
      : teerOk
        ? `TEER ${teer} ✓`
        : `TEER ${teer} — not eligible for CEC`,
    critical: true,
  });

  // No proof of funds required for CEC
  requirements.push({
    label: 'Proof of funds',
    met: true,
    detail: 'Not required for CEC (only required for FSWP)',
    critical: false,
  });

  const eligible = hasMinExp && (isRecent !== false) && clbMet && (teerOk === true);
  const mayQualify = !eligible && (hasMinExp || (canadaExp > 0));

  return {
    program: 'CEC',
    eligible,
    mayQualify,
    requirements,
  };
}


// ── FSTP Assessment ──

export function assessFSTP(profile: EligibilityProfile): ProgramEligibility {
  const requirements: RequirementCheck[] = [];

  // 1. Skilled trades experience (2+ years)
  // We don't have a specific "trades experience" field, so we use total + TEER check
  const expYears = profile.totalSkilledExperienceYears ?? 0;
  const hasMinExp = expYears >= 2;
  requirements.push({
    label: '2+ years of full-time skilled trades work experience (within last 5 years)',
    met: hasMinExp,
    detail: hasMinExp
      ? `${expYears} years of skilled work experience ✓`
      : 'FSTP requires at least 2 years of full-time experience in a skilled trade',
    critical: true,
  });

  // 2. TEER category — must be in specific trade groups (TEER 2 or 3 with specific NOC major groups)
  const teer = profile.teerCategory;
  const teerOk = teer ? ['2', '3'].includes(teer) : null;
  requirements.push({
    label: 'Skilled trade occupation (specific NOC groups)',
    met: teerOk,
    detail: teerOk === null
      ? 'Complete the NOC Finder to determine your occupation category'
      : teerOk
        ? 'Your occupation may qualify for FSTP. Verify your specific NOC code against IRCC\'s eligible trades list.'
        : 'FSTP requires occupations in specific skilled trade NOC groups (typically TEER 2/3)',
    critical: true,
  });

  // 3. Valid job offer OR certificate of qualification
  requirements.push({
    label: 'Valid job offer or certificate of qualification from a Canadian authority',
    met: profile.hasJobOffer || null,
    detail: profile.hasJobOffer
      ? 'Valid Canadian job offer ✓'
      : 'FSTP requires either a valid job offer from up to 2 Canadian employers OR a certificate of qualification from a Canadian provincial/territorial authority',
    critical: true,
  });

  // 4. Language (CLB 5 speaking/listening, CLB 4 reading/writing)
  let primaryClb: CLBScores = { speaking: 0, listening: 0, reading: 0, writing: 0 };
  if (profile.primaryLanguageTest && profile.primaryScores && profile.primaryLanguageTest !== 'none') {
    primaryClb = profile.primaryScores;  // Already CLB values
  }
  const slMet = primaryClb.speaking >= 5 && primaryClb.listening >= 5;
  const rwMet = primaryClb.reading >= 4 && primaryClb.writing >= 4;
  const langMet = slMet && rwMet;

  requirements.push({
    label: 'Language: CLB 5+ speaking/listening, CLB 4+ reading/writing',
    met: profile.primaryLanguageTest === 'none' ? null : langMet,
    detail: profile.primaryLanguageTest === 'none'
      ? 'Take a language test to check this requirement'
      : langMet
        ? `S:${primaryClb.speaking} L:${primaryClb.listening} R:${primaryClb.reading} W:${primaryClb.writing} ✓`
        : `Your CLB scores: S:${primaryClb.speaking} L:${primaryClb.listening} R:${primaryClb.reading} W:${primaryClb.writing}. FSTP requires S/L ≥ 5 and R/W ≥ 4.`,
    critical: true,
  });

  const eligible = hasMinExp && langMet && (profile.hasJobOffer === true) && (teerOk === true);
  const mayQualify = !eligible && hasMinExp && (teerOk === true || teerOk === null);

  return {
    program: 'FSTP',
    eligible,
    mayQualify,
    requirements,
  };
}


// ── CRS Range Estimator ──

import {
  calculateCRSScore,
  type CRSInputs,
} from '../lib/crs-math';

/**
 * Computes a CRS range by running the actual CRS calculator engine.
 * Uses the full calculateCRSScore() for accurate core, transferability,
 * and additional points. Since the eligibility wizard doesn't collect
 * spouse language/education, we show a ±15 range to account for that.
 */
export function estimateCrsRange(profile: EligibilityProfile): [number, number] | null {
  if (!profile.age || !profile.primaryLanguageTest || profile.primaryLanguageTest === 'none') {
    return null;
  }

  const hasSpouse = profile.maritalStatus !== 'single' && profile.spouseAccompanying === true;

  // Map primary CLB scores (already in CLB format from the wizard)
  const clbS = profile.primaryScores?.speaking ?? 0;
  const clbL = profile.primaryScores?.listening ?? 0;
  const clbR = profile.primaryScores?.reading ?? 0;
  const clbW = profile.primaryScores?.writing ?? 0;

  // Map secondary CLB scores
  const clb2S = profile.secondaryScores?.speaking ?? 0;
  const clb2L = profile.secondaryScores?.listening ?? 0;
  const clb2R = profile.secondaryScores?.reading ?? 0;
  const clb2W = profile.secondaryScores?.writing ?? 0;

  const canadianWorkYears = profile.canadianExperienceYears ?? 0;
  const foreignWorkYears = Math.max(0, (profile.totalSkilledExperienceYears ?? 0) - canadianWorkYears);

  // Determine Canadian education type for additional points
  let canadianEducationType = '';
  if (profile.educationInCanada) {
    // Map education level to Canadian education type
    const edu = profile.educationLevel;
    if (edu === 'masters' || edu === 'doctoral' || edu === 'bachelors' || edu === 'two-or-more') {
      canadianEducationType = 'three-plus';
    } else if (edu === 'one-year' || edu === 'two-year') {
      canadianEducationType = 'one-two';
    }
  }

  // Detect French language for bonus points
  const primaryLangIsFrench = (profile.primaryLanguageTest === 'tef' || profile.primaryLanguageTest === 'tcf');
  const secondaryLangIsFrench = (profile.secondaryLanguageTest === 'tef' || profile.secondaryLanguageTest === 'tcf');
  const primaryLangIsEnglish = (profile.primaryLanguageTest === 'ielts_general' || profile.primaryLanguageTest === 'celpip' || profile.primaryLanguageTest === 'pte_core');
  const secondaryLangIsEnglish = (profile.secondaryLanguageTest === 'ielts_general' || profile.secondaryLanguageTest === 'celpip' || profile.secondaryLanguageTest === 'pte_core');

  const crsInputs: CRSInputs = {
    age: profile.age,
    education: profile.educationLevel || 'none',
    hasSpouseForMath: hasSpouse,

    clbSpeaking: clbS,
    clbListening: clbL,
    clbReading: clbR,
    clbWriting: clbW,

    clb2Speaking: clb2S,
    clb2Listening: clb2L,
    clb2Reading: clb2R,
    clb2Writing: clb2W,

    canadianWorkYears,
    foreignWorkYears,

    // Spouse factors — unknown from eligibility wizard, default to 0
    spouseEducation: 'none',
    spClbSpeaking: 0,
    spClbListening: 0,
    spClbReading: 0,
    spClbWriting: 0,
    spouseCanadianWorkYears: 0,

    // Additional factors
    provincialNomination: profile.hasProvincialNomination ?? false,
    hasCanadianEducation: profile.educationInCanada ?? false,
    canadianEducationType,
    siblingInCanada: profile.hasRelativeInCanada ?? false,
    certOfQualification: false,

    // Language identity
    primaryLangIsFrench,
    secondaryLangIsFrench,
    primaryLangIsEnglish,
    secondaryLangIsEnglish,
  };

  // ── Compute LOW bound: spouse contributes 0 points (worst case) ──
  const lowResult = calculateCRSScore(crsInputs);

  if (!hasSpouse) {
    // No spouse → score is precise, just ±5 for cert-of-qualification unknown
    return [Math.max(0, lowResult.total - 5), Math.min(1200, lowResult.total + 5)];
  }

  // ── Compute HIGH bound: spouse maxes out all factors (best case) ──
  // Spouse max: education=doctoral(10) + language CLB10 all(5×4=20) + 5yr Canadian work(10) = 40pts
  const highInputs: CRSInputs = {
    ...crsInputs,
    spouseEducation: 'doctoral',
    spClbSpeaking: 10,
    spClbListening: 10,
    spClbReading: 10,
    spClbWriting: 10,
    spouseCanadianWorkYears: 5,
  };
  const highResult = calculateCRSScore(highInputs);

  return [Math.max(0, lowResult.total), Math.min(1200, highResult.total)];
}


// ── Main Assessment Function ──

export function runEligibilityAssessment(profile: EligibilityProfile): EligibilityResult {
  const fswp = assessFSWP(profile);
  const cec = assessCEC(profile);
  const fstp = assessFSTP(profile);
  const crsRange = estimateCrsRange(profile);

  // Determine recommended program
  let recommended: string | null = null;
  if (cec.eligible) recommended = 'CEC';
  else if (fswp.eligible) recommended = 'FSWP';
  else if (fstp.eligible) recommended = 'FSTP';
  else if (cec.mayQualify) recommended = 'CEC';
  else if (fswp.mayQualify) recommended = 'FSWP';

  return {
    fswp,
    cec,
    fstp,
    estimatedCrsRange: crsRange,
    recommendedProgram: recommended,
  };
}
