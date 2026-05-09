import { getCategoriesForNoc } from '../data/nocCategoryMap';
import {
  getLanguageAbilityPoints, calculateCRSScore, type CRSInputs
} from '../lib/crs-math';

export interface ImprovementScenario {
  id: string;
  title: string;
  description: string;
  pointsGained: number;
  effortLevel: 'low' | 'medium' | 'high';
  timeNeeded: string;
  cost: string;
  impact: 'low' | 'medium' | 'high';
  category: 'language' | 'education' | 'experience' | 'additional' | 'spouse' | 'urgency';
  applicable: boolean; // Whether this scenario applies to the user
  reason?: string; // Why it doesn't apply, if applicable is false
}

export interface SimulatorProfile {
  crsScore: number;
  age: number | null;
  hasSpouse: boolean;
  spouseAccompanying: boolean;
  minClb: number;
  hasSecondLanguage: boolean;
  secondLanguageMinClb: number;
  educationLevel: string | null;
  canadianExperienceYears: number;
  foreignExperienceYears: number;
  hasProvincialNomination: boolean;
  hasCanadianEducation: boolean;
  hasFrenchSkills: boolean;
  hasSiblingInCanada: boolean;
  spouseClbMin: number;
  spouseEducation: string | null;
  spouseCanadianYears: number;
}


/**
 * Generate ranked improvement scenarios.
 * Uses the "run twice" approach: exact CRS math with cloned inputs to find real points delta.
 * Returns only applicable scenarios, sorted by points gained (desc).
 */
