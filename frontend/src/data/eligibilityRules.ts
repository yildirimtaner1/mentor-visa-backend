/**
 * Eligibility Rules — Config-Driven Data Tables
 * 
 * All IRCC eligibility logic is driven by these tables.
 * When IRCC updates their rules, we update these tables — not the logic code.
 * 
 * Sources:
 * - IRCC FSWP 67-point grid: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/federal-skilled-workers/six-selection-factors-702.html
 * - CRS: https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/eligibility/criteria-comprehensive-ranking-system/grid.html
 * - CLB-IELTS mapping: https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/operational-bulletins-manuals/standard-requirements/language-requirements/test-equivalency-charts.html
 */

// ── Education Levels ──

export const EDUCATION_LEVELS = [
  { value: 'none', label: 'Less than secondary (high school)', fswpPoints: 0, crsPoints: 0, crsFactor: 0 },
  { value: 'secondary', label: 'Secondary diploma (high school)', fswpPoints: 5, crsPoints: 30, crsFactor: 28 },
  { value: 'one_year_post_secondary', label: 'One-year post-secondary credential', fswpPoints: 15, crsPoints: 90, crsFactor: 84 },
  { value: 'two_year_post_secondary', label: 'Two-year post-secondary credential', fswpPoints: 19, crsPoints: 98, crsFactor: 91 },
  { value: 'three_year_post_secondary', label: "Bachelor's degree OR three+ year credential", fswpPoints: 21, crsPoints: 120, crsFactor: 112 },
  { value: 'two_credentials', label: 'Two or more post-secondary credentials (one 3+ years)', fswpPoints: 22, crsPoints: 128, crsFactor: 119 },
  { value: 'masters', label: "Master's degree", fswpPoints: 23, crsPoints: 135, crsFactor: 126 },
  { value: 'doctoral', label: 'Doctoral degree (PhD)', fswpPoints: 25, crsPoints: 150, crsFactor: 140 },
] as const;

// ── FSWP Age Points ──

export const FSWP_AGE_POINTS: Record<number, number> = {
  18: 0, 19: 0, 20: 0, 21: 0, 22: 0, 23: 0, 24: 0, 25: 0, 26: 0, 27: 0, 28: 0, 29: 0,
  // Actually: 18-35 = 12 points, then decreasing
};

// More precise FSWP age table
export function getFSWPAgePoints(age: number): number {
  if (age <= 17) return 0;
  if (age >= 18 && age <= 35) return 12;
  if (age === 36) return 11;
  if (age === 37) return 10;
  if (age === 38) return 9;
  if (age === 39) return 8;
  if (age === 40) return 7;
  if (age === 41) return 6;
  if (age === 42) return 5;
  if (age === 43) return 4;
  if (age === 44) return 3;
  if (age === 45) return 2;
  if (age === 46) return 1;
  return 0; // 47+
}

// ── CRS Age Points (with/without spouse) ──

export function getCRSAgePoints(age: number, withSpouse: boolean): number {
  const table: Record<number, [number, number]> = {
    // [withoutSpouse, withSpouse]
    17: [0, 0], 18: [99, 90], 19: [105, 95],
    20: [110, 100], 21: [110, 100], 22: [110, 100], 23: [110, 100],
    24: [110, 100], 25: [110, 100], 26: [110, 100], 27: [110, 100],
    28: [110, 100], 29: [110, 100], 30: [105, 95], 31: [99, 90],
    32: [94, 85], 33: [88, 80], 34: [83, 75], 35: [77, 70],
    36: [72, 65], 37: [66, 60], 38: [61, 55], 39: [55, 50],
    40: [50, 45], 41: [39, 35], 42: [28, 25], 43: [17, 15],
    44: [6, 5], 45: [0, 0],
  };
  if (age < 17) return 0;
  if (age > 45) return 0;
  const entry = table[age];
  return entry ? (withSpouse ? entry[1] : entry[0]) : 0;
}

// ── IELTS General Training → CLB Conversion ──

export interface CLBScores {
  speaking: number;
  listening: number;
  reading: number;
  writing: number;
}

/**
 * IELTS General Training band → CLB level.
 * Returns the CLB level for the given IELTS band score.
 */
export function ieltsToClb(band: number): number {
  if (band >= 8.5) return 10;
  if (band >= 8.0) return 10;
  if (band >= 7.5) return 10;
  if (band >= 7.0) return 9;
  if (band >= 6.5) return 8;
  if (band >= 6.0) return 7;
  if (band >= 5.5) return 6;
  if (band >= 5.0) return 5;
  if (band >= 4.0) return 4;
  return 3; // Below 4.0
}