export function getImprovementScenarios(profile: SimulatorProfile, crsInputs?: CRSInputs | null): ImprovementScenario[] {
  const scenarios: ImprovementScenario[] = [];
  const hasSpouse = profile.hasSpouse && profile.spouseAccompanying;

  // Helper: Calculate exact point difference if crsInputs is available, else fallback to estimate
  const getDelta = (modifier: (inputs: CRSInputs) => void, fallbackDelta: number): number => {
    if (!crsInputs) return fallbackDelta;
    const newInputs = { ...crsInputs };
    modifier(newInputs);
    const newScore = calculateCRSScore(newInputs).total;
    const oldScore = calculateCRSScore(crsInputs).total;
    return newScore - oldScore;
  };

  const calculateImpact = (pts: number): 'low' | 'medium' | 'high' => {
    if (pts < 0) return 'high'; // Warnings are high impact
    if (pts >= 30) return 'high';
    if (pts >= 15) return 'medium';
    return 'low';
  };

  // ── Language Improvements ──
  if (profile.minClb < 10) {
    const targetClb = Math.min(10, profile.minClb + 1);
    
    // Estimate fallback (just core + some transferability guess)
    const currentPerAbility = getLanguageAbilityPoints(profile.minClb, hasSpouse);
    const targetPerAbility = getLanguageAbilityPoints(targetClb, hasSpouse);
    const coreDelta = (targetPerAbility - currentPerAbility) * 4;
    let transferDelta = 0;
    if (profile.minClb < 7 && targetClb >= 7) transferDelta = 13;
    if (profile.minClb < 9 && targetClb >= 9) transferDelta = 25;

    const actualDelta = getDelta((inputs) => {
      // Improve lowest abilities to target
      inputs.clbReading = Math.max(inputs.clbReading, targetClb);
      inputs.clbWriting = Math.max(inputs.clbWriting, targetClb);
      inputs.clbListening = Math.max(inputs.clbListening, targetClb);
      inputs.clbSpeaking = Math.max(inputs.clbSpeaking, targetClb);
    }, coreDelta + transferDelta);

    scenarios.push({
      id: 'improve_clb',
      title: `Improve language test to CLB ${targetClb}+`,
      description: `Your lowest CLB is ${profile.minClb}. Improving to CLB ${targetClb} across all abilities adds ${actualDelta} total CRS points (including cross-factor bonuses).`,
      pointsGained: actualDelta,
      effortLevel: profile.minClb < 7 ? 'high' : 'medium',
      timeNeeded: '2-4 months (retake test)',
      cost: '~$350 CAD',
      impact: calculateImpact(actualDelta),
      category: 'language',
      applicable: true,
    });
  }

  // ── French / Second Language (Bug 6: merged when overlapping) ──
  if (!profile.hasFrenchSkills && !profile.hasSecondLanguage) {
    const actualDelta = getDelta((inputs) => {
      // Simulate adding French as a second language with CLB 7
      inputs.secondaryLangIsFrench = true;
      inputs.secondaryLangIsEnglish = false;
      inputs.clb2Reading = 7;
      inputs.clb2Writing = 7;
      inputs.clb2Listening = 7;
      inputs.clb2Speaking = 7;
    }, 62);

    scenarios.push({
      id: 'french_bonus',
      title: 'Learn French to NCLC 7+',
      description: 'With no second official language, learning French to NCLC 7+ adds both second-language core points AND French bonus points. French-language draws also have much lower cutoffs (~379).',
      pointsGained: actualDelta,
      effortLevel: 'high',
      timeNeeded: '6-12 months (B2 level study)',
      cost: '~$350 CAD + Tutoring',
      impact: calculateImpact(actualDelta),
      category: 'language',
      applicable: true,
    });
  } else if (!profile.hasFrenchSkills && profile.hasSecondLanguage) {
    const actualDelta = getDelta((inputs) => {
      // Assume they switch secondary language to French or swap
      if (inputs.primaryLangIsEnglish) {
        inputs.secondaryLangIsFrench = true;
        inputs.clb2Reading = 7;
        inputs.clb2Writing = 7;
        inputs.clb2Listening = 7;
        inputs.clb2Speaking = 7;
      } else {
        inputs.primaryLangIsFrench = true;
        inputs.clbReading = 7;
        inputs.clbWriting = 7;
        inputs.clbListening = 7;
        inputs.clbSpeaking = 7;
      }
    }, 50);

    scenarios.push({
      id: 'french_bonus',
      title: 'Learn French to NCLC 7+',
      description: 'Strong French skills (NCLC 7+ in all abilities) earn 25 bonus points. With English CLB 5+ as well, this becomes 50 bonus points. French-language draws also have much lower cutoffs (~379).',
      pointsGained: actualDelta,
      effortLevel: 'high',
      timeNeeded: '6-12 months (B2 level study)',
      cost: '~$350 CAD + Tutoring',
      impact: calculateImpact(actualDelta),
      category: 'language',
      applicable: true,
    });
  } else if (!profile.hasSecondLanguage) {
    const actualDelta = getDelta((inputs) => {
      // Add English as secondary language CLB 7
      inputs.secondaryLangIsEnglish = true;
      inputs.clb2Reading = 7;
      inputs.clb2Writing = 7;
      inputs.clb2Listening = 7;
      inputs.clb2Speaking = 7;
    }, 12);

    scenarios.push({
      id: 'add_second_language',
      title: 'Add an English language test (IELTS/CELPIP)',
      description: 'Adding a second official language at CLB 7+ can add up to 24 core points.',
      pointsGained: actualDelta,
      effortLevel: 'medium',
      timeNeeded: '3-6 months (study + test)',
      cost: '~$350 CAD',
      impact: calculateImpact(actualDelta),
      category: 'language',
      applicable: true,
    });
  }

  // ── Education Improvements (Bug 7: dynamic calculation) ──
  if (profile.educationLevel && !['masters', 'doctoral'].includes(profile.educationLevel)) {
    const actualDelta = getDelta((inputs) => {
      inputs.education = 'masters';
    }, 39); // 14 core + 25 transferability approx

    scenarios.push({
      id: 'higher_education',
      title: "Pursue a Master's degree",
      description: `A Master's degree adds ${actualDelta} points over your current ${profile.educationLevel} credential (including transferability bonuses with strong language and work experience).`,
      pointsGained: actualDelta,
      effortLevel: 'high',
      timeNeeded: '1-2 years',
      cost: '~$15,000+ CAD',
      impact: calculateImpact(actualDelta),
      category: 'education',
      applicable: true,
    });
  }

  if (!profile.hasCanadianEducation) {
    const actualDelta = getDelta((inputs) => {
      inputs.hasCanadianEducation = true;
      inputs.canadianEducationType = 'one-two';
    }, 15);

    scenarios.push({
      id: 'canadian_education',
      title: 'Complete a Canadian credential',
      description: 'A 1-2 year Canadian diploma adds 15 points. A 3+ year degree/diploma adds 30 points. Also helps with adaptability and Canadian work via co-op/PGWP.',
      pointsGained: actualDelta,
      effortLevel: 'high',
      timeNeeded: '1-2 years',
      cost: '~$15,000+ CAD',
      impact: calculateImpact(actualDelta),
      category: 'education',
      applicable: true,
    });
  }

  // ── Experience Improvements (Bug 8: dynamic calculation) ──
  if (profile.canadianExperienceYears < 3) {
    const nextYear = profile.canadianExperienceYears + 1;
    const actualDelta = getDelta((inputs) => {
      inputs.canadianWorkYears += 1;
    }, 11); // Fallback: just ~11 core points

    scenarios.push({
      id: 'more_canadian_exp',
      title: `Gain ${nextYear} year(s) of Canadian work experience`,
      description: `Going from ${profile.canadianExperienceYears} to ${nextYear} year(s) adds ${actualDelta} CRS points total. Canadian experience is one of the highest-value CRS factors due to cross-factor bonuses.`,
      pointsGained: actualDelta,
      effortLevel: 'medium',
      timeNeeded: '12 months (on a valid work permit)',
      cost: '$0 CAD',
      impact: calculateImpact(actualDelta),
      category: 'experience',
      applicable: true,
    });
  }

  // ── Additional Points ──
  if (!profile.hasProvincialNomination) {
    scenarios.push({
      id: 'provincial_nomination',
      title: 'Apply for a Provincial Nomination (PNP)',
      description: 'A provincial nomination adds 600 CRS points — virtually guaranteeing an ITA. Check if your NOC code and profile match any provincial stream. Ontario, BC, Alberta, and Saskatchewan have popular streams.',
      pointsGained: 600,
      effortLevel: 'high',
      timeNeeded: '1-6 months (varies by province)',
      cost: '~$1,500 CAD',
      impact: calculateImpact(600),
      category: 'additional',
      applicable: true,
    });
  }

  // Note: Job offer with LMIA was removed — IRCC eliminated CRS points
  // for job offers on March 25, 2025. No scenario to recommend.

  // ── Spouse Improvements ──
  if (profile.hasSpouse && profile.spouseAccompanying) {
    if (profile.spouseClbMin < 7) {
      const actualDelta = getDelta((inputs) => {
        inputs.spClbReading = Math.max(inputs.spClbReading, 7);
        inputs.spClbWriting = Math.max(inputs.spClbWriting, 7);
        inputs.spClbListening = Math.max(inputs.spClbListening, 7);
        inputs.spClbSpeaking = Math.max(inputs.spClbSpeaking, 7);
      }, profile.spouseClbMin < 5 ? 10 : 6);

      scenarios.push({
        id: 'spouse_language',
        title: "Improve spouse's language test to CLB 7+",
        description: `Your spouse's language scores can add up to 20 CRS points directly. Improving their scores to CLB 7+ will add exactly ${actualDelta} points to your score.`,
        pointsGained: actualDelta,
        effortLevel: 'medium',
        timeNeeded: '2-4 months',
        cost: '~$350 CAD',
        impact: calculateImpact(actualDelta),
        category: 'spouse',
        applicable: true,
      });
    }

    // New Strategy: Re-evaluate Accompanying Spouse Status
    const actualUnaccompanyingDelta = getDelta((inputs) => {
      inputs.hasSpouseForMath = false; // Calculate as a single applicant
    }, 0);

    if (actualUnaccompanyingDelta > 0) {
      scenarios.push({
        id: 'unaccompanying_spouse',
        title: "Re-evaluate Accompanying Spouse Status",
        description: `Given your spouse's current profile, a strategic option is to declare your spouse as 'non-accompanying'. This allows you to be assessed under the single applicant grid, potentially increasing your score by ${actualUnaccompanyingDelta} points. They would need to apply separately for immigration later.`,
        pointsGained: actualUnaccompanyingDelta,
        effortLevel: 'low',
        timeNeeded: 'Immediate',
        cost: '$0 CAD',
        impact: calculateImpact(actualUnaccompanyingDelta),
        category: 'spouse',
        applicable: true,
      });
    }
  } // Close Spouse Improvements block
  // Note: Spouse ECA scenario removed per user feedback (assumed evaluated if user inputs it)


  // ── Urgency Warning: Age ──
  if (profile.age !== null && profile.age >= 29 && profile.age <= 44) {
    const actualDelta = getDelta((inputs) => {
      inputs.age += 1;
    }, -5);

    if (actualDelta < 0) {
      scenarios.push({
        id: 'age_urgency',
        title: `Warning: You will lose points when you turn ${profile.age + 1}`,
        description: `Your score will drop by ${Math.abs(actualDelta)} CRS points on your next birthday. ${profile.age >= 40 ? 'Age points drop sharply after 40 — act urgently.' : 'Try to secure an ITA before your birthday to prevent this drop.'}`,
        pointsGained: actualDelta, // Keep negative so the UI can flag it as a warning
        effortLevel: 'high',
        timeNeeded: 'Immediate',
        cost: '$0 CAD',
        impact: calculateImpact(actualDelta),
        category: 'urgency',
        applicable: true,
      });
    }
  }

  // Sort by effort level (lowest first), then by points gained (highest first)
  const effortOrder = { low: 0, medium: 1, high: 2 };
  scenarios.sort((a, b) => {
    // 1. Sort by effort
    const effortDiff = effortOrder[a.effortLevel] - effortOrder[b.effortLevel];
    if (effortDiff !== 0) return effortDiff;

    // 2. Sort by points gained
    // If one is negative and the other is positive, put positive first
    if (a.pointsGained > 0 && b.pointsGained < 0) return -1;
    if (a.pointsGained < 0 && b.pointsGained > 0) return 1;
    
    // Within same sign, sort by absolute magnitude
    return Math.abs(b.pointsGained) - Math.abs(a.pointsGained);
  });

  return scenarios.filter(s => s.applicable);
}

/**
 * Calculate how many of the last N draws the user would have been invited in.
 */
export function getInvitationAnalysis(
  userScore: number,
  draws: Array<{ crsScore: number; drawType: string; date: string }>,
  drawType: string = 'General',
  lastN: number = 12
): {
  invited: number;
  total: number;
  percentage: number;
  lowestCutoff: number;
  highestCutoff: number;
  avgCutoff: number;
} {
  const relevantDraws = draws
    .filter(d => d.drawType === drawType || drawType === 'all')
    .slice(0, lastN);

  if (relevantDraws.length === 0) {
    return { invited: 0, total: 0, percentage: 0, lowestCutoff: 0, highestCutoff: 0, avgCutoff: 0 };
  }

  const invited = relevantDraws.filter(d => userScore >= d.crsScore).length;
  const cutoffs = relevantDraws.map(d => d.crsScore);

  return {
    invited,
    total: relevantDraws.length,
    percentage: Math.round((invited / relevantDraws.length) * 100),
    lowestCutoff: Math.min(...cutoffs),
    highestCutoff: Math.max(...cutoffs),
    avgCutoff: Math.round(cutoffs.reduce((a, b) => a + b, 0) / cutoffs.length),
  };
}

export type EligibilityStatus = 'eligible' | 'ineligible' | 'unknown';