/**
 * Per-skill IELTS → CLB conversion with skill-specific thresholds.
 * IRCC has different thresholds per skill.
 */
export function ieltsToClbPerSkill(scores: { speaking: number; listening: number; reading: number; writing: number }): CLBScores {
  // Speaking thresholds
  const speakingClb = ieltsToClbSpeaking(scores.speaking);
  const listeningClb = ieltsToClbListening(scores.listening);
  const readingClb = ieltsToClbReading(scores.reading);
  const writingClb = ieltsToClbWriting(scores.writing);

  return {
    speaking: speakingClb,
    listening: listeningClb,
    reading: readingClb,
    writing: writingClb,
  };
}

function ieltsToClbSpeaking(band: number): number {
  if (band >= 7.5) return 10;
  if (band >= 7.0) return 9;
  if (band >= 6.5) return 8;
  if (band >= 6.0) return 7;
  if (band >= 5.5) return 6;
  if (band >= 5.0) return 5;
  if (band >= 4.0) return 4;
  return 3;
}

function ieltsToClbListening(band: number): number {
  if (band >= 8.5) return 10;
  if (band >= 8.0) return 9;
  if (band >= 7.5) return 8;
  if (band >= 6.0) return 7;
  if (band >= 5.5) return 6;
  if (band >= 5.0) return 5;
  if (band >= 4.5) return 4;
  return 3;
}

function ieltsToClbReading(band: number): number {
  if (band >= 8.0) return 10;
  if (band >= 7.0) return 9;
  if (band >= 6.5) return 8;
  if (band >= 6.0) return 7;
  if (band >= 5.0) return 6;
  if (band >= 4.0) return 5;
  if (band >= 3.5) return 4;
  return 3;
}

function ieltsToClbWriting(band: number): number {
  if (band >= 7.5) return 10;
  if (band >= 7.0) return 9;
  if (band >= 6.5) return 8;
  if (band >= 6.0) return 7;
  if (band >= 5.5) return 6;
  if (band >= 5.0) return 5;
  if (band >= 4.0) return 4;
  return 3;
}

// ── CELPIP → CLB Conversion ──

export function celpipToClb(score: number): number {
  // CELPIP scores are 1:1 with CLB levels (CELPIP 7 = CLB 7, etc.)
  if (score >= 10) return 10;
  if (score >= 9) return 9;
  if (score >= 8) return 8;
  if (score >= 7) return 7;
  if (score >= 6) return 6;
  if (score >= 5) return 5;
  if (score >= 4) return 4;
  return 3;
}

export function celpipToClbPerSkill(scores: { speaking: number; listening: number; reading: number; writing: number }): CLBScores {
  return {
    speaking: celpipToClb(scores.speaking),
    listening: celpipToClb(scores.listening),
    reading: celpipToClb(scores.reading),
    writing: celpipToClb(scores.writing),
  };
}

// ── TEF → CLB Conversion ──

export function tefToClbPerSkill(scores: { speaking: number; listening: number; reading: number; writing: number }): CLBScores {
  return {
    speaking: tefSpeakingToClb(scores.speaking),
    listening: tefListeningToClb(scores.listening),
    reading: tefReadingToClb(scores.reading),
    writing: tefWritingToClb(scores.writing),
  };
}

function tefSpeakingToClb(score: number): number {
  if (score >= 393) return 10;
  if (score >= 371) return 9;
  if (score >= 349) return 8;
  if (score >= 310) return 7;
  if (score >= 271) return 6;
  if (score >= 226) return 5;
  if (score >= 181) return 4;
  return 3;
}

function tefListeningToClb(score: number): number {
  if (score >= 316) return 10;
  if (score >= 298) return 9;
  if (score >= 280) return 8;
  if (score >= 249) return 7;
  if (score >= 217) return 6;
  if (score >= 181) return 5;
  if (score >= 145) return 4;
  return 3;
}

function tefReadingToClb(score: number): number {
  if (score >= 263) return 10;
  if (score >= 248) return 9;
  if (score >= 233) return 8;
  if (score >= 207) return 7;
  if (score >= 181) return 6;
  if (score >= 151) return 5;
  if (score >= 121) return 4;
  return 3;
}

function tefWritingToClb(score: number): number {
  if (score >= 393) return 10;
  if (score >= 371) return 9;
  if (score >= 349) return 8;
  if (score >= 310) return 7;
  if (score >= 271) return 6;
  if (score >= 226) return 5;
  if (score >= 181) return 4;
  return 3;
}


// ── Generic CLB-to-test-score conversion ──