export interface DrawEligibilityResult {
  status: EligibilityStatus;
  reason?: string;
}

/**
 * Validates if the user meets the official IRCC baseline requirements for a specific draw type.
 *
 * Returns one of three states:
 * - 'eligible'   → user clearly meets the baseline requirements
 * - 'ineligible' → user clearly does NOT meet a requirement we can verify
 * - 'unknown'    → we lack data (e.g. no NOC code) to determine eligibility
 */
export function checkDrawEligibility(
  drawType: string,
  profile: SimulatorProfile,
  nocCode: string | null
): DrawEligibilityResult {
  if (drawType === 'all' || drawType === 'General') {
    return { status: 'eligible' };
  }

  if (drawType === 'CEC') {
    if (profile.canadianExperienceYears >= 1) {
      return { status: 'eligible' };
    }
    return {
      status: 'ineligible',
      reason: `You entered ${profile.canadianExperienceYears} year(s) of Canadian experience. CEC draws require at least 1 year.`,
    };
  }

  if (drawType === 'PNP') {
    if (profile.hasProvincialNomination) {
      return { status: 'eligible' };
    }
    return {
      status: 'ineligible',
      reason: 'You indicated you don\'t have a Provincial Nomination. PNP draws require one.',
    };
  }

  if (drawType === 'French') {
    if (profile.hasFrenchSkills) {
      return { status: 'eligible' };
    }
    return {
      status: 'ineligible',
      reason: 'You didn\'t indicate French proficiency. French draws require NCLC 7+ in all four skills.',
    };
  }

  // Category-based draws (STEM, Healthcare, Trades, Transport, Agriculture)
  const CATEGORY_DRAWS = ['Healthcare', 'STEM', 'Trades', 'Transport', 'Agriculture'];

  if (CATEGORY_DRAWS.includes(drawType)) {
    if (!nocCode) {
      // No NOC data available — we can't determine eligibility
      return {
        status: 'unknown',
        reason: `Eligibility depends on your occupation (NOC). Use the NOC Finder to check.`,
      };
    }

    const fromNocCategories = getCategoriesForNoc(nocCode);
    if (fromNocCategories.includes(drawType as any)) {
      const totalExp = profile.canadianExperienceYears + profile.foreignExperienceYears;
      if (totalExp >= 0.5) {
        return { status: 'eligible' };
      }
      return { status: 'ineligible', reason: `You have less than 6 months of work experience. ${drawType} draws require at least 6 months in a targeted NOC.` };
    }
    return { status: 'ineligible', reason: `Your NOC (${nocCode}) is not in the ${drawType} category. Only specific occupations qualify.` };
  }

  // Fallback for other draw types (e.g. Senior Managers, Physicians)
  if (!nocCode) {
    return {
      status: 'unknown',
      reason: `Eligibility for ${drawType} draws depends on your occupation (NOC). Use the NOC Finder to check.`,
    };
  }

  const fromNocCategories = getCategoriesForNoc(nocCode);
  if (fromNocCategories.includes(drawType as any)) {
    return { status: 'eligible' };
  }

  return { 
    status: 'ineligible', 
    reason: `Your NOC (${nocCode}) is not eligible for ${drawType} draws. These targeted draws require work experience in specific eligible occupations.` 
  };
}