export function getClbScores(
  testType: string,
  scores: { speaking: number; listening: number; reading: number; writing: number }
): CLBScores {
  switch (testType) {
    case 'ielts_general':
      return ieltsToClbPerSkill(scores);
    case 'celpip':
      return celpipToClbPerSkill(scores);
    case 'tef':
    case 'tcf':
      return tefToClbPerSkill(scores);
    default:
      return { speaking: 0, listening: 0, reading: 0, writing: 0 };
  }
}

export function getMinClb(clbScores: CLBScores): number {
  return Math.min(clbScores.speaking, clbScores.listening, clbScores.reading, clbScores.writing);
}


// ── FSWP Language Points ──

/**
 * FSWP First Official Language points (max 24)
 * CLB 7 = 4 per ability, CLB 8 = 5, CLB 9+ = 6
 */
export function getFSWPLanguagePoints(clbScores: CLBScores): number {
  let total = 0;
  for (const skill of ['speaking', 'listening', 'reading', 'writing'] as const) {
    const clb = clbScores[skill];
    if (clb >= 9) total += 6;
    else if (clb >= 8) total += 5;
    else if (clb >= 7) total += 4;
    else total += 0;
  }
  return total; // max 24
}

/**
 * FSWP Second Official Language points (max 4)
 * CLB 5+ in all abilities = 4 points
 */
export function getFSWPSecondLanguagePoints(clbScores: CLBScores | null): number {
  if (!clbScores) return 0;
  const minClb = getMinClb(clbScores);
  return minClb >= 5 ? 4 : 0;
}


// ── FSWP Experience Points ──

export function getFSWPExperiencePoints(years: number): number {
  if (years >= 6) return 15;
  if (years >= 4) return 13;
  if (years >= 2) return 11;
  if (years >= 1) return 9;
  return 0;
}


// ── IRCC Proof of Funds Requirements (2026, updated annually) ──

export const PROOF_OF_FUNDS: Record<number, number> = {
  1: 14690,  // Single applicant
  2: 18288,
  3: 22483,
  4: 27297,
  5: 30690,
  6: 34606,
  7: 38522,  // 7+ family members — add $3,916 per additional
};

export function getRequiredFunds(familySize: number): number {
  if (familySize <= 0) return PROOF_OF_FUNDS[1];
  if (familySize >= 7) {
    return PROOF_OF_FUNDS[7] + (familySize - 7) * 3916;
  }
  return PROOF_OF_FUNDS[familySize] || PROOF_OF_FUNDS[1];
}


// ── TEER Categories ──

export const TEER_DEFINITIONS: Record<string, string> = {
  '0': 'Management occupations',
  '1': 'Professional occupations (usually require university degree)',
  '2': 'Technical occupations (usually require college diploma or apprenticeship)',
  '3': 'Intermediate occupations (usually require some post-secondary or on-the-job training)',
  '4': 'Entry-level occupations (usually require secondary school or short-term training)',
  '5': 'Labouring occupations (usually require minimal training)',
};

export function isTeerEligibleForCEC(teer: string | null): boolean {
  return teer !== null && ['0', '1', '2', '3'].includes(teer);
}


// ── Country List (for dropdowns) ──

export const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Argentina', 'Armenia', 'Australia',
  'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados',
  'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina',
  'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia',
  'Cameroon', 'Canada', 'Chad', 'Chile', 'China', 'Colombia', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Estonia', 'Ethiopia', 'Fiji', 'Finland',
  'France', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guatemala',
  'Guinea', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland',
  'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Jamaica',
  'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Laos',
  'Latvia', 'Lebanon', 'Libya', 'Lithuania', 'Luxembourg', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Mauritius', 'Mexico', 'Moldova', 'Mongolia', 'Morocco',
  'Mozambique', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua',
  'Niger', 'Nigeria', 'North Korea', 'Norway', 'Oman', 'Pakistan', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Somalia', 'South Africa',
  'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Trinidad and Tobago', 'Tunisia',
  'Turkey', 'Turkmenistan', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Venezuela',
  'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
] as const;


// ── Language Tests ──

export const LANGUAGE_TESTS = [
  { value: 'ielts_general', label: 'IELTS General Training', language: 'english' },
  { value: 'celpip', label: 'CELPIP-General', language: 'english' },
  { value: 'pte_core', label: 'PTE Core', language: 'english' },
  { value: 'tef', label: 'TEF Canada', language: 'french' },
  { value: 'tcf', label: 'TCF Canada', language: 'french' },
  { value: 'none', label: "I haven't taken a test yet", language: 'none' },
] as const;
